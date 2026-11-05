/* 写真バンク: 写真で取りこんだ問題の「答えの文字列 → 採点用の形」変換・検証・画像の縮小・IndexedDB 保存。
   本文(写真)はこの端末の IndexedDB にだけ置く。リポジトリに写真は入れない。
   純ロジック部分(parseAnswerText / validateMeta / prefixedStorage)は Node でもブラウザでも動く。 */
"use strict";
var J = typeof module !== "undefined" ? require("../neko-sansu/judge.js") : window;

var PB_FIELDS = ["計算", "和と差", "割合と比", "速さ", "図形", "表とグラフ", "数の性質", "規則性", "場合の数"];
// self = 答えを登録しない「じぶんで まるつけ」モード
var PB_TYPES = ["int", "dec", "frac", "unit", "time", "multi", "ordered", "choice", "self"];
var PB_TYPE_LABEL = { int: "整数", dec: "小数", frac: "分数", unit: "単位つきの数", time: "時間(○分○秒)", multi: "答えが いくつか(順不同)", ordered: "答えが いくつか(順番あり)", choice: "選択肢(ア・イ・ウ…)", self: "答えを 登録しない(じぶんで まるつけ)" };

function numOrFrac(s) {
  const p = J.parseNumber(s);
  if (!p) return null;
  return p.n != null ? J.reduce(p.n, p.d) : p.v;
}
/** おうちの人が入力した答えの文字列を、answerType ごとの採点用の形にする。だめなら null */
function parseAnswerText(text, type) {
  const s = J.normalize(text);
  switch (type) {
    case "int": { const p = J.parseNumber(s); return p && p.n == null && Number.isInteger(p.v) ? p.v : null; }
    case "dec": case "unit": { const p = J.parseNumber(s); return p ? p.v : null; }
    case "frac": { const p = J.parseNumber(s); if (!p) return null; if (p.n != null) return J.reduce(p.n, p.d); return Number.isInteger(p.v) ? { n: p.v, d: 1 } : null; }
    case "time": { if (!s) return null; const sec = J.parseTime(s); if (sec == null || !Number.isInteger(sec) || sec < 0) return null; return { h: Math.floor(sec / 3600), m: Math.floor(sec % 3600 / 60), s: sec % 60 }; }
    case "multi": case "ordered": { const parts = s.split(",").filter(Boolean); if (!parts.length) return null; const out = parts.map(numOrFrac); return out.some(x => x == null) ? null : out; }
    case "choice": { if (!/^\d+$/.test(s)) return null; return Number(s); }
    case "self": return null;
    default: return null;
  }
}
/** 選択肢の文字列 "ア,イ,ウ" → ["ア","イ","ウ"] */
function parseChoices(text) { return String(text || "").split(/[,、，\n]/).map(x => x.trim()).filter(Boolean); }

/**
 * 取りこみフォームの内容を検証して、保存する形にする。
 * meta: { field, sub, answerType, answerText, unit, choicesText, hint1, hint2, exp, templateId, memo }
 * → { ok, errors:[string], item }(item には写真は含めない。呼び出し側が photo/expPhoto を足す)
 */
function validateMeta(meta) {
  const errors = []; const m = meta || {};
  if (!PB_FIELDS.includes(m.field)) errors.push("分野を えらんでください");
  if (!PB_TYPES.includes(m.answerType)) errors.push("答えの型が 正しくありません");
  let answer = null, choices = null;
  if (m.answerType === "choice") {
    choices = parseChoices(m.choicesText);
    if (choices.length < 2) errors.push("選択肢を 2つ以上、「,」で区切って 入れてください");
    const idx = parseAnswerText(m.answerText, "choice");
    if (idx == null || idx < 1 || idx > choices.length) errors.push("答えは 選択肢の番号(1〜)で 入れてください");
    else answer = idx - 1;
  } else if (m.answerType !== "self" && PB_TYPES.includes(m.answerType)) {
    answer = parseAnswerText(m.answerText, m.answerType);
    if (answer == null) errors.push(`答え「${m.answerText || ""}」が 「${PB_TYPE_LABEL[m.answerType]}」の形に なっていません`);
  }
  for (const k of ["sub", "unit", "hint1", "hint2", "exp", "memo", "templateId", "essence", "pattern"]) if (m[k] != null && typeof m[k] !== "string") errors.push(`${k} は 文字列`);
  const item = {
    tags: [m.field, (m.sub || "").trim()].filter(Boolean),
    answerType: m.answerType, answer, unit: (m.unit || "").trim(), choices,
    hint1: (m.hint1 || "").trim(), hint2: (m.hint2 || "").trim(), exp: (m.exp || "").trim(),
    essence: (m.essence || "").trim(), pattern: (m.pattern || "").trim(),
    templateId: (m.templateId || "").trim() || null, memo: (m.memo || "").trim(),
  };
  return { ok: errors.length === 0, errors, item };
}
function newPhotoId(now = Date.now(), rnd = Math.random()) { return `ph-${now.toString(36)}-${Math.floor(rnd * 1e6).toString(36)}`; }

/** localStorage を別キーに付け替える(履歴モジュールを別アプリと分けて使うため) */
function prefixedStorage(base, key) {
  return { getItem: () => base.getItem(key), setItem: (_, v) => base.setItem(key, v), removeItem: () => base.removeItem(key) };
}

// ---- ここからブラウザ専用 ----
/** 画像を長辺 max px の JPEG Blob に縮小する(iPad の写真は大きいので) */
async function shrinkImage(file, max = 1600, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("画像を 読めませんでした")); i.src = url; });
    const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * r)), h = Math.max(1, Math.round(img.naturalHeight * r));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const blob = await new Promise(res => c.toBlob(res, "image/jpeg", quality));
    if (!blob) throw new Error("画像を 変換できませんでした");
    return { blob, width: w, height: h };
  } finally { URL.revokeObjectURL(url); }
}

const PDB_NAME = "neko-sansu-photo", PSTORE = "photos";
function openPhotoDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(PDB_NAME, 1);
    r.onupgradeneeded = () => { const st = r.result.createObjectStore(PSTORE, { keyPath: "id" }); st.createIndex("created", "created"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function putPhoto(item) { const db = await openPhotoDB(); await new Promise((res, rej) => { const tx = db.transaction(PSTORE, "readwrite"); tx.objectStore(PSTORE).put(item); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); return item.id; }
async function loadPhotos() {
  if (typeof indexedDB === "undefined") return [];
  try { const db = await openPhotoDB(); const all = await new Promise((res, rej) => { const r = db.transaction(PSTORE).objectStore(PSTORE).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); return all.sort((a, b) => a.created - b.created); } catch (e) { return []; }
}
async function deletePhoto(id) { const db = await openPhotoDB(); await new Promise((res, rej) => { const tx = db.transaction(PSTORE, "readwrite"); tx.objectStore(PSTORE).delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function clearPhotos() { const db = await openPhotoDB(); await new Promise((res, rej) => { const tx = db.transaction(PSTORE, "readwrite"); tx.objectStore(PSTORE).clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }

var api = { parseAnswerText, parseChoices, validateMeta, newPhotoId, prefixedStorage, shrinkImage, putPhoto, loadPhotos, deletePhoto, clearPhotos, PB_FIELDS, PB_TYPES, PB_TYPE_LABEL };
if (typeof module !== "undefined") module.exports = api; else Object.assign(window, api);
