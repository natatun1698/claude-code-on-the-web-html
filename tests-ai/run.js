/* =========================================================
 * tests-ai/run.js — 生成AI版の検証(node だけで動く。ネットワーク不要)
 *   node tests-ai/run.js
 *
 * 1. 一致検証   : 固定発言を元エンジンと生成AI版エンジンに流し、
 *                 定型セリフ・採点結果が完全に一致することを確認する
 * 2. 手番の検証 : 手番の列が golden の期待どおりであること
 * 3. 不変条件   : 同じ専門用語の聞き返しは1回だけ / 3ストライクで打ち切り
 * 4. 模擬LLM    : 成功・時間切れ・上限・エラー・不正な文面のそれぞれで、
 *                 会話が止まらず定型に戻り、採点が変わらないこと
 * 5. 出力検証   : validate() の個別ケース
 * ========================================================= */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

function load(scenario) {
  const code = [
    read(`${scenario}/js/data.js`),
    read(`${scenario}-ai/js/data-ai.js`),
    read("js/engine.js"),
    read("js-ai/engine.js"),
    read("js-ai/llm.js"),
    `;({ RoleAI, AIRoleEngine, scoreSession, LLM, MockLLM, JARGON, SCENES,
        seed(n) { let s = n >>> 0; Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); } })`,
  ].join("\n");
  return vm.runInNewContext(code, { setTimeout, clearTimeout, console });
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const scoreKey = (r) => ({ score: r.score, grade: r.grade, title: r.title, goodQuote: r.goodQuote, improvement: r.improvement, detail: r.detail, walkout: r.walkout });

const X = load("bucho");
const golden = JSON.parse(read("tests-ai/golden/price.json"));

/* 元エンジンでの実行結果 */
function runOriginal(g) {
  X.seed(g.seed);
  const e = new X.RoleAI(g.scene, g.mode, g.theme);
  const texts = [e.openerText()];
  let walkout = false;
  for (const u of g.utterances) {
    const r = e.respond(u);
    texts.push(r.text);
    if (r.event === "walkout") walkout = true;
    if (r.end) break;
  }
  return { texts, walkout, score: scoreKey(X.scoreSession(e, walkout)) };
}

/* 生成AI版での実行(模擬LLMの挙動を指定) */
async function runAI(g, scenario) {
  X.seed(g.seed);
  X.LLM.resetSession();
  X.LLM.config.timeoutMs = 60;
  X.MockLLM.scenario = scenario;
  X.MockLLM.delayMs = [1, 3];
  X.MockLLM.slowMs = 200;
  X.MockLLM.n = 0;
  const e = new X.AIRoleEngine(g.scene, g.mode, g.theme);
  const canned = [e.openerText()];
  const moves = [], lines = [];
  let walkout = false;
  for (const u of g.utterances) {
    const d = e.decide(u);
    const line = await X.LLM.line(e, d);
    e.commit(d, line.text);
    canned.push(d.canned);
    moves.push(d.move);
    lines.push({ move: d.move, term: d.term, ...line });
    if (d.event === "walkout") walkout = true;
    if (d.end) break;
  }
  return { canned, moves, lines, walkout, calls: X.LLM.calls, disabled: X.LLM.disabled,
           disabledReason: X.LLM.disabledReason, score: scoreKey(X.scoreSession(e, walkout)) };
}

(async () => {
  console.log("1-3. 元エンジンとの一致・手番・不変条件");
  for (const g of golden) {
    const o = runOriginal(g);
    const a = await runAI(g, "ok");
    check(`${g.name}: 定型セリフが元と一致`, same(o.texts, a.canned));
    check(`${g.name}: 採点が元と一致`, same(o.score, a.score), JSON.stringify([o.score.score, a.score.score]));
    check(`${g.name}: 手番が期待どおり`, same(a.moves, g.moves), a.moves.join(","));
    check(`${g.name}: 打ち切りが期待どおり`, a.walkout === g.walkout);
    const asked = a.lines.filter((l) => l.move === "ASK_JARGON").map((l) => l.term);
    check(`${g.name}: 同じ用語の聞き返しは1回だけ`, new Set(asked).size === asked.length, asked.join(","));
    check(`${g.name}: 模擬LLM(ok)で失敗なし`, a.lines.every((l) => l.source === "llm" || l.reason === "local-move"),
      JSON.stringify(a.lines.filter((l) => l.source !== "llm")));
    check(`${g.name}: 定型手番では生成AIを呼ばない`,
      a.calls === a.lines.filter((l) => !X.LLM.LOCAL_MOVES.includes(l.move)).length);
  }

  console.log("4. 模擬LLMの失敗パターン");
  const expectReason = {
    slow: "timeout", error: "error", long: "invalid:too-long", inject: "invalid:out-of-character",
    jargon: "invalid:uses-jargon", empty: "invalid:empty",
  };
  for (const g of golden) {
    const o = runOriginal(g);
    for (const sc of ["slow", "limit", "error", "flaky", "long", "inject", "jargon", "empty"]) {
      const a = await runAI(g, sc);
      const tag = `${g.name} [${sc}]`;
      check(`${tag}: 採点が元と一致`, same(o.score, a.score));
      check(`${tag}: 手番が元と一致`, same(a.moves, g.moves));
      const remote = a.lines.filter((l) => !X.LLM.LOCAL_MOVES.includes(l.move));
      if (sc === "flaky") {
        check(`${tag}: 全ターンに文面がある`, a.lines.every((l) => l.text && l.text.length > 0));
        continue;
      }
      check(`${tag}: すべて定型に戻る`, a.lines.every((l) => l.source === "canned"));
      check(`${tag}: 定型の文面は元と同じ`, same(a.lines.map((l) => l.text), o.texts.slice(1)));
      if (!remote.length) continue;
      if (sc === "limit") {
        check(`${tag}: 1回目で定型モードに入る`, a.disabled && a.disabledReason === "limit" && a.calls === 1);
      } else {
        check(`${tag}: 1回目の理由`, remote[0].reason === expectReason[sc], remote[0].reason);
        if (remote.length >= 2) {
          check(`${tag}: 2回連続の失敗で定型モード`, a.disabled && a.calls === 2, `calls=${a.calls}`);
        }
      }
    }
  }

  console.log("5. 出力検証の個別ケース");
  const d = (o) => ({ move: "BEAT", modeId: "B", term: null, ack: false, mustPush: false, ...o });
  const v = (t, o) => X.LLM.validate(t, d(o || {}));
  check("通常の質問は合格", v("価格を教えてください。概算で結構です。") === null);
  check("製品のAI機能に触れるのは合格", v("AIが手伝ってくれるのは理解しました。それで、いくらですか。") === null);
  check("役の放棄は不合格", v("私はAIアシスタントです。") === "out-of-character");
  check("採点への言及は不合格", v("今の説明は80点ですね。点数をつけるとそうなります。") === "out-of-character");
  check("助言は不合格", v("アドバイスすると、結論から話すとよいですよ。") === "out-of-character");
  check("勝手な契約は不合格", v("わかりました、御社に決めます。") === "premature-commit");
  check("英語だけは不合格", v("How much is it?") === "not-japanese");
  check("知らない用語の使用は不合格", v("散乱線はどのくらい出ますか。") === "uses-jargon");
  check("聞き返しは対象の用語を含めば合格", v("「FPD」というのは何ですか。", { move: "ASK_JARGON", term: "FPD" }) === null);
  check("聞き返しに用語がなければ不合格", v("それは何ですか。", { move: "ASK_JARGON", term: "FPD" }) === "missing-term");
  check("値引き圧が要る手番で圧がなければ不合格", v("他社さんも検討しています。", { mustPush: true }) === "missing-discount-push");
  check("値引き圧があれば合格", v("他社はもっと下げてくれるそうですよ。", { mustPush: true }) === null);
  check("承認が要る手番で承認がなければ不合格", v("価格を教えてください。", { ack: true }) === "missing-ack");

  /* 全シーン・全モードの定型セリフが検証を通ること(定型に戻したとき矛盾しない) */
  let cannedBad = 0;
  for (const s of X.SCENES) for (const m of ["A", "B", "C"]) {
    const lines = [...(s.beats || []), ...(s.followups || [])];
    for (const b of lines) {
      if (v(b.ask[m], { mustPush: !!b.discountPush })) { cannedBad++; console.log("    定型が不合格:", s.id, m, b.ask[m], v(b.ask[m], { mustPush: !!b.discountPush })); }
    }
  }
  check("全シーンの定型セリフが出力検証を通る", cannedBad === 0, `${cannedBad}件`);

  console.log(`\n結果: ${pass} 件合格 / ${fail} 件不合格`);
  process.exit(fail ? 1 : 0);
})();
