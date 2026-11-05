/* ねこさんすう(過去問版) ― UIロジック(ブラウザ専用)。
   ロジックは judge.js(採点) / problems.js(出題) / nav.js(画面遷移) / history.js(履歴) に分離。問題データは data/ だけ */
"use strict";
const STORE_KEY = "neko-sansu-v2";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- 保存データ(設定・進捗) ----------
const defaultState = () => ({ name: "", pin: "", count: 0, field: {}, wrong: [], seen: [] });
let state = (() => { try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch (e) { return defaultState(); } })();
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };
const hist = createHistory();
let ALL = [];            // 全問題(ready も excluded も)
const FIG = {};          // 図の SVG キャッシュ

// ---------- 猫 ----------
const catName = () => state.name || "ねこ";
function setCats(mood) { $$(".cat").forEach(el => { el.innerHTML = renderCat(mood); }); }
function say(html, mood = "idle") { const b = $("#bubble"); b.innerHTML = html; b.classList.remove("hidden"); $("#cat").innerHTML = renderCat(mood); }
function sparkle() { const box = $("#sparkles"); box.innerHTML = ""; for (let i = 0; i < 14; i++) { const s = document.createElement("span"); s.textContent = pick(["✨", "⭐", "💫", "🌟"]); s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * .4 + "s"; box.appendChild(s); } setTimeout(() => box.innerHTML = "", 1400); }
const PRAISE = ["式の 立て方が バッチリにゃ!", "じゅんばんに 考えられたのが すごいにゃ", "紙に 書いて 整理できたのが えらいにゃ", "数字の あつかいが ていねいだったにゃ", "落ち着いて 計算できたにゃ。さすがにゃ", "考え方の すじ道が きれいだったにゃ"];
const ENCOURAGE = ["おしい! もう一回 紙に 書いてみるにゃ", "だいじょうぶにゃ。どこまで 分かったか 紙に 書いてみるにゃ", "まちがえた問題は いちばん 強くなれる問題にゃ"];
const PAPER = ["まず 紙に 書いてみてにゃ", "あわてなくて いいにゃ。紙に 式を 書いて 整理するにゃ", "図や 線分図を 紙に かいてみるにゃ"];

// ---------- 画面遷移(nav.js を真として、ブラウザの履歴を鏡のように合わせる) ----------
const SCREENS = ["title", "name", "quiz", "zukan", "seiseki", "parent"];
const NAV = createNav(SCREENS);
const FLOW = createQuizFlow();
let shown = "title", wantNew = false, resumeP = null; // wantNew: タイトルの「もんだいを とく」から来た(前の問題が終わっていれば新しい問題を出す)
function show(id) {
  if (shown === "quiz" && id !== "quiz") leaveQuestion();
  shown = id;
  SCREENS.forEach(s => $("#screen-" + s).classList.toggle("hidden", s !== id));
  $(".catbar").classList.toggle("hidden", id !== "quiz");
  (ENTER[id] || (() => {}))();
  window.scrollTo(0, 0);
}
const pushDepth = (depth, replace) => { try { const url = location.pathname + location.search + (NAV.current() === "title" ? "" : "#" + NAV.current()); history[replace ? "replaceState" : "pushState"]({ app: STORE_KEY, depth }, "", url); } catch (e) {} };
function go(id) { if (NAV.current() === id) { show(id); return; } NAV.go(id); pushDepth(NAV.depth()); show(id); }
function back() { if (NAV.canBack()) history.back(); else goHome(); }
function goHome() { const d = NAV.depth(); NAV.home(); if (d > 0) history.go(-d); else show("title"); }
window.addEventListener("popstate", e => {
  if (!e.state || e.state.app !== STORE_KEY || e.state.depth < 0) { // いちばん下まで戻った(スワイプ戻る等) → アプリを閉じずにタイトルへ
    NAV.home(); pushDepth(0); show("title"); return;
  }
  show(NAV.syncTo(e.state.depth));
});
const ENTER = {
  title() { titleGreeting(); },
  name() { $("#cat-name").value = state.name; setCats("idle"); },
  quiz() { if (resumeP) { const p = resumeP; resumeP = null; startQuestion(p, { resumed: true }); } else if (!FLOW.current() || (wantNew && FLOW.current().ended)) startQuestion(); else renderQuiz(); wantNew = false; },
  zukan() { $("#zukan-name").textContent = catName(); $("#zukan-stats").textContent = `いっしょに といた もんだい: ${state.count}問`; setCats("idle"); },
  seiseki() { renderFields(); },
  parent() { $("#parent-lock").classList.remove("hidden"); $("#parent-body").classList.add("hidden"); $("#pin").value = ""; },
};

// ---------- 問題の準備 ----------
async function fetchJson(path) { const r = await fetch(path, { cache: "no-cache" }); if (!r.ok) throw new Error(path + " " + r.status); return r.json(); }
async function loadFigure(path) {
  if (!path) return "";
  if (FIG[path] == null) { try { const r = await fetch("data/" + path); const t = r.ok ? await r.text() : ""; FIG[path] = /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(t) && !/<script|<img|on\w+=/i.test(t) ? t.replace(/^\s*<\?xml[^>]*>/, "") : ""; } catch (e) { FIG[path] = ""; } }
  return FIG[path];
}
function makeQ(p, { resumed = false } = {}) {
  const q = { p, id: p.id, phase: "asking", result: null, retries: 0, hints: 0, edits: 0, ended: false, input: [], fb: [], t0: Date.now(), showReal: !!p.realworld && Math.random() < 0.6 };
  if (!resumed) hist.start(p.id, p.tags);
  return q;
}
function rememberSeen(id) { state.seen = state.seen.filter(x => x !== id).concat(id).slice(-20); save(); }
function nextProblem(prev) { return pickNext(ALL, { prevId: prev && prev.id, wrong: state.wrong, seen: state.seen }); }

// ---------- 数字キー・選択肢 ----------
const KEYS = { num: ["7", "8", "9", "←", "C", "4", "5", "6", "/", "と", "1", "2", "3", ".", ",", "0"], time: ["7", "8", "9", "←", "C", "4", "5", "6", "時間", "分", "1", "2", "3", "秒", ",", "0"], pick: ["←", "C"] };
const Q = () => FLOW.current();
const isPick = q => q.p.answerType === "ordered" || q.p.answerType === "choice";
function buildKeypad(q) {
  const keys = q.p.answerType === "time" ? KEYS.time : isPick(q) ? KEYS.pick : KEYS.num;
  $("#keypad").className = "keypad" + (isPick(q) ? " kbd-small" : "");
  $("#keypad").innerHTML = keys.map(k => `<button data-k="${k}" class="${/^\d$/.test(k) ? "" : k === "←" || k === "C" ? "fn del" : "fn"}">${k}</button>`).join("");
  $$("#keypad button").forEach(b => b.onclick = () => key(b.dataset.k));
  $("#choices").classList.toggle("hidden", !isPick(q));
  if (isPick(q)) { $("#choices").innerHTML = q.p.choices.map(c => `<button data-c="${esc(c)}">${esc(c)}</button>`).join(""); $$("#choices button").forEach(b => b.onclick = () => key(b.dataset.c)); }
}
function key(k) {
  const q = Q(); if (!q || q.ended) return;
  if (k === "C") { if (q.input.length) q.edits++; q.input = []; }
  else if (k === "←") { if (q.input.length) q.edits++; q.input.pop(); }
  else if (q.p.answerType === "choice") q.input = [k];
  else if (q.p.answerType === "ordered") { if (!q.input.includes(k)) q.input.push(k); }
  else q.input.push(k);
  renderInput(q);
}
const inputText = q => q.input.join(isPick(q) ? "," : "");
function renderInput(q) {
  const d = $("#answer-display"); const t = inputText(q);
  if (!t) d.innerHTML = `<span class="ph">ここに こたえが 出るにゃ</span>`;
  else if (isPick(q)) d.innerHTML = `<span class="seq">${q.input.map(esc).join(q.p.answerType === "ordered" ? " → " : "")}</span>`;
  else d.innerHTML = t.split(",").map(part => { const m = part.match(/^(?:(\d+)と)?(\d+)\/(\d*)$/); return m ? `${m[1] || ""}<span class="frac"><span>${m[2]}</span><i>${m[3] || "?"}</i></span>` : esc(part); }).join("、");
  $$("#choices button").forEach(b => b.classList.toggle("used", q.input.includes(b.dataset.c)));
}

// ---------- 1問の流れ ----------
function startQuestion(problem, opts = {}) {
  const p = problem || nextProblem(Q());
  if (!p) { say("出せる問題が ないにゃ。おうちの人に 相談してにゃ", "idle"); return; }
  const q = makeQ(p, opts); FLOW.add(q); rememberSeen(p.id);
  renderQuiz();
  say(pick(PAPER), "think");
}
async function renderQuiz() {
  const q = Q(); const p = q.p;
  $("#q-field").textContent = `${subOf(p)} ・ ${p.pattern}`;
  $("#q-count").textContent = `${FLOW.index() + 1}もんめ ・ ${p.source.year}年 ${p.source.big}−${p.source.no}`;
  $("#q-text").innerHTML = textToHtml(p.text);
  $("#q-answer-note").textContent = { frac: "分数は 「/」キー、帯分数は 「と」キーを つかうにゃ(約分していなくても OK)", multi: p.orderMatters ? `${(p.labels || []).join("・")} の じゅんに、「,」で くぎって 入れるにゃ` : "答えが いくつか あるときは 「,」で くぎるにゃ(じゅんばんは 自由)", ordered: "下の ボタンを じゅんばんに タップするにゃ", choice: "下から 1つ えらぶにゃ", time: "時間・分・秒の キーを つかうにゃ" }[p.answerType] || (p.unit ? `答えは 数字だけ 入れるにゃ(${p.unit} は 書かなくて いいにゃ)` : "");
  $("#answer-unit").textContent = p.unit || "";
  buildKeypad(q); renderInput(q);
  const fig = $("#q-figure"); fig.classList.toggle("hidden", !p.figure); if (p.figure) { fig.innerHTML = ""; const svg = await loadFigure(p.figure); if (Q() === q) fig.innerHTML = svg || `<p class="note">(図を 読みこめなかったにゃ)</p>`; }
  renderPhase();
}
/** 段階(asking/hint1/hint2/exp/done)に合わせてフィードバックとボタンを描き直す。前の問題に戻ったときも同じ関数で復元する */
function renderPhase() {
  const q = Q(); const fb = $("#feedback");
  fb.className = "feedback " + (q.result === "ok" || q.result === "ok_hint" ? "ok" : q.result ? "ng" : "");
  fb.classList.toggle("hidden", !q.fb.length); fb.innerHTML = q.fb.join("");
  $("#btn-submit").disabled = q.ended; $("#btn-submit").classList.toggle("hidden", q.ended);
  $("#keypad").classList.toggle("hidden", q.ended); $("#choices").classList.toggle("hidden", q.ended || !isPick(q)); $(".answer-row").classList.toggle("hidden", q.ended);
  const finished = q.phase === "done" || q.phase === "exp";
  $("#btn-real").classList.toggle("hidden", !(finished && q.p.realworld && q.showReal && !q.realSeen));
  $("#btn-similar").classList.toggle("hidden", q.phase !== "done");
  $("#btn-finish").classList.toggle("hidden", !finished);
  $("#btn-prev").disabled = !FLOW.hasPrev();
  const f = $("#btn-forward");
  f.textContent = finished && FLOW.hasNext() ? "つぎの問題へ →" : q.phase === "asking" && q.retries ? "ヒントを 見る" : forwardLabel(q.phase) + (finished ? " →" : "");
  f.className = finished ? "primary" : "ghost";
}
function addBox(q, html, cls = "box") { q.fb.push(`<div class="${cls}">${html}</div>`); }
function submit() {
  const q = Q(); if (!q || q.ended) return;
  const val = inputText(q);
  if (!val) { say("まだ 答えが 入っていないにゃ", "idle"); return; }
  const res = judge(val, q.p.answer, q.p.answerType, { unit: q.p.unit, orderMatters: q.p.orderMatters });
  if (res.ok) {
    q.result = q.hints ? "ok_hint" : "ok"; q.phase = "done";
    q.fb = [`<div class="mark">⭕️ せいかい!</div><div>こたえ: <b>${esc(formatAnswer(q.p.answer, q.p.answerType, q.p.unit, { labels: q.p.labels }))}</b></div>`];
    addBox(q, `<b class="tag">${esc(q.p.pattern)}</b> の 考え方が できているにゃ。<br>${esc(q.p.essence)}`);
    say(`${esc(q.p.pattern)}の ${pick(PRAISE)}`, "happy"); sparkle();
    recordField(q.p, true); removeWrong(q.id); endQuestion(q, q.result);
  } else {
    q.retries++;
    const reason = res.reason === "parse" ? "数字の 書き方を もう一度 見てみるにゃ" : res.reason === "count" ? "答えの 数が ちがうみたいにゃ" : "もう一度 考えてみるにゃ。紙に 式を 書くと 見えてくるにゃ";
    q.fb = q.fb.filter(h => !h.includes('class="mark"')); q.fb.unshift(`<div class="mark">💭 おしい</div><div>${reason}</div>`);
    say(pick(ENCOURAGE), "cheer");
    q.input = []; renderInput(q);
    if (q.retries === 1 && !state.wrong.some(w => w.pid === q.id)) { recordField(q.p, false); addWrong(q.id); }
  }
  renderPhase();
}
function showHint(n) {
  const q = Q(); if (q.hints >= n) return;
  q.hints = n; q.phase = "hint" + n;
  addBox(q, `<b class="tag">ヒント${n}</b><br>${esc(q.p["hint" + n])}`);
  say(n === 1 ? "ここまで 分かれば あと少しにゃ。もう一回 紙で ためしてみるにゃ" : "もう一歩にゃ。紙に 式を 書いてみるにゃ", "think");
  renderPhase();
}
function showExp() {
  const q = Q(); if (q.ended) return;
  q.phase = "exp"; q.result = "exp";
  addBox(q, `<b class="tag">この問題は なにを 聞いているか</b><br>${esc(q.p.essence)}<br><br><b class="tag">かいせつ(${esc(q.p.pattern)})</b><br>${textToHtml(q.p.exp)}<br>こたえ: <b>${esc(formatAnswer(q.p.answer, q.p.answerType, q.p.unit, { labels: q.p.labels }))}</b>`);
  endQuestion(q, "exp");
  say("つぎに 同じ形の 問題が 出たら きっと 解けるにゃ。もう一問 やってみる?", "cheer");
  renderPhase();
}
function showReal() { const q = Q(); q.realSeen = true; addBox(q, `<b class="tag">社会で こんなときに 役立つにゃ</b><br>${esc(q.p.realworld)}`); renderPhase(); }
function forward() {
  const q = Q(); if (!q) return;
  if (q.phase === "asking") showHint(1);
  else if (q.phase === "hint1") showHint(2);
  else if (q.phase === "hint2") showExp();
  else if (FLOW.hasNext()) { FLOW.next(); renderQuiz(); say(Q().ended ? "この問題は もう といたにゃ" : "さっきの つづきにゃ", "think"); }
  else if (q.phase === "exp") similar();
  else startQuestion();
}
function prevQuestion() { if (!FLOW.hasPrev()) return; FLOW.prev(); renderQuiz(); say(Q().ended ? "見直しにゃ。いい習慣にゃ" : "この問題は まだ とちゅうにゃ。紙に 書いてみるにゃ", "think"); }
function similar() {
  const q = Q(); const p = pickSimilar(ALL, q.p, { seen: state.seen });
  if (!p) { say("同じ形の 問題は もう ないにゃ。べつの問題を 出すにゃ", "idle"); startQuestion(); return; }
  startQuestion(p); say(p.pattern === q.p.pattern ? "同じ 解き方の 問題にゃ。紙に 書いてみるにゃ" : "同じ分野の 問題にゃ。紙に 書いてみるにゃ", "think");
}
function endQuestion(q, result) {
  if (q.ended) return; q.ended = true;
  hist.end(q.id, { result, hints: q.hints, retries: q.retries, edits: q.edits });
  state.count++; save();
}
/** 問題画面から離れるとき。未回答なら start だけ残る(= 途中離脱)。まちがえたあと・ヒントのあとに去ったら「不正解のまま終了」 */
function leaveQuestion() { const q = Q(); if (q && !q.ended && (q.retries >= 1 || q.hints)) { q.result = "ng"; q.phase = "done"; addBox(q, `とちゅうで おわった問題にゃ。こたえ: <b>${esc(formatAnswer(q.p.answer, q.p.answerType, q.p.unit, { labels: q.p.labels }))}</b><br>${textToHtml(q.p.exp)}`); endQuestion(q, "ng"); } }

// ---------- 成績・再出題 ----------
function recordField(p, ok) { const s = state.field[subOf(p)] ||= { o: 0, x: 0 }; ok ? s.o++ : s.x++; save(); }
function addWrong(pid) { state.wrong.push({ pid, due: Date.now() + 86400000, n: 1 }); save(); }
function removeWrong(pid) { const w = state.wrong.find(w => w.pid === pid); if (!w) return; if (w.n >= 2) state.wrong = state.wrong.filter(x => x !== w); else { w.n++; w.due = Date.now() + 3 * 86400000; } save(); }
function renderFields() {
  const box = $("#fields"); box.innerHTML = "";
  const rows = TAGS.filter(t => state.field[t]);
  if (!rows.length) { box.innerHTML = `<p class="note">まだ 記録が ないにゃ。問題を とくと ここに 出るにゃ</p>`; return; }
  for (const f of rows) { const s = state.field[f], n = s.o + s.x, pct = Math.round(s.o / n * 100); box.insertAdjacentHTML("beforeend", `<div class="field"><div class="field-head"><span>${esc(f)}</span><span>${pct}%(${n}問)</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`); }
}

// ---------- 保護者画面 ----------
function pinOk() {
  const v = $("#pin").value; if (!/^\d{4}$/.test(v)) { alert("4桁の数字を入れてください"); return; }
  if (!state.pin) { state.pin = v; save(); } else if (v !== state.pin) { alert("暗証番号が違います"); return; }
  $("#parent-lock").classList.add("hidden"); $("#parent-body").classList.remove("hidden"); renderParent();
}
const fmtMs = ms => `${Math.floor(ms / 60000)}分${Math.round(ms % 60000 / 1000)}秒`;
const fmtDate = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
function renderParent() {
  const s = hist.summarize();
  $("#p-days").innerHTML = Object.entries(s.byDay).sort().reverse().slice(0, 14).map(([d, v]) => `<div><span>${d}</span><span>${v.total}問 / 正解${v.ok + v.ok_hint}(ヒント${v.ok_hint}) 不正解${v.ng} 解説${v.exp} 離脱${v.abandoned}</span></div>`).join("") || "<div>まだ記録がありません</div>";
  $("#p-fields").innerHTML = Object.entries(s.byField).map(([f, v]) => `<div><span>${esc(f)}</span><span>${v.rate == null ? "―" : v.rate + "%"}(${v.total}問)</span></div>`).join("") || "<div>―</div>";
  $("#p-abandoned").innerHTML = s.abandoned.slice(-20).reverse().map(a => `<div><span>${fmtDate(a.t)}</span><span class="mono">${esc(a.pid)}</span></div>`).join("") || "<div>なし</div>";
  $("#p-slow").innerHTML = s.slow.slice(0, 20).map(a => `<div><span>${fmtDate(a.t)} ${fmtMs(a.ms)} ヒント${a.hints} やり直し${a.retries}</span><span class="mono">${esc(a.pid)}</span></div>`).join("") || "<div>なし</div>";
  const years = {}; for (const p of ALL) { const y = years[p.source.year] ||= { ready: 0, ex: 0 }; p.status === "ready" ? y.ready++ : y.ex++; }
  $("#p-data").innerHTML = Object.entries(years).sort().reverse().map(([y, v]) => `<div><span>${y}年度</span><span>出題 ${v.ready}問${v.ex ? ` / 除外 ${v.ex}問` : ""}</span></div>`).join("") || "<div>―</div>";
}
function backup() { const blob = new Blob([hist.exportJSON()], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `neko-sansu-log-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }

// ---------- 起動 ----------
function titleGreeting() {
  setCats("sleep"); $("#cat-title").innerHTML = renderCat("idle");
  const cur = Q(); const pend = (cur && !cur.ended) ? { pid: cur.id } : hist.pendingStart();
  const p = pend && ALL.find(x => x.id === pend.pid && x.status === "ready");
  if (p) {
    $("#title-bubble").innerHTML = `おかえりにゃ。さっきの つづきから やる? <br><button id="btn-resume" class="primary" style="margin-top:6px">つづきから</button>`;
    $("#btn-resume").onclick = () => { if (!(cur && cur.id === p.id && !cur.ended)) resumeP = p; go("quiz"); };
  } else $("#title-bubble").textContent = state.name ? `${state.name}だにゃ。きょうも いっしょに がんばるにゃ` : "はじめまして。名前を つけてほしいにゃ";
}
window.addEventListener("DOMContentLoaded", async () => {
  try { ALL = await loadProblems(fetchJson); $("#data-status").textContent = `もんだい: ${ready(ALL).length}問`; }
  catch (e) { $("#data-status").textContent = "問題データを 読みこめませんでした(" + e.message + ")"; }
  // 履歴の土台: いちばん下に番人(depth -1)を置き、その上にタイトル(depth 0)。スワイプ戻るで番人に落ちたらタイトルに戻す
  try { history.replaceState({ app: STORE_KEY, depth: -1 }, "", location.pathname + location.search); } catch (e) {}
  pushDepth(0); show("title");
  $("#btn-start").onclick = () => { if (!state.name) { go("name"); return; } wantNew = true; go("quiz"); };
  $("#btn-name-ok").onclick = () => { const v = $("#cat-name").value.trim(); if (!v) return; state.name = v; save(); goHome(); };
  $("#btn-rename").onclick = () => go("name");
  $("#btn-zukan").onclick = () => go("zukan");
  $("#btn-seiseki").onclick = () => go("seiseki");
  $("#btn-submit").onclick = submit;
  $("#btn-forward").onclick = forward; $("#btn-prev").onclick = prevQuestion;
  $("#btn-real").onclick = showReal; $("#btn-similar").onclick = similar; $("#btn-finish").onclick = goHome;
  $$(".btn-home").forEach(b => b.onclick = goHome);
  $$(".btn-back").forEach(b => b.onclick = back);
  // 保護者画面: タイトルの猫を長押し
  let pressT = null; const c = $("#cat-title");
  const down = () => { pressT = setTimeout(() => go("parent"), 900); }, up = () => clearTimeout(pressT);
  c.addEventListener("touchstart", down, { passive: true }); c.addEventListener("touchend", up); c.addEventListener("touchmove", up);
  c.addEventListener("mousedown", down); c.addEventListener("mouseup", up); c.addEventListener("mouseleave", up);
  c.addEventListener("contextmenu", e => e.preventDefault());
  $("#btn-pin-ok").onclick = pinOk; $("#pin").addEventListener("keydown", e => { if (e.key === "Enter") pinOk(); });
  $("#btn-pin-change").onclick = () => { const v = prompt("新しい4桁の暗証番号"); if (/^\d{4}$/.test(v || "")) { state.pin = v; save(); alert("変更しました"); } };
  $("#btn-backup").onclick = backup;
  $("#restore-file").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const n = hist.importJSON(await f.text(), "merge"); alert(`${n}件の記録になりました`); renderParent(); } catch (err) { alert("読み込めませんでした: " + err.message); } e.target.value = ""; };
  window.addEventListener("pagehide", () => { if (shown === "quiz") leaveQuestion(); });
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
});
