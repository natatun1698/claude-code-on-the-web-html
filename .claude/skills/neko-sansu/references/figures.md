# 図の型(figure)の追加手順

図は `figure(p)` が返す **SVG 文字列**。外部画像・`<img>`・`<script>` を使わない。
viewBox は `0 0 320 220` を基本にし、幅 100% で表示する(iPad 縦持ちで 1 画面に収める)。

## 共通ヘルパー(`templates/_svg.js`)
```js
svg(inner, w=320, h=220)            // <svg viewBox="0 0 w h" …>inner</svg>
line(x1,y1,x2,y2, cls)               // cls: "edge" | "dash"
text(x,y,str, cls)                   // cls: "lbl"(数値ラベル) | "small"
arc(cx,cy,r, a0,a1)                  // おうぎ形パス(度数法、時計回り)
hatch(pathD)                         // 斜線塗り(pattern id "hatch" を自動付与)
```
色は CSS 変数 `--fig-stroke` `--fig-hatch` を使い、`style.css` 側で決める。

## 初期の 3 型(実装済み)
| 型 | テンプレート | 図の中身 |
|---|---|---|
| 1 | `ougigata-shasen` | 正方形(1辺 r)と、その頂点中心・半径 r の 4分円。斜線部 = 正方形 − 4分円 など |
| 2 | `seihoukei-kumiawase` | 正方形 2〜3 個を L 字に並べた図。周の長さ・面積 |
| 3 | `ten-idou-graph` | 長方形 ABCD の辺上を点 P が動く図 + 三角形 ABP の面積グラフ(折れ線) |

## 新しい型を足すとき
1. `templates/<id>.js` の `figure(p)` に描く。`p` の値だけで図が決まること(solve と同じ数値を使う)。
2. 寸法ラベルは `text()` で図の外側に置く。問題文で聞く値は `?` または `□` と表示する。
3. 斜線部は `hatch()`、求める長さは `cls:"dash"` で強調。
4. 図が大きくなるときは `svg(inner, 320, 300)` のように高さだけ変える(幅は固定)。
5. `tests/templates.test.js` は `figure(p)` が `<svg` で始まり、`<script`・`<img` を含まないことを自動で確認する。
6. Playwright で `index.html` を開き、1 問だけ表示して図が崩れていないか見る。

## 将来の拡張(未実装)
- 展開図から立体を作る問題(型 4): 立方体・直方体の展開図 11 種をパラメータ化し、
  向かい合う面や体積を問う。`params` で「どの展開図か」「各辺の長さ」を選ぶ設計にする。
- 図形上の点の移動の「2 点同時移動」版。
