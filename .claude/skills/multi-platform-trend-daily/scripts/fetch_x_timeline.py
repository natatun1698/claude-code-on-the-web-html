#!/usr/bin/env python3
"""X（旧Twitter）の公開アカウントのタイムラインをAPIキーなしで取得する。

syndication.twitter.com（埋め込みウィジェット用エンドポイント）はログイン不要で、
HTML内の __NEXT_DATA__ にツイートJSON（本文・いいね・RT数）が含まれる。
直近約20件しか取れない点と、非公開/凍結アカウントは取れない点に注意。

単発ポストのURLを要約したい場合はこのスクリプトではなく
https://api.fxtwitter.com/status/<tweet_id> を使うこと（JSONで本文+メトリクスが返る）。

使い方:
  python3 fetch_x_timeline.py AnthropicAI OpenAI ... > x.json
"""
import json
import random
import re
import sys
import time
import urllib.error
import urllib.request

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def get(url, tries=4):
    delay = 10
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=30).read().decode()
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:
                time.sleep(delay + random.uniform(0, 3))
                delay *= 1.7
            else:
                raise


def fetch_timeline(screen_name):
    url = f"https://syndication.twitter.com/srv/timeline-profile/screen-name/{screen_name}"
    html = get(url)
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
                  html, re.S)
    if not m:
        raise RuntimeError("__NEXT_DATA__ not found (layout changed?)")
    data = json.loads(m.group(1))
    entries = data["props"]["pageProps"]["timeline"]["entries"]
    tweets = []
    for e in entries:
        t = e.get("content", {}).get("tweet")
        if not t:
            continue
        tweets.append({
            "text": t["full_text"],
            "likes": t.get("favorite_count"),
            "retweets": t.get("retweet_count"),
            "created_at": t.get("created_at"),
            "url": f"https://x.com/{t['user']['screen_name']}/status/{t['id_str']}",
        })
    return tweets


def main():
    accounts = sys.argv[1:]
    if not accounts:
        print("usage: fetch_x_timeline.py <screen_name> ...", file=sys.stderr)
        sys.exit(1)
    out = {}
    for i, name in enumerate(accounts):
        try:
            out[name] = fetch_timeline(name)
            print(f"{name}: {len(out[name])} tweets", file=sys.stderr)
        except Exception as ex:
            out[name] = []
            print(f"{name}: ERROR {ex}", file=sys.stderr)
        if i < len(accounts) - 1:
            time.sleep(5)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
