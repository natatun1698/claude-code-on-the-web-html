# 年度の過去問を追加する手順(Sonnet 向け・これだけ読めば足りる)

## 0. 前提
- 入力は、写真から**人が書き起こした問題文と公式解答**。写真の再読み込みはしない。
- 問題文・答えの事実は変えない。読み取れない・確定できない問題は `status: "excluded"` + `reason`(推測で埋めない)。
- 学校名・出版社名・塾名・「入試」「第○回」などの語を、どのファイルにも書かない(`id` の「回」は数字で表す)。
- 他のファイルは読まなくてよい。迷ったときだけ `schema.md`(項目の形) / `figures.md`(図) / `explanation-style.md`(文体)。

## 1. ファイルを作る
`neko-sansu/data/problems-{年度}-{回}.json` を新規作成し、**JSON配列**に下のテンプレートを問題数ぶん並べる。
```json
[
  {
    "id": "2024-1-1-1",
    "source": { "year": 2024, "round": 1, "big": 1, "no": 1 },
    "tags": ["計算/四則計算・逆算"],
    "pattern": "かっこのある四則計算",
    "text": "TODO: 問題文。分数は {{5/8}}、帯分数は {{2 1/13}}、空らんは □、改行は \\n",
    "answerType": "int",
    "answer": "TODO: 文字列で。例 \"26\" / \"7.74\" / \"7/8\" / [\"3.1\",\"3.6\"] / {\"hours\":1,\"minutes\":21}",
    "unit": "TODO: 単位(なければこの行を消す)",
    "essence": "TODO: 本質的に何を聞いているか(「〜できるかを聞いています。」1〜2文)",
    "hint1": "TODO: どこに注目するか(数値は出さない)",
    "hint2": "TODO: 最初の1手(答えは出さない)",
    "exp": "TODO: 式→計算→答え。小5の言葉で書き直す(丸写し禁止)",
    "status": "ready"
  },
  {
    "id": "2024-1-2-5",
    "source": { "year": 2024, "round": 1, "big": 2, "no": 5 },
    "tags": ["図形/角度・面積・長さ"],
    "pattern": "TODO",
    "text": "TODO",
    "answerType": "dec",
    "answer": "",
    "essence": "", "hint1": "", "hint2": "", "exp": "",
    "status": "excluded",
    "reason": "TODO: 例「斜線部分の範囲が写真から確定できない」「公式解答が読み取れない」"
  }
]
```

## 2. 埋めるときのルール
- `id` は `年度-回-大問-小問`。`source` の数値と一致させる。小問のない大問は小問 `1` とする。
- `tags` は `schema.md` の一覧の文字列を**一字一句そのまま**(先頭が主分野)。無い分野名はテストで FAIL。
- `pattern` は、同じ解き方の既存問題があればその文字列をコピーする(「もう一問」が同じ `pattern` を探すため)。
  既存の一覧: `grep -h '"pattern"' neko-sansu/data/problems-*.json | sort | uniq -c`
- `answerType` と `answer` の形は `schema.md` の表のとおり。数値は必ず文字列。
  - 答えが分数 → `frac`、`"7/8"` または `"2 1/13"`。 小数 → `dec`。 整数 → `int`。 単位がある → `unit` 項目に書く(型は `int`/`dec` のまま)。
  - 時間 → `time`、`{"hours":1,"minutes":21}`。 複数の答え → `multi` + `"orderMatters": false`(順不同)/ `true` + `"labels"`。
  - 並べ替え → `ordered` + `choices`。 記号を選ぶ → `choice` + `choices`。
- 前の小問の答えを使う小問は、必要な値を問題文の最後に「(この長方形では、ABは60cmです。)」のように書き足し、`dependsOn` に元の `id` を書く。
- 図がある問題: `figures.md` の手順で `neko-sansu/data/figures/{id}.svg` を描き、`"figure": "figures/{id}.svg"` を書く。描き切れなければ `excluded`。
- `essence` `hint1` `hint2` `exp` は `explanation-style.md` の表のとおり。です・ます調。「〜にゃ」は書かない。

## 3. 一覧に登録する
`neko-sansu/data/index.json` の `files` 配列にファイル名を1行足す(年度の新しい順でなくてよい)。
```json
{ "files": ["problems-2026-1.json", "problems-2025-1.json", "problems-2024-1.json"] }
```

## 4. テストを走らせる(必須)
```bash
node neko-sansu/tests/run.js
```
`data.test.js` が、必須項目・型と答えの形・ID重複・`tags` の一覧照合・図の存在と XML・禁止語・`excluded` の `reason` を検査する。
FAIL が出たら、表示された `id` と項目名を直して再実行する。すべて PASS になるまでコミットしない。

## 5. 最終チェックリスト
- [ ] `index.json` に新ファイルを追加した
- [ ] 全問に `id` `source` `tags` `pattern` `text` `answerType` `answer` `status` がある(`excluded` は `reason` も)
- [ ] `ready` の全問に `essence` `hint1` `hint2` `exp` がある(空文字・TODO が残っていない)
- [ ] `answer` が公式解答と一致している(自分で一度解いて確かめる。合わなければ `excluded` にして `reason` に書く)
- [ ] 図のある問題は SVG を描き、ラベルが問題文と一致している
- [ ] 学校名・出版社名・塾名が入っていない
- [ ] `node neko-sansu/tests/run.js` が全部 PASS
- [ ] 報告には「追加した問題数」「`excluded` にした問題とその理由」「疑わしい箇所(答えが合わない等)」を書く。疑わしい箇所は勝手に直さない
