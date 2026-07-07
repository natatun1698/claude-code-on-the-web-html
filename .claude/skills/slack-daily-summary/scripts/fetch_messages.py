#!/usr/bin/env python3
"""Fetch recent Slack messages for the channels listed in config.json.

Prints a markdown transcript to stdout, one section per channel, for Claude
to summarize. Requires a Slack token per workspace, supplied via the env var
named in each channel's "token_env" (user token xoxp-... or bot token
xoxb-... with channels:history, channels:read, users:read scopes; the bot
must be a member of the channel).

Usage: python3 fetch_messages.py [--hours N]
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config.json")
API_BASE = "https://slack.com/api/"


def api_call(token, method, params):
    url = API_BASE + method + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(int(e.headers.get("Retry-After", "5")))
                continue
            raise
        if not data.get("ok"):
            if data.get("error") == "ratelimited":
                time.sleep(5)
                continue
            raise RuntimeError(f"Slack API {method} failed: {data.get('error')}")
        return data
    raise RuntimeError(f"Slack API {method}: rate limited after retries")


def paginate(token, method, params, key):
    items = []
    cursor = None
    while True:
        p = dict(params)
        if cursor:
            p["cursor"] = cursor
        data = api_call(token, method, p)
        items.extend(data.get(key, []))
        cursor = data.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            return items


class UserCache:
    def __init__(self, token):
        self.token = token
        self.names = {}

    def name(self, user_id):
        if not user_id:
            return "(unknown)"
        if user_id not in self.names:
            try:
                u = api_call(self.token, "users.info", {"user": user_id})["user"]
                profile = u.get("profile", {})
                self.names[user_id] = (
                    profile.get("display_name")
                    or profile.get("real_name")
                    or u.get("name")
                    or user_id
                )
            except Exception:
                self.names[user_id] = user_id
        return self.names[user_id]


def fmt_ts(ts):
    return datetime.fromtimestamp(float(ts), tz=timezone.utc).strftime(
        "%Y-%m-%d %H:%M UTC"
    )


def render_message(msg, users, indent=""):
    who = users.name(msg.get("user") or msg.get("bot_id"))
    text = (msg.get("text") or "").strip()
    for f in msg.get("files", []):
        text += f" [file: {f.get('name', 'attachment')}]"
    for a in msg.get("attachments", []):
        if a.get("title") or a.get("text"):
            text += f" [attachment: {a.get('title', '')} {a.get('text', '')[:200]}]"
    return f"{indent}- {fmt_ts(msg['ts'])} **{who}**: {text}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hours", type=float, default=None)
    args = parser.parse_args()

    with open(CONFIG_PATH) as f:
        config = json.load(f)

    hours = args.hours or config.get("lookback_hours", 24)
    oldest = time.time() - hours * 3600
    exit_code = 0

    print(f"# Slack transcript (last {hours:g}h)\n")

    for ch in config["channels"]:
        token = os.environ.get(ch["token_env"], "").strip()
        header = f"## Channel {ch['channel']} (workspace {ch['workspace']})"
        if not token:
            print(header)
            print(
                f"\nERROR: env var `{ch['token_env']}` is not set. "
                f"Set a Slack token for workspace {ch['workspace']} "
                "(xoxp-/xoxb- with channels:history, channels:read, users:read).\n"
            )
            exit_code = 1
            continue

        users = UserCache(token)
        try:
            info = api_call(token, "conversations.info", {"channel": ch["channel"]})
            ch_name = info["channel"].get("name", ch["channel"])
            msgs = paginate(
                token,
                "conversations.history",
                {"channel": ch["channel"], "oldest": f"{oldest:.6f}", "limit": 200},
                "messages",
            )
        except Exception as e:
            print(header)
            print(f"\nERROR: {e}\n")
            exit_code = 1
            continue

        msgs = [m for m in msgs if m.get("subtype") != "channel_join"]
        msgs.sort(key=lambda m: float(m["ts"]))
        print(f"## #{ch_name} ({ch['channel']}, workspace {ch['workspace']})")
        print(f"{len(msgs)} messages\n")

        for m in msgs:
            print(render_message(m, users))
            if m.get("reply_count") and m.get("thread_ts") == m.get("ts"):
                replies = paginate(
                    token,
                    "conversations.replies",
                    {
                        "channel": ch["channel"],
                        "ts": m["thread_ts"],
                        "limit": 200,
                    },
                    "messages",
                )
                for r in replies[1:]:
                    print(render_message(r, users, indent="    "))
        print()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
