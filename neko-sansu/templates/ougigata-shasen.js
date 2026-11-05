/* 図形: 正方形と おうぎ形(4分円)の しゃ線部分の面積。円周率 3.14 */
"use strict";
var T = {  // var: 複数のテンプレートを <script> で読むため
  id: "ougigata-shasen", title: "おうぎ形と しゃ線の面積", tags: ["図形", "角度・面積・長さ"],
  answerType: "dec", unit: "cm²", weight: 3,
  params(rng) {
    const r = rng.pick([2, 4, 5, 6, 8, 10, 12, 20]);
    const kind = rng.int(0, 1); // 0: 正方形 − 4分円, 1: 葉っぱ形(4分円2つの重なり)
    return { r, kind };
  },
  text(p) { return p.kind === 0
    ? `1辺 ${p.r}cm の 正方形の 中に、頂点を 中心と する 半径 ${p.r}cm の おうぎ形(円の 4分の1)を かいたにゃ。<br>しゃ線部分の 面積は 何cm²かにゃ?(円周率は 3.14)`
    : `1辺 ${p.r}cm の 正方形の 中に、向かいあう 2つの 頂点を 中心と する 半径 ${p.r}cm の おうぎ形(円の 4分の1)を 2つ かいたにゃ。<br>かさなった しゃ線部分の 面積は 何cm²かにゃ?(円周率は 3.14)`; },
  figure(p) {
    const S = typeof SVG !== "undefined" ? SVG : require("./_svg.js");
    const r = 150, x = 85, y = 30;
    const sq = S.rect(x, y, r, r);
    let shade, arcs;
    if (p.kind === 0) {
      shade = S.hatch(`M${x + r},${y} L${x + r},${y + r} L${x},${y + r} A${r},${r} 0 0 0 ${x + r},${y} Z`);
      arcs = S.path(`M${x + r},${y} A${r},${r} 0 0 1 ${x},${y + r}`);
    } else {
      shade = S.hatch(`M${x},${y} A${r},${r} 0 0 1 ${x + r},${y + r} A${r},${r} 0 0 1 ${x},${y} Z`);
      arcs = S.path(`M${x},${y} A${r},${r} 0 0 1 ${x + r},${y + r}`) + S.path(`M${x + r},${y + r} A${r},${r} 0 0 1 ${x},${y}`);
    }
    return S.svg(shade + sq + arcs + S.text(x + r / 2, y + r + 22, `${p.r}cm`) + S.text(x - 22, y + r / 2 + 5, `${p.r}cm`), 320, 215);
  },
  solve(p) { const sq = p.r * p.r, quarter = sq * 3.14 / 4; const v = p.kind === 0 ? sq - quarter : 2 * (quarter - sq / 2); return Math.round(v * 1e6) / 1e6; },
  check(p) { const k = p.kind === 0 ? (1 - 0.785) : (0.785 * 2 - 1); return Math.round(p.r * p.r * k * 1e6) / 1e6; },
  explain(p, ans) {
    const sq = p.r * p.r, q = Math.round(sq * 3.14 / 4 * 1e6) / 1e6, tri = sq / 2;
    const essence = p.kind === 0
      ? "しゃ線の形は 直せつ もとめられないので、「正方形 − おうぎ形」の ひき算で 出す問題にゃ"
      : "葉っぱの形は「おうぎ形 − 三角形」を 2つ あわせたもの、と 分けて考える問題にゃ";
    const exp = p.kind === 0
      ? `正方形 = ${p.r}×${p.r} = ${sq}cm²<br>おうぎ形 = ${p.r}×${p.r}×3.14÷4 = ${q}cm²<br>しゃ線 = ${sq} − ${q} = <b>${ans}cm²</b><br>かんたんな形から ひく、が 面積の きほんにゃ`
      : `おうぎ形 = ${p.r}×${p.r}×3.14÷4 = ${q}cm²<br>三角形 = ${p.r}×${p.r}÷2 = ${tri}cm²<br>葉っぱの半分 = ${q} − ${tri} = ${Math.round((q - tri) * 1e6) / 1e6} → 2倍して <b>${ans}cm²</b><br>かさなった部分は 「2つに分けて たす」にゃ`;
    return {
      essence, pattern: p.kind === 0 ? "面積のひき算(正方形−おうぎ形)" : "葉っぱ形(おうぎ形−三角形)×2",
      hint1: "しゃ線の形を そのまま もとめようと しないにゃ。知っている形の たし算・ひき算で 作れないかにゃ?",
      hint2: `まず 半径 ${p.r}cm の 円の 4分の1 の面積を、${p.r}×${p.r}×3.14÷4 で 出してみるにゃ`,
      exp,
      realworld: "にわの 形や 布を 切るとき、あまる部分の 広さを 考えるのに つかうにゃ",
    };
  },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
