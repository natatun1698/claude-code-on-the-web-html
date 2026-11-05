---
name: neko-sansu
description: 小5〜小6向け中学受験算数の一問一答アプリ「ねこさんすう」(/neko-sansu/)を開発・拡張する。スコティッシュフォールドの猫が過去問(原題)を出題し、数字キーで答え、段階ヒント→解説で学ぶ、iPad向けオフライン静的Webアプリ。問題は `neko-sansu/data/` のJSON+手描きSVG図だけで管理する。「ねこさんすう」「過去問を追加」「○○年度の問題を追加」「図を描き直す」「問題JSONの作り方」などの依頼で使用する。
---

# ねこさんすう 開発スキル

## いちばん多い仕事: 年度の過去問を追加する
→ **`references/add-problems.md` だけ読めば足りる**(手順・穴埋めJSON・チェックリスト・テストコマンド)。
迷ったときだけ `schema.md`(項目の形)、`figures.md`(図)、`explanation-style.md`(文の書き方)を開く。

## 絶対に守ること
- 問題データは `neko-sansu/data/` の中だけ(`problems-{年度}-{回}.json` と `figures/{id}.svg`)。**アプリのコードに問題を埋め込まない**。
- 問題文・答えの事実関係を勝手に変えない。公式解答や図が読み取れない問題は推測で埋めず `status: "excluded"` + `reason`。
- 学校名・出版社名・塾名を、どのファイルにも書かない(データの中も)。`tests/data.test.js` が禁止語を機械検査する。
- 追加・修正のあとは必ず `node neko-sansu/tests/run.js` を走らせ、全部 PASS にする。
- 家庭学習用。README に明記してある。URL・フォルダ名に学校名を入れない。noindex。外部通信なし。

## アプリ概要
- 場所: `neko-sansu/`(GitHub Pages で `/neko-sansu/`)。ビルド不要・オフライン(localStorage)。
- 端末: iPad Safari(ホーム画面追加)。標準キーボードは使わず、アプリ内の数字キー(分数 `/`・帯分数 `と`・`,`・時間キー)で入力。
  `ordered` / `choice` 型は選択肢ボタンで答える。
- 猫: スコティッシュフォールド(折れ耳)。名前は初回起動時に子どもが付ける。口調はひらがな多め「〜にゃ」。
- 1問の流れ: 出題 →「紙に書いてみてにゃ」→ 入力 → 正解ならプロセスをほめる / 不正解なら ヒント1 → ヒント2 → 解説(本質 `essence` を必ず表示)
  →「もう一問」は同じ `pattern` の別問題(無ければ同じ分野)。「社会で役立つ」は任意ボタン。
- 間違えた問題は日をおいて再出題。分野別正答率・学習履歴(保護者画面: タイトルの猫を長押し+4桁暗証番号)・バックアップ/復元。

## ファイル構成
| ファイル | 役割 |
|---|---|
| `data/index.json` | 読み込む問題ファイルの一覧(年度を足したらここに1行追加) |
| `data/problems-*.json` / `data/figures/*.svg` | 問題データ・手描きの図 |
| `index.html` / `style.css` | 画面(title / name / quiz / zukan / seiseki / parent) |
| `cat.js` | 猫のインラインSVG `renderCat(mood)` |
| `judge.js` | 採点 `judge(input, answer, answerType, opts)`。純関数 |
| `problems.js` | 読み込み・検証・重み付き出題・再出題・「もう一問」の選び方。純関数 |
| `history.js` | 学習履歴(開始/終了イベント、離脱検知、集計、バックアップ) |
| `nav.js` | 画面遷移の状態機械(戻る・進む)。純関数 |
| `app.js` | UI(DOM に触るのはここと `cat.js` だけ) |
| `tests/run.js` | 全テスト(Node.js だけで動く) |

## アーキテクチャの約束事
1. ロジックは Node とブラウザの両方で動く書き方: ファイル末尾を `if (typeof module !== "undefined") module.exports = api; else Object.assign(window, api);` にする。
2. 画面切り替えは `nav.js` の状態機械 + `history.pushState`。新しい画面を足すときは `SCREENS` と `ENTER` に登録する。
3. 履歴には問題 `id` だけを保存し、本文は保存しない。localStorage キーは `neko-sansu-v2`(設定)と `neko-sansu-log-v1`(履歴)。
4. 問題文の分数は `{{5/8}}` `{{2 1/13}}` と書き、`app.js` が縦書き分数に変換する。

## 動作確認
- `node neko-sansu/tests/run.js` がすべて PASS。
- ブラウザ確認は Playwright(`/opt/pw-browsers/chromium`)でローカルHTTPサーバー経由(`python3 -m http.server`)で開く(`fetch` を使うため `file://` では動かない)。pageerror が無いこと。
