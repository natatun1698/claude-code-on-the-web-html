/* ねこさんすう 写真版 ― UIロジック(ブラウザ専用)。
   ../neko-sansu の rng/judge/cat/history/templates を共用し、原題は JSON ではなく「写真 + おうちの人が入力した答え」で取りこむ。
   保存先はこのアプリ専用(localStorage: neko-sansu-photo-v1 / neko-sansu-photo-log-v1、IndexedDB: neko-sansu-photo)。 */
"use strict";
const STORE_KEY = "neko-sansu-photo-v1", LOG_KEY_PHOTO = "neko-sansu-photo-log-v1";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SUBS = { "計算": ["四則計算・逆算", "計算のくふう", "単位の計算"], "和と差": ["和差算", "分配算", "消去算", "つるかめ算", "平均とのべ", "過不足算"], "割合と比": ["割合と比", "還元算・相当算", "倍数算", "売買損益", "濃度", "仕事算"], "速さ": ["速さと比", "旅人算", "通過算"], "図形": ["角度・面積・長さ", "辺の比と面積の比", "体積・表面積", "展開図", "図形上の点の移動"], "表とグラフ": ["表とグラフ"], "数の性質": ["約数と倍数", "整数・小数・分数の性質"], "規則性": ["数列", "周期算", "植木算"], "場合の数": ["場合の数", "調べ・推理"] };
const ANSWER_HELP = { int: "例: 12", dec: "例: 1.5", frac: "例: 3/4、1と1/4(帯分数)", unit: "例: 12(単位は下の欄に)", time: "例: 5分30秒、1時間20分", multi: "例: 3,5,8(「,」で区切る。順番は問わない)", ordered: "例: 3,5(「,」で区切る。順番どおり)", choice: "正しい選択肢の番号(1から)。選択肢は下の欄に", self: "答えを登録しません。子どもが答えたあと、解説(文か写真)を見せて ⭕❌ を自分で付けます" };

// ---------- 保存データ ----------
const defaultState = () => ({ name: "", pin: "", count: 0, field: {}, wrong: [], mix: "mix" });
let state = (() => { try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch (e) { return defaultState(); } })();
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };
const hist = createHistory(prefixedStorage(localStorage, LOG_KEY_PHOTO));
const TPL = Object.fromEntries((window.NEKO_TEMPLATES || []).map(t => [t.id, t]));
let PHOTOS = [];
const URLS = new Map(); // blob → objectURL(使い回し)
function urlOf(blob) { if (!blob) return ""; if (!URLS.has(blob)) URLS.set(blob, URL.createObjectURL(blob)); return URLS.get(blob); }
function dropUrls() { for (const u of URLS.values()) URL.revokeObjectURL(u); URLS.clear(); }

// ---------- 猫 ----------
const catName = () => state.name || "ねこ";
function setCats(mood) { $$(".cat").forEach(el => { el.innerHTML = renderCat(mood); }); }
function say(text, mood = "idle") { const b = $("#bubble"); b.innerHTML = text; b.classList.remove("hidden"); $("#cat").innerHTML = renderCat(mood); }
function sparkle() { const box = $("#sparkles"); box.innerHTML = ""; for (let i = 0; i < 14; i++) { const s = document.createElement("span"); s.textContent = pick(["✨", "⭐", "💫", "🌟"]); s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * .4 + "s"; box.appendChild(s); } setTimeout(() => box.innerHTML = "", 1400); }
const PRAISE = ["式の 立て方が バッチリにゃ!", "じゅんばんに 考えられたのが すごいにゃ", "紙に 書いて 整理できたのが えらいにゃ", "数字の あつかいが ていねいだったにゃ", "落ち着いて 計算できたにゃ。さすがにゃ"];
const ENCOURAGE = ["おしい! もう一回 紙に 書いてみるにゃ", "だいじょうぶにゃ。どこまで 分かったか 紙に 書いてみるにゃ", "まちがえた問題は いちばん 強くなれる問題にゃ"];

// ---------- 画面(ブラウザの戻る/進むと同期) ----------
const SCREENS = ["title", "name", "quiz", "zukan", "seiseki", "import", "edit", "parent"];
function show(id) { SCREENS.forEach(s => $("#screen-" + s).classList.toggle("hidden", s !== id)); $(".catbar").classList.toggle("hidden", id !== "quiz"); closeLightbox(); window.scrollTo(0, 0); }
const ENTER = {
  title() { titleGreeting(); },
  name() {},
  quiz() { if (!Q) startQuestion(); else say(Q.answered ? "つづきを 見るにゃ" : "さっきの つづきにゃ。紙に 書いて 考えるにゃ", "think"); },
  zukan() { $("#zukan-name").textContent = catName(); $("#zukan-stats").textContent = `いっしょに といた もんだい: ${state.count}問`; setCats("idle"); },
  seiseki() { renderFields(); },
  import() { renderImport(); },
  edit() { renderEdit(EDIT); },
  parent() { $("#parent-lock").classList.remove("hidden"); $("#parent-body").classList.add("hidden"); $("#pin").value = ""; },
};
function nav(id, replace) {
  const depth = (history.state && history.state.depth) || 0;
  const st = { app: STORE_KEY, s: id, depth: replace ? depth : depth + 1 };
  const url = location.pathname + location.search + (id === "title" ? "" : "#" + id);
  try { replace ? history.replaceState(st, "", url) : history.pushState(st, "", url); } catch (e) {}
  (ENTER[id] || (() => {}))(); show(id);
  if (id === "parent") $("#pin").focus();
}
function back() { if (history.state && history.state.app === STORE_KEY && history.state.depth > 0) history.back(); else nav("title", true); }
window.addEventListener("popstate", e => {
  const id = e.state && e.state.app === STORE_KEY && SCREENS.includes(e.state.s) ? e.state.s : "title";
  if (id === "title" && !(e.state && e.state.app === STORE_KEY)) try { history.replaceState({ app: STORE_KEY, s: "title", depth: 0 }, "", location.pathname + location.search); } catch (err) {}
  (ENTER[id] || (() => {}))(); show(id);
});

// ---------- 写真の拡大 ----------
function openLightbox(url) { $("#lb-img").src = url; $("#lightbox").classList.remove("hidden"); $("#lightbox").classList.remove("zoom2"); }
function closeLightbox() { $("#lightbox").classList.add("hidden"); }

// ---------- 問題の生成 ----------
function makeQuestion(pid) {
  if (pid.startsWith("imp:")) { const q = PHOTOS.find(b => "imp:" + b.id === pid); return q ? fromPhoto(q) : null; }
  const [tid, seed] = pid.split("#"); const T = TPL[tid]; if (!T) return null;
  const rng = makeRng(Number(seed)); const p = T.params(rng); const ans = T.solve(p);
  return { pid, templateId: tid, title: T.title, tags: T.tags, answerType: T.answerType, unit: T.unit || "", text: T.text(p), figure: T.figure ? T.figure(p) : null, choices: T.choices ? T.choices(p) : null, answer: ans, ex: T.explain(p, ans), selfCheck: false };
}
function fromPhoto(q) {
  return { pid: "imp:" + q.id, templateId: q.templateId && TPL[q.templateId] ? q.templateId : null, title: q.pattern || q.tags[1] || "写真の もんだい", tags: q.tags, answerType: q.answerType === "self" ? "int" : q.answerType, selfCheck: q.answerType === "self", unit: q.unit, text: "", photo: q.photo, expPhoto: q.expPhoto || null, figure: null, choices: q.choices, answer: q.answer, ex: { essence: q.essence, pattern: q.pattern, hint1: q.hint1, hint2: q.hint2, exp: q.exp, realworld: "" } };
}
function newPid(tid) { return `${tid}#${randomSeed()}`; }
function duePid() { const now = Date.now(); const d = state.wrong.filter(w => w.due <= now && (!w.pid.startsWith("imp:") || PHOTOS.some(p => "imp:" + p.id === w.pid))); return d.length ? pick(d).pid : null; }
function nextPid(prev) {
  if (Math.random() < 0.3) { const d = duePid(); if (d && d !== prev) return d; }
  const wantPhoto = PHOTOS.length && (state.mix === "photo" || Math.random() < 0.5);
  if (wantPhoto) { const cands = PHOTOS.filter(p => "imp:" + p.id !== prev); return "imp:" + pick(cands.length ? cands : PHOTOS).id; }
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
function key(k) { if (Q.answered) return; if (k === "C") input = []; else if (k === "←") input.pop(); else input.push(k); renderInput(); }
function inputText() { return input.join(""); }
function renderInput() {
  const d = $("#answer-display"); const t = inputText();
  if (!t) { d.innerHTML = `<span class="ph">ここに こたえが 出るにゃ</span>`; return; }
  d.innerHTML = t.split(",").map(part => { const m = part.match(/^(?:(\d+)と)?(\d+)\/(\d*)$/); return m ? `${m[1] || ""}<span class="frac"><span>${m[2]}</span><i>${m[3] || "?"}</i></span>` : esc(part); }).join("、");
}

// ---------- 1問の流れ ----------
let Q = null, qCount = 0;
function startQuestion(pid) {
  if (!Object.keys(TPL).length && !PHOTOS.length) { say("まだ もんだいが ないにゃ。おうちの人に 写真を 取りこんで もらってにゃ", "think"); return; }
  const q = makeQuestion(pid || nextPid(Q && Q.pid));
  if (!q) return startQuestion(nextPid());
  Q = Object.assign(q, { answered: false, retries: 0, hints: 0, sawExp: 0, ended: false, t0: Date.now() });
  qCount++; input = [];
  hist.start(q.pid, q.tags);
  $("#q-field").textContent = `${q.tags[0]} ・ ${q.title}`;
  $("#q-count").textContent = `${qCount}もんめ`;
  $("#q-text").innerHTML = q.photo ? `<span class="note">写真の もんだいを といてにゃ${q.selfCheck ? "(答えたら じぶんで まるつけ)" : ""}</span>` : q.text;
  $("#q-figure").innerHTML = q.figure || ""; $("#q-figure").classList.toggle("hidden", !q.figure);
  $("#q-photo").classList.toggle("hidden", !q.photo); if (q.photo) $("#q-photo-img").src = urlOf(q.photo);
  $("#q-answer-note").textContent = q.selfCheck ? "紙に といて、こたえを 入れたら「こたえる」にゃ(入れなくても OK)" : { frac: "分数は 「/」キー、帯分数は 「と」キーを つかうにゃ(約分していなくても OK)", multi: "答えが いくつか あるときは 「,」で くぎるにゃ(じゅんばんは 自由)", ordered: "「,」で くぎって、じゅんばん どおりに 入れるにゃ", time: "時間・分・秒の キーを つかうにゃ" }[q.answerType] || "";
  $("#answer-unit").textContent = q.unit || "";
  const isChoice = q.answerType === "choice" && q.choices;
  $("#keypad").classList.toggle("hidden", isChoice); $(".answer-row").classList.toggle("hidden", isChoice); $("#choices").classList.toggle("hidden", !isChoice);
  if (isChoice) { $("#choices").innerHTML = q.choices.map((c, i) => `<button data-i="${i}">${esc(c)}</button>`).join(""); $$("#choices button").forEach(b => b.onclick = () => { if (Q.answered) return; input = [b.dataset.i]; $$("#choices button").forEach(x => x.classList.toggle("sel", x === b)); }); }
  else buildKeypad(q.answerType);
  renderInput();
  $("#feedback").className = "feedback hidden"; $("#feedback").innerHTML = "";
  $("#selfcheck-row").classList.add("hidden");
  ["hint1", "hint2", "exp", "giveup", "real", "similar", "next"].forEach(k => $("#btn-" + k).classList.add("hidden"));
  $("#btn-submit").disabled = false;
  say(pick([`まず 紙に 書いてみてにゃ`, `${state.name ? state.name + "は " : ""}見守ってるにゃ。紙に 式を 書いてみるにゃ`, `あわてなくて いいにゃ。紙に 書いて 整理するにゃ`]), "think");
}
const hasExp = () => !!(Q.ex.exp || Q.expPhoto);
function expHtml(withAnswer) {
  return `${Q.ex.exp ? Q.ex.exp + "<br>" : ""}${Q.expPhoto ? `<img class="exp-photo" src="${urlOf(Q.expPhoto)}" alt="かいせつの 写真">` : ""}${withAnswer && !Q.selfCheck ? `こたえ: <b>${formatAnswer(Q.answer, Q.answerType, Q.unit)}</b>` : ""}`;
}
function submit() {
  if (!Q || Q.answered) return;
  const val = inputText();
  const fb = $("#feedback");
  if (Q.selfCheck) {
    // 答えが登録されていない写真: 解説を見せて、子どもが ⭕❌ を付ける
    Q.answered = true; $("#btn-submit").disabled = true; fb.classList.remove("hidden"); fb.className = "feedback";
    fb.innerHTML = `<div class="mark">📝 こたえあわせ</div>${val ? `<div>きみの こたえ: <b>${esc(val)}</b></div>` : ""}<div class="box">${hasExp() ? `<b class="tag">かいせつ</b><br>${expHtml(false)}` : "おうちの人の 答えと くらべて、あっていたか おしえてにゃ"}</div>`;
    $("#selfcheck-row").classList.remove("hidden");
    say("どうだったにゃ? 正直に おしてにゃ", "think");
    return;
  }
  if (!val) { say("まだ 答えが 入っていないにゃ", "idle"); return; }
  const res = judge(val, Q.answer, Q.answerType, { unit: Q.unit });
  fb.classList.remove("hidden");
  if (res.ok) correct(fb);
  else {
    Q.retries++;
    fb.className = "feedback ng";
    const reason = res.reason === "parse" ? "数字の 書き方を もう一度 見てみるにゃ" : res.reason === "count" ? "答えの 数が ちがうみたいにゃ" : "";
    fb.innerHTML = `<div class="mark">💭 おしい</div><div>${reason || "もう一度 考えてみるにゃ。紙に 式を 書くと 見えてくるにゃ"}</div>`;
    say(pick(ENCOURAGE), "cheer");
    input = []; renderInput();
    if (Q.retries >= 2) afterTwoMisses();
  }
}
function correct(fb) {
  Q.answered = true; $("#btn-submit").disabled = true;
  fb.className = "feedback ok";
  fb.innerHTML = `<div class="mark">⭕️ せいかい!</div>${Q.selfCheck ? "" : `<div>こたえ: <b>${formatAnswer(Q.answer, Q.answerType, Q.unit)}</b></div>`}${Q.ex.pattern || Q.ex.essence ? `<div class="box"><b class="tag">${esc(Q.ex.pattern || "")}</b> の 考え方が できているにゃ。<br>${esc(Q.ex.essence || "")}</div>` : ""}`;
  say((Q.ex.pattern ? `${esc(Q.ex.pattern)}の ` : "") + pick(PRAISE), "happy");
  sparkle();
  recordField(Q.tags[0], true); removeWrong(Q.pid);
  endQuestion(Q.hints ? "ok_hint" : "ok");
  $("#btn-real").classList.toggle("hidden", !Q.ex.realworld || Math.random() < 0.5);
  $("#btn-similar").classList.toggle("hidden", !Q.templateId);
  $("#btn-next").classList.remove("hidden");
}
function afterTwoMisses() {
  if (!state.wrong.some(w => w.pid === Q.pid)) { recordField(Q.tags[0], false); addWrong(Q.pid); }
  if (Q.ex.hint1) { $("#btn-hint1").classList.remove("hidden"); say("ヒントを 見ても いいにゃ。ズルじゃなくて かしこい作戦にゃ", "cheer"); }
  else if (hasExp()) $("#btn-exp").classList.remove("hidden");
  else $("#btn-giveup").classList.remove("hidden");
}
function selfResult(ok) {
  const fb = $("#feedback"); $("#selfcheck-row").classList.add("hidden");
  if (ok) { correct(fb); return; }
  Q.retries++;
  if (hasExp()) {
    // 解説(答え)を見てしまったので、この問題はここで終わり
    fb.className = "feedback ng";
    fb.insertAdjacentHTML("beforeend", `<div class="selfnote">かいせつを 読んで、紙に もう一度 書いてみるにゃ。つぎに 出たとき きっと 解けるにゃ</div>`);
    recordField(Q.tags[0], false); addWrong(Q.pid);
    endQuestion("ng");
    say(pick(ENCOURAGE), "cheer");
    $("#btn-similar").classList.toggle("hidden", !Q.templateId); $("#btn-next").classList.remove("hidden");
  } else {
    fb.className = "feedback ng"; fb.innerHTML = `<div class="mark">💭 おしい</div><div>もう一度 考えてみるにゃ。紙に 式を 書くと 見えてくるにゃ</div>`;
    Q.answered = false; $("#btn-submit").disabled = false; input = []; renderInput();
    say(pick(ENCOURAGE), "cheer");
    if (Q.retries >= 2) afterTwoMisses();
  }
}
function showHint(n) {
  Q.hints = Math.max(Q.hints, n);
  const box = document.createElement("div"); box.className = "box"; box.innerHTML = `<b class="tag">ヒント${n}</b><br>${Q.ex["hint" + n] || "(ヒントは ないにゃ)"}`;
  $("#feedback").classList.remove("hidden"); $("#feedback").appendChild(box);
  $("#btn-hint" + n).classList.add("hidden");
  if (n === 1 && Q.ex.hint2) $("#btn-hint2").classList.remove("hidden");
  else if (hasExp() || !Q.selfCheck) $("#btn-exp").classList.remove("hidden");
  else $("#btn-giveup").classList.remove("hidden");
  say(n === 1 ? "ここまで 分かれば あと少しにゃ" : "もう一回 紙で ためしてみるにゃ", "think");
}
function showExp() {
  Q.sawExp = 1; Q.answered = true; $("#btn-submit").disabled = true; $("#btn-exp").classList.add("hidden");
  const box = document.createElement("div"); box.className = "box";
  box.innerHTML = `${Q.ex.essence ? `<b class="tag">この問題は なにを 聞いているか</b><br>${Q.ex.essence}<br><br>` : ""}<b class="tag">かいせつ${Q.ex.pattern ? `(${esc(Q.ex.pattern)})` : ""}</b><br>${expHtml(true)}`;
  $("#feedback").classList.remove("hidden"); $("#feedback").appendChild(box);
  endQuestion("exp");
  $("#btn-real").classList.toggle("hidden", !Q.ex.realworld);
  $("#btn-similar").classList.toggle("hidden", !Q.templateId);
  $("#btn-next").classList.remove("hidden");
  say("つぎに 同じ形の 問題が 出たら きっと 解けるにゃ。もう一問 やってみる?", "cheer");
}
function giveUp() {
  Q.answered = true; $("#btn-submit").disabled = true; $("#btn-giveup").classList.add("hidden");
  $("#feedback").classList.remove("hidden"); $("#feedback").insertAdjacentHTML("beforeend", `<div class="box">この問題は おうちの人と いっしょに 見なおしてにゃ。また 出すにゃ</div>`);
  endQuestion("ng");
  $("#btn-similar").classList.toggle("hidden", !Q.templateId); $("#btn-next").classList.remove("hidden");
  say("ここまで がんばったのが えらいにゃ", "cheer");
}
function showReal() { const box = document.createElement("div"); box.className = "box"; box.innerHTML = `<b class="tag">社会で こんなときに 役立つにゃ</b><br>${Q.ex.realworld}`; $("#feedback").appendChild(box); $("#btn-real").classList.add("hidden"); }
function endQuestion(result) { if (!Q || Q.ended) return; Q.ended = true; hist.end(Q.pid, { result, hints: Q.hints, retries: Q.retries }); state.count++; save(); }
function leaveQuestion() { if (Q && !Q.ended) { if (Q.retries >= 1 || Q.hints) endQuestion("ng"); } }

// ---------- 成績・再出題 ----------
function recordField(f, ok) { const s = state.field[f] ||= { o: 0, x: 0 }; ok ? s.o++ : s.x++; save(); }
function addWrong(pid) { if (state.wrong.some(w => w.pid === pid)) return; state.wrong.push({ pid, due: Date.now() + 86400000, n: 1 }); save(); }
function removeWrong(pid) { const w = state.wrong.find(w => w.pid === pid); if (!w) return; if (w.n >= 2) state.wrong = state.wrong.filter(x => x !== w); else { w.n++; w.due = Date.now() + 3 * 86400000; } save(); }
function renderFields() {
  const box = $("#fields"); box.innerHTML = "";
  for (const f of PB_FIELDS) { const s = state.field[f] || { o: 0, x: 0 }, n = s.o + s.x, pct = n ? Math.round(s.o / n * 100) : 0; box.insertAdjacentHTML("beforeend", `<div class="field"><div class="field-head"><span>${f}</span><span>${n ? pct + "%（" + n + "問）" : "―"}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`); }
}

// ---------- 写真の取りこみ ----------
let QUEUE = [];   // 取りこみ待ちの File
let EDIT = null;  // 編集中 { item, photo, thumb, expPhoto, isNew }
async function refreshPhotos() { PHOTOS = await loadPhotos(); $("#title-count").textContent = PHOTOS.length ? `取りこんだ写真: ${PHOTOS.length}問` : "まだ 写真が ありません(類題だけで あそべます)"; }
function answerLabel(p) { if (p.answerType === "self") return "じぶんで まるつけ"; if (p.answerType === "choice") return `答え: ${p.choices[p.answer]}`; return `答え: ${formatAnswer(p.answer, p.answerType, p.unit)}`; }
function renderImport() {
  $$('input[name=mix]').forEach(r => r.checked = r.value === state.mix);
  $("#import-count").textContent = PHOTOS.length ? `(${PHOTOS.length}問・この端末の中だけ)` : "";
  $("#import-queue").innerHTML = QUEUE.length ? `<div class="queue-box">答えを 登録していない写真が あと ${QUEUE.length}まい<br><button class="primary" id="btn-queue-go" style="margin-top:6px">つづきを 登録する</button> <button id="btn-queue-drop">やめる</button></div>` : "";
  if (QUEUE.length) { $("#btn-queue-go").onclick = () => nextInQueue(); $("#btn-queue-drop").onclick = () => { QUEUE = []; renderImport(); }; }
  $("#photo-list").innerHTML = PHOTOS.slice().reverse().map(p => `<button class="photo-card" data-id="${p.id}"><img src="${urlOf(p.thumb || p.photo)}" alt=""><div class="pc-field">${esc(p.tags.join(" ・ "))}</div><div class="pc-ans">${esc(answerLabel(p))}</div></button>`).join("");
  $$("#photo-list .photo-card").forEach(b => b.onclick = () => { const p = PHOTOS.find(x => x.id === b.dataset.id); if (p) openEdit({ item: p, photo: p.photo, thumb: p.thumb, expPhoto: p.expPhoto, isNew: false }); });
}
async function addFiles(files) {
  QUEUE.push(...Array.from(files).filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name)));
  if (!EDIT || !EDIT.isNew) nextInQueue(); else renderImport();
}
async function nextInQueue() {
  const f = QUEUE.shift();
  if (!f) { EDIT = null; if (!$("#screen-import").classList.contains("hidden")) renderImport(); else back(); return; }
  try {
    const [big, small] = await Promise.all([shrinkImage(f, 1600, 0.85), shrinkImage(f, 240, 0.7)]);
    openEdit({ item: { id: newPhotoId(), tags: [LAST_FIELD, ""], answerType: LAST_TYPE, answer: null, unit: "", choices: null, hint1: "", hint2: "", exp: "", essence: "", pattern: "", templateId: null, memo: "" }, photo: big.blob, thumb: small.blob, expPhoto: null, isNew: true });
  } catch (e) { alert(`「${f.name}」を 読めませんでした: ${e.message}`); nextInQueue(); }
}
let LAST_FIELD = "計算", LAST_TYPE = "int";
function openEdit(ed) { EDIT = ed; if ($("#screen-edit").classList.contains("hidden")) nav("edit"); else renderEdit(ed); }
function renderEdit(ed) {
  if (!ed) { back(); return; }
  const f = $("#edit-form"), it = ed.item;
  $("#edit-title").textContent = ed.isNew ? `写真の 答えを 登録${QUEUE.length ? `(あと ${QUEUE.length}まい)` : ""}` : "この問題を 直す";
  $("#edit-img").src = urlOf(ed.photo);
  f.field.value = it.tags[0] || "計算"; f.sub.value = it.tags[1] || ""; f.answerType.value = it.answerType || "int";
  f.answerText.value = it.answerType === "choice" ? (it.answer + 1) : it.answerType === "self" || it.answer == null ? "" : formatAnswer(it.answer, it.answerType, "");
  f.choicesText.value = (it.choices || []).join(","); f.unit.value = it.unit || "";
  for (const k of ["hint1", "hint2", "exp", "essence", "pattern", "memo"]) f[k].value = it[k] || "";
  f.templateId.value = it.templateId || "";
  $("#exp-photo").value = ""; setExpPreview(ed.expPhoto);
  $("#edit-errors").className = "import-result hidden"; $("#edit-errors").textContent = "";
  $("#btn-edit-skip").classList.toggle("hidden", !ed.isNew); $("#btn-edit-delete").classList.toggle("hidden", ed.isNew);
  $("#edit-progress").textContent = ed.isNew && QUEUE.length ? `保存すると つぎの写真(あと ${QUEUE.length}まい)に すすみます` : "";
  typeChanged();
}
function setExpPreview(blob) { const box = $("#exp-preview"); box.classList.toggle("hidden", !blob); if (blob) box.querySelector("img").src = urlOf(blob); }
function typeChanged() {
  const ty = $("#edit-form").answerType.value;
  $("#answer-help").textContent = ANSWER_HELP[ty] || "";
  $("#lab-answer").classList.toggle("hidden", ty === "self"); $("#lab-choices").classList.toggle("hidden", ty !== "choice"); $("#lab-unit").classList.toggle("hidden", ty === "choice" || ty === "time");
}
async function saveEdit(e) {
  e.preventDefault(); if (!EDIT) return;
  const f = $("#edit-form"); const get = k => f[k].value;
  const v = validateMeta({ field: get("field"), sub: get("sub"), answerType: get("answerType"), answerText: get("answerText"), unit: get("unit"), choicesText: get("choicesText"), hint1: get("hint1"), hint2: get("hint2"), exp: get("exp"), essence: get("essence"), pattern: get("pattern"), templateId: get("templateId"), memo: get("memo") });
  const box = $("#edit-errors");
  if (!v.ok) { box.className = "import-result err"; box.textContent = v.errors.join("\n"); box.scrollIntoView({ block: "center" }); return; }
  const item = Object.assign({}, v.item, { id: EDIT.item.id, created: EDIT.item.created || Date.now(), photo: EDIT.photo, thumb: EDIT.thumb || null, expPhoto: EDIT.expPhoto || null });
  try { await putPhoto(item); } catch (err) { box.className = "import-result err"; box.textContent = "保存できませんでした: " + err.message; return; }
  LAST_FIELD = item.tags[0]; LAST_TYPE = item.answerType;
  await refreshPhotos();
  if (EDIT.isNew) { EDIT = null; if (QUEUE.length) nextInQueue(); else back(); }
  else { EDIT = null; back(); }
}

// ---------- 保護者画面 ----------
function openParent() { nav("parent"); }
function pinOk() {
  const v = $("#pin").value; if (!/^\d{4}$/.test(v)) { alert("4桁の数字を入れてください"); return; }
  if (!state.pin) { state.pin = v; save(); } else if (v !== state.pin) { alert("暗証番号が違います"); return; }
  $("#parent-lock").classList.add("hidden"); $("#parent-body").classList.remove("hidden"); renderParent();
}
const fmtMs = ms => `${Math.floor(ms / 60000)}分${Math.round(ms % 60000 / 1000)}秒`;
const fmtDate = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const pidLabel = pid => { if (!pid.startsWith("imp:")) return pid; const p = PHOTOS.find(x => "imp:" + x.id === pid); return p ? `📷 ${p.tags.join("・")}${p.memo ? " " + p.memo : ""}` : pid; };
function renderParent() {
  const s = hist.summarize();
  $("#p-days").innerHTML = Object.entries(s.byDay).sort().reverse().slice(0, 14).map(([d, v]) => `<div><span>${d}</span><span>${v.total}問 / 正解${v.ok + v.ok_hint}(ヒント${v.ok_hint}) 不正解${v.ng} 解説${v.exp} 離脱${v.abandoned}</span></div>`).join("") || "<div>まだ記録がありません</div>";
  $("#p-fields").innerHTML = Object.entries(s.byField).map(([f, v]) => `<div><span>${f}</span><span>${v.rate == null ? "―" : v.rate + "%"}(${v.total}問)</span></div>`).join("") || "<div>―</div>";
  $("#p-abandoned").innerHTML = s.abandoned.slice(-20).reverse().map(a => `<div><span>${fmtDate(a.t)}</span><span class="mono">${esc(pidLabel(a.pid))}</span></div>`).join("") || "<div>なし</div>";
  $("#p-slow").innerHTML = s.slow.slice(0, 20).map(a => `<div><span>${fmtDate(a.t)} ${fmtMs(a.ms)}</span><span class="mono">${esc(pidLabel(a.pid))}</span></div>`).join("") || "<div>なし</div>";
}
function backup() { const blob = new Blob([hist.exportJSON()], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `neko-sansu-photo-log-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }

// ---------- 起動 ----------
function titleGreeting() {
  setCats("sleep"); $("#cat-title").innerHTML = renderCat("idle");
  const pend = (Q && !Q.ended) ? { pid: Q.pid } : hist.pendingStart();
  if (pend && (pend.pid.startsWith("imp:") ? PHOTOS.some(p => "imp:" + p.id === pend.pid) : TPL[pend.pid.split("#")[0]])) {
    $("#title-bubble").innerHTML = `おかえりにゃ。さっきの つづきから やる? <br><button id="btn-resume" class="primary" style="margin-top:6px">つづきから</button>`;
    $("#btn-resume").onclick = () => { if (Q && Q.pid === pend.pid && !Q.ended) nav("quiz"); else { Q = null; nav("quiz"); startQuestion(pend.pid); } };
  } else $("#title-bubble").textContent = state.name ? `${state.name}だにゃ。きょうも いっしょに がんばるにゃ` : "はじめまして。名前を つけてほしいにゃ";
}
function buildEditSelects() {
  const f = $("#edit-form");
  f.field.innerHTML = PB_FIELDS.map(x => `<option>${x}</option>`).join("");
  f.answerType.innerHTML = PB_TYPES.map(x => `<option value="${x}">${PB_TYPE_LABEL[x]}</option>`).join("");
  f.templateId.innerHTML = `<option value="">なし</option>` + Object.values(TPL).map(t => `<option value="${t.id}">${esc(t.title)}(${esc(t.tags.join("・"))})</option>`).join("");
  const fillSubs = () => { $("#sub-list").innerHTML = (SUBS[f.field.value] || []).map(x => `<option value="${x}">`).join(""); };
  f.field.onchange = fillSubs; fillSubs();
  f.answerType.onchange = typeChanged;
}
window.addEventListener("DOMContentLoaded", async () => {
  await refreshPhotos();
  buildEditSelects();
  nav("title", true);
  $("#btn-start").onclick = () => { if (!state.name) { nav("name"); return; } if (Q && !Q.ended) { nav("quiz"); return; } Q = null; nav("quiz"); };
  $("#btn-name-ok").onclick = () => { const v = $("#cat-name").value.trim(); if (!v) return; state.name = v; save(); back(); };
  $("#btn-rename").onclick = () => { $("#cat-name").value = state.name; nav("name"); };
  $("#btn-zukan").onclick = () => nav("zukan");
  $("#btn-seiseki").onclick = () => nav("seiseki");
  $("#btn-import").onclick = () => nav("import");
  $("#photo-camera").onchange = e => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ""; };
  $("#photo-files").onchange = e => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ""; };
  $$('input[name=mix]').forEach(r => r.onchange = () => { state.mix = r.value; save(); });
  $("#btn-import-clear").onclick = async () => { if (confirm(`取りこんだ写真(${PHOTOS.length}問)を すべて消しますか?`)) { await clearPhotos(); dropUrls(); await refreshPhotos(); renderImport(); } };
  $("#edit-form").onsubmit = saveEdit;
  $("#btn-edit-skip").onclick = () => { EDIT = null; if (QUEUE.length) nextInQueue(); else back(); };
  $("#btn-edit-delete").onclick = async () => { if (!EDIT || !confirm("この問題を 消しますか?")) return; await deletePhoto(EDIT.item.id); state.wrong = state.wrong.filter(w => w.pid !== "imp:" + EDIT.item.id); save(); EDIT = null; await refreshPhotos(); back(); };
  $("#exp-photo").onchange = async e => { const f = e.target.files[0]; if (!f || !EDIT) return; try { EDIT.expPhoto = (await shrinkImage(f, 1600, 0.85)).blob; setExpPreview(EDIT.expPhoto); } catch (err) { alert(err.message); } e.target.value = ""; };
  $("#btn-exp-remove").onclick = () => { if (EDIT) { EDIT.expPhoto = null; setExpPreview(null); } };
  $("#btn-edit-zoom").onclick = () => { if (EDIT) openLightbox(urlOf(EDIT.photo)); };
  $("#btn-zoom").onclick = () => { if (Q && Q.photo) openLightbox(urlOf(Q.photo)); };
  $("#q-photo-img").onclick = () => { if (Q && Q.photo) openLightbox(urlOf(Q.photo)); };
  $("#lb-close").onclick = closeLightbox; $("#lb-zoom").onclick = () => $("#lightbox").classList.toggle("zoom2");
  $("#btn-submit").onclick = submit;
  $("#btn-self-ok").onclick = () => selfResult(true); $("#btn-self-ng").onclick = () => selfResult(false);
  $("#btn-hint1").onclick = () => showHint(1); $("#btn-hint2").onclick = () => showHint(2); $("#btn-exp").onclick = showExp; $("#btn-real").onclick = showReal; $("#btn-giveup").onclick = giveUp;
  $("#btn-similar").onclick = () => startQuestion(newPid(Q.templateId));
  $("#btn-next").onclick = () => startQuestion();
  $$(".btn-home").forEach(b => b.onclick = () => { if (b.closest("#screen-quiz")) { leaveQuestion(); Q = null; qCount = 0; } back(); });
  $$(".btn-back").forEach(b => b.onclick = () => { if (b.closest("#screen-edit")) EDIT = null; back(); });
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
