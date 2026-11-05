/* 採点の単体テスト: 分数・小数・単位・全角・順不同・時間・文字の選択肢 */
const { judge, formatAnswer } = require("../judge.js");
module.exports = function (t) {
  const ok = (i, a, ty, o) => t.ok(judge(i, a, ty, o).ok, `judge ${JSON.stringify(i)} vs ${JSON.stringify(a)} (${ty}) should be ok`);
  const ng = (i, a, ty, o) => t.ok(!judge(i, a, ty, o).ok, `judge ${JSON.stringify(i)} vs ${JSON.stringify(a)} (${ty}) should be ng`);
  // 整数・小数(データの answer は文字列)
  ok("15", "15", "int"); ng("16", "15", "int"); ng("", "15", "int"); ok("１５", "15", "int"); ok(" 1500円 ", "1500", "int"); ng("1,500", "1500", "int");
  ok("-3", "-3", "int"); ok("7.74", "7.74", "dec"); ok("７．７４", "7.74", "dec"); ok("7.74cm²", "7.74", "dec"); ng("7.740001", "7.74", "dec"); ok("1.350", "1.35", "dec");
  // 単位つき(数だけ入力でも単位つきでもよい)
  ok("150", "150", "unit", { unit: "cm" }); ok("150cm", "150", "unit", { unit: "cm" }); ok("700cm²", "700", "int"); ok("36秒後", "36", "int");
  // 分数: 文字列 "7/8" / 帯分数 "2 1/13" / 未約分 / 小数での回答
  ok("7/8", "7/8", "frac"); ok("14/16", "7/8", "frac"); ok("７／８", "7/8", "frac"); ok("0.875", "7/8", "frac"); ng("7/9", "7/8", "frac"); ng("1/0", "1/4", "frac");
  ok("2と1/13", "2 1/13", "frac"); ok("27/13", "2 1/13", "frac"); ng("1/13", "2 1/13", "frac"); ok("6/7", "6/7", "frac");
  ok("3/4", { n: 3, d: 4 }, "frac"); ok("1と1/4", { n: 5, d: 4 }, "frac"); // 旧形式も読める
  // 時間
  ok("1時間21分", { hours: 1, minutes: 21 }, "time"); ok("81分", { hours: 1, minutes: 21 }, "time"); ng("1時間20分", { hours: 1, minutes: 21 }, "time");
  ok("5分30秒", { minutes: 5, seconds: 30 }, "time"); ok("330秒", { minutes: 5, seconds: 30 }, "time"); ok("1:21:00", { hours: 1, minutes: 21 }, "time"); ok("5分30秒", { m: 5, s: 30 }, "time");
  // 複数の答え: 順不同 / 順序あり(ア・イ)
  ok("36,12,20", ["12", "20", "36"], "multi"); ok("３６，１２，２０", ["12", "20", "36"], "multi"); ng("12,20", ["12", "20", "36"], "multi"); ng("12,20,37", ["12", "20", "36"], "multi"); ng("12,12,20", ["12", "20", "36"], "multi");
  ok("3.1,3.6", ["3.1", "3.6"], "multi", { orderMatters: true }); ng("3.6,3.1", ["3.1", "3.6"], "multi", { orderMatters: true }); ok("3.6,3.1", ["3.1", "3.6"], "multi", { orderMatters: false });
  ok("1/2,3/4", ["1/2", "3/4"], "multi"); ok("0.5,6/8", ["1/2", "3/4"], "multi");
  // 並べ替え(文字) / 選択
  ok("A,B,D,C", ["A", "B", "D", "C"], "ordered"); ng("A,B,C,D", ["A", "B", "D", "C"], "ordered"); ok("ａ,ｂ,ｄ,ｃ".toUpperCase(), ["A", "B", "D", "C"], "ordered"); ng("A,B,D", ["A", "B", "D", "C"], "ordered");
  ok("1,2,3", ["1", "2", "3"], "ordered"); ng("3,2,1", ["1", "2", "3"], "ordered");
  ok("イ", "イ", "choice"); ng("ア", "イ", "choice"); ok("Ｂ", "B", "choice");
  ng("abc", "1", "int"); ng("1/", "1", "int"); t.eq(judge("", "1", "int").reason, "empty", "empty reason"); t.eq(judge("12", ["1", "2"], "multi").reason, "count", "count reason");
  // 表示
  t.eq(formatAnswer("7/8", "frac"), "7/8", "format frac string"); t.eq(formatAnswer("2 1/13", "frac"), "2と1/13", "format mixed"); t.eq(formatAnswer({ n: 6, d: 8 }, "frac"), "3/4", "format frac object reduces");
  t.eq(formatAnswer({ hours: 1, minutes: 21 }, "time"), "1時間21分", "format time"); t.eq(formatAnswer({ m: 5, s: 30 }, "time"), "5分30秒", "format time old");
  t.eq(formatAnswer("7.74", "dec", "cm²"), "7.74cm²", "format dec with unit"); t.eq(formatAnswer(["A", "B", "D", "C"], "ordered"), "A → B → D → C", "format ordered");
  t.eq(formatAnswer(["3.1", "3.6"], "multi", "", { labels: ["ア", "イ"] }), "ア=3.1、イ=3.6", "format labeled multi"); t.eq(formatAnswer(["12", "20", "36"], "multi", "秒後"), "12、20、36(秒後)", "format multi with unit");
  t.eq(formatAnswer("イ", "choice"), "イ", "format choice");
};
