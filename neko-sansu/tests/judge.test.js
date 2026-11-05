const { judge, formatAnswer } = require("../judge.js");
module.exports = function (t) {
  const ok = (i, a, ty, o) => t.ok(judge(i, a, ty, o).ok, `judge ${JSON.stringify(i)} vs ${JSON.stringify(a)} (${ty}) should be ok`);
  const ng = (i, a, ty, o) => t.ok(!judge(i, a, ty, o).ok, `judge ${JSON.stringify(i)} vs ${JSON.stringify(a)} (${ty}) should be ng`);
  ok("15", 15, "int"); ng("16", 15, "int"); ng("", 15, "int");
  ok("１５", 15, "int"); ok(" 1500円 ", 1500, "int"); ng("1,500", 1500, "int"); // 「,」は複数解答の区切り ok("15cm²", 15, "unit", { unit: "cm²" });
  ok("1.5", 1.5, "dec"); ok("1．5", 1.5, "dec"); ok("21.5", 21.5, "dec"); ng("21.50001", 21.5, "dec");
  ok("3/4", { n: 3, d: 4 }, "frac"); ok("6/8", { n: 3, d: 4 }, "frac"); ok("３／４", { n: 3, d: 4 }, "frac"); ok("0.75", { n: 3, d: 4 }, "frac");
  ok("1と1/4", { n: 5, d: 4 }, "frac"); ok("5/4", { n: 5, d: 4 }, "frac"); ng("1/4", { n: 5, d: 4 }, "frac"); ng("1/0", { n: 1, d: 4 }, "frac");
  ok("5分30秒", { m: 5, s: 30 }, "time"); ok("330秒", { m: 5, s: 30 }, "time"); ok("1時間5分", { h: 1, m: 5 }, "time"); ng("5分", { m: 5, s: 30 }, "time");
  ok("3,1,2", [1, 2, 3], "multi"); ok("３，１，２", [1, 2, 3], "multi"); ng("1,2", [1, 2, 3], "multi"); ng("1,2,4", [1, 2, 3], "multi"); ng("1,1,2", [1, 2, 3], "multi");
  ok("1,2,3", [1, 2, 3], "ordered"); ng("3,2,1", [1, 2, 3], "ordered");
  ok("2", 2, "choice"); ng("1", 2, "choice");
  ng("abc", 1, "int"); ng("1/", 1, "int");
  t.eq(formatAnswer({ n: 6, d: 8 }, "frac"), "3/4", "formatAnswer frac reduces");
  t.eq(formatAnswer({ n: 8, d: 4 }, "frac"), "2", "formatAnswer frac integer");
  t.eq(formatAnswer({ m: 5, s: 30 }, "time"), "5分30秒", "formatAnswer time");
  t.eq(formatAnswer(21.5, "dec", "cm²"), "21.5cm²", "formatAnswer dec with unit");
};
