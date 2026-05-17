# Slack リアクション分析ツール

Slack チャンネルの過去30日間のリアクションを集計し、Excelレポートを生成するツールです。

## 機能

- **リアクション実行ランキング**: よくリアクションするユーザーを集計
- **リアクション受信ランキング**: よくリアクションされるユーザーを集計
- **絵文字ランキング**: よく使われる絵文字を集計
- **Excelレポート出力**: 3シートのレポートを `output/slack_reaction_report.xlsx` に保存
- **メール送信**: Gmail SMTP でレポートを自動送信（任意）
- **GitHub Actions**: 毎朝6時(JST)に自動実行

## 必要な Slack Bot スコープ

Slack アプリに以下の Bot Token Scopes が必要です:

| スコープ | 用途 |
|---|---|
| `channels:history` | チャンネルのメッセージ取得 |
| `channels:read` | チャンネル情報の読み取り |
| `reactions:read` | リアクション情報の読み取り |
| `users:read` | ユーザー名の解決 |

> **注意**: プライベートチャンネルを対象にする場合は `groups:history` も必要です。

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd <repository-name>
```

### 2. 仮想環境の作成と依存パッケージのインストール

```bash
python -m venv venv
source venv/bin/activate  # Windows の場合: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、各値を設定します:

```bash
cp .env.example .env
```

`.env` ファイルを編集:

```env
SLACK_BOT_TOKEN=xoxb-your-token-here
GMAIL_ADDRESS=your-address@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
REPORT_TO_EMAIL=recipient@example.com
```

#### Slack Bot Token の取得方法

1. [Slack API](https://api.slack.com/apps) にアクセス
2. **Create New App** → **From scratch** を選択
3. **OAuth & Permissions** → **Bot Token Scopes** に必要なスコープを追加
4. **Install to Workspace** でインストール
5. **Bot User OAuth Token**（`xoxb-` から始まる）をコピー

#### Gmail アプリパスワードの取得方法

1. Google アカウントの **セキュリティ** 設定を開く
2. **2段階認証プロセス** を有効化（未設定の場合）
3. **アプリパスワード** を選択
4. アプリを選択して生成されたパスワードを使用

> メール送信が不要な場合は `GMAIL_*` と `REPORT_TO_EMAIL` は設定不要です。

## 実行方法

```bash
# 仮想環境を有効化（未実施の場合）
source venv/bin/activate

# 分析を実行
python slack_reaction_analyzer.py
```

実行後、`output/slack_reaction_report.xlsx` にレポートが生成されます。

### 実行ログの例

```
2024-01-15 09:00:00 [INFO] Analysis period: 2023-12-16 → 2024-01-15
2024-01-15 09:00:01 [INFO] Fetching user list...
2024-01-15 09:00:02 [INFO] Fetched 120 users.
2024-01-15 09:00:02 [INFO] Fetching messages from channel CBHRRSZAP ...
2024-01-15 09:00:05 [INFO]   Fetched 200 messages so far...
2024-01-15 09:00:10 [INFO] Total messages (including thread replies): 543
2024-01-15 09:00:10 [INFO] Analyzing reactions...
2024-01-15 09:00:10 [INFO] Unique reactors: 45
2024-01-15 09:00:10 [INFO] Unique posters with reactions: 38
2024-01-15 09:00:10 [INFO] Unique emojis used: 62
2024-01-15 09:00:10 [INFO] Generating Excel report...
2024-01-15 09:00:11 [INFO] Excel report saved: output/slack_reaction_report.xlsx
2024-01-15 09:00:11 [INFO] Sending report email to recipient@example.com ...
2024-01-15 09:00:13 [INFO] Email sent successfully.
2024-01-15 09:00:13 [INFO] Done! Report: output/slack_reaction_report.xlsx
```

## 出力ファイル

`output/slack_reaction_report.xlsx` に以下の3シートが生成されます:

### シート1: most_reactive_users

よくリアクションするユーザーのランキング

| rank | user_name | reactions_made | favorite_emoji |
|------|-----------|---------------|----------------|
| 1 | 山田太郎 | 152 | :thumbsup: |
| 2 | 鈴木花子 | 98 | :heart: |

### シート2: most_reacted_users

よくリアクションされるユーザーのランキング

| rank | user_name | reactions_received | top_received_emoji |
|------|-----------|-------------------|-------------------|
| 1 | 佐藤次郎 | 204 | :tada: |
| 2 | 田中三郎 | 176 | :thumbsup: |

### シート3: emoji_ranking

絵文字ごとの使用回数ランキング

| emoji | count |
|-------|-------|
| :thumbsup: | 312 |
| :heart: | 256 |

## GitHub Actions による自動実行

毎朝6時(JST)に自動実行されます。

### Secrets の設定方法

1. GitHub リポジトリの **Settings** → **Secrets and variables** → **Actions** を開く
2. **New repository secret** で以下を追加:

| シークレット名 | 値 |
|---|---|
| `SLACK_BOT_TOKEN` | Slack の Bot Token |
| `GMAIL_ADDRESS` | 送信元 Gmail アドレス |
| `GMAIL_APP_PASSWORD` | Gmail アプリパスワード |
| `REPORT_TO_EMAIL` | 送信先メールアドレス |

### 手動実行

GitHub の **Actions** タブ → **Daily Slack Reaction Report** → **Run workflow** で手動実行できます。

実行後、レポートファイルはアーティファクトとしてダウンロード可能です（30日間保存）。

## プロジェクト構成

```
.
├── slack_reaction_analyzer.py   # メインスクリプト
├── requirements.txt             # Python 依存パッケージ
├── .env.example                 # 環境変数サンプル
├── .env                         # 環境変数（git管理外）
├── output/
│   └── slack_reaction_report.xlsx  # 生成されるレポート
└── .github/
    └── workflows/
        └── daily_report.yml    # GitHub Actions ワークフロー
```

## トラブルシューティング

| エラー | 原因 | 対処法 |
|--------|------|--------|
| `SLACK_BOT_TOKEN が設定されていません` | .env ファイルが未設定 | `.env` を作成して Token を設定 |
| `Slack API error: not_in_channel` | ボットがチャンネルに未参加 | 対象チャンネルにボットを招待 |
| `Slack API error: channel_not_found` | チャンネルIDが誤り | チャンネルIDを確認 |
| `Failed to send email` | Gmail 認証失敗 | アプリパスワードを確認 |