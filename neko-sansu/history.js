/* 学習履歴(保護者用)。イベントの追記・離脱検知・集計・バックアップ。純ロジック(storage は注入) */
"use strict";
const LOG_KEY = "neko-sansu-log-v1";
const RESULTS = ["ok", "ok_hint", "ng", "exp"]; // 他に 未着手(記録なし) と 途中離脱(end が無い)

function memoryStorage() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }

function createHistory(storage, now = () => Date.now()) {
  storage = storage || (typeof localStorage !== "undefined" ? localStorage : memoryStorage());
  const read = () => { try { return JSON.parse(storage.getItem(LOG_KEY) || "[]"); } catch (e) { return []; } };
  const write = ev => { try { storage.setItem(LOG_KEY, JSON.stringify(ev)); } catch (e) {} };
  return {
    events: read,
    start(pid, tags) { const ev = read(); ev.push({ t: now(), ev: "start", pid, tags: tags || [] }); write(ev); },
    end(pid, { result, hints = 0, retries = 0 }) {
      if (!RESULTS.includes(result)) throw new Error("bad result " + result);
      const ev = read();
      const st = [...ev].reverse().find(e => e.ev === "start" && e.pid === pid);
      const t = now();
      ev.push({ t, ev: "end", pid, result, hints, retries, ms: st ? t - st.t : 0 });
      write(ev);
    },
    /** 直前の start に end が無ければ、その問題(離脱)を返す。次回起動時の「続きからやる?」に使う */
    pendingStart() {
      const ev = read();
      for (let i = ev.length - 1; i >= 0; i--) {
        if (ev[i].ev === "end") return null;
        if (ev[i].ev === "start") return ev[i];
      }
      return null;
    },
    summarize() { return summarize(read()); },
    exportJSON() { return JSON.stringify({ app: "neko-sansu", version: 1, exported: now(), events: read() }); },
    importJSON(text, mode = "merge") {
      const data = JSON.parse(text);
      const incoming = Array.isArray(data) ? data : data.events;
      if (!Array.isArray(incoming) || !incoming.every(e => e && typeof e.t === "number" && (e.ev === "start" || e.ev === "end") && typeof e.pid === "string")) throw new Error("形式が ちがいます");
      const clean = incoming.map(e => ({ t: e.t, ev: e.ev, pid: e.pid, tags: e.tags, result: e.result, hints: e.hints, retries: e.retries, ms: e.ms }));
      const merged = mode === "replace" ? clean : dedupe(read().concat(clean));
      write(merged);
      return merged.length;
    },
    clear() { write([]); },
  };
}
function dedupe(ev) { const seen = new Set(); return ev.filter(e => { const k = `${e.t}|${e.ev}|${e.pid}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.t - b.t); }

function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

/** 問題ごとに start/end を対応づけて「試行」のリストにする。end の無い start は abandoned */
function attempts(events) {
  const out = [], open = new Map();
  for (const e of events) {
    if (e.ev === "start") { const a = { pid: e.pid, tags: e.tags || [], t: e.t, status: "abandoned", hints: 0, retries: 0, ms: 0 }; open.set(e.pid, a); out.push(a); }
    else if (e.ev === "end") { const a = open.get(e.pid); if (a) { Object.assign(a, { status: e.result, hints: e.hints || 0, retries: e.retries || 0, ms: e.ms || 0 }); open.delete(e.pid); } }
  }
  return out;
}
function summarize(events, { slowMs = 180000 } = {}) {
  const list = attempts(events);
  const byDay = {}, byField = {};
  for (const a of list) {
    const d = byDay[dayKey(a.t)] ||= { total: 0, ok: 0, ok_hint: 0, ng: 0, exp: 0, abandoned: 0 };
    d.total++; d[a.status]++;
    const f = byField[a.tags[0] || "その他"] ||= { total: 0, correct: 0, abandoned: 0 };
    f.total++; if (a.status === "ok" || a.status === "ok_hint") f.correct++; if (a.status === "abandoned") f.abandoned++;
  }
  for (const f of Object.values(byField)) f.rate = f.total - f.abandoned ? Math.round(f.correct / (f.total - f.abandoned) * 100) : null;
  return {
    attempts: list, byDay, byField,
    abandoned: list.filter(a => a.status === "abandoned"),
    slow: list.filter(a => a.status !== "abandoned" && a.ms >= slowMs).sort((a, b) => b.ms - a.ms),
    counts: RESULTS.concat("abandoned").reduce((o, k) => (o[k] = list.filter(a => a.status === k).length, o), {}),
  };
}
var api = { createHistory, summarize, attempts, dayKey, memoryStorage, LOG_KEY, RESULTS };
if (typeof module !== "undefined") module.exports = api; else Object.assign(window, api);
