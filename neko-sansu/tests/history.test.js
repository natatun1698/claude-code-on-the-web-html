const { createHistory, memoryStorage, summarize } = require("../history.js");
module.exports = function (t) {
  let now = 1700000000000; const clock = () => now;
  const h = createHistory(memoryStorage(), clock);
  t.eq(h.pendingStart(), null, "no pending at first");
  h.start("gyakusan#1", ["計算", "四則計算・逆算"]); now += 40000;
  h.end("gyakusan#1", { result: "ok", hints: 0, retries: 1 });
  t.eq(h.pendingStart(), null, "ended -> no pending");
  h.start("noudo#2", ["割合と比", "濃度"]); now += 5000;
  const p = h.pendingStart(); t.ok(p && p.pid === "noudo#2", "abandoned start is detected as pending");
  // 離脱したまま次の問題へ → 前の start は abandoned として集計される
  h.start("tsurukame#3", ["和と差", "つるかめ算"]); now += 200000;
  h.end("tsurukame#3", { result: "exp", hints: 2, retries: 2 });
  h.start("imp:2024-01", ["図形"]); now += 10000; h.end("imp:2024-01", { result: "ng", hints: 1, retries: 2 });
  h.start("gyakusan#9", ["計算"]); now += 10000; h.end("gyakusan#9", { result: "ok_hint", hints: 1, retries: 2 });
  const s = h.summarize();
  t.eq(JSON.stringify(s.counts), JSON.stringify({ ok: 1, ok_hint: 1, ng: 1, exp: 1, abandoned: 1 }), "counts by 5 recorded states");
  t.eq(s.abandoned[0].pid, "noudo#2", "abandoned list");
  t.eq(s.slow.length, 1, "slow list (>=3min)"); t.eq(s.slow[0].pid, "tsurukame#3", "slow pid");
  t.eq(s.attempts[0].ms, 40000, "ms measured from start");
  t.eq(s.byField["計算"].rate, 100, "field rate counts ok_hint as correct");
  t.eq(s.byField["割合と比"].rate, null, "field with only abandoned has null rate");
  t.eq(s.byField["図形"].rate, 0, "ng -> 0%");
  t.eq(Object.values(s.byDay)[0].total, 5, "byDay total");
  t.throws(() => h.end("x", { result: "bad" }), "unknown result rejected");
  // バックアップ → 復元(マージで重複しない)
  const json = h.exportJSON(); const h2 = createHistory(memoryStorage(), clock);
  t.eq(h2.importJSON(json), 9, "restore event count"); t.eq(h2.importJSON(json), 9, "merge dedupes");
  t.eq(JSON.stringify(h2.summarize().counts), JSON.stringify(s.counts), "restored summary equals");
  t.throws(() => h2.importJSON('{"events":[{"foo":1}]}'), "bad backup rejected");
  t.ok(!json.includes("にゃ"), "backup contains no problem text");
  // 壊れた storage でも落ちない
  const broken = createHistory({ getItem: () => "{{{", setItem: () => { throw new Error("full"); } }, clock);
  t.eq(broken.events().length, 0, "broken storage reads as empty"); broken.start("a", []); t.ok(true, "write failure swallowed");
  t.eq(summarize([]).attempts.length, 0, "empty summarize");
};
