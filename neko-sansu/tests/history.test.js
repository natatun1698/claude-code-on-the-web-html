/* 学習履歴の記録: 開始/終了、離脱の検知、6状態の集計、やり直し回数、バックアップ/復元 */
const { createHistory, memoryStorage, summarize } = require("../history.js");
module.exports = function (t) {
  let now = 1700000000000; const clock = () => now;
  const h = createHistory(memoryStorage(), clock);
  t.eq(h.pendingStart(), null, "no pending at first");
  h.start("2025-1-1-1", ["計算/四則計算・逆算"]); now += 40000;
  h.end("2025-1-1-1", { result: "ok", hints: 0, retries: 0, edits: 2 });
  t.eq(h.pendingStart(), null, "ended -> no pending");
  h.start("2026-1-2-2", ["割合と比/濃度"]); now += 5000;
  const p = h.pendingStart(); t.ok(p && p.pid === "2026-1-2-2", "start without end is detected as pending (途中離脱)");
  // 離脱したまま次の問題へ → 前の start は abandoned として集計される
  h.start("2025-1-2-2", ["和と差/つるかめ算"]); now += 200000;
  h.end("2025-1-2-2", { result: "exp", hints: 2, retries: 2 });
  h.start("2025-1-2-5", ["図形/角度・面積・長さ"]); now += 10000; h.end("2025-1-2-5", { result: "ng", hints: 1, retries: 2 });
  h.start("2026-1-1-4", ["計算/四則計算・逆算"]); now += 10000; h.end("2026-1-1-4", { result: "ok_hint", hints: 1, retries: 1 });
  const s = h.summarize();
  t.eq(JSON.stringify(s.counts), JSON.stringify({ ok: 1, ok_hint: 1, ng: 1, exp: 1, abandoned: 1 }), "counts by 5 recorded states (+未着手 = 記録なし)");
  t.eq(s.abandoned[0].pid, "2026-1-2-2", "abandoned list");
  t.eq(s.slow.length, 1, "slow list (>=3min)"); t.eq(s.slow[0].pid, "2025-1-2-2", "slow pid");
  t.eq(s.attempts[0].ms, 40000, "ms measured from start"); t.eq(s.attempts[0].edits, 2, "edits (入力のやり直し) recorded");
  t.eq(s.byField["計算"].rate, 100, "field rate by 大分類, ok_hint counts as correct");
  t.eq(s.byField["割合と比"].rate, null, "field with only abandoned has null rate");
  t.eq(s.byField["図形"].rate, 0, "ng -> 0%");
  t.eq(Object.values(s.byDay)[0].total, 5, "byDay total");
  t.throws(() => h.end("x", { result: "bad" }), "unknown result rejected");
  // 同じ問題を後日もう一度 → 別の試行として数える。再開(resumed)では start を足さないのは app 側の責任
  now += 86400000; h.start("2026-1-2-2", ["割合と比/濃度"]); now += 1000; h.end("2026-1-2-2", { result: "ok" });
  const s2 = h.summarize(); t.eq(s2.counts.abandoned, 1, "old abandoned attempt stays abandoned"); t.eq(s2.counts.ok, 2, "new attempt counted");
  t.eq(Object.keys(s2.byDay).length, 2, "two days");
  // バックアップ → 復元(マージで重複しない)。本文は含まれない
  const json = h.exportJSON(); const h2 = createHistory(memoryStorage(), clock);
  t.eq(h2.importJSON(json), 11, "restore event count"); t.eq(h2.importJSON(json), 11, "merge dedupes");
  t.eq(JSON.stringify(h2.summarize().counts), JSON.stringify(s2.counts), "restored summary equals");
  t.throws(() => h2.importJSON('{"events":[{"foo":1}]}'), "bad backup rejected");
  t.ok(!/text|問題文|にゃ/.test(json), "backup contains ids only, no problem text");
  // 壊れた storage でも落ちない
  const broken = createHistory({ getItem: () => "{{{", setItem: () => { throw new Error("full"); } }, clock);
  t.eq(broken.events().length, 0, "broken storage reads as empty"); broken.start("a", []); t.ok(true, "write failure swallowed");
  t.eq(summarize([]).attempts.length, 0, "empty summarize");
};
