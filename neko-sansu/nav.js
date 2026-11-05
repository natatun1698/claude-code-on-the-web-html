/* 画面遷移の状態機械。純ロジック(DOM・history API に触らない)。app.js がこれを真として pushState を鏡のように合わせる */
"use strict";
/** 画面のスタック。go / back / forward / home。戻る・進むを何度くり返しても壊れない */
function createNav(screens, home = "title") {
  const stack = [home]; let fwd = [];
  const current = () => stack[stack.length - 1];
  return {
    current, depth: () => stack.length - 1, canBack: () => stack.length > 1, canForward: () => fwd.length > 0,
    go(id) { if (!screens.includes(id)) throw new Error("unknown screen " + id); if (id === current()) return id; stack.push(id); fwd = []; return id; },
    back() { if (stack.length <= 1) return null; fwd.push(stack.pop()); return current(); },
    forward() { if (!fwd.length) return null; stack.push(fwd.pop()); return current(); },
    home() { stack.splice(1); fwd = []; return home; },
    /** ブラウザの popstate で届いた depth に合わせる。戻った数・進んだ数だけ動かす */
    syncTo(depth) { while (stack.length - 1 > depth && stack.length > 1) this.back(); while (stack.length - 1 < depth && fwd.length) this.forward(); return current(); },
  };
}

/** 1回の学習セッション内の問題の並び。「前の問題にもどる」「つぎの問題へ」。各要素は app 側の Q オブジェクト */
function createQuizFlow() {
  const list = []; let i = -1;
  return {
    list, index: () => i, current: () => list[i] || null, hasPrev: () => i > 0, hasNext: () => i < list.length - 1,
    add(q) { list.push(q); i = list.length - 1; return q; },
    prev() { if (i <= 0) return null; i--; return list[i]; },
    next() { if (i >= list.length - 1) return null; i++; return list[i]; },
    reset() { list.length = 0; i = -1; },
  };
}

/** 1問の段階。asking → (まちがい/わからない) hint1 → hint2 → exp(終了) / 正解で done */
const PHASES = ["asking", "hint1", "hint2", "exp", "done"];
/** 「わからない」「つぎのヒント」で進む先 */
function nextPhase(phase) { return { asking: "hint1", hint1: "hint2", hint2: "exp", exp: "exp", done: "done" }[phase] || "hint1"; }
/** 右側の「進む」ボタンのラベル */
function forwardLabel(phase) { return { asking: "わからない", hint1: "つぎのヒント", hint2: "かいせつを 見る", exp: "もう一問", done: "つぎの問題へ" }[phase]; }

var api = { createNav, createQuizFlow, PHASES, nextPhase, forwardLabel };
if (typeof module !== "undefined") module.exports = api; else Object.assign(window, api);
