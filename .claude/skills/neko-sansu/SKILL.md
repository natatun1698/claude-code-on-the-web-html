---
name: neko-sansu
description: 小5〜小6向け中学受験算数の一問一答アプリ「ねこさんすう」(/neko-sansu/)を開発・拡張する。スコティッシュフォールドの猫が出題し、数字キーで答え、段階ヒント→解説で学ぶ、iPad向けオフライン静的Webアプリ。類題は「テンプレート(数値生成+コードで解く)」で量産する。「ねこさんすう」「類題を追加」「テンプレート追加」「図の型を追加」「原題JSONの作り方」などの依頼で使用する。過去問の本文は絶対にコミットしない。
---

# ねこさんすう 開発スキル

## まず守ること(著作権)
- 過去問・市販教材の問題文・図・解説を**そのまま、または言い換えて**リポジトリに入れない。
- リポジトリに入れてよいのは、数値がランダムに変わる**オリジナルの類題テンプレート**だけ。
- 原題は利用者が端末内に「取り込む」(IndexedDB)。詳細は `references/copyright.md`。
- 問題を追加する前後に必ず `node neko-sansu/tests/run.js` を走らせる(著作権チェック含む)。

## アプリ概要
- 場所: `neko-sansu/`(GitHub Pagesで `/neko-sansu/`)。noindex・外部通信なし・ビルド不要。
- 端末: iPad Safari(ホーム画面追加)。標準キーボードは使わず、アプリ内の数字キーで入力する。
- 猫: スコティッシュフォールド(折れ耳)。名前は初回起動時に子どもが付ける(localStorage)。
- 口調: ひらがな多め「〜にゃ」。小5が読める漢字だけ。

## 姉妹アプリ「写真版」(`neko-sansu-photo/`)
- 原題を JSON ではなく写真で取りこむ版。`../neko-sansu/` の `rng.js` `judge.js` `cat.js` `history.js` `templates/` を**そのまま読み込む**ので、
  テンプレートを足せば両方に反映される。共用ファイルの API(`createHistory(storage)`、`judge`、`formatAnswer`、`TEMPLATE_IDS`)は変えない。
- 写真版だけのファイル: `index.html` `style.css`(本家の CSS に追記)`app.js` `photo-bank.js`(答え文字列の解析・検証・画像縮小・IndexedDB)`tests/`。
- 保存キーは別(`neko-sansu-photo-v1` / `neko-sansu-photo-log-v1` / IndexedDB `neko-sansu-photo`)。テストは `node neko-sansu-photo/tests/run.js`。
- 両アプリとも画面切り替えで `history.pushState` し、ブラウザの戻る/進むと各画面の「← もどる」が同じ動きをする(`nav()` / `back()` / `popstate`)。新しい画面を足すときは `SCREENS` と `ENTER` に登録する。

## ファイル構成
| ファイル | 役割 |
|---|---|
| `index.html` / `style.css` | 画面(タイトル・なまえ・もんだい・ずかん・とりこみ・ほごしゃ) |
| `cat.js` | 猫のインラインSVGと表情(`renderCat(mood)`) |
| `rng.js` | seed付き乱数 `makeRng(seed)` → `{int(a,b), pick(arr), shuffle(arr)}` |
| `judge.js` | 採点 `judge(input, answer, answerType)`。純関数 |
| `templates/*.js` | 類題テンプレート1ファイル1種。`templates/index.js` で登録 |
| `history.js` | 学習履歴(開始/終了イベント、離脱検知、保護者集計、バックアップ) |
| `importer.js` | 原題JSONの検証と IndexedDB 保存 |
| `app.js` (+ `screens/*.js`) | UIロジック |
| `tests/run.js` | 全テスト。Node.js だけで動く |

## アーキテクチャの約束事
1. **ロジックはブラウザとNodeの両方で動く書き方**にする。各ファイル末尾は
   `if (typeof module !== "undefined") module.exports = {...}; else window.X = ...;`。
   `document`/`window` に触るのは `app.js`・`screens/`・`cat.js` だけ。
2. **テンプレートは `params → text/solve/explain` の純関数**。答えは必ず `solve` が計算する。
   解説文の数値は `solve` の戻り値や `params` から埋め込む(手で数字を書かない)。
   スキーマは `references/schema.md`。
3. **乱数は必ず引数の `rng` を使う**(`Math.random` 禁止)。テストが seed で再現するため。
4. **図は SVG 文字列を返す関数**。型の追加手順は `references/figures.md`。
5. **履歴は問題IDだけを保存**し、本文は保存しない。原題IDは `imp:` で始める。
6. **localStorage キー**は `neko-sansu-v1`(設定・進捗)と `neko-sansu-log-v1`(履歴)。
   形式を変えるときは旧データを読めるようにするか、キーのバージョンを上げる。

## 必要なときだけ読む
- 類題を追加する → `references/add-problems.md`(チェックリスト・穴埋めテンプレ・テストコマンド)
- テンプレートや原題JSONの形 → `references/schema.md`
- 図の型を足す → `references/figures.md`
- 解説・ヒント・猫のセリフの書き方 → `references/explanation-style.md`
- 著作権の判断に迷う → `references/copyright.md`

## 動作確認
- `node neko-sansu/tests/run.js` がすべて PASS。
- ブラウザ確認は Playwright(`/opt/pw-browsers/chromium`)で `file:///.../neko-sansu/index.html` を開き、pageerror が無いこと。
