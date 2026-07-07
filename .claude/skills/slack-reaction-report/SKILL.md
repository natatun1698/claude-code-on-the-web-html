---
name: slack-reaction-report
description: Slack チャンネルの過去30日間のリアクションを分析して Excel レポートを生成し、メール送信や Notion アップロードまで行う。ユーザーが「Slackのリアクション分析」「リアクションレポート」「reaction report」を実行・更新・修正したいときに使う。
---

# Slack リアクション分析レポート

このリポジトリには、Slack チャンネル(デフォルト: `CBHRRSZAP`)の過去30日間の
リアクションを集計して Excel レポートを作るツール一式が入っている。

## プロジェクト構成

| ファイル | 役割 |
|---|---|
| `src/slack_reaction_report.py` | メイン。Slack からデータ取得 → 集計 → `output/slack_reaction_report.xlsx` を生成 |
| `src/send_email.py` | 生成済み xlsx を Gmail SMTP で添付送信 |
| `src/upload_to_notion.py` | 生成済み xlsx の内容を Notion ページ(テーブル+ファイル添付)としてアップロード |
| `.github/workflows/daily-report.yml` | 毎朝6時 JST (`0 21 * * *` UTC) に自動実行 |
| `.env.example` | 必要な環境変数の一覧(コピーして `.env` を作る) |

## 実行手順

1. 依存関係をインストール: `pip install -r requirements.txt`
2. `.env` が無ければ `.env.example` をコピーして作成し、必要な値を設定する
3. レポート生成: `python src/slack_reaction_report.py`
4. (任意)メール送信: `python src/send_email.py`
5. (任意)Notion アップロード: `python src/upload_to_notion.py`

必要な環境変数: `SLACK_BOT_TOKEN`(必須)、`SLACK_CHANNEL_ID`(任意)、
メール送信には `GMAIL_ADDRESS` / `GMAIL_APP_PASSWORD` / `REPORT_TO_EMAIL`、
Notion には `NOTION_TOKEN` / `NOTION_PARENT_PAGE_ID`。

## 仕様(変更時に守ること)

- 集計対象は過去30日間のみ(`DAYS_TO_ANALYZE = 30`)
- bot の投稿・bot によるリアクションは除外する
- スレッド返信も `conversations.replies` で取得して集計に含める
- `conversations.history` / `users.list` / `conversations.replies` はすべて
  カーソルページネーション対応。rate limit (429) は `Retry-After` 秒待ってリトライ
- Excel は3シート構成(列名・順序を変えないこと):
  1. `most_reactive_users`: rank / user_name / reactions_made / favorite_emoji
  2. `most_reacted_users`: rank / user_name / reactions_received / top_received_emoji
  3. `emoji_ranking`: emoji / count
- 出力先は `output/slack_reaction_report.xlsx` 固定

## Notion アップロードについて

アップロード先の Notion は後から決まる想定。ユーザーから Notion のページや
トークンを渡されたら、`.env`(ローカル)または GitHub Secrets の
`NOTION_TOKEN` / `NOTION_PARENT_PAGE_ID` に設定し、GitHub Actions で有効にする場合は
リポジトリの Actions Variables に `ENABLE_NOTION_UPLOAD=true` を設定する。
親ページにインテグレーションの「接続」が必要な点をユーザーに必ず案内すること。

## トラブルシューティング

- `not_in_channel`: Bot をチャンネルに `/invite` してもらう
- `missing_scope`: `channels:history` `channels:read` `users:read` を追加
  (プライベートチャンネルは `groups:history` `groups:read`)
- Gmail 認証エラー: アプリパスワード(2段階認証必須)を使っているか確認
- Notion 404: 親ページにインテグレーションが接続されているか確認
- コード修正時は初心者向けの日本語コメントのスタイルを維持すること
