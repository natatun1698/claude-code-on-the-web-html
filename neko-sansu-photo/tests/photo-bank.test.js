const { parseAnswerText, parseChoices, validateMeta, newPhotoId, prefixedStorage } = require("../photo-bank.js");
const { judge, formatAnswer } = require("../../neko-sansu/judge.js");
const { createHistory, memoryStorage } = require("../../neko-sansu/history.js");
module.exports = function (t) {
  // 答えの文字列 → 採点用の形
  t.eq(parseAnswerText("12", "int"), 12, "int");
  t.eq(parseAnswerText("１２", "int"), 12, "int zenkaku");
  t.eq(parseAnswerText("1.5", "int"), null, "int rejects decimal");
  t.eq(parseAnswerText("3/4", "int"), null, "int rejects fraction");
  t.eq(parseAnswerText("1.5", "dec"), 1.5, "dec");
  t.eq(parseAnswerText("12", "unit"), 12, "unit");
  t.eq(parseAnswerText("6/8", "frac"), { n: 3, d: 4 }, "frac reduced");
  t.eq(parseAnswerText("1と1/4", "frac"), { n: 5, d: 4 }, "mixed frac");
  t.eq(parseAnswerText("2", "frac"), { n: 2, d: 1 }, "integer as frac");
  t.eq(parseAnswerText("0.5", "frac"), null, "decimal is not frac");
  t.eq(parseAnswerText("5分30秒", "time"), { h: 0, m: 5, s: 30 }, "time m s");
  t.eq(parseAnswerText("1時間20分", "time"), { h: 1, m: 20, s: 0 }, "time h m");
  t.eq(parseAnswerText("", "time"), null, "empty time");
  t.eq(parseAnswerText("3,5,8", "multi"), [3, 5, 8], "multi");
  t.eq(parseAnswerText("3、1/2", "multi"), [3, { n: 1, d: 2 }], "multi with frac and zenkaku comma");
  t.eq(parseAnswerText("3,x", "ordered"), null, "ordered with garbage");
  t.eq(parseAnswerText("2", "choice"), 2, "choice number");
  t.eq(parseAnswerText("ア", "choice"), null, "choice letter rejected");
  t.eq(parseAnswerText("12", "self"), null, "self has no answer");
  t.eq(parseChoices("ア,イ、ウ，エ"), ["ア", "イ", "ウ", "エ"], "choices split");

  // 登録した答えで judge が採点できる(子どもの入力形式と一致する)
  const roundtrip = (text, type, kid) => judge(kid, parseAnswerText(text, type), type).ok;
  t.ok(roundtrip("12", "int", "12"), "judge int");
  t.ok(roundtrip("3/4", "frac", "6/8"), "judge unreduced frac");
  t.ok(roundtrip("1と1/4", "frac", "5/4"), "judge mixed vs improper");
  t.ok(roundtrip("5分30秒", "time", "5分30秒"), "judge time");
  t.ok(roundtrip("3,5,8", "multi", "8,3,5"), "judge multi any order");
  t.ok(!roundtrip("3,5,8", "ordered", "8,3,5"), "judge ordered wrong order");
  t.eq(formatAnswer(parseAnswerText("1と1/4", "frac"), "frac"), "5/4", "format frac");

  // フォーム検証
  const base = { field: "計算", sub: "四則計算・逆算", answerType: "int", answerText: "12", unit: "", choicesText: "", hint1: "", hint2: "", exp: "", templateId: "gyakusan", memo: "" };
  let v = validateMeta(base); t.ok(v.ok, "valid meta: " + v.errors.join(";")); t.eq(v.item.tags, ["計算", "四則計算・逆算"], "tags"); t.eq(v.item.answer, 12, "answer"); t.eq(v.item.templateId, "gyakusan", "templateId");
  v = validateMeta(Object.assign({}, base, { sub: "" })); t.eq(v.item.tags, ["計算"], "empty sub dropped");
  t.ok(!validateMeta(Object.assign({}, base, { field: "算数" })).ok, "unknown field");
  t.ok(!validateMeta(Object.assign({}, base, { answerText: "abc" })).ok, "unparsable answer");
  t.ok(!validateMeta(Object.assign({}, base, { answerType: "zzz" })).ok, "unknown type");
  v = validateMeta(Object.assign({}, base, { answerType: "self", answerText: "" })); t.ok(v.ok, "self needs no answer"); t.eq(v.item.answer, null, "self answer null");
  v = validateMeta(Object.assign({}, base, { answerType: "choice", choicesText: "ア,イ,ウ", answerText: "2" })); t.ok(v.ok, "choice ok"); t.eq(v.item.answer, 1, "choice index 0-based"); t.eq(v.item.choices, ["ア", "イ", "ウ"], "choices");
  t.ok(!validateMeta(Object.assign({}, base, { answerType: "choice", choicesText: "ア", answerText: "1" })).ok, "choice needs 2+");
  t.ok(!validateMeta(Object.assign({}, base, { answerType: "choice", choicesText: "ア,イ", answerText: "3" })).ok, "choice index out of range");
  v = validateMeta(Object.assign({}, base, { answerType: "time", answerText: "5分30秒", unit: "分" })); t.ok(v.ok, "time ok"); t.eq(v.item.answer, { h: 0, m: 5, s: 30 }, "time answer");

  // ID と履歴の分離
  t.ok(/^ph-[0-9a-z]+-[0-9a-z]+$/.test(newPhotoId()), "photo id format");
  t.ok(newPhotoId(1, 0.1) !== newPhotoId(2, 0.1), "ids differ by time");
  const base2 = memoryStorage();
  const h = createHistory(prefixedStorage(base2, "neko-sansu-photo-log-v1"));
  h.start("imp:ph-1", ["計算"]); h.end("imp:ph-1", { result: "ok" });
  t.ok(base2.getItem("neko-sansu-photo-log-v1") && !base2.getItem("neko-sansu-log-v1"), "history goes to the photo app's own key");
  t.eq(h.summarize().counts.ok, 1, "history readable through prefixed storage");
};
