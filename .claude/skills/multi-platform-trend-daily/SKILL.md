---
name: multi-platform-trend-daily
description: はてブIT・Hacker News・Reddit・X・YouTube・note.com・RED（小紅書）・セキュリティブログからトレンド情報を収集・分析し、ideas/daily/YYYYMMDD-trend.md に保存する。「トレンド収集」「ネタ収集」「今日のトレンド」と言われたら使う。
---

# マルチプラットフォーム トレンドネタ収集

はてなブックマークIT・Hacker News・Reddit・X（旧Twitter）・YouTube・note.com・RED（小紅書）・セキュリティブログの人気コンテンツを収集し、`ideas/daily/YYYYMMDD-trend.md` に保存する。

## 実行手順

### 0. ユーザープロファイル読み込み

`CLAUDE.md` を読み込み、以下の興味領域を理解する（CLAUDE.mdに定義があればそちらを優先）：
- AI（開発とセキュリティへの応用）
- Webセキュリティ/ハッキング（OWASP、脆弱性、サプライチェーン攻撃）
- OSS開発/コミュニティ
- 個人開発/SaaS運営（Technical SEO、グロースハック、収益化）
- キャリア/人生哲学（経済的自由、外資転職、Build in Public）
- JavaScript/TypeScript技術スタック

### 1. トレンド情報の収集

各プラットフォームは取得方法が異なる。**並列実行できるものは並列で**取得すること。
`scripts/` 配下に検証済みの取得スクリプトがあるので、コードを書き直さずそれを使う。

#### 1-1. 日本市場（はてブIT）

- メインカテゴリはRSSが最速（ブックマーク数 `hatena:bookmarkcount` 込みで取れる）:
  ```bash
  curl -s "https://b.hatena.ne.jp/hotentry/it.rss"
  ```
- サブカテゴリページには `.rss` が**存在しない**（404になる）ため、WebFetchツールでHTMLページから抽出する:
  - https://b.hatena.ne.jp/hotentry/it/プログラミング
  - https://b.hatena.ne.jp/hotentry/it/AI・機械学習
  - https://b.hatena.ne.jp/hotentry/it/はてなブログ（テクノロジー）
  - https://b.hatena.ne.jp/hotentry/it/セキュリティ技術
  - https://b.hatena.ne.jp/hotentry/it/エンジニア
- 各エントリーの**タイトル、元記事URL、ブックマーク数**を必ず取得すること
- はてブのエントリーページURLではなく、リンク先の**元記事URL**を抽出

#### 1-2. グローバル（Hacker News）

Algolia APIで一発取得（WebFetchより確実・高速）:
```bash
curl -s "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30" | \
  jq -r '.hits[] | "\(.points)pt|\(.num_comments)c|\(.title)|https://news.ycombinator.com/item?id=\(.objectID)"'
```
- **元記事URLではなくHNのコメントページURL**（`https://news.ycombinator.com/item?id=XXXXX`形式）を使用すること
- **タイトルは日本語に翻訳して出力**

#### 1-3. セキュリティブログ

WebFetchで最新1〜3記事をチェックし、興味度★★★のものがあれば注目トピックに含める:
- https://www.aikido.dev/blog - セキュリティ研究開発者向け
- https://www.wiz.io/blog - クラウドセキュリティ

#### 1-4. Reddit（13サブレッド）

**重要**: WebFetchはreddit.comをブロックし、さらにデータセンターIPからは
`hot.json` も**403**を返す。同梱スクリプトがフォールバックチェーン
（hot.json → hot.rss + arctic-shift APIによるスコア補完）を実装済みなのでこれを使う:

```bash
python3 .claude/skills/multi-platform-trend-daily/scripts/fetch_reddit.py > reddit.json
```

- RSS経路はレート制限が厳しい（連続リクエストで429）。スクリプトは12秒間隔+指数バックオフ済み。**全13サブレッドで3〜5分かかるので、必ずバックグラウンド実行し、待ち時間に他プラットフォームを収集する**
- 各記事の**タイトル、Redditコメントページの完全URL、投票数（ups）、コメント数**を取得（RSS経路のスコアはarctic-shiftの取り込み時点の概算値。補完に失敗した場合は「-」でよい）
- **タイトルは日本語に翻訳して出力**

対象サブレッド:
| カテゴリ | サブレッド |
|---------|-----------|
| セキュリティ系 | r/netsec, r/cybersecurity |
| AI系 | r/OpenAI, r/LocalLLaMA, r/ClaudeCode |
| コア技術系 | r/programming, r/technology |
| OSS/個人開発系 | r/opensource, r/indiehackers, r/webdev, r/javascript |
| キャリア/実践系 | r/cscareerquestions, r/productivity |

#### 1-5. X（旧Twitter）

x.comはJavaScriptレンダリング必須でWebFetch不可だが、**syndication API（埋め込みウィジェット用エンドポイント）ならログイン・APIキー不要**で公開アカウントの直近約20ツイート（本文・いいね数・RT数付き）が取れる:

```bash
python3 .claude/skills/multi-platform-trend-daily/scripts/fetch_x_timeline.py \
  AnthropicAI OpenAI GoogleDeepMind github vercel > x.json
```

- ウォッチ対象アカウントはCLAUDE.mdに定義があればそれを使う。なければ上記デフォルト＋興味領域に合うアカウントを選ぶ
- 各ツイートの**本文（日本語に翻訳）、ポストURL、いいね数、RT数**を取得
- いいね数が多い直近24〜48時間のポストを優先
- **単発ポストURLの内容確認**には `https://api.fxtwitter.com/status/<tweet_id>` を使う（JSONで本文+メトリクスが返る）
- キーワード検索が必要な場合のみブラウザ自動化（claude-in-chromeやPlaywright）にフォールバック

#### 1-6. YouTube

APIキー不要で2経路。同梱スクリプトを使う:

```bash
# 興味領域キーワードで今週の動画を検索（再生数・投稿時期付き）
python3 .claude/skills/multi-platform-trend-daily/scripts/fetch_youtube.py \
  search "claude code" "AI agent" "個人開発" > yt-search.json

# ウォッチ対象チャンネルの新着（チャンネルIDはUCで始まる形式）
python3 .claude/skills/multi-platform-trend-daily/scripts/fetch_youtube.py \
  channel UCXZCJLdBC09xxGZ6gcdrc6A > yt-channels.json
```

- 検索キーワードは興味領域から3〜5個選ぶ（例: claude code / AI agent / TypeScript / 個人開発 / セキュリティ）
- 各動画の**タイトル（日本語に翻訳）、動画URL、再生数、投稿時期、チャンネル名**を取得
- 再生数が多く投稿が新しい（1週間以内）ものを優先

#### 1-7. note.com

- **ハッシュタグページ**をWebFetchで取得し、人気記事（スキ数付き）を抽出:
  - https://note.com/hashtag/AI
  - https://note.com/hashtag/個人開発
  - https://note.com/hashtag/エンジニア
  - https://note.com/hashtag/キャリア
- **クリエイターの新着**はRSSで取れる: `https://note.com/{urlname}/rss`
- note.comの内部API（`/api/v3/...`）は認証なしだとAccess deniedになるので使わない
- 各記事の**タイトル、記事URL、スキ数（取得できる場合）、著者名**を取得

#### 1-8. RED（小紅書 / Xiaohongshu）

**最も不安定なソース**。コンテンツの大半がJavaScriptレンダリング+ログイン必須。

1. まずWebFetchで試す: `https://www.xiaohongshu.com/search_result?keyword=<キーワード>`（キーワード例: AI编程 / Claude / 独立开发）
2. 中身が取れない場合はブラウザ自動化（claude-in-chrome / Playwright）にフォールバック
3. それでも取れない場合は**セクションごとスキップし、出力に「本日取得不可」と明記**（エラーで全体を止めない）
- 取得できた場合は**タイトル（日本語に翻訳）、ノートURL、いいね数**を記録
- 中国語コンテンツなので、興味領域（AI開発・個人開発など）に関係するものだけ選ぶ

### 2. 分析

収集した情報を以下の観点で分析：

**興味領域マッチング（最優先）**
- 各記事・ポスト・動画を興味領域と照合し、関連度を評価
- 高関連度のものを「注目トピック」の最上位に配置

**プラットフォーム別の見方**
- はてブIT: 日本のエンジニアに刺さりやすい話題、議論を呼びそうなトピック
- Hacker News: グローバルの技術トレンド、スタートアップ、セキュリティ（ポイント数が高いもの）
- Reddit: 投票数とコメント数でコミュニティの反応を評価、議論が活発なものを優先
- X: いいね/RTの伸びが速いポスト、公式発表の一次情報
- YouTube: 再生数×新しさ。解説系はテーマ選定の参考になる
- note.com: 日本語圏の個人の実践知・キャリア論。スキ数が多い記事は発信フォーマットの参考になる
- RED: 中国語圏のAI/開発トレンドの先行指標（取得できた場合のみ）

**クロスプラットフォーム分析（重要）**
- **複数のプラットフォームで同時に話題になっているトピック**は最重要。「今日の横断トピック」として冒頭にまとめる
- 例: HNとはてブの両方に載った記事、Xで公式発表→Reddit/HNで議論、の流れ

**興味度の定義**:
- ★★★: 興味領域に直接関連（AI×セキュリティ、OSS、個人開発、キャリアなど）
- ★★: 間接的に関連（技術トレンド全般、エンジニアリング文化）
- ★: 一般的なIT/技術ニュース

### 3. 出力

**まず「ネタ収集完了。」というメッセージを返してから、結果を `ideas/daily/YYYYMMDD-trend.md` に保存。**

以下のフォーマットで出力：

```markdown
# トレンドネタ: YYYY-MM-DD

## 今日の横断トピック

複数プラットフォームで同時に話題のトピックを2〜5個。各トピックに関連リンクを添える。

## はてブIT（日本市場）

### 注目トピック

| タイトル | ブクマ数 | 興味度 | カテゴリ | メモ |
|---------|---------|--------|---------|------|
| [タイトル](元記事URL) | XXX users | ★★★/★★/★ | AI/開発/キャリア等 | 発信に活用できるポイント |

### 全エントリー

1. [タイトル](元記事URL) (XXX users) - 概要

## Hacker News（グローバル）

### 注目トピック

| タイトル | ポイント | 興味度 | カテゴリ | メモ |
|---------|---------|--------|---------|------|
| [タイトル](HNコメントページURL) | XXXpt | ★★★/★★/★ | AI/Security/Dev等 | 発信に活用できるポイント |

### 全エントリー

1. [タイトル](HNコメントページURL) (XXXpt) - 概要

## Reddit（13サブレッド）

### 注目トピック

| タイトル | 投票数 | コメント数 | 興味度 | カテゴリ | サブレッド | メモ |
|---------|--------|-----------|--------|---------|-----------|------|
| [タイトル](Redditコメントページ完全URL) | XXX ups | XXX | ★★★/★★/★ | Security/AI/OSS等 | r/subreddit | 発信に活用できるポイント |

### カテゴリ別エントリー

#### セキュリティ系 / AI系 / OSS・個人開発系 / キャリア・実践系

1. [タイトル](RedditコメントページURL) (XXX ups, XXX comments) - r/xxx - 概要

## X（旧Twitter）

### 注目ポスト

| ポスト概要 | いいね | RT | 興味度 | アカウント | メモ |
|-----------|--------|----|--------|-----------|------|
| [概要（日本語）](ポストURL) | XXX | XXX | ★★★/★★/★ | @xxx | 発信に活用できるポイント |

## YouTube

### 注目動画

| タイトル | 再生数 | 投稿 | 興味度 | チャンネル | メモ |
|---------|--------|------|--------|-----------|------|
| [タイトル（日本語）](動画URL) | XXX回 | X日前 | ★★★/★★/★ | チャンネル名 | 発信に活用できるポイント |

## note.com

### 注目記事

| タイトル | スキ | 興味度 | 著者 | メモ |
|---------|------|--------|------|------|
| [タイトル](記事URL) | XXX | ★★★/★★/★ | 著者名 | 発信に活用できるポイント |

## RED（小紅書）

取得できた場合のみ。取得不可の日は「本日取得不可（理由）」と1行書く。

| タイトル（日本語訳） | いいね | 興味度 | メモ |
|--------------------|--------|--------|------|
| [タイトル](ノートURL) | XXX | ★★★/★★/★ | 発信に活用できるポイント |

## セキュリティブログ

興味度★★★の記事があった場合のみ、注目トピックとして記載。
```

## 注意事項

- **すべての記事にURLリンクを必ず含める（リンクなしは不可）**
- **はてブは元記事のURL**（はてブページURLではなく）
- **Hacker NewsはHNコメントページURL**（`item?id=`形式）
- **RedditはRedditコメントページの完全URL**（`https://www.reddit.com/r/subreddit/comments/...`形式）
- **英語・中国語のタイトルはすべて日本語に翻訳**
- 数値（ブクマ数/ポイント/ups/いいね/再生数）が高いものを優先
- 一部のソースが取得失敗しても**全体を止めず、そのセクションに取得不可と明記して続行**する
- Redditのレート制限に注意（詳細は 1-4 参照）。X syndication APIも連続アクセスは2秒以上空ける
- 出力ファイルのYYYYMMDDは実行日の日付を使用
