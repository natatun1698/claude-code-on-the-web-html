#!/usr/bin/env python3
"""Slack リアクション分析ダッシュボード生成ツール

指定した Slack チャネルの過去 N 日間 (デフォルト 30 日) のメッセージと
リアクションを収集し、チャネルごとの分析ダッシュボードを Excel で出力する。
あわせて Notion へアップしやすい形式 (Markdown サマリー / PNG グラフ / CSV) も
output/notion/ に出力する。

必須ランキング:
  1. リアクションした回数が多いユーザーランキング
  2. リアクションされた回数が多いユーザーランキング
  3. 投稿が多いユーザーランキング

使い方:
  export SLACK_BOT_TOKEN=xoxb-...   # または SLACK_USER_TOKEN / SLACK_TOKEN
  python scripts/slack_reaction_dashboard.py --channels C02REH1V7QW C02SC8DRRDG --days 30

  # Slack エクスポート (ZIP または展開済みディレクトリ) から生成する場合 (トークン不要):
  python scripts/slack_reaction_dashboard.py --export path/to/export.zip

  # Slack トークンなしでレイアウト確認用のサンプルを生成する場合:
  python scripts/slack_reaction_dashboard.py --demo

必要な Slack トークンスコープ:
  channels:read, channels:history, groups:read, groups:history,
  reactions:read, users:read
"""

from __future__ import annotations

import argparse
import csv
import os
import random
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# カラーパレット (dataviz スキルの検証済みライトモードパレット)
# ---------------------------------------------------------------------------
BLUE = "#2A78D6"
AQUA = "#1BAF7A"
VIOLET = "#4A3AA7"
ORANGE = "#EB6834"
RED = "#E34948"
BLUE_DEEP = "#256ABF"
SURFACE = "#FCFCFB"
INK = "#0B0B0B"
INK_2 = "#52514E"
MUTED = "#898781"
GRID = "#E1E0D9"

JST = timezone(timedelta(hours=9))
TOP_N = 10

DEFAULT_CHANNELS = ["C02REH1V7QW", "C02SC8DRRDG"]


# ---------------------------------------------------------------------------
# Slack API クライアント
# ---------------------------------------------------------------------------
class SlackApiError(RuntimeError):
    pass


def api_call(token: str, method: str, **params) -> dict:
    url = f"https://slack.com/api/{method}"
    for _ in range(8):
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=30,
        )
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", "15"))
            print(f"    rate limited: {wait}s 待機 ({method})")
            time.sleep(wait)
            continue
        data = resp.json()
        if not data.get("ok"):
            if data.get("error") == "ratelimited":
                time.sleep(15)
                continue
            raise SlackApiError(f"{method} failed: {data.get('error')}")
        return data
    raise SlackApiError(f"{method}: rate limit を超過しました")


def fetch_user_map(token: str) -> dict[str, str]:
    """user_id -> 表示名"""
    users: dict[str, str] = {}
    cursor = None
    while True:
        params = {"limit": 200}
        if cursor:
            params["cursor"] = cursor
        data = api_call(token, "users.list", **params)
        for m in data.get("members", []):
            prof = m.get("profile", {})
            name = prof.get("display_name") or prof.get("real_name") or m.get("name") or m["id"]
            users[m["id"]] = name
        cursor = (data.get("response_metadata") or {}).get("next_cursor")
        if not cursor:
            break
        time.sleep(0.5)
    return users


def fetch_channel_name(token: str, channel_id: str) -> str:
    data = api_call(token, "conversations.info", channel=channel_id)
    return data["channel"].get("name") or channel_id


def _normalize_message(msg: dict) -> dict | None:
    """通常のユーザー投稿のみを正規化して返す (join/leave 等の subtype は除外)。"""
    subtype = msg.get("subtype")
    if subtype not in (None, "thread_broadcast"):
        return None
    if "user" not in msg:
        return None
    return {
        "user": msg["user"],
        "ts": float(msg["ts"]),
        "reactions": [
            {
                "name": r.get("name", ""),
                "count": r.get("count", 0),
                "users": list(r.get("users", [])),
            }
            for r in msg.get("reactions", [])
        ],
    }


def _fill_truncated_reactions(token: str, channel_id: str, raw_msg: dict, norm: dict) -> None:
    """message payload の reactions.users は途中で切り詰められることがあるため、
    count と users の数が合わない場合は reactions.get で補完する。"""
    needs_full = any(r["count"] > len(r["users"]) for r in norm["reactions"])
    if not needs_full:
        return
    try:
        data = api_call(
            token, "reactions.get", channel=channel_id, timestamp=raw_msg["ts"], full=True
        )
        full = data.get("message", {}).get("reactions", [])
        norm["reactions"] = [
            {
                "name": r.get("name", ""),
                "count": r.get("count", 0),
                "users": list(r.get("users", [])),
            }
            for r in full
        ]
        time.sleep(0.4)
    except SlackApiError as e:
        print(f"    reactions.get 失敗 (無視して続行): {e}")


def fetch_channel_messages(token: str, channel_id: str, oldest: float) -> list[dict]:
    """チャネルの本文 + スレッド返信を oldest 以降の範囲で収集する。"""
    messages: list[dict] = []
    thread_parents: list[dict] = []
    cursor = None
    while True:
        params = {"channel": channel_id, "oldest": f"{oldest:.6f}", "limit": 200}
        if cursor:
            params["cursor"] = cursor
        data = api_call(token, "conversations.history", **params)
        for raw in data.get("messages", []):
            norm = _normalize_message(raw)
            if norm is None:
                continue
            _fill_truncated_reactions(token, channel_id, raw, norm)
            messages.append(norm)
            if raw.get("reply_count", 0) > 0 and raw.get("thread_ts") == raw.get("ts"):
                thread_parents.append(raw)
        cursor = (data.get("response_metadata") or {}).get("next_cursor")
        if not data.get("has_more") or not cursor:
            break
        time.sleep(1.0)

    for parent in thread_parents:
        cursor = None
        while True:
            params = {
                "channel": channel_id,
                "ts": parent["ts"],
                "oldest": f"{oldest:.6f}",
                "limit": 200,
            }
            if cursor:
                params["cursor"] = cursor
            data = api_call(token, "conversations.replies", **params)
            for raw in data.get("messages", []):
                if raw.get("ts") == parent["ts"]:
                    continue  # 親メッセージは history 側で取得済み
                if float(raw["ts"]) < oldest:
                    continue
                norm = _normalize_message(raw)
                if norm is None:
                    continue
                _fill_truncated_reactions(token, channel_id, raw, norm)
                messages.append(norm)
            cursor = (data.get("response_metadata") or {}).get("next_cursor")
            if not data.get("has_more") or not cursor:
                break
            time.sleep(1.0)
        time.sleep(1.0)

    return messages


# ---------------------------------------------------------------------------
# Slack エクスポート (ZIP / ディレクトリ) の読み込み
# ---------------------------------------------------------------------------
class SlackExport:
    """Slack のワークスペースエクスポートを読む。

    構成: users.json / channels.json (+ groups.json 等) /
    <channel_name>/YYYY-MM-DD.json (その日のメッセージ配列)
    """

    def __init__(self, path: str):
        import io
        import json
        import zipfile

        self._json = json
        p = Path(path)
        if p.is_file():
            self._zip = zipfile.ZipFile(p)
            self._names = self._zip.namelist()
            self._root = self._common_zip_root(self._names)
            self._dir = None
        elif p.is_dir():
            self._zip = None
            self._dir = p
        else:
            raise FileNotFoundError(f"エクスポートが見つかりません: {path}")

    @staticmethod
    def _common_zip_root(names: list[str]) -> str:
        """ZIP 直下に単一フォルダが挟まっている場合はそれをルートとして扱う。"""
        tops = {n.split("/", 1)[0] for n in names if n.strip("/")}
        if len(tops) == 1 and any("/" in n for n in names):
            top = next(iter(tops))
            if not any(n == top for n in names):  # 単一フォルダのみ
                return top + "/"
        return ""

    def _read_json(self, rel: str):
        if self._zip is not None:
            full = self._root + rel
            if full not in self._names:
                return None
            return self._json.loads(self._zip.read(full).decode("utf-8"))
        f = self._dir / rel
        if not f.is_file():
            return None
        return self._json.loads(f.read_text(encoding="utf-8"))

    def _list_day_files(self, channel_name: str) -> list[str]:
        prefix = f"{channel_name}/"
        if self._zip is not None:
            full_prefix = self._root + prefix
            return sorted(
                n[len(self._root):] for n in self._names
                if n.startswith(full_prefix) and n.endswith(".json")
            )
        d = self._dir / channel_name
        if not d.is_dir():
            return []
        return sorted(f"{channel_name}/{f.name}" for f in d.glob("*.json"))

    def user_map(self) -> dict[str, str]:
        users = {}
        for m in self._read_json("users.json") or []:
            prof = m.get("profile", {})
            name = prof.get("display_name") or prof.get("real_name") or m.get("name") or m["id"]
            users[m["id"]] = name
        return users

    def channel_index(self) -> dict[str, str]:
        """channel_id -> channel_name (public: channels.json, private: groups.json)"""
        index = {}
        for fname in ("channels.json", "groups.json", "mpims.json"):
            for ch in self._read_json(fname) or []:
                if "id" in ch and "name" in ch:
                    index[ch["id"]] = ch["name"]
        return index

    def channel_messages(self, channel_name: str, oldest: float) -> list[dict]:
        oldest_day = (datetime.fromtimestamp(oldest, tz=JST) - timedelta(days=2)).date()
        messages = []
        for rel in self._list_day_files(channel_name):
            stem = rel.rsplit("/", 1)[-1][:-5]  # YYYY-MM-DD
            try:
                file_day = datetime.strptime(stem, "%Y-%m-%d").date()
            except ValueError:
                continue
            if file_day < oldest_day:
                continue
            for raw in self._read_json(rel) or []:
                if float(raw.get("ts", 0)) < oldest:
                    continue
                norm = _normalize_message(raw)
                if norm is not None:
                    messages.append(norm)
        return messages


def collect_from_export(export_path: str, channels: list[str],
                        oldest: float) -> tuple[list[ChannelStats], dict[str, str]]:
    exp = SlackExport(export_path)
    user_map = exp.user_map()
    index = exp.channel_index()  # id -> name
    by_name = {v: k for k, v in index.items()}

    all_stats = []
    for ch in channels:
        if ch in index:
            cid, name = ch, index[ch]
        elif ch.lstrip("#") in by_name:
            name = ch.lstrip("#")
            cid = by_name[name]
        else:
            available = ", ".join(sorted(index.values())[:20])
            print(f"警告: チャネル '{ch}' はエクスポートに含まれていません。スキップします。\n"
                  f"  エクスポート内のチャネル (先頭20件): {available}", file=sys.stderr)
            continue
        msgs = exp.channel_messages(name, oldest)
        print(f"#{name} ({cid}): {len(msgs)} 件のメッセージ")
        all_stats.append(aggregate(cid, name, msgs))
    return all_stats, user_map


# ---------------------------------------------------------------------------
# 集計
# ---------------------------------------------------------------------------
@dataclass
class ChannelStats:
    channel_id: str
    channel_name: str
    n_posts: int = 0
    n_reactions: int = 0
    reactors: Counter = field(default_factory=Counter)      # リアクションした回数
    receivers: Counter = field(default_factory=Counter)     # リアクションされた回数
    posters: Counter = field(default_factory=Counter)       # 投稿数
    emoji: Counter = field(default_factory=Counter)
    daily_posts: Counter = field(default_factory=Counter)   # 'YYYY-MM-DD' -> n
    daily_reactions: Counter = field(default_factory=Counter)
    hourly_posts: Counter = field(default_factory=Counter)  # 0-23 -> n

    @property
    def n_users(self) -> int:
        return len(set(self.posters) | set(self.reactors))


def aggregate(channel_id: str, channel_name: str, messages: list[dict]) -> ChannelStats:
    st = ChannelStats(channel_id, channel_name)
    for m in messages:
        dt = datetime.fromtimestamp(m["ts"], tz=JST)
        day = dt.strftime("%Y-%m-%d")
        st.n_posts += 1
        st.posters[m["user"]] += 1
        st.daily_posts[day] += 1
        st.hourly_posts[dt.hour] += 1
        for r in m["reactions"]:
            st.n_reactions += r["count"]
            st.emoji[r["name"]] += r["count"]
            st.receivers[m["user"]] += r["count"]
            st.daily_reactions[day] += r["count"]
            for u in r["users"]:
                st.reactors[u] += 1
    return st


def merge_stats(all_stats: list[ChannelStats]) -> ChannelStats:
    total = ChannelStats("ALL", "全チャネル合計")
    for st in all_stats:
        total.n_posts += st.n_posts
        total.n_reactions += st.n_reactions
        for attr in ("reactors", "receivers", "posters", "emoji",
                     "daily_posts", "daily_reactions", "hourly_posts"):
            getattr(total, attr).update(getattr(st, attr))
    return total


def top_items(counter: Counter, user_map: dict[str, str], n: int = TOP_N) -> list[tuple[str, int]]:
    ranked = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[:n]
    return [(user_map.get(k, k), v) for k, v in ranked]


def date_range(start: datetime, end: datetime) -> list[str]:
    days = []
    d = start.astimezone(JST).date()
    last = end.astimezone(JST).date()
    while d <= last:
        days.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
    return days


# ---------------------------------------------------------------------------
# デモデータ (レイアウト確認用)
# ---------------------------------------------------------------------------
DEMO_USERS = [
    "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本",
    "中村", "小林", "加藤", "吉田", "山田", "松本", "井上",
]
DEMO_EMOJI = [
    "+1", "pray", "eyes", "tada", "joy", "clap", "fire",
    "heart", "raised_hands", "bow", "ok_hand", "sparkles",
]


def make_demo(channel_id: str, channel_name: str, oldest: float, now: float,
              seed: int) -> tuple[list[dict], dict[str, str]]:
    rng = random.Random(seed)
    user_ids = [f"U{i:03d}" for i in range(len(DEMO_USERS))]
    user_map = dict(zip(user_ids, DEMO_USERS))
    weights = [rng.uniform(0.3, 3.0) for _ in user_ids]
    messages = []
    n_days = int((now - oldest) / 86400)
    for d in range(n_days):
        day_start = oldest + d * 86400
        weekday = datetime.fromtimestamp(day_start, tz=JST).weekday()
        n_msgs = rng.randint(2, 6) if weekday >= 5 else rng.randint(8, 25)
        for _ in range(n_msgs):
            author = rng.choices(user_ids, weights=weights)[0]
            hour = rng.choices(range(24), weights=[1, 1, 1, 1, 1, 1, 2, 3, 5, 9, 10, 8,
                                                   6, 8, 9, 9, 8, 7, 5, 3, 2, 2, 1, 1])[0]
            ts = day_start + hour * 3600 + rng.uniform(0, 3599)
            reactions = []
            for _ in range(rng.choices([0, 1, 2, 3], weights=[35, 35, 20, 10])[0]):
                emoji = rng.choice(DEMO_EMOJI)
                reactor_pool = [u for u in user_ids if u != author]
                k = rng.randint(1, 6)
                users = rng.sample(reactor_pool, k)
                reactions.append({"name": emoji, "count": len(users), "users": users})
            messages.append({"user": author, "ts": ts, "reactions": reactions})
    return messages, user_map


# ---------------------------------------------------------------------------
# Excel 出力 (xlsxwriter)
# ---------------------------------------------------------------------------
def sanitize_sheet_name(name: str, used: set[str]) -> str:
    for ch in "[]:*?/\\":
        name = name.replace(ch, "-")
    name = name[:28]
    base, i = name, 2
    while name in used:
        name = f"{base[:25]}_{i}"
        i += 1
    used.add(name)
    return name


def build_excel(path: Path, all_stats: list[ChannelStats], total: ChannelStats,
                user_map: dict[str, str], period_label: str, days: list[str]) -> None:
    import xlsxwriter

    wb = xlsxwriter.Workbook(str(path))
    fmt_title = wb.add_format({"font_size": 16, "bold": True, "font_color": INK})
    fmt_sub = wb.add_format({"font_size": 10, "font_color": MUTED})
    fmt_kpi_label = wb.add_format({"font_size": 9, "font_color": MUTED,
                                   "align": "center", "valign": "vcenter"})
    fmt_kpi_value = wb.add_format({"font_size": 22, "bold": True, "font_color": INK,
                                   "align": "center", "valign": "vcenter"})
    fmt_head = wb.add_format({"bold": True, "font_size": 10, "font_color": INK_2,
                              "bottom": 1, "border_color": GRID})
    fmt_cell = wb.add_format({"font_size": 10, "font_color": INK})

    used_names: set[str] = set()
    sheets = [(total, "サマリー")] + [(st, f"#{st.channel_name}") for st in all_stats]

    def style_axis_common(chart):
        chart.set_chartarea({"border": {"none": True}, "fill": {"color": SURFACE}})
        chart.set_plotarea({"border": {"none": True}, "fill": {"color": SURFACE}})

    def label_font():
        return {"font": {"size": 9, "color": INK_2}}

    def axis_font():
        return {"num_font": {"size": 9, "color": MUTED},
                "name_font": {"size": 9, "color": MUTED}}

    for st, disp_name in sheets:
        ws_name = sanitize_sheet_name(disp_name, used_names)
        data_name = sanitize_sheet_name(f"Data_{disp_name}", used_names)
        ws = wb.add_worksheet(ws_name)
        dws = wb.add_worksheet(data_name)
        ws.hide_gridlines(2)
        ws.set_tab_color(BLUE if st.channel_id == "ALL" else AQUA)
        dws.hide()  # 集計データシートは通常は見せない (再表示可)

        # ---- データシートへ集計値を書き込む -------------------------------
        # ランキングは棒グラフで上位が上に来るよう昇順で書く
        def write_block(col: int, header: tuple[str, str],
                        rows: list[tuple[str, int]]) -> tuple[int, int, int]:
            dws.write(0, col, header[0], fmt_head)
            dws.write(0, col + 1, header[1], fmt_head)
            for i, (k, v) in enumerate(rows):
                dws.write(1 + i, col, k, fmt_cell)
                dws.write_number(1 + i, col + 1, v, fmt_cell)
            return col, 1, len(rows)

        reactors = list(reversed(top_items(st.reactors, user_map)))
        receivers = list(reversed(top_items(st.receivers, user_map)))
        posters = list(reversed(top_items(st.posters, user_map)))
        emoji = list(reversed([(f":{k}:", v) for k, v in
                               sorted(st.emoji.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_N]]))
        daily = [(d[5:].replace("-", "/"), st.daily_posts.get(d, 0),
                  st.daily_reactions.get(d, 0)) for d in days]
        hourly = [(f"{h}時", st.hourly_posts.get(h, 0)) for h in range(24)]

        c0 = write_block(0, ("ユーザー", "リアクションした回数"), reactors)
        c1 = write_block(3, ("ユーザー", "リアクションされた回数"), receivers)
        c2 = write_block(6, ("ユーザー", "投稿数"), posters)
        c3 = write_block(9, ("絵文字", "使用回数"), emoji)
        dws.write_row(0, 12, ["日付", "投稿数", "リアクション数"], fmt_head)
        for i, (d, p, r) in enumerate(daily):
            dws.write(1 + i, 12, d, fmt_cell)
            dws.write_number(1 + i, 13, p, fmt_cell)
            dws.write_number(1 + i, 14, r, fmt_cell)
        dws.write_row(0, 16, ["時間帯", "投稿数"], fmt_head)
        for i, (h, p) in enumerate(hourly):
            dws.write(1 + i, 16, h, fmt_cell)
            dws.write_number(1 + i, 17, p, fmt_cell)
        # チャネル比較 (サマリーのみ)
        if st.channel_id == "ALL":
            dws.write_row(0, 19, ["チャネル", "投稿数", "リアクション数"], fmt_head)
            for i, cst in enumerate(all_stats):
                dws.write(1 + i, 19, f"#{cst.channel_name}", fmt_cell)
                dws.write_number(1 + i, 20, cst.n_posts, fmt_cell)
                dws.write_number(1 + i, 21, cst.n_reactions, fmt_cell)

        # ---- ダッシュボードのヘッダーと KPI -------------------------------
        ws.set_row(0, 26)
        ws.write(0, 0, f"{disp_name}  リアクション分析ダッシュボード", fmt_title)
        ws.write(1, 0, f"対象期間: {period_label}（過去{len(days)}日間 / JST集計）", fmt_sub)

        kpis = [
            ("投稿数", st.n_posts),
            ("リアクション総数", st.n_reactions),
            ("アクティブユーザー数", st.n_users),
            ("1投稿あたりリアクション", round(st.n_reactions / st.n_posts, 2) if st.n_posts else 0),
        ]
        ws.set_row(3, 30)
        ws.set_row(4, 16)
        for i, (label, value) in enumerate(kpis):
            c = i * 4
            ws.merge_range(3, c, 3, c + 2, value, fmt_kpi_value)
            ws.merge_range(4, c, 4, c + 2, label, fmt_kpi_label)

        # ---- グラフ --------------------------------------------------------
        def bar_chart(block, color, title, value_title):
            col, r0, n = block
            if n == 0:
                return None
            ch = wb.add_chart({"type": "bar"})
            ch.add_series({
                "categories": [data_name, r0, col, r0 + n - 1, col],
                "values": [data_name, r0, col + 1, r0 + n - 1, col + 1],
                "fill": {"color": color},
                "gap": 60,
                "data_labels": {"value": True, **label_font()},
            })
            ch.set_title({"name": title,
                          "name_font": {"size": 11, "bold": True, "color": INK}})
            ch.set_legend({"none": True})
            ch.set_x_axis({"major_gridlines": {"visible": True,
                                               "line": {"color": GRID, "width": 0.75}},
                           "line": {"color": GRID}, **axis_font()})
            ch.set_y_axis({"line": {"none": True},
                           "major_gridlines": {"visible": False}, **axis_font()})
            style_axis_common(ch)
            return ch

        anchor_rows = [6, 22, 38]
        # 1. リアクションした回数 / 2. リアクションされた回数 / 3. 投稿数
        ch = bar_chart(c0, BLUE, "リアクションした回数 Top10", "回")
        if ch:
            ws.insert_chart(anchor_rows[0], 0, ch, {"x_scale": 1.05, "y_scale": 1.1})
        ch = bar_chart(c1, AQUA, "リアクションされた回数 Top10", "回")
        if ch:
            ws.insert_chart(anchor_rows[0], 8, ch, {"x_scale": 1.05, "y_scale": 1.1})
        ch = bar_chart(c2, VIOLET, "投稿数 Top10", "件")
        if ch:
            ws.insert_chart(anchor_rows[1], 0, ch, {"x_scale": 1.05, "y_scale": 1.1})
        ch = bar_chart(c3, ORANGE, "よく使われた絵文字 Top10", "回")
        if ch:
            ws.insert_chart(anchor_rows[1], 8, ch, {"x_scale": 1.05, "y_scale": 1.1})

        # 日別推移 (折れ線)
        n_days_rows = len(daily)
        line = wb.add_chart({"type": "line"})
        line.add_series({
            "name": "投稿数",
            "categories": [data_name, 1, 12, n_days_rows, 12],
            "values": [data_name, 1, 13, n_days_rows, 13],
            "line": {"color": BLUE, "width": 2},
        })
        line.add_series({
            "name": "リアクション数",
            "categories": [data_name, 1, 12, n_days_rows, 12],
            "values": [data_name, 1, 14, n_days_rows, 14],
            "line": {"color": AQUA, "width": 2},
        })
        line.set_title({"name": "日別 投稿数・リアクション数の推移",
                        "name_font": {"size": 11, "bold": True, "color": INK}})
        line.set_legend({"position": "bottom", "font": {"size": 9, "color": INK_2}})
        line.set_y_axis({"major_gridlines": {"visible": True,
                                             "line": {"color": GRID, "width": 0.75}},
                         "line": {"none": True}, **axis_font()})
        line.set_x_axis({"line": {"color": GRID}, "interval_unit": max(1, n_days_rows // 10),
                         **axis_font()})
        style_axis_common(line)
        ws.insert_chart(anchor_rows[2], 0, line, {"x_scale": 1.05, "y_scale": 1.1})

        # 時間帯別 (縦棒)
        colch = wb.add_chart({"type": "column"})
        colch.add_series({
            "categories": [data_name, 1, 16, 24, 16],
            "values": [data_name, 1, 17, 24, 17],
            "fill": {"color": BLUE_DEEP},
            "gap": 40,
        })
        colch.set_title({"name": "時間帯別 投稿数 (JST)",
                         "name_font": {"size": 11, "bold": True, "color": INK}})
        colch.set_legend({"none": True})
        colch.set_y_axis({"major_gridlines": {"visible": True,
                                              "line": {"color": GRID, "width": 0.75}},
                          "line": {"none": True}, **axis_font()})
        colch.set_x_axis({"line": {"color": GRID}, "interval_unit": 2, **axis_font()})
        style_axis_common(colch)
        ws.insert_chart(anchor_rows[2], 8, colch, {"x_scale": 1.05, "y_scale": 1.1})

        # チャネル比較 (サマリーのみ)
        if st.channel_id == "ALL" and all_stats:
            comp = wb.add_chart({"type": "column"})
            n = len(all_stats)
            comp.add_series({
                "name": "投稿数",
                "categories": [data_name, 1, 19, n, 19],
                "values": [data_name, 1, 20, n, 20],
                "fill": {"color": BLUE},
                "gap": 80, "overlap": -10,
                "data_labels": {"value": True, **label_font()},
            })
            comp.add_series({
                "name": "リアクション数",
                "categories": [data_name, 1, 19, n, 19],
                "values": [data_name, 1, 21, n, 21],
                "fill": {"color": AQUA},
                "gap": 80, "overlap": -10,
                "data_labels": {"value": True, **label_font()},
            })
            comp.set_title({"name": "チャネル別 投稿数・リアクション数",
                            "name_font": {"size": 11, "bold": True, "color": INK}})
            comp.set_legend({"position": "bottom", "font": {"size": 9, "color": INK_2}})
            comp.set_y_axis({"major_gridlines": {"visible": True,
                                                 "line": {"color": GRID, "width": 0.75}},
                             "line": {"none": True}, **axis_font()})
            comp.set_x_axis({"line": {"color": GRID}, **axis_font()})
            style_axis_common(comp)
            ws.insert_chart(54, 0, comp, {"x_scale": 2.15, "y_scale": 1.1})

    wb.close()


# ---------------------------------------------------------------------------
# Notion 向けエクスポート (Markdown / PNG / CSV)
# ---------------------------------------------------------------------------
def setup_matplotlib():
    import matplotlib
    matplotlib.use("Agg")
    from matplotlib import font_manager, pyplot as plt
    available = {f.name for f in font_manager.fontManager.ttflist}
    for cand in ("IPAPGothic", "IPAGothic", "Noto Sans CJK JP", "Hiragino Sans",
                 "Yu Gothic", "Meiryo"):
        if cand in available:
            plt.rcParams["font.family"] = cand
            break
    plt.rcParams.update({
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
        "axes.edgecolor": GRID, "axes.labelcolor": INK_2,
        "xtick.color": MUTED, "ytick.color": MUTED,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.75,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.axisbelow": True,
        "font.size": 10,
    })
    return plt


def export_notion(out_dir: Path, all_stats: list[ChannelStats], total: ChannelStats,
                  user_map: dict[str, str], period_label: str, days: list[str]) -> None:
    plt = setup_matplotlib()
    img_dir = out_dir / "images"
    csv_dir = out_dir / "csv"
    img_dir.mkdir(parents=True, exist_ok=True)
    csv_dir.mkdir(parents=True, exist_ok=True)

    def slug(name: str) -> str:
        return "".join(c if c.isalnum() or c in "-_" else "_" for c in name)

    def png_barh(fname: str, rows: list[tuple[str, int]], color: str, title: str):
        if not rows:
            return None
        labels = [k for k, _ in rows][::-1]
        values = [v for _, v in rows][::-1]
        fig, ax = plt.subplots(figsize=(7, 0.45 * len(rows) + 1.2))
        bars = ax.barh(labels, values, color=color, height=0.62)
        ax.bar_label(bars, padding=4, fontsize=9, color=INK_2)
        ax.set_title(title, fontsize=12, fontweight="bold", color=INK, loc="left")
        ax.grid(axis="y", visible=False)
        ax.margins(x=0.12)
        fig.tight_layout()
        fig.savefig(img_dir / fname, dpi=150)
        plt.close(fig)
        return fname

    def png_timeline(fname: str, st: ChannelStats, title: str):
        xs = list(range(len(days)))
        posts = [st.daily_posts.get(d, 0) for d in days]
        reacts = [st.daily_reactions.get(d, 0) for d in days]
        fig, ax = plt.subplots(figsize=(9, 3.2))
        ax.plot(xs, posts, color=BLUE, linewidth=2, label="投稿数")
        ax.plot(xs, reacts, color=AQUA, linewidth=2, label="リアクション数")
        step = max(1, len(days) // 10)
        ax.set_xticks(xs[::step])
        ax.set_xticklabels([days[i][5:].replace("-", "/") for i in xs[::step]])
        ax.set_title(title, fontsize=12, fontweight="bold", color=INK, loc="left")
        ax.legend(frameon=False, fontsize=9, loc="upper left")
        ax.grid(axis="x", visible=False)
        fig.tight_layout()
        fig.savefig(img_dir / fname, dpi=150)
        plt.close(fig)
        return fname

    def write_csv(fname: str, header: list[str], rows: list[tuple]):
        with open(csv_dir / fname, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)

    md: list[str] = [
        "# Slack リアクション分析ダッシュボード",
        "",
        f"対象期間: **{period_label}**（過去{len(days)}日間 / JST 集計）",
        "",
        "| チャネル | 投稿数 | リアクション総数 | アクティブユーザー数 |",
        "|---|---:|---:|---:|",
        f"| 全体 | {total.n_posts} | {total.n_reactions} | {total.n_users} |",
    ]
    for st in all_stats:
        md.append(f"| #{st.channel_name} | {st.n_posts} | {st.n_reactions} | {st.n_users} |")
    md.append("")

    for st, label in [(total, "全体")] + [(s, f"#{s.channel_name}") for s in all_stats]:
        s = slug(label)
        md += [f"## {label}", ""]
        sections = [
            ("リアクションした回数 Top10", top_items(st.reactors, user_map), BLUE,
             ["ユーザー", "リアクションした回数"], f"{s}_reactors"),
            ("リアクションされた回数 Top10", top_items(st.receivers, user_map), AQUA,
             ["ユーザー", "リアクションされた回数"], f"{s}_receivers"),
            ("投稿数 Top10", top_items(st.posters, user_map), VIOLET,
             ["ユーザー", "投稿数"], f"{s}_posters"),
            ("よく使われた絵文字 Top10",
             [(f":{k}:", v) for k, v in sorted(st.emoji.items(),
                                               key=lambda kv: (-kv[1], kv[0]))[:TOP_N]],
             ORANGE, ["絵文字", "使用回数"], f"{s}_emoji"),
        ]
        for title, rows, color, header, base in sections:
            img = png_barh(f"{base}.png", rows, color, f"{label} {title}")
            write_csv(f"{base}.csv", header, rows)
            md += [f"### {title}", ""]
            if img:
                md.append(f"![{title}](images/{img})")
            md += ["", f"| {header[0]} | {header[1]} |", "|---|---:|"]
            md += [f"| {k} | {v} |" for k, v in rows]
            md.append("")
        tl = png_timeline(f"{s}_timeline.png", st, f"{label} 日別 投稿数・リアクション数")
        write_csv(f"{s}_daily.csv", ["日付", "投稿数", "リアクション数"],
                  [(d, st.daily_posts.get(d, 0), st.daily_reactions.get(d, 0)) for d in days])
        md += ["### 日別推移", "", f"![日別推移](images/{tl})", ""]

    (out_dir / "summary.md").write_text("\n".join(md), encoding="utf-8")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description="Slack リアクション分析ダッシュボード生成")
    ap.add_argument("--channels", nargs="+", default=DEFAULT_CHANNELS,
                    help="対象チャネル ID (デフォルト: %(default)s)")
    ap.add_argument("--days", type=int, default=30, help="分析対象日数 (デフォルト: 30)")
    ap.add_argument("--out", default="output", help="出力ディレクトリ")
    ap.add_argument("--token", default=None,
                    help="Slack トークン (省略時は SLACK_BOT_TOKEN / SLACK_USER_TOKEN / SLACK_TOKEN)")
    ap.add_argument("--export", default=None, metavar="PATH",
                    help="Slack エクスポート (ZIP または展開済みディレクトリ) から読み込む。"
                         "指定時はトークン不要。--channels にはチャネル ID か名前を指定可")
    ap.add_argument("--demo", action="store_true",
                    help="Slack に接続せずサンプルデータでダッシュボードを生成")
    args = ap.parse_args()

    now_dt = datetime.now(tz=JST)
    oldest_dt = now_dt - timedelta(days=args.days)
    oldest, now = oldest_dt.timestamp(), now_dt.timestamp()
    days = date_range(oldest_dt, now_dt)
    period_label = f"{oldest_dt.strftime('%Y/%m/%d')} 〜 {now_dt.strftime('%Y/%m/%d')}"

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    all_stats: list[ChannelStats] = []
    if args.export:
        print(f"エクスポートから読み込み: {args.export}")
        all_stats, user_map = collect_from_export(args.export, args.channels, oldest)
        if not all_stats:
            print("エラー: 対象チャネルがエクスポート内に見つかりませんでした。", file=sys.stderr)
            return 1
    elif args.demo:
        print("デモモード: サンプルデータでダッシュボードを生成します")
        user_map: dict[str, str] = {}
        demo_names = ["demo-market-team", "demo-dev-random"]
        for i, cid in enumerate(args.channels):
            msgs, umap = make_demo(cid, demo_names[i % len(demo_names)], oldest, now, seed=42 + i)
            user_map.update(umap)
            all_stats.append(aggregate(cid, demo_names[i % len(demo_names)], msgs))
    else:
        token = args.token or os.environ.get("SLACK_BOT_TOKEN") \
            or os.environ.get("SLACK_USER_TOKEN") or os.environ.get("SLACK_TOKEN")
        if not token:
            print("エラー: Slack トークンが見つかりません。", file=sys.stderr)
            print("  SLACK_BOT_TOKEN (推奨) / SLACK_USER_TOKEN / SLACK_TOKEN のいずれかを"
                  "環境変数に設定するか、--token で指定してください。", file=sys.stderr)
            print("  レイアウト確認だけなら --demo で実行できます。", file=sys.stderr)
            return 1
        print("ユーザー一覧を取得中...")
        user_map = fetch_user_map(token)
        print(f"  {len(user_map)} ユーザー")
        for cid in args.channels:
            name = fetch_channel_name(token, cid)
            print(f"#{name} ({cid}) のメッセージを取得中...")
            msgs = fetch_channel_messages(token, cid, oldest)
            print(f"  {len(msgs)} 件のメッセージ (スレッド返信含む)")
            all_stats.append(aggregate(cid, name, msgs))

    total = merge_stats(all_stats)
    suffix = "_SAMPLE" if args.demo else ""
    xlsx_path = out_dir / f"slack_reaction_dashboard_{now_dt.strftime('%Y%m%d')}{suffix}.xlsx"
    build_excel(xlsx_path, all_stats, total, user_map, period_label, days)
    print(f"Excel ダッシュボードを出力: {xlsx_path}")

    notion_dir = out_dir / "notion"
    export_notion(notion_dir, all_stats, total, user_map, period_label, days)
    print(f"Notion 用エクスポートを出力: {notion_dir}/ (summary.md, images/, csv/)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
