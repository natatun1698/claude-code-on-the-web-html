#!/usr/bin/env python3
"""
西脇資哲さんの無料講演情報を自動収集するスクリプト
"""

import json
import re
import time
import logging
import hashlib
from datetime import datetime, date
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

CACHE_FILE = Path("events_cache.json")
OUTPUT_FILE = Path("events.json")
OUTPUT_HTML = Path("index.html")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en;q=0.9",
}

REQUEST_TIMEOUT = 15

# 西脇資哲さんに関連するキーワード
SPEAKER_KEYWORDS = [
    "西脇資哲", "西脇 資哲", "Nishiwaki Motohiro", "nishiwaki",
    "motohiro nishiwaki",
]

FREE_KEYWORDS = ["無料", "参加費無料", "入場無料", "参加無料", "free", "無償"]

PAID_KEYWORDS = [
    "有料", "参加費", "円", "¥", "\\d+,\\d+円", "チケット代",
]

# スクレイピング対象サイト
# (label, url, search_paths)
TARGET_SITES: list[tuple[str, str, list[str]]] = [
    (
        "Peatix",
        "https://peatix.com",
        ["/search?q=西脇資哲"],
    ),
    (
        "connpass",
        "https://connpass.com",
        ["/search/?q=西脇資哲"],
    ),
    (
        "EventBank",
        "https://www.eventbank.jp",
        ["/search/?q=西脇資哲"],
    ),
    (
        "Doorkeeper",
        "https://www.doorkeeper.jp",
        ["/events?query=西脇資哲"],
    ),
    (
        "イベントレジスト",
        "https://eventregist.com",
        ["/p/search?q=西脇資哲"],
    ),
    (
        "Microsoft Events",
        "https://www.microsoft.com",
        ["/ja-jp/events/"],
    ),
    (
        "西脇資哲 個人サイト",
        "https://www.motohironishiwaki.com",
        ["/"],
    ),
]

# X(Twitter) のユーザー名
TWITTER_USERNAME = "torumich"

# --------------------------------------------------------------------------- #
# Data model                                                                   #
# --------------------------------------------------------------------------- #

@dataclass
class Event:
    title: str
    organizer: str
    event_date: Optional[str]          # ISO 8601 or partial (YYYY-MM-DD)
    event_date_raw: str                 # original text
    location: Optional[str]
    is_free: Optional[bool]
    fee_raw: str
    registration_url: Optional[str]
    registration_deadline: Optional[str]
    source_url: str
    source_label: str
    fetched_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def uid(self) -> str:
        key = f"{self.title}|{self.source_url}|{self.event_date_raw}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def is_future(self) -> bool:
        if not self.event_date:
            return True  # unknown date → keep
        try:
            d = date.fromisoformat(self.event_date[:10])
            return d >= date.today()
        except ValueError:
            return True


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

def get(url: str, **kwargs) -> Optional[requests.Response]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT, **kwargs)
        r.raise_for_status()
        return r
    except requests.RequestException as e:
        log.warning("GET %s → %s", url, e)
        return None


def soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def text_contains_speaker(text: str) -> bool:
    low = text.lower()
    return any(k.lower() in low for k in SPEAKER_KEYWORDS)


def detect_free(text: str) -> Optional[bool]:
    low = text.lower()
    if any(k.lower() in low for k in FREE_KEYWORDS):
        return True
    if any(re.search(k, text) for k in PAID_KEYWORDS):
        return False
    return None


def parse_date(text: str) -> Optional[str]:
    """Try to extract ISO date from arbitrary Japanese text."""
    patterns = [
        r"(\d{4})[年\-/.](\d{1,2})[月\-/.](\d{1,2})日?",
        r"(\d{4})/(\d{1,2})/(\d{1,2})",
        r"(\d{4})-(\d{2})-(\d{2})",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            y, mo, d = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
            try:
                date.fromisoformat(f"{y}-{mo}-{d}")
                return f"{y}-{mo}-{d}"
            except ValueError:
                continue
    return None


# --------------------------------------------------------------------------- #
# Generic event-page scraper                                                   #
# --------------------------------------------------------------------------- #

def scrape_generic(label: str, base_url: str, path: str) -> list[Event]:
    url = urljoin(base_url, path)
    log.info("Fetching %s ...", url)
    resp = get(url)
    if not resp:
        return []

    bs = soup(resp.text)
    events: list[Event] = []

    # Heuristic: look for article / li / div blocks that mention the speaker
    candidates = bs.find_all(
        ["article", "li", "div", "section"],
        class_=re.compile(r"event|card|item|result|listing", re.I),
    )
    if not candidates:
        candidates = bs.find_all(["article", "li"])

    for block in candidates:
        text = block.get_text(" ", strip=True)
        if not text_contains_speaker(text):
            continue

        title_tag = block.find(["h1", "h2", "h3", "h4", "a"])
        title = title_tag.get_text(strip=True) if title_tag else text[:80]

        link_tag = block.find("a", href=True)
        event_url = url
        source_url = url
        if link_tag:
            href = link_tag["href"]
            event_url = urljoin(base_url, href) if not href.startswith("http") else href

        date_raw = ""
        date_iso = None
        for tag in block.find_all(string=re.compile(r"\d{4}[年\-/]\d{1,2}")):
            date_raw = tag.strip()
            date_iso = parse_date(date_raw)
            if date_iso:
                break

        is_free = detect_free(text)
        fee_raw = ""
        for m in re.finditer(r"(無料|有料|参加費[^\s。、]{0,30}|[\d,]+\s*円)", text):
            fee_raw = m.group()
            break

        location = None
        for m in re.finditer(r"(会場|場所|開催地)[：:]\s*([^\s、。\n]{2,30})", text):
            location = m.group(2)
            break

        ev = Event(
            title=title,
            organizer=label,
            event_date=date_iso,
            event_date_raw=date_raw,
            location=location,
            is_free=is_free,
            fee_raw=fee_raw,
            registration_url=event_url,
            registration_deadline=None,
            source_url=source_url,
            source_label=label,
        )
        if ev not in events:
            events.append(ev)

    log.info("  → %d candidate(s) found on %s", len(events), label)
    return events


# --------------------------------------------------------------------------- #
# Connpass dedicated scraper                                                   #
# --------------------------------------------------------------------------- #

def scrape_connpass() -> list[Event]:
    url = "https://connpass.com/search/?q=西脇資哲&order=2"
    log.info("Fetching connpass ...")
    resp = get(url)
    if not resp:
        return []

    bs = soup(resp.text)
    events: list[Event] = []

    for item in bs.select("div.event_list .event_item, ul.event_list li"):
        text = item.get_text(" ", strip=True)
        if not text_contains_speaker(text):
            continue

        title_tag = item.select_one("p.event_title a, .title a, a.event_title")
        title = title_tag.get_text(strip=True) if title_tag else text[:80]
        href = title_tag["href"] if title_tag and title_tag.get("href") else url

        date_tag = item.select_one("time, .date, .event_date")
        date_raw = date_tag.get_text(strip=True) if date_tag else ""
        date_iso = parse_date(date_raw)

        fee_tag = item.select_one(".fee, .participation_fee, .price")
        fee_raw = fee_tag.get_text(strip=True) if fee_tag else ""
        is_free = detect_free(fee_raw or text)

        place_tag = item.select_one(".address, .place, .venue")
        location = place_tag.get_text(strip=True) if place_tag else None

        events.append(Event(
            title=title,
            organizer="connpass",
            event_date=date_iso,
            event_date_raw=date_raw,
            location=location,
            is_free=is_free,
            fee_raw=fee_raw,
            registration_url=href,
            registration_deadline=None,
            source_url=url,
            source_label="connpass",
        ))

    log.info("  → %d connpass event(s)", len(events))
    return events


# --------------------------------------------------------------------------- #
# Peatix dedicated scraper                                                     #
# --------------------------------------------------------------------------- #

def scrape_peatix() -> list[Event]:
    url = "https://peatix.com/search?q=西脇資哲&l.country=JP"
    log.info("Fetching Peatix ...")
    resp = get(url)
    if not resp:
        return []

    bs = soup(resp.text)
    events: list[Event] = []

    for item in bs.select("li.event-item, div[data-event-id]"):
        text = item.get_text(" ", strip=True)
        if not text_contains_speaker(text):
            continue

        title_tag = item.select_one("a.event-item-title, h3 a, .title a")
        title = title_tag.get_text(strip=True) if title_tag else text[:80]
        href = title_tag["href"] if title_tag and title_tag.get("href") else url
        if href.startswith("/"):
            href = "https://peatix.com" + href

        date_tag = item.select_one("time, .event-date, .date")
        date_raw = date_tag.get_text(strip=True) if date_tag else ""
        date_iso = parse_date(date_raw)

        fee_tag = item.select_one(".price, .ticket-price, .fee")
        fee_raw = fee_tag.get_text(strip=True) if fee_tag else ""
        is_free = detect_free(fee_raw or text)

        events.append(Event(
            title=title,
            organizer="Peatix",
            event_date=date_iso,
            event_date_raw=date_raw,
            location=None,
            is_free=is_free,
            fee_raw=fee_raw,
            registration_url=href,
            registration_deadline=None,
            source_url=url,
            source_label="Peatix",
        ))

    log.info("  → %d Peatix event(s)", len(events))
    return events


# --------------------------------------------------------------------------- #
# Nitter (X/Twitter proxy) scraper                                             #
# --------------------------------------------------------------------------- #

NITTER_INSTANCES = [
    "https://nitter.privacydev.net",
    "https://nitter.poast.org",
    "https://nitter.1d4.us",
]

def scrape_twitter() -> list[Event]:
    """
    X(Twitter) @torumich のタイムラインから講演関連ツイートを収集する。
    公開 Nitter インスタンスを使用（API 不要）。
    """
    events: list[Event] = []
    html = None

    for instance in NITTER_INSTANCES:
        url = f"{instance}/{TWITTER_USERNAME}"
        log.info("Trying Nitter: %s", url)
        resp = get(url)
        if resp and resp.status_code == 200 and "timeline" in resp.text.lower():
            html = resp.text
            break
        time.sleep(1)

    if not html:
        log.warning("Nitter unavailable; skipping Twitter scrape")
        return []

    bs = soup(html)
    for tweet_div in bs.select(".timeline-item, .tweet-content"):
        text = tweet_div.get_text(" ", strip=True)
        if not any(k in text for k in ["講演", "セミナー", "登壇", "スピーカー", "イベント"]):
            continue

        is_free = detect_free(text)
        date_raw = ""
        date_iso = None
        for tag in tweet_div.select("span.tweet-date a, time"):
            raw = tag.get("title") or tag.get_text(strip=True)
            date_raw = raw
            date_iso = parse_date(raw)
            break

        # extract URL from tweet
        reg_url = None
        for a in tweet_div.select("a[href]"):
            href = a["href"]
            if re.search(r"(peatix|connpass|eventregist|doorkeeper|forms\.gle)", href):
                reg_url = href
                break

        events.append(Event(
            title=text[:100],
            organizer="X (@torumich)",
            event_date=date_iso,
            event_date_raw=date_raw,
            location=None,
            is_free=is_free,
            fee_raw="",
            registration_url=reg_url,
            registration_deadline=None,
            source_url=f"https://x.com/{TWITTER_USERNAME}",
            source_label="X (Twitter)",
        ))

    log.info("  → %d tweet-derived event(s)", len(events))
    return events


# --------------------------------------------------------------------------- #
# Aggregate & filter                                                           #
# --------------------------------------------------------------------------- #

def collect_all() -> list[Event]:
    events: list[Event] = []
    events += scrape_connpass()
    events += scrape_peatix()
    events += scrape_twitter()

    for label, base, paths in TARGET_SITES:
        if label in ("connpass", "Peatix"):
            continue
        for path in paths:
            events += scrape_generic(label, base, path)
            time.sleep(0.5)

    # dedup by uid
    seen: set[str] = set()
    unique: list[Event] = []
    for ev in events:
        if ev.uid not in seen:
            seen.add(ev.uid)
            unique.append(ev)

    # filter: free only, future only
    filtered = [
        ev for ev in unique
        if ev.is_free is not False and ev.is_future()
    ]

    # sort: unknown date last, nearest first
    def sort_key(ev: Event):
        if ev.event_date:
            return ev.event_date
        return "9999-12-31"

    filtered.sort(key=sort_key)
    return filtered


# --------------------------------------------------------------------------- #
# Output                                                                       #
# --------------------------------------------------------------------------- #

def save_json(events: list[Event]) -> None:
    data = {
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "count": len(events),
        "events": [asdict(ev) for ev in events],
    }
    OUTPUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("Saved %d event(s) → %s", len(events), OUTPUT_FILE)


def render_html(events: list[Event]) -> None:
    today_str = date.today().strftime("%Y年%m月%d日")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    rows = ""
    for ev in events:
        date_disp = ev.event_date or ev.event_date_raw or "未定"
        fee_disp = "無料" if ev.is_free else (ev.fee_raw or "不明")
        loc_disp = ev.location or "—"
        reg_disp = (
            f'<a href="{ev.registration_url}" target="_blank" rel="noopener">申込む</a>'
            if ev.registration_url
            else "—"
        )
        deadline_disp = ev.registration_deadline or "—"
        rows += f"""
        <tr>
          <td>{date_disp}</td>
          <td>{ev.title}</td>
          <td>{loc_disp}</td>
          <td class="free">{fee_disp}</td>
          <td>{deadline_disp}</td>
          <td>{reg_disp}</td>
          <td><small>{ev.source_label}</small></td>
        </tr>"""

    if not rows:
        rows = '<tr><td colspan="7" class="empty">現在、該当する無料講演情報はありません。</td></tr>'

    html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>西脇資哲さん 無料講演情報</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Hiragino Sans', 'Meiryo', sans-serif;
      background: #f4f7fb;
      color: #222;
      padding: 24px;
    }}
    h1 {{ font-size: 1.5rem; margin-bottom: 4px; }}
    .subtitle {{ color: #555; font-size: 0.9rem; margin-bottom: 20px; }}
    .updated {{ font-size: 0.8rem; color: #888; margin-bottom: 16px; }}
    table {{
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,.1);
    }}
    th {{
      background: #1a73e8;
      color: #fff;
      text-align: left;
      padding: 10px 12px;
      font-size: 0.85rem;
    }}
    td {{
      padding: 10px 12px;
      border-bottom: 1px solid #eee;
      font-size: 0.875rem;
      vertical-align: top;
    }}
    tr:last-child td {{ border-bottom: none; }}
    tr:hover td {{ background: #f0f7ff; }}
    .free {{ color: #1a8a2e; font-weight: bold; }}
    td a {{
      color: #1a73e8;
      text-decoration: none;
    }}
    td a:hover {{ text-decoration: underline; }}
    .empty {{ text-align: center; padding: 40px; color: #888; }}
    .badge {{
      display: inline-block;
      background: #e8f4e8;
      color: #1a8a2e;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
    }}
    @media (max-width: 768px) {{
      body {{ padding: 12px; }}
      th, td {{ padding: 8px; font-size: 0.8rem; }}
    }}
  </style>
</head>
<body>
  <h1>🎤 西脇資哲さん 無料講演情報</h1>
  <p class="subtitle">自動収集 — 無料・今後の開催のみ表示 / 開催日順</p>
  <p class="updated">最終更新: {now_str} JST &nbsp;|&nbsp; 本日: {today_str} &nbsp;|&nbsp; 件数: {len(events)} 件</p>
  <table>
    <thead>
      <tr>
        <th>開催日</th>
        <th>タイトル</th>
        <th>場所</th>
        <th>参加費</th>
        <th>申込期限</th>
        <th>申込</th>
        <th>情報源</th>
      </tr>
    </thead>
    <tbody>{rows}
    </tbody>
  </table>
  <p style="margin-top:12px;font-size:0.75rem;color:#aaa;">
    ※ 本ページはスクリプトによる自動収集です。最新情報は各情報源でご確認ください。
  </p>
</body>
</html>"""

    OUTPUT_HTML.write_text(html, encoding="utf-8")
    log.info("Rendered HTML → %s", OUTPUT_HTML)


# --------------------------------------------------------------------------- #
# Cache / incremental update                                                   #
# --------------------------------------------------------------------------- #

def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {}


def save_cache(events: list[Event]) -> None:
    cache = {ev.uid: asdict(ev) for ev in events}
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def merge_with_cache(new_events: list[Event], cache: dict) -> list[Event]:
    merged: dict[str, Event] = {}
    for uid, ev_dict in cache.items():
        ev = Event(**ev_dict)
        if ev.is_future():
            merged[uid] = ev

    for ev in new_events:
        merged[ev.uid] = ev  # overwrite with fresh data

    result = list(merged.values())
    result.sort(key=lambda e: e.event_date or "9999-12-31")
    return [e for e in result if e.is_free is not False]


# --------------------------------------------------------------------------- #
# Main                                                                         #
# --------------------------------------------------------------------------- #

def run_once() -> None:
    log.info("=== 西脇資哲さん 講演情報収集 開始 ===")
    cache = load_cache()
    new_events = collect_all()
    events = merge_with_cache(new_events, cache)
    save_cache(events)
    save_json(events)
    render_html(events)
    log.info("=== 完了: %d 件の無料講演情報 ===", len(events))
    return events


def run_scheduled(interval_hours: float = 24) -> None:
    import schedule

    log.info("スケジューラ起動: %g 時間ごとに更新", interval_hours)
    run_once()

    schedule.every(interval_hours).hours.do(run_once)

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    import sys

    if "--daemon" in sys.argv or "--schedule" in sys.argv:
        try:
            idx = sys.argv.index("--interval")
            hours = float(sys.argv[idx + 1])
        except (ValueError, IndexError):
            hours = 24.0
        run_scheduled(hours)
    else:
        run_once()
