/* コピーして <新ID>.js にする。TODO を全部埋める。原題の文・数値・図は写さない */
"use strict";
var T = {  // var: 複数のテンプレートを <script> で読むため
  id: "TODO-id",                       // TODO: 英小文字とハイフン。ファイル名と同じ
  title: "TODO やさしい表示名",
  tags: ["TODO 大分野", "TODO 小分野"], // schema.md の一覧の文字列をそのまま
  answerType: "int",                   // int/dec/frac/unit/time/multi/ordered/choice
  unit: "",                            // 表示用の単位(例 "円")
  weight: 1,
  figure: null,                        // 図があるときは (p) => SVG.svg(...)
  params(rng) {
    // TODO: rng.int / rng.pick で数値を決める。条件を満たすまで while(true) で作り直してよい
    while (true) {
      const a = rng.int(2, 9), b = rng.int(10, 90);
      if (b % a === 0) return { a, b };
    }
  },
  text(p) { return `TODO: ${p.a} と ${p.b} をつかった問題文にゃ`; },
  solve(p) { return p.b / p.a; },      // TODO: 必ずコードで計算する
  check(p) { for (let x = 0; x <= 1000; x++) if (x * p.a === p.b) return x; return null; }, // 推奨: 別解
  explain(p, ans) {
    return {
      essence: "TODO: この問題は 本質的に なにを 聞いているか(1文)",
      pattern: "TODO: 解法パターン名",
      hint1: "TODO: どこに注目するか(数値は出さない)",
      hint2: `TODO: 1手目だけ(例: まず ${p.b} を ${p.a} で わってみるにゃ)`,
      exp: `TODO: ${p.b}÷${p.a} = <b>${ans}</b>`,
      realworld: "TODO(省略可): 社会で役立つ場面",
    };
  },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
