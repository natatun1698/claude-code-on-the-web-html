const { validateBank } = require("../importer.js");
module.exports = function (t) {
  const good = { version: 1, problems: [
    { id: "a-1", tags: ["計算", "四則計算・逆算"], text: "x", answerType: "int", answer: 3 },
    { id: "a-2", tags: ["図形"], text: "x", answerType: "frac", answer: { n: 1, d: 4 }, figure: "<svg viewBox='0 0 1 1'><rect/></svg>" },
    { id: "a-3", tags: ["速さ"], text: "x", answerType: "time", answer: { m: 5 } },
    { id: "a-4", tags: ["場合の数"], text: "x", answerType: "multi", answer: [1, { n: 1, d: 2 }] },
    { id: "a-5", tags: ["規則性"], text: "x", answerType: "choice", answer: 1, choices: ["ア", "イ"] },
  ] };
  const v = validateBank(good); t.ok(v.ok, "valid bank ok: " + v.errors.join(";")); t.eq(v.problems.length, 5, "all kept");
  t.ok(validateBank(good.problems).ok, "bare array accepted");
  const bad = id => validateBank({ problems: [{ id: "a-1", tags: ["計算"], text: "x", answerType: "int", answer: 3 }, id] });
  t.ok(!bad({ id: "a-1", tags: ["計算"], text: "x", answerType: "int", answer: 1 }).ok, "dup id");
  t.ok(!bad({ id: "b", tags: ["算数"], text: "x", answerType: "int", answer: 1 }).ok, "unknown field");
  t.ok(!bad({ id: "b", tags: ["計算"], text: "x", answerType: "int", answer: 1.5 }).ok, "int needs integer");
  t.ok(!bad({ id: "b", tags: ["計算"], text: "x", answerType: "frac", answer: { n: 1, d: 0 } }).ok, "frac d=0");
  t.ok(!bad({ id: "b", tags: ["計算"], text: "x", answerType: "choice", answer: 0 }).ok, "choice needs choices");
  t.ok(!bad({ id: "b", tags: ["計算"], text: "x", answerType: "int", answer: 1, figure: "<svg><script>1</script></svg>" }).ok, "script in svg");
  t.ok(!bad({ id: "b", tags: ["計算"], text: "x", answerType: "int", answer: 1, figure: "<svg onload='x'></svg>" }).ok, "on= in svg");
  t.ok(!bad({ id: "b", tags: ["計算"], text: "x", answerType: "int", answer: 1, figure: "<img src=x>" }).ok, "img figure");
  t.ok(!bad({ id: "b c", tags: ["計算"], text: "x", answerType: "int", answer: 1 }).ok, "bad id chars");
  t.ok(!validateBank({}).ok, "no problems array");
  t.ok(bad({ id: "b", tags: ["算数"], text: "", answerType: "zzz", answer: 1 }).errors.length >= 3, "multiple errors reported");
};
