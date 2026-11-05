/* 原題JSON(私用バンク)の検証と IndexedDB 保存。本文はリポジトリに入れない */
"use strict";
const FIELDS = ["計算", "和と差", "割合と比", "速さ", "図形", "表とグラフ", "数の性質", "規則性", "場合の数"];
const TYPES = ["int", "dec", "frac", "unit", "time", "multi", "ordered", "choice"];
const BAD_SVG = /<script|<img|<foreignObject|<iframe|\son\w+\s*=|javascript:/i;

function answerShapeOk(type, a) {
  const num = v => typeof v === "number" && isFinite(v);
  switch (type) {
    case "int": return Number.isInteger(a);
    case "dec": case "unit": return num(a);
    case "frac": return a && num(a.n) && num(a.d) && a.d !== 0;
    case "time": return a && ["h", "m", "s"].every(k => a[k] === undefined || Number.isInteger(a[k]));
    case "multi": case "ordered": return Array.isArray(a) && a.length > 0 && a.every(x => num(x) || (x && num(x.n) && num(x.d)));
    case "choice": return Number.isInteger(a);
    default: return false;
  }
}
/** → { ok, errors:[string], problems:[normalized] } */
function validateBank(json) {
  const errors = [], problems = [];
  const list = Array.isArray(json) ? json : json && Array.isArray(json.problems) ? json.problems : null;
  if (!list) return { ok: false, errors: ["problems の配列が ありません"], problems };
  const ids = new Set();
  list.forEach((q, i) => {
    const at = `${i + 1}番目(id=${q && q.id})`;
    if (!q || typeof q !== "object") return errors.push(`${at}: オブジェクトでは ありません`);
    if (!/^[A-Za-z0-9_-]+$/.test(String(q.id || ""))) errors.push(`${at}: id は 英数字とハイフンだけ`);
    else if (ids.has(q.id)) errors.push(`${at}: id が 重複`); else ids.add(q.id);
    if (!Array.isArray(q.tags) || !FIELDS.includes(q.tags[0])) errors.push(`${at}: tags[0] が 分野一覧に ありません`);
    if (typeof q.text !== "string" || !q.text.trim()) errors.push(`${at}: text が ありません`);
    if (!TYPES.includes(q.answerType)) errors.push(`${at}: answerType が 不正`);
    else if (!answerShapeOk(q.answerType, q.answer)) errors.push(`${at}: answer の形が answerType に 合いません`);
    if (q.answerType === "choice" && !(Array.isArray(q.choices) && q.choices.length >= 2)) errors.push(`${at}: choice には choices が 必要`);
    if (q.figure != null && (typeof q.figure !== "string" || !/^\s*<svg[\s>]/.test(q.figure) || BAD_SVG.test(q.figure))) errors.push(`${at}: figure は 安全な <svg> だけ`);
    for (const k of ["hint1", "hint2", "exp", "essence", "pattern", "realworld", "unit", "templateId"]) if (q[k] != null && typeof q[k] !== "string") errors.push(`${at}: ${k} は 文字列`);
    problems.push({ id: q.id, tags: q.tags, text: q.text, figure: q.figure || null, answerType: q.answerType, answer: q.answer, unit: q.unit || "", choices: q.choices || null, hint1: q.hint1 || "", hint2: q.hint2 || "", exp: q.exp || "", essence: q.essence || "", pattern: q.pattern || "", realworld: q.realworld || "", templateId: q.templateId || null });
  });
  return { ok: errors.length === 0, errors, problems };
}

// ---- IndexedDB(ブラウザのみ) ----
const DB_NAME = "neko-sansu", STORE = "bank";
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function saveBank(problems) {
  const db = await openDB();
  await new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); const st = tx.objectStore(STORE); problems.forEach(p => st.put(p)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  return problems.length;
}
async function loadBank() {
  if (typeof indexedDB === "undefined") return [];
  try { const db = await openDB(); return await new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); } catch (e) { return []; }
}
async function clearBank() { const db = await openDB(); await new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }

var api = { validateBank, answerShapeOk, saveBank, loadBank, clearBank, FIELDS, TYPES };
if (typeof module !== "undefined") module.exports = api; else Object.assign(window, api);
