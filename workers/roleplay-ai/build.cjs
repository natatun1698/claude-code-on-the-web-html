/* =========================================================
 * build.cjs — worker.js を生成する
 *   node workers/roleplay-ai/build.cjs
 *
 * 各シナリオの data.js(元アプリ。読むだけ)と data-ai.js から、
 * Worker が必要とする台詞と人物設定を取り出して worker.js に焼き込む。
 * 台詞や人物設定を変えたら、このスクリプトを実行し直してデプロイする。
 * ========================================================= */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

/* 生成AI版を持つシナリオ */
const SCENARIO_DIRS = ["bucho"];

function extract(dir) {
  const code = [
    read(`${dir}/js/data.js`),
    read(`${dir}-ai/js/data-ai.js`),
    `;({ AI_SCENARIO_ID, AI_SCENE_IDS, AI_PERSONA, JARGON, SCENES, VALUE_ACK, DISCOUNT_PUSH_INJECT })`,
  ].join("\n");
  const d = vm.runInNewContext(code, {});
  const scenes = {};
  for (const id of d.AI_SCENE_IDS) {
    const s = d.SCENES.find((x) => x.id === id);
    scenes[id] = {
      beats: (s.beats || []).map((b) => b.ask),
      followups: (s.followups || []).map((b) => b.ask),
      nuggets: (s.nuggets || []).map((n) => n.text),
      noQuestion: s.noQuestion || null,
      closer: s.closer,
    };
  }
  return [d.AI_SCENARIO_ID, {
    persona: d.AI_PERSONA,
    jargon: d.JARGON.map((j) => j.label),
    valueAck: d.VALUE_ACK,
    discountPush: d.DISCOUNT_PUSH_INJECT,
    scenes,
  }];
}

function build(opts = {}) {
  const scenarios = Object.fromEntries(SCENARIO_DIRS.map(extract));
  return [
    "/* このファイルは build.cjs が生成したものです。直接編集せず、",
    " * worker.src.js か各シナリオの data-ai.js を直して build.cjs を実行してください。 */",
    "",
    "const SCENARIOS = " + JSON.stringify(scenarios, null, 2) + ";",
    "",
    read("workers/roleplay-ai/worker.src.js"),
    // テスト用ビルドだけ内部関数を公開する(デプロイ用には含めない)
    opts.test ? "export const __test = { SCENARIOS, checkRequest, buildMessages, systemPrompt, extractText, isLimitError };" : "",
  ].join("\n");
}

module.exports = { build };

if (require.main === module) {
  const out = path.join(__dirname, "worker.js");
  fs.writeFileSync(out, build());
  console.log("生成しました:", path.relative(root, out));
}
