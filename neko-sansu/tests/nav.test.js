/* 画面遷移の状態機械: 戻る・進むをくり返しても壊れない。問題の前後移動。段階の進み方 */
const { createNav, createQuizFlow, nextPhase, forwardLabel } = require("../nav.js");
module.exports = function (t) {
  const S = ["title", "name", "quiz", "zukan", "seiseki", "parent"];
  const n = createNav(S);
  t.eq(n.current(), "title", "starts at title"); t.eq(n.depth(), 0, "depth 0"); t.ok(!n.canBack(), "cannot back at title");
  t.eq(n.back(), null, "back at bottom does nothing"); t.eq(n.current(), "title", "still title");
  n.go("quiz"); n.go("zukan"); t.eq(n.depth(), 2, "depth after 2 go");
  t.eq(n.go("zukan"), "zukan", "go to same screen is no-op"); t.eq(n.depth(), 2, "depth unchanged by no-op");
  t.eq(n.back(), "quiz", "back -> quiz"); t.eq(n.back(), "title", "back -> title"); t.eq(n.back(), null, "back at bottom again");
  t.eq(n.forward(), "quiz", "forward -> quiz"); t.eq(n.forward(), "zukan", "forward -> zukan"); t.eq(n.forward(), null, "no more forward");
  // 戻ってから別の画面へ行くと「進む」は消える
  n.back(); n.go("seiseki"); t.ok(!n.canForward(), "forward cleared after new go"); t.eq(n.depth(), 2, "depth 2");
  // ブラウザの popstate に合わせる
  t.eq(n.syncTo(0), "title", "syncTo 0 -> title"); t.eq(n.syncTo(2), "seiseki", "syncTo 2 -> seiseki"); t.eq(n.syncTo(1), "quiz", "syncTo 1 -> quiz");
  t.eq(n.syncTo(9), "seiseki", "syncTo beyond forward stops at top"); t.eq(n.syncTo(-5), "title", "syncTo below 0 stops at title");
  t.eq(n.home(), "title", "home"); t.eq(n.depth(), 0, "home depth 0"); t.ok(!n.canForward(), "home clears forward");
  t.throws(() => n.go("nope"), "unknown screen rejected");
  // 100回ランダムに操作しても整合
  let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) { const r = rnd(); if (r < .4) n.go(S[Math.floor(rnd() * S.length)]); else if (r < .7) n.back(); else if (r < .9) n.forward(); else n.home(); t.ok(S.includes(n.current()) && n.depth() >= 0, "state stays valid"); if (n.depth() === 0) t.eq(n.current(), "title", "depth 0 is always title"); }
  // 問題の前後移動
  const f = createQuizFlow();
  t.eq(f.current(), null, "empty flow"); t.ok(!f.hasPrev() && !f.hasNext(), "no prev/next when empty"); t.eq(f.prev(), null, "prev on empty");
  const a = { id: "a", ended: true }, b = { id: "b", ended: false }, c = { id: "c", ended: false };
  f.add(a); f.add(b); t.eq(f.index(), 1, "index at newest"); t.ok(f.hasPrev() && !f.hasNext(), "prev only");
  t.eq(f.prev(), a, "prev -> a (回答済み: 結果と解説を表示する側)"); t.eq(f.prev(), null, "no more prev"); t.eq(f.next(), b, "next -> b (未回答: 出題の状態)"); t.eq(f.next(), null, "no more next");
  f.prev(); f.add(c); t.eq(f.index(), 2, "add appends at end even after prev"); t.eq(f.list.length, 3, "3 questions"); t.eq(f.prev(), b, "prev from c -> b");
  f.reset(); t.eq(f.current(), null, "reset");
  // 段階
  t.eq(nextPhase("asking"), "hint1", "asking -> hint1"); t.eq(nextPhase("hint1"), "hint2", "hint1 -> hint2"); t.eq(nextPhase("hint2"), "exp", "hint2 -> exp"); t.eq(nextPhase("done"), "done", "done stays");
  t.eq(forwardLabel("asking"), "わからない", "label asking"); t.eq(forwardLabel("hint1"), "つぎのヒント", "label hint1"); t.eq(forwardLabel("exp"), "もう一問", "label exp"); t.eq(forwardLabel("done"), "つぎの問題へ", "label done");
};
