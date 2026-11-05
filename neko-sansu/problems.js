/* 問題データの読み込み・検証・出題の選び方。純ロジック(DOM に触らない)。ブラウザと Node の両方で動く */
"use strict";
const TAGS = [
  "計算/四則計算・逆算", "計算/計算のくふう", "計算/単位の計算",
  "和と差/和差算", "和と差/分配算", "和と差/消去算", "和と差/つるかめ算", "和と差/平均とのべ", "和と差/過不足算",
  "割合と比/割合と比", "割合と比/還元算・相当算", "割合と比/倍数算", "割合と比/売買損益", "割合と比/濃度", "割合と比/仕事算",
  "速さ/速さと比", "速さ/旅人算", "速さ/通過算",
  "図形/角度・面積・長さ", "図形/辺の比と面積の比", "図形/体積・表面積", "図形/展開図", "図形/図形上の点の移動",
  "表とグラフ",
  "数の性質/約数と倍数", "数の性質/整数・小数・分数の性質",
  "規則性/数列", "規則性/周期算", "規則性/植木算",
  "場合の数", "調べ・推理",
];
const ANSWER_TYPES = ["int", "dec", "frac", "unit", "time", "multi", "ordered", "choice"];
/** 主分野(大分類)ごとの出題の重み。四則計算・逆算が最多、次に図形・割合と比 */
const FIELD_WEIGHTS = { "計算": 3, "図形": 2, "割合と比": 2, "和と差": 1.2, "速さ": 1.2, "数の性質": 1, "規則性": 1, "表とグラフ": 0.8, "場合の数": 0.8, "調べ・推理": 0.6 };

const bigOf = tag => String(tag).split("/")[0];          // "図形/角度・面積・長さ" → "図形"
const fieldOf = p => bigOf((p.tags || [])[0] || "");      // 問題の主分野(大分類)
const subOf = p => (p.tags || [])[0] || "";                // 主分野(小分類まで)

const isNumStr = s => typeof s === "string" && /^-?\d+(\.\d+)?$/.test(s.trim());
const isFracStr = s => typeof s === "string" && /^-?(\d+\s+)?\d+\/\d+$/.test(s.trim());
const ID_RE = /^\d{4}-\d+-\d+-\d+$/;

/** 1問を検証して、エラー文字列の配列を返す(空なら OK) */
function validateProblem(p, { figureExists } = {}) {
  const e = [];
  const req = (k, type) => { if (!(k in p) || p[k] == null || p[k] === "") e.push(`${k} がありません`); else if (type && typeof p[k] !== type) e.push(`${k} は ${type} で書きます`); };
  if (typeof p !== "object" || !p) return ["問題がオブジェクトではありません"];
  req("id", "string"); if (p.id && !ID_RE.test(p.id)) e.push("id は 年度-回-大問-小問 の形(例 2025-1-2-3)");
  req("source", "object");
  if (p.source && p.id && ID_RE.test(p.id)) { const [y, r, b, n] = p.id.split("-").map(Number); if (p.source.year !== y || p.source.round !== r || p.source.big !== b || p.source.no !== n) e.push("source が id と一致しません"); }
  if (!Array.isArray(p.tags) || !p.tags.length) e.push("tags は 1つ以上の配列"); else for (const t of p.tags) if (!TAGS.includes(t)) e.push(`tags に一覧にない分野: ${t}`);
  req("pattern", "string"); req("text", "string"); req("status", "string");
  if (!["ready", "excluded"].includes(p.status)) e.push("status は ready か excluded");
  if (!ANSWER_TYPES.includes(p.answerType)) e.push(`answerType が不正: ${p.answerType}`);
  if (p.figure != null) { if (typeof p.figure !== "string" || !/^figures\/[\w-]+\.svg$/.test(p.figure)) e.push("figure は figures/{id}.svg の形"); else if (figureExists && !figureExists(p.figure)) e.push(`図ファイルがありません: ${p.figure}`); }
  if (p.status === "excluded") { if (!p.reason) e.push("excluded には reason が必要"); return e; }
  for (const k of ["essence", "hint1", "hint2", "exp"]) { req(k, "string"); if (typeof p[k] === "string" && /TODO|未作成/.test(p[k])) e.push(`${k} に TODO/未作成 が残っています`); }
  if (/TODO|未作成/.test(p.text)) e.push("text に TODO/未作成 が残っています");
  const a = p.answer;
  switch (p.answerType) {
    case "int": if (!isNumStr(a) || !/^-?\d+$/.test(a.trim())) e.push("int の answer は整数の文字列"); break;
    case "dec": case "unit": if (!isNumStr(a)) e.push(`${p.answerType} の answer は数の文字列`); if (p.answerType === "unit" && !p.unit) e.push("unit 型には unit 項目が必要"); break;
    case "frac": if (!isFracStr(a) && !isNumStr(a)) e.push('frac の answer は "7/8" か "2 1/13"'); break;
    case "time": if (!a || typeof a !== "object" || !["hours", "minutes", "seconds"].some(k => typeof a[k] === "number")) e.push("time の answer は {hours, minutes, seconds}"); break;
    case "multi": if (!Array.isArray(a) || a.length < 2 || !a.every(x => typeof x === "string")) e.push("multi の answer は 2つ以上の文字列の配列"); if (p.orderMatters && (!Array.isArray(p.labels) || p.labels.length !== (a || []).length)) e.push("orderMatters のときは labels を answer と同じ数だけ"); break;
    case "ordered": if (!Array.isArray(p.choices) || !Array.isArray(a) || a.length !== p.choices.length || a.some(x => !p.choices.includes(x))) e.push("ordered の answer は choices を並べ替えた配列"); break;
    case "choice": if (!Array.isArray(p.choices) || !p.choices.includes(a)) e.push("choice の answer は choices の中の1つ"); break;
  }
  if (p.unit != null && typeof p.unit !== "string") e.push("unit は文字列");
  if (p.dependsOn != null && !ID_RE.test(p.dependsOn)) e.push("dependsOn は id の形");
  return e;
}
/** 全問を検証。{ok, errors:[{id, msg}]} */
function validateAll(list, opts) {
  const errors = [], seen = new Set();
  if (!Array.isArray(list)) return { ok: false, errors: [{ id: "-", msg: "JSON は配列" }] };
  list.forEach((p, i) => {
    const id = (p && p.id) || `#${i}`;
    if (seen.has(id)) errors.push({ id, msg: "id が重複" }); seen.add(id);
    for (const msg of validateProblem(p, opts)) errors.push({ id, msg });
  });
  return { ok: !errors.length, errors };
}

/** data/index.json → 各ファイルを読み込んで 1 つの配列にする。fetchJson(path) は Promise<object> */
async function loadProblems(fetchJson, base = "data/") {
  const idx = await fetchJson(base + "index.json");
  const all = [];
  for (const f of idx.files || []) { const arr = await fetchJson(base + f); if (Array.isArray(arr)) all.push(...arr); }
  return all;
}
const ready = list => list.filter(p => p.status === "ready");

/** 重み付きで次の問題を選ぶ。wrong: [{pid, due}] 復習待ち、seen: 最近出した id の配列、rand: 0〜1 */
function pickNext(list, { prevId = null, wrong = [], seen = [], now = Date.now(), rand = Math.random } = {}) {
  const pool = ready(list).filter(p => p.id !== prevId);
  if (!pool.length) return null;
  const due = wrong.filter(w => w.due <= now).map(w => pool.find(p => p.id === w.pid)).filter(Boolean);
  if (due.length && rand() < 0.4) return due[Math.floor(rand() * due.length)];
  const fresh = pool.filter(p => !seen.includes(p.id));
  const cand = fresh.length ? fresh : pool;
  const fields = [...new Set(cand.map(fieldOf))];
  const total = fields.reduce((s, f) => s + (FIELD_WEIGHTS[f] || 1), 0);
  let r = rand() * total, field = fields[fields.length - 1];
  for (const f of fields) { r -= (FIELD_WEIGHTS[f] || 1); if (r <= 0) { field = f; break; } }
  const inField = cand.filter(p => fieldOf(p) === field);
  return inField[Math.floor(rand() * inField.length)];
}
/** 「もう一問」: 同じ pattern → 同じ主分野(小分類) → 同じ大分類 の順に探す。無ければ null */
function pickSimilar(list, cur, { seen = [], rand = Math.random } = {}) {
  const pool = ready(list).filter(p => p.id !== cur.id);
  const choose = arr => { if (!arr.length) return null; const fresh = arr.filter(p => !seen.includes(p.id)); const c = fresh.length ? fresh : arr; return c[Math.floor(rand() * c.length)]; };
  return choose(pool.filter(p => p.pattern === cur.pattern))
    || choose(pool.filter(p => subOf(p) === subOf(cur)))
    || choose(pool.filter(p => fieldOf(p) === fieldOf(cur)));
}

/** 問題文の {{5/8}} {{2 1/13}} を縦書き分数の HTML に、\n を <br> にする(先にエスケープする) */
function textToHtml(text) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return esc(text).replace(/\{\{\s*(?:(-?\d+)\s+)?(\d+)\/(\d+)\s*\}\}/g, (_, w, n, d) => `${w ? `<span class="whole">${w}</span>` : ""}<span class="frac"><span>${n}</span><i>${d}</i></span>`).replace(/\n/g, "<br>");
}

var api = { TAGS, ANSWER_TYPES, FIELD_WEIGHTS, fieldOf, subOf, bigOf, validateProblem, validateAll, loadProblems, pickNext, pickSimilar, textToHtml, ready };
if (typeof module !== "undefined") module.exports = api; else Object.assign(window, api);
