/* 旅人算: 向かい合って出発して出会うまでの時間 */
"use strict";
var T = {  // var: 複数のテンプレートを <script> で読むため
  id: "tabibito-deau", title: "むかいあって であうまで", tags: ["速さ", "旅人算"],
  answerType: "int", unit: "分", weight: 1, figure: null,
  params(rng) {
    while (true) {
      const a = rng.int(40, 95), b = rng.int(40, 95), t = rng.int(4, 30);
      if (a === b) continue;
      return { a, b, t, d: (a + b) * t };
    }
  },
  text(p) {
    return `${p.d}m はなれた 2つの家から、たろうさんは 分速 ${p.a}m、はなこさんは 分速 ${p.b}m で、同時に 向かい合って 歩きはじめるにゃ。2人は 何分後に 出会うかにゃ?`;
  },
  solve(p) { return p.d / (p.a + p.b); },
  check(p) { for (let m = 1; m <= 2000; m++) if (p.a * m + p.b * m === p.d) return m; return null; },
  explain(p, ans) {
    const s = p.a + p.b;
    return {
      essence: "2人が 1分間に ちぢめる きょりを 使って、はなれた きょりを うめる時間を もとめる問題にゃ",
      pattern: "旅人算(出会い算)",
      hint1: "向かい合って 歩くと、2人のあいだは 1分間に どれだけ ちぢまるか 考えるにゃ",
      hint2: `まず 2人の速さを たして ${p.a} + ${p.b} を 計算してみるにゃ`,
      exp: `1分間に ちぢまる きょり → ${p.a} + ${p.b} = ${s}(m)<br>出会うまでの時間 → ${p.d} ÷ ${s} = <b>${ans}</b>分<br>向かい合うときは 速さを たすのが コツにゃ`,
      realworld: "電車が 反対がわから 来て すれちがうまでの時間を 考えるときに つかうにゃ",
    };
  },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
