#!/usr/bin/env python3
"""Redditのhot投稿を収集する。

取得戦略（フォールバックチェーン）:
  1. old.reddit.com の hot.json（住宅IPなら通る。データセンターIPは403）
  2. www.reddit.com の hot.rss（403環境でも通るが、スコアを含まない）
     + arctic-shift APIでスコア/コメント数を補完（取り込み時点の概算値。
       pullpushはレート制限が厳しく、直近投稿のヒット率も低いため使わない）

RSSはレート制限が厳しい（連続リクエストで429）ため、
サブレッド間で12秒待機し、429時は指数バックオフでリトライする。

使い方:
  python3 fetch_reddit.py netsec programming ... > reddit.json
  引数省略時はデフォルトの13サブレッドを取得。
"""
import json
import random
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

UA_BOT = "neta-trend-collector/1.0 (trend analysis tool)"
UA_BROWSER = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
DEFAULT_SUBS = [
    "netsec", "cybersecurity",                       # セキュリティ系
    "OpenAI", "LocalLLaMA", "ClaudeCode",            # AI系
    "programming", "technology",                     # コア技術系
    "opensource", "indiehackers", "webdev", "javascript",  # OSS/個人開発系
    "cscareerquestions", "productivity",             # キャリア/実践系
]
ATOM = {"a": "http://www.w3.org/2005/Atom"}


def fetch(url, ua, tries=5):
    delay = 15
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "*/*"})
            return urllib.request.urlopen(req, timeout=30).read()
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:
                time.sleep(delay + random.uniform(0, 5))
                delay *= 1.7
            else:
                raise


def via_json(sub):
    """経路1: hot.json（403ならHTTPErrorが上がる）"""
    data = json.loads(fetch(
        f"https://old.reddit.com/r/{sub}/hot.json?t=day&limit=10", UA_BOT, tries=1))
    posts = []
    for c in data["data"]["children"]:
        d = c["data"]
        if d.get("stickied"):
            continue
        posts.append({
            "title": d["title"],
            "url": "https://www.reddit.com" + d["permalink"],
            "id": d["id"],
            "ups": d.get("ups"),
            "num_comments": d.get("num_comments"),
        })
    return posts


def via_rss(sub):
    """経路2: hot.rss（スコアなし）"""
    root = ET.fromstring(fetch(
        f"https://www.reddit.com/r/{sub}/hot.rss?limit=10", UA_BROWSER))
    posts = []
    for e in root.findall("a:entry", ATOM):
        link = ""
        for l in e.findall("a:link", ATOM):
            link = l.get("href", "")
        m = re.search(r"/comments/([a-z0-9]+)/", link)
        posts.append({
            "title": e.findtext("a:title", "", ATOM),
            "url": link,
            "id": m.group(1) if m else None,
            "ups": None,
            "num_comments": None,
        })
    return posts


def enrich_arctic_shift(all_posts):
    """RSS経路のスコアをarctic-shiftで補完（ベストエフォート、25件ずつ）"""
    ids = [p["id"] for p in all_posts if p["id"]]
    meta = {}
    for i in range(0, len(ids), 25):
        chunk = ",".join(ids[i:i + 25])
        try:
            data = json.loads(fetch(
                f"https://arctic-shift.photon-reddit.com/api/posts/ids?ids={chunk}",
                UA_BROWSER, tries=2))
            for d in data.get("data", []):
                meta[d["id"]] = d
        except Exception as ex:
            print(f"  arctic-shift enrichment failed: {ex}", file=sys.stderr)
        time.sleep(2)
    for p in all_posts:
        d = meta.get(p["id"])
        if d:
            p["ups"] = d.get("score")
            p["num_comments"] = d.get("num_comments")


def main():
    subs = sys.argv[1:] or DEFAULT_SUBS
    out = {}
    json_blocked = False
    for i, sub in enumerate(subs):
        posts = []
        if not json_blocked:
            try:
                posts = via_json(sub)
            except urllib.error.HTTPError as e:
                if e.code == 403:
                    json_blocked = True  # 以降のサブレッドもRSS経路に切替
                    print(f"  hot.json is 403 (datacenter IP?); falling back to RSS",
                          file=sys.stderr)
                else:
                    print(f"  {sub}: json error {e}", file=sys.stderr)
        if json_blocked:
            try:
                posts = via_rss(sub)
            except Exception as ex:
                print(f"  {sub}: rss error {ex}", file=sys.stderr)
        out[sub] = posts
        print(f"{sub}: {len(posts)} posts", file=sys.stderr)
        if i < len(subs) - 1:
            time.sleep(12 if json_blocked else 1.5)
    if json_blocked:
        enrich_arctic_shift([p for posts in out.values() for p in posts])
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
