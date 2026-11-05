/* 売買損益: 定価をつけて値引きして売ったときの利益 */
"use strict";
var T = {  // var: 複数のテンプレートを <script> で読むため
  id: "baibai-soneki", title: "ねだんと もうけ", tags: ["割合と比", "売買損益"],
  answerType: "int", unit: "円", weight: 2, figure: null,
  params(rng) {
    while (true) {
      const cost = rng.pick([400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000]);
      const up = rng.pick([10, 20, 25, 30, 40, 50]);
      const off = rng.pick([10, 20, 25, 30]);
      const list = cost * (100 + up) / 100;
      const sold = list * (100 - off) / 100;
      if (!Number.isInteger(list) || !Number.isInteger(sold)) continue;
      const profit = sold - cost;
      if (profit === 0) continue;
      return { cost, up, off, list, sold, profit };
    }
  },
  text(p) { return `ある品物を ${p.cost}円で 仕入れて、${p.up}%の もうけを 見こんで ていかを つけたにゃ。<br>売れなかったので ていかの ${p.off}%引きで 売ったにゃ。<br>${p.profit > 0 ? "もうけ" : "そん"}は 何円かにゃ?`; },
  solve(p) { return Math.abs(p.sold - p.cost); },
  check(p) { const list = p.cost + p.cost * p.up / 100; const sold = list - list * p.off / 100; return Math.abs(sold - p.cost); },
  explain(p, ans) {
    return {
      essence: "「なにを 100% とするか」が とちゅうで 変わることに 気づく問題にゃ",
      pattern: "売買損益",
      hint1: "ていかは「仕入れね」の 何%、売りねは「ていか」の 何%かにゃ。もとにする数が ちがうにゃ",
      hint2: `まず ていか = ${p.cost} × (1 + ${p.up}/100) を 計算してみるにゃ`,
      exp: `ていか = ${p.cost} × ${(100 + p.up) / 100} = ${p.list}円<br>売りね = ${p.list} × ${(100 - p.off) / 100} = ${p.sold}円<br>${p.profit > 0 ? "もうけ" : "そん"} = ${p.profit > 0 ? `${p.sold} − ${p.cost}` : `${p.cost} − ${p.sold}`} = <b>${ans}円</b><br>%は 「もとにする数」が 変わると 大きさも 変わるにゃ`,
      realworld: "セールの 「○%引き」が ほんとうに おとくか 考えるときに つかうにゃ",
    };
  },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
