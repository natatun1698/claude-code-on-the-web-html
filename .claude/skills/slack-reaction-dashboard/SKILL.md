---
name: slack-reaction-dashboard
description: Slackチャンネルのリアクション分析を行い、グラフ多めのExcelダッシュボードとNotion掲載用エクスポート(Markdown/PNG/CSV)を生成する。「Slackのリアクション分析」「リアクションランキング」「Slackダッシュボード」などの依頼で使用。データ取得(Slack API直接 or GitHub Actionsリレー)→分析→Excel/Notion出力まで一気通貫で実行できる。
---

# Slackリアクション分析ダッシュボード

Slackチャンネルの過去N日間(デフォルト30日)のリアクションを分析し、以下を生成する:

- `slack_reaction_dashboard.xlsx` — KPI + グラフ8点のExcelダッシュボード(ネイティブExcelグラフ)
- `notion_export/` — Notion掲載用の `dashboard.md` + グラフPNG×8 + ランキングCSV×5

必須の分析項目(必ず含める):
1. **リアクションした回数が多いユーザーランキング**
2. **リアクションされた回数が多いユーザーランキング**

追加: 人気絵文字、日別推移、曜日別、時間帯別、した vs された散布図、リアクション率。

## 実行手順

### 0. 依存関係の確認

```bash
pip install requests openpyxl matplotlib
```

PNG生成には日本語フォントが必要。`fc-list | grep -i -E 'noto.*cjk|ipa'` で確認し、
無ければ `apt-get install -y fonts-ipafont-gothic` などで導入する
(スクリプトは Noto Sans CJK JP / IPAPGothic / IPAGothic を自動検出する)。

### 1. データ取得 — 環境に応じて3つの経路から選ぶ

パラメータ: チャンネルID(URL `https://app.slack.com/client/T…/C…` の `C…` 部分)と日数。

**経路A: Slack MCPコネクタが使える場合**
セッションにSlackのMCPツール(conversations.history相当)があればそれで取得し、
下記「rawデータのスキーマ」のJSONを自分で組み立てて `data/slack_raw.json` に保存する。

**経路B: slack.comへ直接アクセスできる場合**(`curl -s https://slack.com/api/api.test` で確認)

```bash
export SLACK_TOKEN=xoxb-...   # 環境変数に設定されている場合もある
python .claude/skills/slack-reaction-dashboard/scripts/slack_reaction_dashboard.py fetch \
  --channel CBHRRSZAP --days 30 --out data/slack_raw.json
```

**経路C: サンドボックスからslack.comへ到達できない場合(Claude Code on the Webでは通常こちら)**
GitHub Actionsリレー `.github/workflows/slack-fetch.yml` を使う:

1. 前提: リポジトリのActions secretsに `SLACK_TOKEN` が登録済みであること。
   未登録ならユーザーに依頼する(必要スコープ: `channels:history`, `groups:history`,
   `reactions:read`, `users:read`)。
2. 現在のブランチをpushしてから、GitHub MCPの `actions_run_trigger` で
   workflow `slack-fetch.yml` を現在のブランチref・inputs `{channel, days}` で起動する。
3. `actions_get`(または `actions_list`)で実行完了をポーリングする(通常1〜3分。
   メッセージやスレッドが多いとSlackのレート制限で10分以上かかることもある)。
4. 完了後 `git pull` して `data/slack_raw.json` を取り込む。
5. 失敗した場合は `get_job_logs` でログを確認する(トークン未設定・スコープ不足・
   `not_in_channel`=Botが未参加、が典型)。

### 2. ダッシュボード生成

```bash
python .claude/skills/slack-reaction-dashboard/scripts/slack_reaction_dashboard.py build \
  --raw data/slack_raw.json --outdir output --tz Asia/Tokyo
```

### 3. 成果物の確認と提出

- `output/slack_reaction_dashboard.xlsx` をopenpyxlで開き直してシート・グラフ数を検証する
- PNGを1〜2枚目視確認する(文字化け=フォント未導入のサイン)
- ユーザーにはxlsxと `notion_export/` を提出する(SendUserFileが使える環境ではそれで送る)
- 動作確認だけしたい場合: `... demo --outdir /tmp/demo_out`

## rawデータのスキーマ (raw-v1)

経路Aで自分でJSONを組み立てる場合は次の形にする:

```json
{
  "schema": "slack-reaction-dashboard/raw-v1",
  "channel": "CBHRRSZAP",
  "channel_name": "general",
  "days": 30,
  "fetched_at": "2026-07-07T10:00:00+00:00",
  "users": {"U123": {"name": "田中", "is_bot": false}},
  "messages": [
    {"ts": "1751600000.000100", "user": "U123", "subtype": null, "thread_ts": null,
     "reactions": [{"name": "+1", "users": ["U456"], "count": 1}]}
  ]
}
```

スレッド返信のメッセージも `messages` にフラットに含める(返信にもリアクションが付くため)。

## 集計仕様(問い合わせがあったとき用)

- 「した回数」= ユーザー×絵文字×メッセージ の組み合わせを1回とカウント
- 「された回数」= メッセージ投稿者に、そのメッセージの全リアクション数を加算
- 日別/曜日別/時間帯別は**メッセージ投稿日時ベース**(Slack APIはリアクション時刻を返さない)
- `channel_join` 等のシステムメッセージは集計から除外
- タイムゾーンは `--tz`(デフォルト Asia/Tokyo)

## Notionへの掲載(アップ先が決まったら)

ExcelのグラフはNotionに直接埋め込めないため、`notion_export/` を使う:

- **手軽な方法**: Notionの「インポート」で `dashboard.md` を取り込み、PNGを各セクションに
  ドラッグ&ドロップする(MDインポートはローカル画像を自動では取り込まない)
- **Notion MCP/APIが使える場合**: ページを作成し、`dashboard.md` の構成どおりに
  見出し+画像ブロック+テーブルを流し込む。ランキングはCSVをNotionデータベースとして
  インポートしてもよい
- Excel側の `D_*` シートはすべてフラット表なので、そのままデータベース化できる

## プライバシー注意

経路Cは取得したSlackメッセージのメタデータ(ユーザーID・リアクション)をリポジトリに
コミットする。分析完了後、必要に応じて `data/slack_raw.json` を削除するコミットを行う。
