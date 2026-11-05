/* つるかめ算: 2種類の合計数と合計値から一方の数を求める */
"use strict";
var T = {  // var: 複数のテンプレートを <script> で読むため
  id: "tsurukame", title: "つるかめ算", tags: ["和と差", "つるかめ算"],
  answerType: "int", unit: "", weight: 1, figure: null,
  params(rng) {
    const SCENES = [
      { a: "50円の あめ", b: "80円の チョコ", va: 50, vb: 80, unit: "円", ask: "チョコ", askB: true },
      { a: "30円の えんぴつ", b: "110円の ペン", va: 30, vb: 110, unit: "円", ask: "ペン", askB: true },
      { a: "2本足の つる", b: "4本足の かめ", va: 2, vb: 4, unit: "本", ask: "かめ", askB: true, what: "足" },
      { a: "3点の 問題", b: "5点の 問題", va: 3, vb: 5, unit: "点", ask: "5点の問題", askB: true },
      { a: "1人がけの いす", b: "3人がけの いす", va: 1, vb: 3, unit: "人", ask: "3人がけの いす", askB: true },
    ];
    const s = rng.pick(SCENES);
    const nb = rng.int(2, 12), na = rng.int(2, 12);
    return { s, n: na + nb, total: na * s.va + nb * s.vb, nb, na };
  },
  text(p) { const w = p.s.what ? `${p.s.what}の数` : "ごうけい"; return `${p.s.a}と ${p.s.b}が あわせて ${p.n}${p.s.what ? "ひき" : "こ"} あって、${w}は ${p.total}${p.s.unit}にゃ。<br>${p.s.ask}は いくつかにゃ?`; },
  solve(p) { return (p.total - p.s.va * p.n) / (p.s.vb - p.s.va); },
  check(p) { for (let b = 0; b <= p.n; b++) if ((p.n - b) * p.s.va + b * p.s.vb === p.total) return b; return null; },
  explain(p, ans) {
    const allA = p.s.va * p.n, diff = p.total - allA, d = p.s.vb - p.s.va;
    return {
      essence: "「ぜんぶ 片方だったら」と 考えて、ほんとうとの ちがいを 1こ分の差で わる問題にゃ",
      pattern: "つるかめ算",
      hint1: `もし ${p.n}こ ぜんぶが ${p.s.a} だったら、ごうけいは いくつに なるかにゃ?`,
      hint2: `ぜんぶ ${p.s.a} なら ${p.s.va} × ${p.n} = ${allA}。ほんとうの ${p.total} との ちがいを 見るにゃ`,
      exp: `ぜんぶ ${p.s.a} と すると ${p.s.va}×${p.n} = ${allA}${p.s.unit}<br>ほんとうとの差 ${p.total} − ${allA} = ${diff}<br>1こ 入れかえると ${p.s.vb} − ${p.s.va} = ${d} ふえる → ${diff} ÷ ${d} = <b>${ans}</b><br>「ぜんぶ○○だったら」と 決めつけてから 直すのが つるかめ算にゃ`,
      realworld: "レシートの 合計から、何を いくつ 買ったか 思い出すときに つかえるにゃ",
    };
  },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
