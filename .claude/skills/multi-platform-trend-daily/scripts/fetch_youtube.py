#!/usr/bin/env python3
"""YouTubeの動画情報をAPIキーなしで取得する。

2つのモード:
  search  — 検索結果ページHTML内の ytInitialData をパース
            （再生数・投稿時期・タイトル・URLが取れる）
  channel — チャンネルの公式RSSフィード
            https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxx

使い方:
  python3 fetch_youtube.py search "claude code" "AI エージェント" > yt.json
  python3 fetch_youtube.py channel UCXZCJLdBC09xxGZ6gcdrc6A ... > yt.json

検索は「今週」フィルタ+関連度順（sp=CAISBAgCEAE%3D）を付与している。
"""
import json
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
# 検索フィルタ: アップロード日=今週
SP_THIS_WEEK = "CAISBAgDEAE%3D"
ATOM = {
    "a": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}


def get(url, tries=4):
    delay = 10
    for i in range(tries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": UA, "Accept-Language": "ja"})
            return urllib.request.urlopen(req, timeout=30).read().decode()
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:
                time.sleep(delay + random.uniform(0, 3))
                delay *= 1.7
            else:
                raise


def walk_video_renderers(obj):
    if isinstance(obj, dict):
        if "videoRenderer" in obj:
            yield obj["videoRenderer"]
        for v in obj.values():
            yield from walk_video_renderers(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_video_renderers(v)


def search(query, limit=15):
    q = urllib.parse.quote(query)
    html = get(f"https://www.youtube.com/results?search_query={q}&sp={SP_THIS_WEEK}")
    m = re.search(r"var ytInitialData = ({.*?});</script>", html, re.S)
    if not m:
        raise RuntimeError("ytInitialData not found (layout changed?)")
    videos = []
    for v in walk_video_renderers(json.loads(m.group(1))):
        videos.append({
            "title": v["title"]["runs"][0]["text"],
            "views": v.get("viewCountText", {}).get("simpleText", ""),
            "published": v.get("publishedTimeText", {}).get("simpleText", ""),
            "channel": (v.get("ownerText", {}).get("runs") or [{}])[0].get("text", ""),
            "url": f"https://www.youtube.com/watch?v={v['videoId']}",
        })
        if len(videos) >= limit:
            break
    return videos


def channel(channel_id):
    xml_data = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
    root = ET.fromstring(xml_data)
    videos = []
    for e in root.findall("a:entry", ATOM):
        stats = e.find("media:group/media:community/media:statistics", ATOM)
        videos.append({
            "title": e.findtext("a:title", "", ATOM),
            "views": stats.get("views") if stats is not None else "",
            "published": e.findtext("a:published", "", ATOM),
            "url": f"https://www.youtube.com/watch?v={e.findtext('yt:videoId', '', ATOM)}",
        })
    return videos


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("search", "channel"):
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    mode, args = sys.argv[1], sys.argv[2:]
    out = {}
    for i, arg in enumerate(args):
        try:
            out[arg] = search(arg) if mode == "search" else channel(arg)
            print(f"{arg}: {len(out[arg])} videos", file=sys.stderr)
        except Exception as ex:
            out[arg] = []
            print(f"{arg}: ERROR {ex}", file=sys.stderr)
        if i < len(args) - 1:
            time.sleep(2)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
