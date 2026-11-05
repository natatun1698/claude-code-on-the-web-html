/* ねこさんすう ― UIロジック(ブラウザ専用)。ロジックは rng/judge/history/importer/templates に分離 */
"use strict";
const STORE_KEY = "neko-sansu-v1";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- 保存データ ----------
const defaultState = () => ({ name: "", pin: "", count: 0, field: {}, wrong: [], realSeen: 0 });
let state = (() => { try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch (e) { return defaultState(); } })();
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };
const hist = createHistory();
const TPL = Object.fromEntries((window.NEKO_TEMPLATES || []).map(t => [t.id, t]));
let BANK = [];

// ---------- 猫 ----------
const catName = () => state.name || "ねこ";
function setCats(mood) { $$(".cat").forEach(el => { el.innerHTML = renderCat(mood); }); }
function say(text, mood = "idle") {
  const b = $("#bubble"); b.innerHTML = text; b.classList.remove("hidden");
  $("#cat").innerHTML = renderCat(mood);
}
function sparkle() { const box = $("#sparkles"); box.innerHTML = ""; for (let i = 0; i < 14; i++) { const s = document.createElement("span"); s.textContent = pick(["✨", "⭐", "💫", "🌟"]); s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * .4 + "s"; box.appendChild(s); } setTimeout(() => box.innerHTML = "", 1400); }
const PRAISE = ["式の 立て方が バッチリにゃ!", "じゅんばんに 考えられたのが すごいにゃ", "紙に 書いて 整理できたのが えらいにゃ", "数字の あつかいが ていねいだったにゃ", "落ち着いて 計算できたにゃ。さすがにゃ"];
const ENCOURAGE = ["おしい! もう一回 紙に 書いてみるにゃ", "だいじょうぶにゃ。どこまで 分かったか 紙に 書いてみるにゃ", "まちがえた問題は いちばん 強くなれる問題にゃ"];

// ---------- 画面 ----------
const SCREENS = ["title", "name", "quiz", "zukan", "seiseki", "import", "parent"];
function show(id) { SCREENS.forEach(s => $("#screen-" + s).classList.toggle("hidden", s !== id)); $(".catbar").classList.toggle("hidden", id !== "quiz"); window.scrollTo(0, 0); }

// ---------- 問題の生成 ----------
// pid: テンプレ "tid#seed" / 原題 "imp:id"
function makeQuestion(pid) {
  if (pid.startsWith("imp:")) { const q = BANK.find(b => "imp:" + b.id === pid); return q ? fromBank(q) : null; }
  const [tid, seed] = pid.split("#"); const T = TPL[tid]; if (!T) return null;
  const rng = makeRng(Number(seed)); const p = T.params(rng); const ans = T.solve(p);
  return { pid, templateId: tid, title: T.title, tags: T.tags, answerType: T.answerType, unit: T.unit || "", text: T.text(p), figure: T.figure ? T.figure(p) : null, choices: T.choices ? T.choices(p) : null, answer: ans, ex: T.explain(p, ans) };
}
function fromBank(q) { return { pid: "imp:" + q.id, templateId: q.templateId, title: q.pattern || q.tags[1] || q.tags[0], tags: q.tags, answerType: q.answerType, unit: q.unit, text: q.text, figure: q.figure, choices: q.choices, answer: q.answer, ex: { essence: q.essence, pattern: q.pattern, hint1: q.hint1, hint2: q.hint2, exp: q.exp, realworld: q.realworld } }; }
function newPid(tid) { return `${tid}#${randomSeed()}`; }
function duePid() { const now = Date.now(); const d = state.wrong.filter(w => w.due <= now); return d.length ? pick(d).pid : null; }
function nextPid(prev) {
  if (Math.random() < 0.3) { const d = duePid(); if (d && d !== prev) return d; }
  if (BANK.length && Math.random() < 0.3) { const q = pick(BANK); if ("imp:" + q.id !== prev) return "imp:" + q.id; }
  const list = Object.values(TPL); const total = list.reduce((s, t) => s + (t.weight || 1), 0);
  let r = Math.random() * total; let T = list[list.length - 1];
  for (const t of list) { r -= (t.weight || 1); if (r <= 0) { T = t; break; } }
  return newPid(T.id);
}

// ---------- 数字キー ----------
let input = [];
const KEYS = { num: ["7", "8", "9", "←", "C", "4", "5", "6", "/", "と", "1", "2", "3", ".", ",", "0"], time: ["7", "8", "9", "←", "C", "4", "5", "6", "時間", "分", "1", "2", "3", "秒", ",", "0"] };
function buildKeypad(type) {
  const keys = type === "time" ? KEYS.time : KEYS.num;
  $("#keypad").innerHTML = keys.map(k => `<button data-k="${k}" class="${/^\d$/.test(k) ? "" : k === "←" || k === "C" ? "fn del" : "fn"}">${k}</button>`).join("");
  $$("#keypad button").forEach(b => b.onclick = () => key(b.dataset.k));
}
function key(k) {
  if (Q.answered) return;
  if (k === "C") input = []; else if (k === "←") input.pop(); else input.push(k);
  renderInput();
}
function inputText() { return input.join(""); }
function renderInput() {
  const d = $("#answer-display"); const t = inputText();
  if (!t) { d.innerHTML = `<span class="ph">ここに こたえが 出るにゃ</span>`; return; }
  d.innerHTML = t.split(",").map(part => { const m = part.match(/^(?:(\d+)と)?(\d+)\/(\d*)$/); return m ? `${m[1] || ""}<span class="frac"><span>${m[2]}</span><i>${m[3] || "?"}</i></span>` : esc(part); }).join("、");
}

// ---------- 1問の流れ ----------
let Q = null, qCount = 0;
function startQuestion(pid) {
  const q = makeQuestion(pid || nextPid(Q && Q.pid));
  if (!q) return startQuestion(nextPid());
  Q = Object.assign(q, { answered: false, retries: 0, hints: 0, sawExp: 0, ended: false, t0: Date.now() });
  qCount++; input = [];
  hist.start(q.pid, q.tags);
  $("#q-field").textContent = `${q.tags[0]} ・ ${q.title}`;
  $("#q-count").textContent = `${qCount}もんめ`;
  $("#q-text").innerHTML = q.text;
  $("#q-figure").innerHTML = q.figure || ""; $("#q-figure").classList.toggle("hidden", !q.figure);
  $("#q-answer-note").textContent = { frac: "分数は 「/」キー、帯分数は 「と」キーを つかうにゃ(約分していなくても OK)", multi: "答えが いくつか あるときは 「,」で くぎるにゃ(じゅんばんは 自由)", ordered: "「,」で くぎって、じゅんばん どおりに 入れるにゃ", time: "時間・分・秒の キーを つかうにゃ" }[q.answerType] || "";
  $("#answer-unit").textContent = q.unit || "";
  const isChoice = q.answerType === "choice";
  $("#keypad").classList.toggle("hidden", isChoice); $(".answer-row").classList.toggle("hidden", isChoice); $("#choices").classList.toggle("hidden", !isChoice);
  if (isChoice) { $("#choices").innerHTML = q.choices.map((c, i) => `<button data-i="${i}">${esc(c)}</button>`).join(""); $$("#choices button").forEach(b => b.onclick = () => { if (Q.answered) return; input = [b.dataset.i]; $$("#choices button").forEach(x => x.classList.toggle("sel", x === b)); }); }
  else buildKeypad(q.answerType);
  renderInput();
  $("#feedback").className = "feedback hidden"; $("#feedback").innerHTML = "";
  ["hint1", "hint2", "exp", "real", "similar", "next"].forEach(k => $("#btn-" + k).classList.add("hidden"));
  $("#btn-submit").disabled = false;
  say(pick([`まず 紙に 書いてみてにゃ`, `${state.name ? state.name + "は " : ""}見守ってるにゃ。紙に 式を 書いてみるにゃ`, `あわてなくて いいにゃ。紙に 書いて 整理するにゃ`]), "think");
}
function submit() {
  if (!Q || Q.answered) return;
  const val = inputText();
  if (!val) { say("まだ 答えが 入っていないにゃ", "idle"); return; }
  const res = judge(val, Q.answer, Q.answerType, { unit: Q.unit });
  const fb = $("#feedback"); fb.classList.remove("hidden");
  if (res.ok) {
    Q.answered = true; $("#btn-submit").disabled = true;
    fb.className = "feedback ok";
    fb.innerHTML = `<div class="mark">⭕️ せいかい!</div><div>こたえ: <b>${formatAnswer(Q.answer, Q.answerType, Q.unit)}</b></div><div class="box"><b class="tag">${esc(Q.ex.pattern || "")}</b> の 考え方が できているにゃ。<br>${esc(Q.ex.essence || "")}</div>`;
    say((Q.ex.pattern ? `${esc(Q.ex.pattern)}の ` : "") + pick(PRAISE), "happy");
    sparkle();
    recordField(Q.tags[0], true); removeWrong(Q.pid);
    endQuestion(Q.hints ? "ok_hint" : "ok");
    $("#btn-real").classList.toggle("hidden", !Q.ex.realworld || Math.random() < 0.5);
    $("#btn-similar").classList.toggle("hidden", !Q.templateId);
    $("#btn-next").classList.remove("hidden");
  } else {
    Q.retries++;
    fb.className = "feedback ng";
    const reason = res.reason === "parse" ? "数字の 書き方を もう一度 見てみるにゃ" : res.reason === "count" ? "答えの 数が ちがうみたいにゃ" : "";
    fb.innerHTML = `<div class="mark">💭 おしい</div><div>${reason || "もう一度 考えてみるにゃ。紙に 式を 書くと 見えてくるにゃ"}</div>`;
    say(pick(ENCOURAGE), "cheer");
    input = []; renderInput();
    if (Q.retries >= 2) { $("#btn-hint1").classList.remove("hidden"); say("ヒントを 見ても いいにゃ。ズルじゃなくて かしこい作戦にゃ", "cheer"); }
    if (Q.retries >= 2 && !state.wrong.some(w => w.pid === Q.pid)) { recordField(Q.tags[0], false); addWrong(Q.pid); }
  }
}
function showHint(n) {
  Q.hints = Math.max(Q.hints, n);
  const box = document.createElement("div"); box.className = "box"; box.innerHTML = `<b class="tag">ヒント${n}</b><br>${Q.ex["hint" + n] || "(ヒントは ないにゃ)"}`;
  $("#feedback").appendChild(box);
  $("#btn-hint" + n).classList.add("hidden");
  $(n === 1 ? "#btn-hint2" : "#btn-exp").classList.remove("hidden");
  say(n === 1 ? "ここまで 分かれば あと少しにゃ" : "もう一回 紙で ためしてみるにゃ", "think");
}
function showExp() {
  Q.sawExp = 1; Q.answered = true; $("#btn-submit").disabled = true; $("#btn-exp").classList.add("hidden");
  const box = document.createElement("div"); box.className = "box";
  box.innerHTML = `<b class="tag">この問題は なにを 聞いているか</b><br>${Q.ex.essence || ""}<br><br><b class="tag">かいせつ(${esc(Q.ex.pattern || "")})</b><br>${Q.ex.exp || ""}<br>こたえ: <b>${formatAnswer(Q.answer, Q.answerType, Q.unit)}</b>`;
  $("#feedback").appendChild(box);
  endQuestion("exp");
  $("#btn-real").classList.toggle("hidden", !Q.ex.realworld);
  $("#btn-similar").classList.toggle("hidden", !Q.templateId);
  $("#btn-next").classList.remove("hidden");
  say("つぎに 同じ形の 問題が 出たら きっと 解けるにゃ。もう一問 やってみる?", "cheer");
}
function showReal() { const box = document.createElement("div"); box.className = "box"; box.innerHTML = `<b class="tag">社会で こんなときに 役立つにゃ</b><br>${Q.ex.realworld}`; $("#feedback").appendChild(box); $("#btn-real").classList.add("hidden"); }
function endQuestion(result) {
  if (!Q || Q.ended) return; Q.ended = true;
  hist.end(Q.pid, { result, hints: Q.hints, retries: Q.retries });
  state.count++; save();
}
function leaveQuestion() { if (Q && !Q.ended) { if (Q.retries >= 1 || Q.hints) endQuestion("ng"); /* 未回答のまま去ると start だけ残る = 途中離脱 */ } }

// ---------- 成績・再出題 ----------
function recordField(f, ok) { const s = state.field[f] ||= { o: 0, x: 0 }; ok ? s.o++ : s.x++; save(); }
function addWrong(pid) { state.wrong.push({ pid, due: Date.now() + 86400000, n: 1 }); save(); }
function removeWrong(pid) { const w = state.wrong.find(w => w.pid === pid); if (!w) return; if (w.n >= 2) state.wrong = state.wrong.filter(x => x !== w); else { w.n++; w.due = Date.now() + 3 * 86400000; } save(); }
function renderFields() {
  const box = $("#fields"); box.innerHTML = "";
  for (const f of FIELDS) { const s = state.field[f] || { o: 0, x: 0 }, n = s.o + s.x, pct = n ? Math.round(s.o / n * 100) : 0; box.insertAdjacentHTML("beforeend", `<div class="field"><div class="field-head"><span>${f}</span><span>${n ? pct + "%（" + n + "問）" : "―"}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`); }
}

// ---------- 原題の取りこみ ----------
async function refreshBank() { BANK = await loadBank(); $("#import-count").textContent = BANK.length ? `取りこみずみ: ${BANK.length}問(この端末の中だけ)` : "まだ 取りこんでいません(類題だけで あそべます)"; }
async function importFile(file) {
  const out = $("#import-result");
  try {
    const json = JSON.parse(await file.text()); const v = validateBank(json);
    if (!v.ok) { out.textContent = "取りこめません:\n" + v.errors.join("\n"); return; }
    await saveBank(v.problems); out.textContent = `${v.problems.length}問を 取りこみました。`; await refreshBank();
  } catch (e) { out.textContent = "読みこみエラー: " + e.message; }
}

// ---------- 保護者画面 ----------
function openParent() { show("parent"); $("#parent-lock").classList.remove("hidden"); $("#parent-body").classList.add("hidden"); $("#pin").value = ""; $("#pin").focus(); }
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
  $("#p-fields").innerHTML = Object.entries(s.byField).map(([f, v]) => `<div><span>${f}</span><span>${v.rate == null ? "―" : v.rate + "%"}(${v.total}問)</span></div>`).join("") || "<div>―</div>";
  $("#p-abandoned").innerHTML = s.abandoned.slice(-20).reverse().map(a => `<div><span>${fmtDate(a.t)}</span><span class="mono">${a.pid}</span></div>`).join("") || "<div>なし</div>";
  $("#p-slow").innerHTML = s.slow.slice(0, 20).map(a => `<div><span>${fmtDate(a.t)} ${fmtMs(a.ms)}</span><span class="mono">${a.pid}</span></div>`).join("") || "<div>なし</div>";
}
function backup() { const blob = new Blob([hist.exportJSON()], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `neko-sansu-log-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }

// ---------- 起動 ----------
function titleGreeting() {
  setCats("sleep"); $("#cat-title").innerHTML = renderCat("idle");
  const pend = hist.pendingStart();
  if (pend && (pend.pid.startsWith("imp:") || TPL[pend.pid.split("#")[0]])) {
    $("#title-bubble").innerHTML = `おかえりにゃ。さっきの つづきから やる? <br><button id="btn-resume" class="primary" style="margin-top:6px">つづきから</button>`;
    $("#btn-resume").onclick = () => { show("quiz"); startQuestion(pend.pid); };
  } else $("#title-bubble").textContent = state.name ? `${state.name}だにゃ。きょうも いっしょに がんばるにゃ` : "はじめまして。名前を つけてほしいにゃ";
}
window.addEventListener("DOMContentLoaded", async () => {
  await refreshBank();
  titleGreeting();
  $("#btn-start").onclick = () => { if (!state.name) { show("name"); return; } show("quiz"); startQuestion(); };
  $("#btn-name-ok").onclick = () => { const v = $("#cat-name").value.trim(); if (!v) return; state.name = v; save(); titleGreeting(); show("title"); };
  $("#btn-rename").onclick = () => { $("#cat-name").value = state.name; show("name"); };
  $("#btn-zukan").onclick = () => { $("#zukan-name").textContent = catName(); $("#zukan-stats").textContent = `いっしょに といた もんだい: ${state.count}問`; setCats("idle"); show("zukan"); };
  $("#btn-seiseki").onclick = () => { renderFields(); show("seiseki"); };
  $("#btn-import").onclick = () => show("import");
  $("#import-file").onchange = e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; };
  $("#btn-import-clear").onclick = async () => { if (confirm("取りこんだ原題をすべて消しますか?")) { await clearBank(); await refreshBank(); $("#import-result").textContent = "消しました。"; } };
  $("#btn-submit").onclick = submit;
  $("#btn-hint1").onclick = () => showHint(1); $("#btn-hint2").onclick = () => showHint(2); $("#btn-exp").onclick = showExp; $("#btn-real").onclick = showReal;
  $("#btn-similar").onclick = () => startQuestion(newPid(Q.templateId));
  $("#btn-next").onclick = () => startQuestion();
  $$(".btn-home").forEach(b => b.onclick = () => { leaveQuestion(); Q = null; qCount = 0; titleGreeting(); show("title"); });
  // 保護者画面: タイトルの猫を長押し
  let pressT = null; const c = $("#cat-title");
  const down = () => { pressT = setTimeout(openParent, 900); }, up = () => clearTimeout(pressT);
  c.addEventListener("touchstart", down, { passive: true }); c.addEventListener("touchend", up); c.addEventListener("touchmove", up);
  c.addEventListener("mousedown", down); c.addEventListener("mouseup", up); c.addEventListener("mouseleave", up);
  c.addEventListener("contextmenu", e => e.preventDefault());
  $("#btn-pin-ok").onclick = pinOk; $("#pin").addEventListener("keydown", e => { if (e.key === "Enter") pinOk(); });
  $("#btn-pin-change").onclick = () => { const v = prompt("新しい4桁の暗証番号"); if (/^\d{4}$/.test(v || "")) { state.pin = v; save(); alert("変更しました"); } };
  $("#btn-backup").onclick = backup;
  $("#restore-file").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const n = hist.importJSON(await f.text(), "merge"); alert(`${n}件の記録になりました`); renderParent(); } catch (err) { alert("読み込めませんでした: " + err.message); } e.target.value = ""; };
  window.addEventListener("pagehide", leaveQuestion);
});
