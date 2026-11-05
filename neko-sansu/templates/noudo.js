/* 濃度: 食塩水を混ぜたあとの濃度 */
"use strict";
var T = {  // var: 複数のテンプレートを <script> で読むため
  id: "noudo", title: "食塩水(しおの こさ)", tags: ["割合と比", "濃度"],
  answerType: "int", unit: "%", weight: 2, figure: null,
  params(rng) {
    while (true) {
      const w1 = rng.pick([100, 150, 200, 250, 300, 400]), c1 = rng.int(2, 15);
      const w2 = rng.pick([100, 150, 200, 250, 300, 400, 500]), c2 = rng.int(2, 20);
      if (c1 === c2) continue;
      const salt = w1 * c1 + w2 * c2, total = (w1 + w2) * 100;
      if (salt % (w1 + w2) !== 0) continue;           // 濃度が整数
      if (salt / (w1 + w2) < 1) continue;
      return { w1, c1, w2, c2 };
    }
  },
  text(p) { return `${p.c1}%の 食塩水 ${p.w1}g と、${p.c2}%の 食塩水 ${p.w2}g を まぜたにゃ。<br>できた 食塩水の こさは 何%かにゃ?`; },
  solve(p) { return (p.w1 * p.c1 + p.w2 * p.c2) / (p.w1 + p.w2); },
  check(p) { const s1 = p.w1 * p.c1 / 100, s2 = p.w2 * p.c2 / 100; return Math.round((s1 + s2) / (p.w1 + p.w2) * 100 * 1e6) / 1e6; },
  explain(p, ans) {
    const s1 = p.w1 * p.c1 / 100, s2 = p.w2 * p.c2 / 100;
    return {
      essence: "まぜても「しおの重さ」は ふえも へりもしない、ということを つかう問題にゃ",
      pattern: "濃度(食塩の重さに注目)",
      hint1: "こさ(%)は たせないにゃ。たせるのは「しおの重さ」と「食塩水の重さ」だけにゃ",
      hint2: `まず ${p.w1}g の中の しおは ${p.w1} × ${p.c1}/100 で もとめてみるにゃ`,
      exp: `しお: ${p.w1}×${p.c1}/100 = ${s1}g、 ${p.w2}×${p.c2}/100 = ${s2}g → あわせて ${s1 + s2}g<br>食塩水: ${p.w1}+${p.w2} = ${p.w1 + p.w2}g<br>こさ = ${s1 + s2} ÷ ${p.w1 + p.w2} × 100 = <b>${ans}%</b><br>「しおの重さは かわらない」が この問題の 心ぞうにゃ`,
      realworld: "ジュースを うすめたり、りょうりの あじつけを 考えるときに つかうにゃ",
    };
  },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
