# claude-code-on-the-web-html

## Slack リアクション分析ダッシュボード

指定した Slack チャネルの過去 30 日間（日数変更可）のリアクションを分析し、
グラフ入りの Excel ダッシュボードと Notion 用エクスポートを生成するツールです。

- スクリプト: [`scripts/slack_reaction_dashboard.py`](scripts/slack_reaction_dashboard.py)
- Claude Code スキル: [`.claude/skills/slack-reaction-analytics/SKILL.md`](.claude/skills/slack-reaction-analytics/SKILL.md)
  — このリポジトリのセッションで `/slack-reaction-analytics` として呼び出せます
  （モデル非依存。Sonnet 5 でも実行可能）。

### 含まれる分析（チャネル別シート + 全体サマリー）

1. リアクションした回数が多いユーザーランキング Top10
2. リアクションされた回数が多いユーザーランキング Top10
3. 投稿が多いユーザーランキング Top10
4. よく使われた絵文字 Top10
5. 日別 投稿数・リアクション数の推移
6. 時間帯別投稿数 (JST)
7. チャネル別比較（サマリーのみ）

### セットアップ

```bash
pip install -r requirements.txt
export SLACK_BOT_TOKEN=xoxb-...
```

トークンに必要なスコープ:
`channels:read` `channels:history` `groups:read` `groups:history`
`reactions:read` `users:read`
（プライベートチャネルを分析する場合は Bot をチャネルに招待してください）

### 実行

```bash
# デフォルト: C02REH1V7QW / C02SC8DRRDG を過去30日分
python3 scripts/slack_reaction_dashboard.py

# チャネル・期間を指定
python3 scripts/slack_reaction_dashboard.py --channels C02REH1V7QW C02SC8DRRDG --days 30

# トークンなしでレイアウト確認 (サンプルデータ)
python3 scripts/slack_reaction_dashboard.py --demo
```

### 出力

```
output/
├── slack_reaction_dashboard_YYYYMMDD.xlsx   # グラフ入りダッシュボード
└── notion/                                  # Notion アップ用
    ├── summary.md                           # テーブル + 画像リンク入り Markdown
    ├── images/*.png                         # 全グラフの画像版
    └── csv/*.csv                            # ランキング・日次データ (BOM 付き UTF-8)
```

Excel のグラフは Notion にそのまま埋め込めないため、Notion のページが決まったら
`notion/` 配下の Markdown・PNG・CSV をインポートする想定です。
