# 類題テンプレートの追加手順(Sonnet 向け・これだけ読めば足りる)

## 0. 先に読む
- `copyright.md` の「結論」だけ(10 行)。原題の文・数値・図を写さない。
- 既存テンプレート 1 本(例: `neko-sansu/templates/gyakusan.js`)。書き方を真似る。

## 1. 穴埋めテンプレートをコピーする
`neko-sansu/templates/_TEMPLATE.js` を `neko-sansu/templates/<新ID>.js` にコピーし、
`TODO:` を全部埋める。ID は英小文字とハイフン(例 `tsurukame-2`)。

## 2. 埋めるときのルール
- `params(rng)`: 数値は `rng.int(a,b)` / `rng.pick([...])` で決める。`Math.random` 禁止。
  条件(割り切れる、答えが正の整数、答えが一意 等)を満たすまで `while(true)` で作り直してよい。
  **5 パターン以上の異なる答えが出る**範囲にする(テストが確認する)。
- `solve(p)`: 必ずコードで計算する。`return 15;` のような直書きは禁止。
- `check(p)`: 総当たりや別の公式で同じ答えを出す(推奨。重要な分野では必須)。
- `explain(p, ans)`: 6 項目を `explanation-style.md` の通りに書く。式に出す数値は `p` と `ans` から埋め込む。
- `tags`: `schema.md` の一覧の文字列をそのまま使う。
- `answerType`: 答えが分数になりうるなら `frac`、単位を答えさせるなら `unit`。

## 3. 登録する
`neko-sansu/templates/index.js` の `TEMPLATE_IDS` 配列に `"<新ID>"` を足す(1 行)。
`index.html` は `TEMPLATE_IDS` を使って自動で `<script>` を生成するので触らない。

## 4. テストを走らせる(必須)
```bash
node neko-sansu/tests/run.js
```
すべて `PASS` になるまで直す。主な FAIL と直し方:
| メッセージ | 直し方 |
|---|---|
| `answer not int` | `params` の条件を強めて割り切れる数値だけ返す |
| `too few distinct answers` | `params` の範囲を広げる |
| `check != solve` | `solve` か `check` のどちらかが間違い。紙で 1 例を計算して確かめる |
| `explain number mismatch` | `exp` の中の数値が `ans` と違う。式を `${}` で埋め込む |
| `forbidden word` | 学校名・年度・「過去問」などを消す |
| `params gave up` | 条件が厳しすぎて 200 回で作れない。範囲を広げる |

## 5. 追加後チェックリスト(全部 ✅ になってから終了報告)
- [ ] 原題の文・数値・図を写していない(自分の言葉と乱数で書いた)
- [ ] `node neko-sansu/tests/run.js` が全 PASS
- [ ] `explain` の 6 項目がそろい、`hint1` に答えに直結する数値が無い
- [ ] 漢字は小5までに習うものだけ(迷ったらひらがな)
- [ ] `index.js` に ID を登録した
- [ ] 1 行で報告: 「`<ID>` を追加。tags=…、答えの型=…、テスト PASS」

## 作らないもの
- 問題文を直書きした固定問題(それは原題JSONとして端末に取り込む側の仕事)。
- 新しい画面・UI。テンプレート追加だけに集中する。
