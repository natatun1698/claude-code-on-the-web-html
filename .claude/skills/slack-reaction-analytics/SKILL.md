---
name: slack-reaction-analytics
description: Slackチャネルの過去30日間（日数変更可）のリアクション分析を実行し、グラフ多めのExcelダッシュボードとNotion用エクスポート（Markdown・PNG・CSV）を生成する。「リアクション分析」「Slackの分析」「Slackダッシュボード」といった依頼、または /slack-reaction-analytics で使用する。
---

# Slack リアクション分析ダッシュボード

`scripts/slack_reaction_dashboard.py` を実行して、指定 Slack チャネルの
リアクション分析ダッシュボードを Excel + Notion 用フォーマットで生成する。

必ず含まれる分析（各チャネル別シート＋全体サマリーシート）:
1. リアクションした回数が多いユーザーランキング Top10
2. リアクションされた回数が多いユーザーランキング Top10
3. 投稿が多いユーザーランキング Top10

追加グラフ: よく使われた絵文字 Top10 / 日別 投稿数・リアクション数の推移 /
時間帯別投稿数 (JST) / チャネル別比較（サマリーのみ）

## 実行手順

1. 依存パッケージを確認・インストールする:
   ```bash
   pip install -r requirements.txt
   ```

2. Slack トークンを確認する。優先順: `SLACK_BOT_TOKEN` → `SLACK_USER_TOKEN` → `SLACK_TOKEN`。
   ```bash
   env | grep -oE 'SLACK_(BOT_|USER_)?TOKEN' | head -3
   ```
   - トークンが**ある**場合 → 手順3で本番実行。
   - トークンが**ない**場合 → ユーザーに設定を依頼する
     （Claude Code on the Web なら環境設定の環境変数に追加してもらう）。
     レイアウト確認だけなら `--demo` でサンプル生成できる。
   - 必要スコープ: `channels:read` `channels:history` `groups:read`
     `groups:history` `reactions:read` `users:read`
     （プライベートチャネルは Bot をチャネルに招待しておく必要がある）

3. スクリプトを実行する:
   ```bash
   python3 scripts/slack_reaction_dashboard.py \
     --channels C02REH1V7QW C02SC8DRRDG \
     --days 30 \
     --out output
   ```
   - デフォルトチャネルは `C02REH1V7QW` と `C02SC8DRRDG`
     （ワークスペース TBJRY8G6S）。ユーザーが別チャネルを指定したら
     `--channels` を差し替える。
   - 期間の指定があれば `--days` を変更する。
   - Slack API のレートリミット処理はスクリプト内蔵。メッセージ数が多いと
     数分かかることがあるので、そのまま完了を待つ。

4. 生成物をユーザーに送る（SendUserFile など、その環境のファイル送信手段で）:
   - `output/slack_reaction_dashboard_YYYYMMDD.xlsx` … メイン成果物
   - `output/notion/summary.md` … Notion 貼り付け用サマリー

## 出力の構成

- **Excel**: シート「サマリー」(全チャネル合計 + チャネル比較) と
  チャネルごとのシート。各シートに KPI（投稿数 / リアクション総数 /
  アクティブユーザー数 / 1投稿あたりリアクション）と 6 種のグラフ。
  集計元データは非表示の `Data_*` シートにあり、再表示すれば確認できる。
- **Notion 用** (`output/notion/`): アップ先の Notion ページが決まったら
  そのまま使えるように、`summary.md`（テーブル + 画像リンク入り Markdown）、
  `images/*.png`（全グラフ）、`csv/*.csv`（各ランキング・日次データ。
  Notion のデータベースインポート対応の UTF-8 BOM 付き）を出力する。
  Notion 連携（MCP コネクタ等）が使える環境なら、summary.md の内容と画像を
  指定ページにアップロードするところまで代行してよい。

## 注意事項

- 集計はすべて JST。リアクション数はメッセージに現在付いている数
  （期間内の投稿に対するもの）を数える。
- スレッド返信も投稿数・リアクションに含む。join/leave 等のシステム
  メッセージは除外。
- Slack の仕様でメッセージ本体の reactions.users が切り詰められる場合は
  `reactions.get` で自動補完する。
- 出力ディレクトリ `output/` は git 管理外。成果物はコミットしない。
