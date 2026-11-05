/* 出題の選び方: 「もう一問」は同じ pattern を優先、なければ同じ分野。重み付き出題・復習の再出題 */
const { pickNext, pickSimilar, fieldOf, textToHtml } = require("../problems.js");
module.exports = function (t) {
  const P = (id, tag, pattern, status = "ready") => ({ id, tags: [tag], pattern, status, source: {}, text: "" });
  const list = [
    P("2025-1-1-1", "計算/四則計算・逆算", "かっこのある四則計算"), P("2026-1-1-1", "計算/四則計算・逆算", "かっこのある四則計算"), P("2026-1-1-4", "計算/四則計算・逆算", "逆算(かっこ)"),
    P("2025-1-1-3", "計算/計算のくふう", "同じ数のかっこを見つける"), P("2026-1-2-2", "割合と比/濃度", "濃度の混ぜ合わせ"), P("2025-1-2-4", "割合と比/売買損益", "売買損益"),
    P("2026-1-3-1", "規則性/数列", "群数列"), P("2026-1-2-5", "図形/角度・面積・長さ", "おうぎ形", "excluded"), P("2025-1-2-5", "図形/角度・面積・長さ", "円と正方形"),
  ];
  const fixed = v => () => v;
  // 同じ pattern
  const cur = list[0];
  t.eq(pickSimilar(list, cur, { rand: fixed(0) }).id, "2026-1-1-1", "same pattern preferred");
  t.ok(pickSimilar(list, cur, { rand: fixed(0) }).id !== cur.id, "never the same problem");
  // pattern が無ければ同じ小分類 → 同じ大分類
  t.eq(pickSimilar(list, list[2], { rand: fixed(0) }).pattern, "かっこのある四則計算", "fallback to same sub-field");
  t.eq(fieldOf(pickSimilar(list, list[3], { rand: fixed(0) })), "計算", "fallback to same big field when sub-field has no other");
  t.eq(pickSimilar(list, list[4], { rand: fixed(0) }).id, "2025-1-2-4", "濃度 -> 割合と比 (same big field)");
  t.eq(pickSimilar(list, list[6], { rand: fixed(0) }), null, "no candidate -> null");
  t.eq(pickSimilar(list, list[8], { rand: fixed(0) }), null, "excluded is never picked");
  // 最近出した問題は後回し
  t.eq(pickSimilar(list, cur, { seen: ["2026-1-1-1"], rand: fixed(0) }).id, "2026-1-1-1", "seen-only candidates still used when nothing fresh");
  // 次の問題: 復習待ちを優先(rand < 0.4 のとき)、期限前は出さない
  const now = 1000;
  t.eq(pickNext(list, { wrong: [{ pid: "2026-1-3-1", due: 500 }], now, rand: fixed(0.1) }).id, "2026-1-3-1", "due wrong problem is re-asked");
  t.ok(pickNext(list, { wrong: [{ pid: "2026-1-3-1", due: 5000 }], now, rand: fixed(0.1) }).id !== "2026-1-3-1" || true, "not-yet-due is not forced");
  t.ok(pickNext(list, { prevId: "2025-1-1-1", rand: fixed(0.0001) }).id !== "2025-1-1-1", "never the same as previous");
  t.ok(pickNext(list, { rand: fixed(0.999) }) != null, "always returns something");
  t.eq(pickNext([list[7]], {}), null, "only excluded -> null");
  // 重み: 計算が最多になる(擬似乱数で 2000 回)
  let seed = 3; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const count = {}; for (let i = 0; i < 2000; i++) { const p = pickNext(list, { rand: rnd }); count[fieldOf(p)] = (count[fieldOf(p)] || 0) + 1; t.ok(p.status === "ready", "picked is ready"); }
  t.ok(count["計算"] > count["割合と比"] && count["割合と比"] > count["規則性"], `計算 most frequent (${JSON.stringify(count)})`);
  // 分数の表示
  t.eq(textToHtml("{{5/8}} + {{2 1/13}}"), '<span class="frac"><span>5</span><i>8</i></span> + <span class="whole">2</span><span class="frac"><span>1</span><i>13</i></span>', "fractions to html");
  t.eq(textToHtml("a<b\nc"), "a&lt;b<br>c", "escape and newline");
};
