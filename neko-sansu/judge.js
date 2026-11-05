/* 採点。純関数。judge(input, answer, answerType, opts) → {ok, reason} */
"use strict";
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
function reduce(n, d) { const g = gcd(n, d); return { n: n / g, d: d / g }; }
function normalize(s) {
  return String(s ?? "")
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[．]/g, ".").replace(/[／]/g, "/").replace(/[−ー―–]/g, "-")
    .replace(/[，、]/g, ",").replace(/\s/g, "").trim();
}
const UNITS = ["cm³", "cm²", "cm3", "cm2", "km", "cm", "mm", "m", "kg", "g", "L", "dL", "mL", "円", "個", "人", "本", "度", "%", "分", "秒", "時間", "通り", "才", "歳", "まい", "枚", "ページ", "こ", "点"];
function stripUnit(s) { let t = s, prev; do { prev = t; for (const u of UNITS) if (t.endsWith(u)) t = t.slice(0, -u.length); } while (t !== prev); return t; }
function parseNumber(s) {
  s = stripUnit(normalize(s));
  let m;
  if ((m = s.match(/^(-?)(\d+)と(\d+)\/(\d+)$/))) { const sign = m[1] ? -1 : 1, w = +m[2], n = +m[3], d = +m[4]; if (!d) return null; return { v: sign * (w + n / d), n: sign * (w * d + n), d }; }
  if ((m = s.match(/^(-?\d+)\/(\d+)$/))) { const n = +m[1], d = +m[2]; if (!d) return null; return { v: n / d, n, d }; }
  if (/^-?\d+(\.\d+)?$/.test(s)) { const v = parseFloat(s); return { v, n: null, d: null }; }
  return null;
}
function parseTime(s) {
  s = normalize(s); let h = 0, m = 0, sec = 0, hit = false, x;
  if ((x = s.match(/(\d+)時間/))) { h = +x[1]; hit = true; }
  if ((x = s.match(/(\d+)分/))) { m = +x[1]; hit = true; }
  if ((x = s.match(/(\d+)秒/))) { sec = +x[1]; hit = true; }
  if (!hit) { const p = s.split(":").map(Number); if (p.some(isNaN) || !p.length) return null; [h, m, sec] = p.length === 3 ? p : p.length === 2 ? [0, p[0], p[1]] : [0, 0, p[0]]; }
  return h * 3600 + m * 60 + sec;
}
const near = (a, b) => Math.abs(a - b) < 1e-9;
function valueOf(answer) {
  if (answer && typeof answer === "object" && "n" in answer) return answer.n / answer.d;
  return Number(answer);
}
function judge(input, answer, answerType = "int", opts = {}) {
  const raw = normalize(input);
  if (raw === "" || raw === "[]") return { ok: false, reason: "empty" };
  switch (answerType) {
    case "int": case "dec": case "frac": {
      const p = parseNumber(raw);
      if (!p) return { ok: false, reason: "parse" };
      return { ok: near(p.v, valueOf(answer)), reason: "value" };
    }
    case "unit": {
      const p = parseNumber(raw);
      if (!p) return { ok: false, reason: "parse" };
      const unitOk = !opts.unit || !opts.inputUnit || normalize(opts.inputUnit) === normalize(opts.unit);
      return { ok: near(p.v, Number(answer)) && unitOk, reason: unitOk ? "value" : "unit" };
    }
    case "time": {
      const got = parseTime(raw);
      if (got == null) return { ok: false, reason: "parse" };
      const want = (answer.h || 0) * 3600 + (answer.m || 0) * 60 + (answer.s || 0);
      return { ok: got === want, reason: "value" };
    }
    case "multi": case "ordered": {
      const got = raw.split(",").filter(Boolean).map(parseNumber);
      if (got.some(g => !g)) return { ok: false, reason: "parse" };
      const want = answer.map(valueOf);
      if (got.length !== want.length) return { ok: false, reason: "count" };
      const gv = got.map(g => g.v);
      if (answerType === "ordered") return { ok: gv.every((v, i) => near(v, want[i])), reason: "value" };
      const rest = want.slice();
      for (const v of gv) { const i = rest.findIndex(w => near(w, v)); if (i < 0) return { ok: false, reason: "value" }; rest.splice(i, 1); }
      return { ok: true, reason: "value" };
    }
    case "choice": return { ok: Number(raw) === Number(answer), reason: "value" };
    default: return { ok: false, reason: "type" };
  }
}
function formatAnswer(answer, answerType, unit = "") {
  if (answerType === "frac") { const r = reduce(answer.n, answer.d); return r.d === 1 ? `${r.n}` : `${r.n}/${r.d}`; }
  if (answerType === "time") return [answer.h ? `${answer.h}時間` : "", answer.m ? `${answer.m}分` : "", answer.s ? `${answer.s}秒` : ""].join("") || "0秒";
  if (Array.isArray(answer)) return answer.map(a => formatAnswer(a, typeof a === "object" ? "frac" : "dec")).join("、");
  const v = Number(answer);
  return `${Math.round(v * 1e6) / 1e6}${unit}`;
}
var api = { judge, normalize, parseNumber, parseTime, stripUnit, reduce, gcd, formatAnswer };
if (typeof module !== "undefined") module.exports = api; else Object.assign(window, api);
