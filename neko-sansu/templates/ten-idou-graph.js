/* 図形上の点の移動: 長方形の辺上を点Pが動き、三角形ABPの面積を考える(グラフつき) */
"use strict";
var T = {  // var: 複数のテンプレートを <script> で読むため
  id: "ten-idou-graph", title: "動く点と 面積のグラフ", tags: ["図形", "図形上の点の移動"],
  answerType: "int", unit: "cm²", weight: 2,
  params(rng) {
    while (true) {
      const a = rng.pick([4, 6, 8, 10, 12]);      // AB(たて)
      const b = rng.pick([6, 8, 9, 10, 12, 15]);  // BC(よこ)
      const v = rng.pick([1, 2, 3]);              // 速さ cm/秒
      if (b % v !== 0 || a === b) continue;
      const t1 = b / v, t2 = t1 + a / v;          // Cに着く時刻, Dに着く時刻
      if (!Number.isInteger(t2)) continue;
      const t = rng.int(1, t2 - 1);
      const area = t <= t1 ? a * v * t / 2 : a * b / 2;
      if (!Number.isInteger(area)) continue;
      return { a, b, v, t, t1, t2, area };
    }
  },
  text(p) { return `たて ${p.a}cm、よこ ${p.b}cm の 長方形 ABCD が あるにゃ。点Pは Bを 出発して、毎秒 ${p.v}cm の速さで B→C→D と 辺の上を 動くにゃ。<br>出発してから ${p.t}秒後の 三角形 ABP の 面積は 何cm²かにゃ?`; },
  figure(p) {
    const S = typeof SVG !== "undefined" ? SVG : require("./_svg.js");
    const W = 120, H = Math.round(120 * p.a / p.b * 0.9) + 20, x = 44, y = 30;
    let s = S.rect(x, y, W, H) + S.text(x - 8, y + H + 14, "B", "small") + S.text(x + W + 8, y + H + 14, "C", "small") + S.text(x - 8, y - 6, "A", "small") + S.text(x + W + 8, y - 6, "D", "small");
    s += S.text(x + W / 2, y + H + 16, `${p.b}cm`, "lbl") + S.text(x - 22, y + H / 2 + 4, `${p.a}cm`, "lbl");
    const pt = p.t <= p.t1 ? [x + W * (p.v * p.t / p.b), y + H] : [x + W, y + H - H * ((p.v * p.t - p.b) / p.a)];
    s += S.circle(pt[0], pt[1], 4, "pt") + S.text(pt[0] + 10, pt[1] + 4, "P", "small") + S.line(x, y, pt[0], pt[1], "dash") + S.line(x, y + H, pt[0], pt[1], "dash");
    // グラフ
    const gx = 185, gy = 150, gw = 115, gh = 110, maxA = p.a * p.b / 2;
    const px = t => gx + gw * t / p.t2, py = A => gy - gh * A / maxA;
    s += S.line(gx, gy, gx + gw, gy, "axis") + S.line(gx, gy, gx, gy - gh - 5, "axis");
    s += S.polyline([[px(0), py(0)], [px(p.t1), py(maxA)], [px(p.t2), py(maxA)]]);
    s += S.text(gx + gw / 2, gy + 16, "時間(秒)", "small") + S.text(gx - 2, gy - gh - 10, "面積(cm²)", "small");
    s += S.text(px(p.t1), gy + 10, `${p.t1}`, "small") + S.text(px(p.t2), gy + 10, `${p.t2}`, "small") + S.text(gx - 10, py(maxA) + 4, "?", "small");
    return S.svg(s, 320, 180);
  },
  solve(p) { return p.t <= p.t1 ? p.a * (p.v * p.t) / 2 : p.a * p.b / 2; },
  check(p) { const d = p.v * p.t; const base = Math.min(d, p.b); return p.a * base / 2; },
  explain(p, ans) {
    const onBC = p.t <= p.t1, d = p.v * p.t;
    return {
      essence: "点が「どの辺の上にいるか」で 三角形の形が 変わるので、まず 場所を 決めてから 面積を出す問題にゃ",
      pattern: "図形上の点の移動(場合分け)",
      hint1: `${p.t}秒後、点Pは BC の上? それとも CD の上? 速さ×時間で 進んだ長さを 出して 考えるにゃ`,
      hint2: `進んだ長さ = ${p.v} × ${p.t} = ${d}cm。BC は ${p.b}cm だから、Pは ${onBC ? "BC の上" : "CD の上"} にゃ`,
      exp: onBC
        ? `BP = ${d}cm、高さは AB = ${p.a}cm<br>面積 = ${d} × ${p.a} ÷ 2 = <b>${ans}cm²</b><br>グラフでは ${p.t1}秒まで 面積が まっすぐ ふえるにゃ`
        : `Pは CD の上。底辺 AB = ${p.a}cm、高さは BC = ${p.b}cm で 変わらないにゃ<br>面積 = ${p.a} × ${p.b} ÷ 2 = <b>${ans}cm²</b><br>グラフでは ${p.t1}秒から ${p.t2}秒まで 平らにゃ。高さが 変わらないからにゃ`,
      realworld: "動くものの 「いつ・どこ」を グラフで 読む力は、電車の 時こく表や 天気の グラフにも つかえるにゃ",
    };
  },
};
if (typeof module !== "undefined") module.exports = T; else (window.NEKO_TEMPLATES ||= []).push(T);
