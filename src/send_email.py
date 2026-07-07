"""
レポートを Gmail (SMTP) でメール送信するスクリプト
==================================================

output/slack_reaction_report.xlsx を添付ファイルとして
指定のメールアドレスに送信します。

実行方法:
    python src/send_email.py

必要な環境変数(.env ファイルに書きます):
    GMAIL_ADDRESS      : 送信元の Gmail アドレス
    GMAIL_APP_PASSWORD : Gmail のアプリパスワード
    REPORT_TO_EMAIL    : 送信先アドレス(カンマ区切りで複数指定可)

※ Gmail の「アプリパスワード」は通常のログインパスワードとは別物です。
   Google アカウントで2段階認証を有効にした上で、
   https://myaccount.google.com/apppasswords から発行してください。
"""

import os
import smtplib
import sys
from datetime import date
from email.message import EmailMessage

from dotenv import load_dotenv

# 添付するレポートファイルのパス
REPORT_PATH = os.path.join("output", "slack_reaction_report.xlsx")

# Gmail の SMTP サーバー設定(SSL接続)
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def main():
    # .env ファイルから環境変数を読み込む
    load_dotenv()

    gmail_address = os.environ.get("GMAIL_ADDRESS")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD")
    report_to_email = os.environ.get("REPORT_TO_EMAIL")

    # 必要な環境変数が揃っているかチェックする
    missing = []
    if not gmail_address:
        missing.append("GMAIL_ADDRESS")
    if not gmail_app_password:
        missing.append("GMAIL_APP_PASSWORD")
    if not report_to_email:
        missing.append("REPORT_TO_EMAIL")
    if missing:
        print(f"エラー: 環境変数 {', '.join(missing)} が設定されていません。")
        sys.exit(1)

    # レポートファイルが存在するかチェックする
    if not os.path.exists(REPORT_PATH):
        print(f"エラー: {REPORT_PATH} が見つかりません。")
        print("先に python src/slack_reaction_report.py を実行してください。")
        sys.exit(1)

    # ------------------------------------------------------------
    # メールを組み立てる
    # ------------------------------------------------------------
    today = date.today().strftime("%Y-%m-%d")

    message = EmailMessage()
    message["Subject"] = f"Slack リアクションレポート ({today})"
    message["From"] = gmail_address
    # カンマ区切りの複数アドレスに対応(前後の空白は取り除く)
    message["To"] = ", ".join(addr.strip() for addr in report_to_email.split(","))

    # メール本文
    message.set_content(
        f"Slack リアクション分析レポート({today})をお送りします。\n"
        "添付の Excel ファイルをご確認ください。\n"
        "\n"
        "シート構成:\n"
        "  1. most_reactive_users : リアクションした回数ランキング\n"
        "  2. most_reacted_users  : リアクションされた回数ランキング\n"
        "  3. emoji_ranking       : 絵文字ランキング\n"
        "\n"
        "※ このメールは自動送信です。\n"
    )

    # Excel ファイルを添付する
    with open(REPORT_PATH, "rb") as f:
        message.add_attachment(
            f.read(),
            # xlsx ファイルの MIME タイプ
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=os.path.basename(REPORT_PATH),
        )

    # ------------------------------------------------------------
    # Gmail の SMTP サーバー経由で送信する
    # ------------------------------------------------------------
    try:
        print(f"メールを送信しています... (宛先: {message['To']})")
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.login(gmail_address, gmail_app_password)
            smtp.send_message(message)
        print("送信しました!")

    except smtplib.SMTPAuthenticationError:
        print("エラー: Gmail へのログインに失敗しました。")
        print("→ GMAIL_ADDRESS と GMAIL_APP_PASSWORD を確認してください。")
        print("→ アプリパスワード(2段階認証が必要)を使っているか確認してください。")
        sys.exit(1)
    except Exception as e:
        print(f"エラー: メール送信に失敗しました: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
