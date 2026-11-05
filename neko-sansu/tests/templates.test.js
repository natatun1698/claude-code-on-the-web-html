const { TEMPLATES, TEMPLATE_IDS } = require("../templates/index.js");
const { makeRng } = require("../rng.js");
const { formatAnswer } = require("../judge.js");
const fs = require("fs"), path = require("path");
const N = 300;
const VALID_TAGS = { "計算": ["四則計算・逆算", "計算のくふう", "単位の計算"], "和と差": ["和差算", "分配算", "消去算", "つるかめ算", "平均とのべ", "過不足算"], "割合と比": ["割合と比", "還元算・相当算", "倍数算", "売買損益", "濃度", "仕事算"], "速さ": ["速さと比", "旅人算", "通過算"], "図形": ["角度・面積・長さ", "辺の比と面積の比", "体積・表面積", "展開図", "図形上の点の移動"], "表とグラフ": ["表とグラフ"], "数の性質": ["約数と倍数", "整数・小数・分数の性質"], "規則性": ["数列", "周期算", "植木算"], "場合の数": ["場合の数", "調べ・推理"] };
const TYPES = ["int", "dec", "frac", "unit", "time", "multi", "ordered", "choice"];
const near = (a, b) => Math.abs(a - b) < 1e-6;
const val = (a, ty) => ty === "frac" ? a.n / a.d : ty === "time" ? (a.h || 0) * 3600 + (a.m || 0) * 60 + (a.s || 0) : Array.isArray(a) ? a.map(x => typeof x === "object" ? x.n / x.d : x) : Number(a);

module.exports = function (t) {
  t.ok(TEMPLATE_IDS.length >= 6, "at least 6 templates");
  for (const id of TEMPLATE_IDS) t.ok(fs.existsSync(path.join(__dirname, "../templates", id + ".js")), `file exists for ${id}`);
  for (const T of TEMPLATES) {
    const tag = `[${T.id}]`;
    t.eq(T.id, T.id.toLowerCase().replace(/[^a-z0-9-]/g, ""), `${tag} id format`);
    t.ok(Array.isArray(T.tags) && VALID_TAGS[T.tags[0]] && VALID_TAGS[T.tags[0]].includes(T.tags[1]), `${tag} tags valid: ${T.tags}`);
    t.ok(TYPES.includes(T.answerType), `${tag} answerType`);
    t.ok(typeof T.params === "function" && typeof T.text === "function" && typeof T.solve === "function" && typeof T.explain === "function", `${tag} required functions`);
    t.ok(!/return\s+-?\d+(\.\d+)?\s*;?\s*\}\s*,?\s*$/.test(T.solve.toString().trim()) || T.solve.toString().includes("p."), `${tag} solve computes from params`);
    const answers = new Set(), texts = new Set();
    let checkMismatch = 0, gaveUp = 0;
    for (let seed = 1; seed <= N; seed++) {
      const rng = makeRng(seed);
      let p; try { p = T.params(rng); } catch (e) { gaveUp++; continue; }
      t.ok(p && typeof p === "object", `${tag} params returns object`);
      const ans = T.solve(p);
      // 型チェック
      if (T.answerType === "int") t.ok(Number.isInteger(ans) && ans >= 0, `${tag} seed ${seed}: answer not int (${ans})`);
      if (T.answerType === "dec" || T.answerType === "unit") t.ok(typeof ans === "number" && isFinite(ans) && ans > 0, `${tag} seed ${seed}: answer not finite positive (${ans})`);
      if (T.answerType === "frac") t.ok(ans && Number.isInteger(ans.n) && Number.isInteger(ans.d) && ans.d > 0, `${tag} seed ${seed}: frac shape`);
      if (T.answerType === "time") t.ok(ans && ["h", "m", "s"].some(k => k in ans), `${tag} seed ${seed}: time shape`);
      if (T.answerType === "multi" || T.answerType === "ordered") t.ok(Array.isArray(ans) && ans.length > 0, `${tag} seed ${seed}: array answer`);
      if (T.answerType === "choice") t.ok(Number.isInteger(ans) && T.choices && ans < T.choices(p).length, `${tag} seed ${seed}: choice index`);
      // 別解
      if (T.check) { const c = T.check(p); const a = val(ans, T.answerType), b = val(c, T.answerType); const same = Array.isArray(a) ? a.length === b.length && a.every((x, i) => near(x, b[i])) : near(a, b); if (!same) checkMismatch++; }
      // 問題文・解説
      const text = T.text(p); t.ok(typeof text === "string" && text.length > 10 && !/undefined|NaN/.test(text), `${tag} seed ${seed}: text ok`);
      const ex = T.explain(p, ans);
      for (const k of ["essence", "pattern", "hint1", "hint2", "exp"]) t.ok(typeof ex[k] === "string" && ex[k].length > 0 && !/undefined|NaN/.test(ex[k]), `${tag} seed ${seed}: explain.${k}`);
      const shown = formatAnswer(ans, T.answerType, "");
      t.ok(ex.exp.includes(`<b>${shown}`), `${tag} seed ${seed}: explain number mismatch (exp lacks <b>${shown})`);
      t.ok(!ex.hint1.includes(`${shown}`) || /^\d$/.test(shown), `${tag} seed ${seed}: hint1 reveals answer`);
      // 図
      if (T.figure) { const f = T.figure(p); t.ok(/^<svg/.test(f) && !/<script|<img|<foreignObject|\son\w+=/.test(f) && !/NaN|undefined/.test(f), `${tag} seed ${seed}: figure svg safe`); }
      answers.add(shown); texts.add(text);
    }
    t.ok(gaveUp === 0, `${tag} params gave up ${gaveUp} times`);
    t.ok(answers.size >= 5, `${tag} too few distinct answers (${answers.size})`);
    t.ok(texts.size >= 5, `${tag} too few distinct texts (${texts.size}) - fixed problem?`);
    t.ok(checkMismatch === 0, `${tag} check != solve in ${checkMismatch} cases`);
    // 再現性
    const p1 = T.params(makeRng(7)), p2 = T.params(makeRng(7));
    t.eq(JSON.stringify(p1), JSON.stringify(p2), `${tag} same seed -> same params`);
  }
  // Math.random 禁止
  for (const id of TEMPLATE_IDS) t.ok(!fs.readFileSync(path.join(__dirname, "../templates", id + ".js"), "utf8").includes("Math.random"), `${id} uses no Math.random`);
};
