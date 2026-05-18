#!/usr/bin/env python3
"""
西脇資哲さんの無料講演情報を自動収集するスクリプト

収集先:
  - connpass API (公式 REST API)
  - Doorkeeper API (公式 REST API)
  - TECH PLAY RSS フィード
  - Google カスタム検索 API (オプション)

出力: 日時順ソート済みテーブル + Gmail 送信
"""

import re
import smtplib
import json
import os
import time
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, date, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dataclasses import dataclass, asdict
from typing import Optional

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("scraper.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ---- 設定 ----------------------------------------------------------------

RECIPIENT_EMAIL = "shimadzu.umetsu@gmail.com"
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "")
SENDER_PASSWORD = os.environ.get("SENDER_PASSWORD", "")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))

# Google Custom Search API (省略可 — 設定すると検索精度が上がる)
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GOOGLE_CSE_ID = os.environ.get("GOOGLE_CSE_ID", "")

CACHE_FILE = "lectures_cache.json"
REQUEST_TIMEOUT = 20
REQUEST_DELAY = 1.5

NISHIWAKI_KEYWORDS = ["西脇資哲", "西脇 資哲", "ntwilightzone"]
FREE_KEYWORDS = ["無料", "free", "参加費無料", "入場無料", "参加無料"]
PAID_KEYWORDS = ["有料", "参加費", "円", "¥", "チケット購入"]

HEADERS = {
    "User-Agent": "NishiwakiLectureScraper/1.0 (educational; contact: shimadzu.umetsu@gmail.com)",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "ja,en-US;q=0.9",
}


# ---- データ構造 ----------------------------------------------------------

@dataclass
class Lecture:
    title: str
    date_str: str
    date_obj: Optional[date]
    location: str
    is_free: bool
    registration_url: str
    registration_deadline: Optional[str]
    source: str
    description: str = ""

    def days_until(self) -> Optional[int]:
        if self.date_obj:
            return (self.date_obj - date.today()).days
        return None

    def deadline_days(self) -> Optional[int]:
        if not self.registration_deadline:
            return None
        parsed = parse_date(self.registration_deadline)
        return (parsed - date.today()).days if parsed else None


# ---- 日付パーサー --------------------------------------------------------

DATE_PATTERNS = [
    r"(\d{4})[年/\-\.](\d{1,2})[月/\-\.](\d{1,2})[日]?",
    r"(\d{4})/(\d{1,2})/(\d{1,2})",
    r"(\d{4})-(\d{2})-(\d{2})",
]


def parse_date(text: str) -> Optional[date]:
    if not text:
        return None
    for pattern in DATE_PATTERNS:
        m = re.search(pattern, str(text))
        if m:
            try:
                return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except ValueError:
                continue
    # ISO 8601 (e.g. "2026-06-15T09:00:00+09:00")
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", str(text))
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    return None


def is_future(d: Optional[date]) -> bool:
    return d is None or d >= date.today()


# ---- HTTP ヘルパー -------------------------------------------------------

def fetch_json(url: str, params: dict = None, retries: int = 3) -> Optional[dict | list]:
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except requests.HTTPError as e:
            logger.warning(f"HTTP {e.response.status_code} for {url}")
            return None
        except requests.RequestException as e:
            wait = 2 ** attempt
            logger.warning(f"Fetch failed ({url}): {e} — retry in {wait}s")
            time.sleep(wait)
    logger.error(f"All retries failed: {url}")
    return None


def fetch_text(url: str, retries: int = 3) -> Optional[str]:
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding
            return resp.text
        except requests.HTTPError as e:
            logger.warning(f"HTTP {e.response.status_code} for {url}")
            return None
        except requests.RequestException as e:
            wait = 2 ** attempt
            logger.warning(f"Fetch failed ({url}): {e} — retry in {wait}s")
            time.sleep(wait)
    return None


# ---- ユーティリティ ------------------------------------------------------

def contains_nishiwaki(text: str) -> bool:
    t = text.lower()
    return any(kw.lower() in t for kw in NISHIWAKI_KEYWORDS)


def detect_free(text: str) -> bool:
    t = text.lower()
    if any(kw in t for kw in FREE_KEYWORDS):
        return True
    if any(kw in t for kw in PAID_KEYWORDS):
        return False
    return False  # 不明は有料扱いでフィルター


def truncate(s: str, n: int) -> str:
    return s[:n] + "…" if len(s) > n else s


# ---- connpass API --------------------------------------------------------

CONNPASS_API = "https://connpass.com/api/v1/event/"


def scrape_connpass() -> list[Lecture]:
    """connpass 公式 REST API を利用（ブロックなし）"""
    lectures = []
    for keyword in ["西脇資哲", "ntwilightzone"]:
        params = {
            "keyword": keyword,
            "order": 2,       # 開催日順
            "count": 100,
        }
        data = fetch_json(CONNPASS_API, params=params)
        if not data:
            continue
        events = data.get("events", [])
        logger.info(f"  connpass '{keyword}': {len(events)} 件")

        for ev in events:
            title = ev.get("title", "")
            full_text = title + " " + ev.get("description", "") + " " + ev.get("catch", "")

            date_str = ev.get("started_at", "")[:10]
            date_obj = parse_date(date_str)

            # 参加費
            fee_text = str(ev.get("fee", 0))
            is_free = ev.get("fee", 0) == 0 or detect_free(full_text)

            location = ev.get("address", "") or ev.get("place", "") or "オンライン"
            url = ev.get("event_url", "")
            deadline = ev.get("limit", None)

            lectures.append(Lecture(
                title=title,
                date_str=date_str,
                date_obj=date_obj,
                location=location,
                is_free=is_free,
                registration_url=url,
                registration_deadline=None,
                source="connpass",
                description=ev.get("catch", ""),
            ))
        time.sleep(REQUEST_DELAY)
    return lectures


# ---- Doorkeeper API ------------------------------------------------------

DOORKEEPER_API = "https://api.doorkeeper.jp/events"


def scrape_doorkeeper() -> list[Lecture]:
    """Doorkeeper 公式 API"""
    lectures = []
    params = {
        "q": "西脇資哲",
        "locale": "ja",
    }
    data = fetch_json(DOORKEEPER_API, params=params)
    if not data:
        return lectures

    events = data if isinstance(data, list) else data.get("events", [])
    logger.info(f"  Doorkeeper: {len(events)} 件")

    for item in events:
        ev = item.get("event", item)
        title = ev.get("title", "")
        full_text = title + " " + ev.get("description", "")
        if not contains_nishiwaki(full_text):
            continue

        date_str = ev.get("starts_at", "")[:10]
        date_obj = parse_date(date_str)

        is_free = ev.get("free", False) or detect_free(full_text)
        location = ev.get("venue_name", "") or ev.get("address", "") or "未定"
        url = ev.get("public_url", "")

        lectures.append(Lecture(
            title=title,
            date_str=date_str,
            date_obj=date_obj,
            location=location,
            is_free=is_free,
            registration_url=url,
            registration_deadline=None,
            source="Doorkeeper",
        ))
    return lectures


# ---- TECH PLAY RSS -------------------------------------------------------

TECHPLAY_RSS = "https://techplay.jp/search/event/feed?keyword=%E8%A5%BF%E8%84%87%E8%B3%87%E5%93%B2"


def scrape_techplay_rss() -> list[Lecture]:
    """TECH PLAY の検索 RSS フィードを取得"""
    lectures = []
    xml_text = fetch_text(TECHPLAY_RSS)
    if not xml_text:
        return lectures

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.warning(f"TECH PLAY RSS パースエラー: {e}")
        return lectures

    ns = {"content": "http://purl.org/rss/1.0/modules/content/"}
    items = root.findall(".//item")
    logger.info(f"  TECH PLAY RSS: {len(items)} 件")

    for item in items:
        title = item.findtext("title", "").strip()
        link = item.findtext("link", "").strip()
        desc = item.findtext("description", "").strip()
        pub_date = item.findtext("pubDate", "").strip()

        full_text = title + " " + desc
        if not contains_nishiwaki(full_text):
            continue

        date_obj = parse_date(pub_date) or parse_date(desc[:100])
        date_str = str(date_obj) if date_obj else pub_date[:10]
        is_free = detect_free(full_text)

        # 場所: descriptionから抽出を試みる
        loc_m = re.search(r"開催場所[：:]\s*([^\n<]{1,30})", desc)
        location = loc_m.group(1).strip() if loc_m else "詳細を確認"

        lectures.append(Lecture(
            title=title,
            date_str=date_str,
            date_obj=date_obj,
            location=location,
            is_free=is_free,
            registration_url=link,
            registration_deadline=None,
            source="TECH PLAY",
        ))
    return lectures


# ---- Google Custom Search API (オプション) ------------------------------

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"


def scrape_google_cse() -> list[Lecture]:
    """Google カスタム検索 API で西脇さんの講演情報ページを発見する"""
    if not GOOGLE_API_KEY or not GOOGLE_CSE_ID:
        logger.info("  Google CSE: スキップ（API キー未設定）")
        return []

    lectures = []
    queries = [
        "西脇資哲 無料 講演 申込",
        "西脇資哲 セミナー 無料 2026",
    ]
    for q in queries:
        params = {
            "key": GOOGLE_API_KEY,
            "cx": GOOGLE_CSE_ID,
            "q": q,
            "num": 10,
            "dateRestrict": "m6",  # 直近6ヶ月
        }
        data = fetch_json(GOOGLE_CSE_URL, params=params)
        if not data:
            continue
        items = data.get("items", [])
        logger.info(f"  Google CSE '{q}': {len(items)} 件")
        for item in items:
            title = item.get("title", "")
            link = item.get("link", "")
            snippet = item.get("snippet", "")
            full_text = title + " " + snippet
            date_obj = parse_date(full_text)
            is_free = detect_free(full_text)

            lectures.append(Lecture(
                title=title,
                date_str=str(date_obj) if date_obj else "",
                date_obj=date_obj,
                location="詳細ページ参照",
                is_free=is_free,
                registration_url=link,
                registration_deadline=None,
                source="Google Search",
                description=snippet,
            ))
        time.sleep(REQUEST_DELAY)
    return lectures


# ---- 統合スクレイパー ----------------------------------------------------

def scrape_all() -> list[Lecture]:
    all_lectures: list[Lecture] = []

    scrapers = [
        ("connpass API", scrape_connpass),
        ("Doorkeeper API", scrape_doorkeeper),
        ("TECH PLAY RSS", scrape_techplay_rss),
        ("Google CSE", scrape_google_cse),
    ]

    for name, func in scrapers:
        logger.info(f"Scraping: {name} ...")
        try:
            results = func()
            logger.info(f"  → {len(results)} 件取得")
            all_lectures.extend(results)
        except Exception as e:
            logger.error(f"  {name} でエラー: {e}", exc_info=True)
        time.sleep(REQUEST_DELAY)

    return all_lectures


# ---- フィルタリング & ソート ---------------------------------------------

def filter_and_sort(lectures: list[Lecture]) -> list[Lecture]:
    filtered = [lec for lec in lectures if lec.is_free and is_future(lec.date_obj)]

    # 重複排除（タイトル先頭40字 + 日付）
    seen: set[tuple] = set()
    unique: list[Lecture] = []
    for lec in filtered:
        key = (lec.title[:40], str(lec.date_obj))
        if key not in seen:
            seen.add(key)
            unique.append(lec)

    def sort_key(lec: Lecture):
        d1 = lec.deadline_days() if lec.deadline_days() is not None else 9999
        d2 = lec.days_until() if lec.days_until() is not None else 9999
        return (d1, d2)

    unique.sort(key=sort_key)
    return unique


# ---- テーブル生成 --------------------------------------------------------

def build_text_table(lectures: list[Lecture]) -> str:
    today = date.today()
    if not lectures:
        return (
            f"西脇資哲さんの無料講演情報（{today} 時点）\n"
            + "=" * 60 + "\n"
            + "現在、該当する無料講演情報は見つかりませんでした。\n"
        )

    sep = "=" * 100
    lines = [
        f"西脇資哲さんの無料講演情報（{today} 時点）",
        sep,
        f"{'#':<3}  {'タイトル':<38}  {'開催日':<24}  {'場所':<16}  {'申込リンク'}",
        "-" * 100,
    ]
    for i, lec in enumerate(lectures, 1):
        days = lec.days_until()
        days_lbl = f" (あと{days}日)" if days is not None else ""
        title = truncate(lec.title, 36)
        date_display = (lec.date_str or "未定") + days_lbl
        location = truncate(lec.location, 14)
        url = truncate(lec.registration_url, 50)
        lines.append(f"{i:<3}  {title:<38}  {date_display:<24}  {location:<16}  {url}")

    lines += ["-" * 100, f"合計: {len(lectures)} 件"]
    return "\n".join(lines)


def build_html_table(lectures: list[Lecture]) -> str:
    today = date.today()
    if not lectures:
        return f"<p>現在（{today}）、西脇資哲さんの無料講演情報は見つかりませんでした。</p>"

    rows = ""
    for i, lec in enumerate(lectures, 1):
        days = lec.days_until()
        days_lbl = f"<br><small style='color:#555'>（あと{days}日）</small>" if days is not None else ""
        deadline = lec.registration_deadline or "—"
        url = lec.registration_url
        link = f'<a href="{url}" target="_blank">申込む</a>' if url else "—"

        dddays = lec.deadline_days()
        highlight = ' style="background:#fff3cd;"' if dddays is not None and dddays <= 3 else ""

        rows += f"""
    <tr{highlight}>
      <td style="text-align:center">{i}</td>
      <td>{lec.title}</td>
      <td>{lec.date_str or "未定"}{days_lbl}</td>
      <td>{lec.location}</td>
      <td style="color:green;font-weight:bold;text-align:center">無料</td>
      <td>{deadline}</td>
      <td>{link}</td>
      <td><small>{lec.source}</small></td>
    </tr>"""

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{font-family:'Meiryo',sans-serif;font-size:13px;max-width:1000px;margin:20px auto;}}
  h2 {{color:#0078d4;border-bottom:2px solid #0078d4;padding-bottom:6px;}}
  table {{border-collapse:collapse;width:100%;}}
  th {{background:#0078d4;color:#fff;padding:9px 12px;text-align:left;white-space:nowrap;}}
  td {{border:1px solid #ddd;padding:7px 10px;vertical-align:top;}}
  tr:hover td {{background:#e8f4ff;}}
  a {{color:#0078d4;}}
  .footer {{margin-top:20px;color:#999;font-size:11px;}}
</style>
</head>
<body>
<h2>&#128214; 西脇資哲さんの無料講演情報</h2>
<p>収集日: <strong>{today}</strong>　件数: <strong>{len(lectures)} 件</strong>（申込締切が近い順）<br>
<small style="color:#888">※ 申込締切まで3日以内はハイライト表示</small></p>
<table>
  <thead>
    <tr>
      <th>#</th><th>タイトル</th><th>開催日時</th><th>場所</th>
      <th>参加費</th><th>申込締切</th><th>申込</th><th>情報源</th>
    </tr>
  </thead>
  <tbody>{rows}
  </tbody>
</table>
<p class="footer">このメールは自動送信です。毎週月曜日 8:00 に更新されます。</p>
</body>
</html>"""


# ---- メール送信 ----------------------------------------------------------

def send_email(lectures: list[Lecture]) -> bool:
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        logger.warning(
            "メール送信スキップ — 以下の環境変数を設定してください:\n"
            "  export SENDER_EMAIL='your@gmail.com'\n"
            "  export SENDER_PASSWORD='your_app_password'  # Gmail アプリパスワード\n"
            "Gmail アプリパスワードの取得: https://myaccount.google.com/apppasswords"
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "西脇資哲さんの無料講演情報"
    msg["From"] = SENDER_EMAIL
    msg["To"] = RECIPIENT_EMAIL
    msg.attach(MIMEText(build_text_table(lectures), "plain", "utf-8"))
    msg.attach(MIMEText(build_html_table(lectures), "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, RECIPIENT_EMAIL, msg.as_string())
        logger.info(f"メール送信完了 → {RECIPIENT_EMAIL}")
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "認証エラー: Gmail アプリパスワードを確認してください。\n"
            "  https://myaccount.google.com/apppasswords"
        )
    except smtplib.SMTPException as e:
        logger.error(f"メール送信失敗: {e}")
    return False


# ---- キャッシュ ----------------------------------------------------------

def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(data: dict):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


# ---- メイン --------------------------------------------------------------

def run():
    logger.info("=== 西脇資哲さん講演情報収集 開始 ===")
    raw = scrape_all()
    logger.info(f"スクレイピング総件数: {len(raw)}")

    lectures = filter_and_sort(raw)
    logger.info(f"無料・今後の講演: {len(lectures)} 件")

    table = build_text_table(lectures)
    print("\n" + table + "\n")

    cache = load_cache()
    cache["last_run"] = str(date.today())
    cache["lectures"] = [asdict(lec) for lec in lectures]
    save_cache(cache)

    send_email(lectures)
    logger.info("=== 完了 ===")
    return lectures


if __name__ == "__main__":
    run()
