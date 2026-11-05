# データスキーマ

## 1. 類題テンプレート(`neko-sansu/templates/<id>.js`)

```js
var T = {
  id: "gyakusan",            // 英小文字とハイフン。ファイル名と同じ
  title: "ぎゃくさん",        // 子ども向け表示名
  tags: ["計算", "四則計算・逆算"],   // [大分野, 小分野]。一覧は下記
  answerType: "int",         // 下記のいずれか
  unit: "",                  // 表示用の単位(例 "cm²", "円", "%")。answerType:"unit" でなくてもよい
  figure: null,              // 省略可。(p) => "<svg ...>...</svg>"
  weight: 3,                 // 出題頻度の重み(1〜5)。傾向: 計算3, 図形3, 割合2, ほか1

  // 数値を決める。条件を満たすまで作り直してよい(ループ上限 200 回)。
  // 戻り値はプレーンオブジェクト。ここで決めた値だけを text/solve/explain が使う。
  params(rng){ ... return { a, b, c }; },

  // 問題文。HTML 可(太字 <b> 程度)。原題の文を写さない。
  text(p){ return `□ × ${p.a} − ${p.b} = ${p.c}  の □ を もとめるにゃ`; },

  // 答えをコードで計算する。文字列で直書きしない。
  // 戻り値の形は answerType に従う(下記)。
  solve(p){ return (p.c + p.b) / p.a; },

  // 解説。必ず 6 項目。数値は p と ans から埋め込む。
  explain(p, ans){
    return {
      essence: "「もとの数」を、計算をぎゃくにたどって もどす問題にゃ",   // 本質(1文)
      pattern: "逆算(けいさんの ぎゃくもどし)",                           // 解法パターン名
      hint1:   "さいごにした計算は なにかにゃ? そこから もどすにゃ",       // 方向づけだけ
      hint2:   `まず ${p.c} に ${p.b} を たして みるにゃ`,                // 1手目を具体的に
      exp:     `□×${p.a} = ${p.c}+${p.b} = ${p.c+p.b}。だから □ = ${p.c+p.b}÷${p.a} = <b>${ans}</b>`,
      realworld: "おつりから もとのねだんを 考えるときに つかうにゃ",      // 省略可
    };
  },

  // 省略可。総当たりなど別の方法で答えを出す。テストが solve と照合する。
  check(p){ for (let x = 0; x < 10000; x++) if (x * p.a - p.b === p.c) return x; return null; },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
```

### answerType と solve の戻り値・入力形式
| answerType | solve の戻り値 | 子どもの入力 | 採点 |
|---|---|---|---|
| `int` | 整数 | `123` | 一致 |
| `dec` | 数値 | `1.5` | 誤差 1e-9 |
| `frac` | `{n, d}`(既約でなくてよい) | `3/4`、`1と1/4` | 値が等しい(未約分も正解) |
| `unit` | 数値 | `12`(単位はキーで選ぶ) | 値一致 + `unit` 一致 |
| `time` | `{h, m, s}`(不要な位は 0) | 時・分・秒キーで入力 | 秒に直して一致 |
| `multi` | 配列(順不同) | 区切りキー「,」で並べる | 集合として一致 |
| `ordered` | 配列(順序あり) | 同上 | 順序込みで一致 |
| `choice` | 選択肢の index(0〜) | 選択肢ボタン | 一致 |

`choice` のときは `choices(p)` → 文字列配列 を定義する。

### tags の一覧(この文字列をそのまま使う)
- 計算: 四則計算・逆算 / 計算のくふう / 単位の計算
- 和と差: 和差算 / 分配算 / 消去算 / つるかめ算 / 平均とのべ / 過不足算
- 割合と比: 割合と比 / 還元算・相当算 / 倍数算 / 売買損益 / 濃度 / 仕事算
- 速さ: 速さと比 / 旅人算 / 通過算
- 図形: 角度・面積・長さ / 辺の比と面積の比 / 体積・表面積 / 展開図 / 図形上の点の移動
- 表とグラフ: 表とグラフ
- 数の性質: 約数と倍数 / 整数・小数・分数の性質
- 規則性: 数列 / 周期算 / 植木算
- 場合の数: 場合の数 / 調べ・推理

### 登録
`templates/index.js` に `require`/`<script>` の両方で読めるよう ID を追加する(手順は add-problems.md)。

## 2. 原題JSON(私用バンク。リポジトリに入れない)

iPad の「ファイル」から読み込む。配列でも `{problems:[...]}` でもよい。

```json
{
  "version": 1,
  "source": "2024-1",                 // 任意のメモ。学校名は不要
  "problems": [
    {
      "id": "2024-1-01",              // 必須。英数字とハイフン。アプリ内では "imp:2024-1-01" になる
      "tags": ["計算", "四則計算・逆算"],   // 必須。上の一覧から
      "text": "……",                  // 必須。問題文(HTML 可)
      "figure": "<svg …>…</svg>",     // 任意。インラインSVG のみ(img/script 不可)
      "answerType": "int",            // 必須
      "answer": 1981,                 // 必須。answerType の形式(frac は {"n":1,"d":4}、time は {"h":0,"m":5,"s":30})
      "unit": "cm²",                  // 任意
      "choices": ["ア","イ"],          // choice のとき必須
      "hint1": "…", "hint2": "…", "exp": "…",   // 任意だが推奨
      "essence": "…", "pattern": "…", "realworld": "…",  // 任意
      "templateId": "gyakusan"        // 任意。「もう一問」で出す類題テンプレート
    }
  ]
}
```

### ブラウザ側の検証(`importer.js` の `validateBank(json)`)
- `id` 重複なし、`tags[0]` が大分野一覧にある、`answerType` が既知、`answer` の形が合う。
- `figure` に `<script`・`on〜=`・`<img`・`<foreignObject` が含まれない。
- エラーは行番号つきで画面に表示し、1件でもあれば保存しない。
- 保存先は IndexedDB `neko-sansu` / store `bank`。削除ボタンで全消去できる。

## 3. 学習履歴(`history.js`)
イベントは `localStorage["neko-sansu-log-v1"]` に追記する配列。
```js
{ t: 1730000000000, ev: "start", pid: "gyakusan#seed123", tags: ["計算","四則計算・逆算"] }
{ t: 1730000040000, ev: "end", pid: "gyakusan#seed123", result: "ok", hints: 0, retries: 1, ms: 40000 }
```
- `result`: `ok`(ノーヒント正解) / `ok_hint`(ヒントを見て正解) / `ng`(不正解のまま終了) / `exp`(解説を見て終了)
- 6状態の `abandoned`(途中離脱) は保存せず、`start` に対応する `end` が無いことから集計時に判定する。
- `summarize(events)` → `{ byDay, byField, abandoned, slow }` を保護者画面が表示する。
