# Slack リアクション分析ツール

Slack チャンネル(デフォルト: `CBHRRSZAP`)の**過去30日間**のリアクションを集計して、
Excel レポート (`output/slack_reaction_report.xlsx`) を生成するツールです。

- リアクションを**した**回数が多いユーザーランキング
- リアクションを**された**回数が多いユーザーランキング
- 絵文字の使用回数ランキング
- bot の投稿は除外、スレッド返信も集計に含めます

さらに、生成したレポートを **Gmail でメール送信**したり、**Notion にアップロード**したりできます。
GitHub Actions により**毎朝6時(日本時間)に自動実行**されます。

## プロジェクト構成

```
.
├── src/
│   ├── slack_reaction_report.py  # メイン: Slack からデータ取得 → Excel 生成
│   ├── send_email.py             # レポートを Gmail SMTP でメール送信
│   └── upload_to_notion.py       # レポートを Notion にアップロード
├── output/                       # 生成された Excel の出力先
├── .github/workflows/
│   └── daily-report.yml          # 毎朝6時(JST)の自動実行ワークフロー
├── .claude/skills/
│   └── slack-reaction-report/    # Claude Code 用スキル(AIにメンテを頼むとき用)
├── .env.example                  # 環境変数のテンプレート
├── requirements.txt              # 必要な Python ライブラリ
└── README.md
```

## セットアップ

### 1. Slack アプリ(Bot)の準備

1. https://api.slack.com/apps で Slack アプリを作成します
2. **OAuth & Permissions** で以下の **Bot Token Scopes** を追加します
   - `channels:history` … チャンネルのメッセージ読み取り
   - `channels:read` … チャンネル情報の読み取り
   - `users:read` … ユーザー名の解決
   - (プライベートチャンネルの場合は `groups:history` と `groups:read` も)
3. ワークスペースにインストールして **Bot User OAuth Token**(`xoxb-` で始まる)をコピーします
4. 対象チャンネルで `/invite @ボット名` を実行して Bot を招待します

### 2. Python 環境の準備

```bash
# (推奨)仮想環境を作成して有効化
python -m venv .venv
source .venv/bin/activate   # Windows は .venv\Scripts\activate

# ライブラリをインストール
pip install -r requirements.txt
```

### 3. 環境変数の設定

```bash
# テンプレートをコピーして .env を作成
cp .env.example .env
```

`.env` をエディタで開いて値を設定します:

| 変数名 | 必須 | 説明 |
|---|---|---|
| `SLACK_BOT_TOKEN` | ✅ | Slack Bot のトークン(`xoxb-` で始まる) |
| `SLACK_CHANNEL_ID` | - | 対象チャンネルID(省略時は `CBHRRSZAP`) |
| `GMAIL_ADDRESS` | メール送信時 | 送信元 Gmail アドレス |
| `GMAIL_APP_PASSWORD` | メール送信時 | Gmail の[アプリパスワード](https://myaccount.google.com/apppasswords) |
| `REPORT_TO_EMAIL` | メール送信時 | 送信先アドレス(カンマ区切りで複数可) |
| `NOTION_TOKEN` | Notion 利用時 | Notion インテグレーションのトークン |
| `NOTION_PARENT_PAGE_ID` | Notion 利用時 | レポートページを作る親ページのID |

> ⚠️ `GMAIL_APP_PASSWORD` は通常のパスワードではなく「アプリパスワード」です。
> Google アカウントの2段階認証を有効にした上で発行してください。

## 実行方法

```bash
# 1. レポート(Excel)を生成する
python src/slack_reaction_report.py

# 2. レポートをメールで送信する(任意)
python src/send_email.py

# 3. レポートを Notion にアップロードする(任意)
python src/upload_to_notion.py
```

実行が終わると `output/slack_reaction_report.xlsx` が生成されます。

### Excel シート構成

| シート名 | 内容 | 列 |
|---|---|---|
| `most_reactive_users` | リアクションした回数ランキング | rank / user_name / reactions_made / favorite_emoji |
| `most_reacted_users` | リアクションされた回数ランキング | rank / user_name / reactions_received / top_received_emoji |
| `emoji_ranking` | 絵文字の使用回数ランキング | emoji / count |

## 毎朝6時(JST)の自動実行(GitHub Actions)

`.github/workflows/daily-report.yml` により、**毎朝6:00(日本時間)= 21:00 UTC** に
レポート生成 → メール送信が自動で実行されます。手動実行も Actions タブの
「Run workflow」からできます。

### GitHub Secrets の登録

リポジトリの **Settings → Secrets and variables → Actions** で以下を登録してください:

- `SLACK_BOT_TOKEN`(必須)
- `SLACK_CHANNEL_ID`(任意。未設定なら `CBHRRSZAP`)
- `GMAIL_ADDRESS` / `GMAIL_APP_PASSWORD` / `REPORT_TO_EMAIL`(メール送信用)
- `NOTION_TOKEN` / `NOTION_PARENT_PAGE_ID`(Notion 連携を使う場合)

Notion アップロードをワークフローで有効にするには、同じ画面の **Variables** タブで
`ENABLE_NOTION_UPLOAD` = `true` を登録します(Notion の準備が整うまでは未登録でOK)。

生成された Excel は GitHub Actions の **Artifacts** からも30日間ダウンロードできます。

## Notion アップロードについて

アップロード先の Notion が決まったら:

1. https://www.notion.so/my-integrations でインテグレーションを作成してトークンを取得
2. レポートを置きたい親ページを開き、右上「…」→「接続」からインテグレーションを接続
3. 親ページのURLの末尾32桁が `NOTION_PARENT_PAGE_ID` です
   (例: `notion.so/My-Page-1234abcd...` → `1234abcd...` の部分)
4. `.env`(ローカル)や GitHub Secrets に設定して `python src/upload_to_notion.py` を実行

レポートは「親ページの下の新規ページ」として作られ、3つのランキングがテーブルで
書き込まれるほか、xlsx ファイル本体も添付されます。

## トラブルシューティング

| エラー | 対処 |
|---|---|
| `invalid_auth` | `SLACK_BOT_TOKEN` の値を確認 |
| `channel_not_found` | チャンネルIDを確認 |
| `not_in_channel` | Bot をチャンネルに `/invite` する |
| `missing_scope` | Bot Token Scopes を追加して再インストール |
| Gmail 認証エラー | アプリパスワードを使っているか確認(2段階認証が必要) |
| Notion 404 | 親ページにインテグレーションが「接続」されているか確認 |
