/* 逆算: □ を使った計算をぎゃくにたどる */
"use strict";
var T = {  // var: 複数のテンプレートを <script> で読むため
  id: "gyakusan", title: "ぎゃくさん(□を もとめる)", tags: ["計算", "四則計算・逆算"],
  answerType: "int", unit: "", weight: 3, figure: null,
  params(rng) {
    while (true) {
      const form = rng.int(0, 2);
      const x = rng.int(3, 40), a = rng.int(2, 9), b = rng.int(2, 60);
      if (form === 0) return { form, a, b, c: x * a - b, x };            // □×a − b = c
      if (form === 1 && b < x * a) return { form, a, b, c: x * a + b, x }; // □×a + b = c
      if (form === 2 && x > b) return { form, a, b, c: (x - b) * a, x };  // (□ − b)×a = c
    }
  },
  text(p) {
    const f = ["□ × A − B = C", "□ × A + B = C", "(□ − B) × A = C"][p.form];
    return `${f.replace("A", p.a).replace("B", p.b).replace("C", p.c)} <br>□に 入る数は いくつかにゃ?`;
  },
  solve(p) { return p.form === 0 ? (p.c + p.b) / p.a : p.form === 1 ? (p.c - p.b) / p.a : p.c / p.a + p.b; },
  check(p) { for (let x = 0; x <= 2000; x++) { const v = p.form === 0 ? x * p.a - p.b : p.form === 1 ? x * p.a + p.b : (x - p.b) * p.a; if (v === p.c) return x; } return null; },
  explain(p, ans) {
    const step1 = p.form === 0 ? `${p.c} + ${p.b} = ${p.c + p.b}` : p.form === 1 ? `${p.c} − ${p.b} = ${p.c - p.b}` : `${p.c} ÷ ${p.a} = ${p.c / p.a}`;
    const step2 = p.form === 0 ? `${p.c + p.b} ÷ ${p.a} = <b>${ans}</b>` : p.form === 1 ? `${p.c - p.b} ÷ ${p.a} = <b>${ans}</b>` : `${p.c / p.a} + ${p.b} = <b>${ans}</b>`;
    const last = p.form === 2 ? "かけ算" : p.form === 0 ? "ひき算" : "たし算";
    return {
      essence: "計算を さいごから ぎゃくに たどって、もとの数に もどす問題にゃ",
      pattern: "逆算",
      hint1: `この式で いちばん あとに している計算は ${last} にゃ。そこから もどすにゃ`,
      hint2: `まず ${step1} を 計算してみるにゃ`,
      exp: `さいごの計算を ぎゃくにする → ${step1}<br>つぎの計算も ぎゃくにする → ${step2}<br>たし算⇔ひき算、かけ算⇔わり算 を 入れかえながら もどすのが コツにゃ`,
      realworld: "おつりや のこりから、もとの ねだんを 考えるときに つかうにゃ",
    };
  },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
