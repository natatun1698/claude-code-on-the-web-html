#!/usr/bin/env python3
"""
週次スケジューラー：毎週月曜日に scraper.py を実行してメール送信する。

使い方:
  python3 scheduler.py          # バックグラウンドで常時実行（推奨: screen / nohup）
  python3 scheduler.py --now    # 今すぐ1回だけ実行してスケジューラーも起動
  python3 scheduler.py --once   # 今すぐ1回だけ実行して終了

環境変数 (必須):
  SENDER_EMAIL      送信元 Gmail アドレス
  SENDER_PASSWORD   Gmail アプリパスワード

nohup 例:
  nohup python3 scheduler.py --now > scheduler.log 2>&1 &
"""

import argparse
import logging
import sys
import time

import schedule

from scraper import run

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("scheduler.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

WEEKLY_DAY = "monday"   # 毎週月曜日
WEEKLY_TIME = "08:00"   # 日本時間 08:00（サーバーのタイムゾーンに合わせて調整）


def job():
    logger.info("定期実行: 講演情報収集を開始します")
    try:
        run()
    except Exception as e:
        logger.error(f"実行中にエラーが発生しました: {e}", exc_info=True)


def main():
    parser = argparse.ArgumentParser(description="西脇資哲さん講演情報 週次スケジューラー")
    parser.add_argument("--now", action="store_true", help="今すぐ1回実行してからスケジューラーを起動")
    parser.add_argument("--once", action="store_true", help="今すぐ1回だけ実行して終了")
    args = parser.parse_args()

    if args.once:
        logger.info("--once モード: 1回実行して終了します")
        job()
        sys.exit(0)

    if args.now:
        logger.info("--now モード: 今すぐ1回実行します")
        job()

    # 毎週月曜 08:00 に実行
    getattr(schedule.every(), WEEKLY_DAY).at(WEEKLY_TIME).do(job)
    logger.info(f"スケジューラー起動: 毎週{WEEKLY_DAY} {WEEKLY_TIME} に実行します")
    logger.info("Ctrl+C で停止できます")

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
