/* 弥花さんの算数アプリ ― ラガマフィンといっしょ */
"use strict";

const NAME = "弥花";
const STORE = "sansu-mihana-v1";

// ---------- ほめ言葉・はげまし言葉 ----------
const PRAISE = [
  `やったね、${NAME}ちゃん！さすが！`,
  `${NAME}ちゃん、天才にゃ〜！`,
  `すごいすごい！ラガマフィンもびっくりだにゃ`,
  `その調子、その調子！${NAME}ちゃんならできるって思ってたにゃ`,
  `ピンポーン！${NAME}ちゃんの頭、ぴかぴかに光ってるにゃ`,
  `かんぺき！いまのはきれいな解き方だったにゃ`,
  `${NAME}ちゃん、こんなの朝ごはん前だにゃ〜`,
  `おおー！しっぽがぶんぶんしちゃうにゃ`,
  `見た見た！ぜんぶ見てたにゃ。${NAME}ちゃんえらい！`,
  `にゃんと！一発正解だにゃ`
];
const ENCOURAGE = [
  `おしい！もう一回いっしょに考えてみようにゃ`,
  `だいじょうぶ、だいじょうぶ。次はきっとできるにゃ`,
  `これはちょっとむずかしい問題だったにゃ。解き方いっしょに見てみよ？`,
  `まちがえた問題は、いちばん強くなれる問題だにゃ`,
  `${NAME}ちゃん、ここまでよくがんばってるにゃ。ひと息つこ`,
  `にゃるほど…ラガマフィンもここは迷ったにゃ`,
  `answerを見るのはズルじゃないにゃ。かしこい作戦だにゃ`,
  `いまのでコツが1こ増えたにゃ。つぎ会ったら勝てるにゃ！`
];
const COMBO = [null, null, null,
  `3れんぞく！キラキラしてきたにゃ〜✨`,
  `4れんぞく！${NAME}ちゃん止まらないにゃ`,
  `5れんぞく！もうにゃんでも解けるにゃ🌟`
];
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------- 保存データ ----------
const defaultState = () => ({
  points: 0, plays: 0, stamps: 0,
  wrongIds: [],
  field: { calc:{o:0,x:0}, number:{o:0,x:0}, figure:{o:0,x:0}, word:{o:0,x:0} },
  badges: []
});
let state = load();
function load(){
  try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE)||"{}")); }
  catch(e){ return defaultState(); }
}
function save(){ try { localStorage.setItem(STORE, JSON.stringify(state)); } catch(e){} }

// ---------- 出題ロジック ----------
const weightOf = q => q.mark === "x" ? 5 : q.mark === "-" ? 4 : 1;

function weightedPick(pool, exclude){
  const cand = pool.filter(q => q.id !== exclude);
  const list = cand.length ? cand : pool;
  const total = list.reduce((s,q)=>s+weightOf(q),0);
  let r = Math.random()*total;
  for (const q of list){ r -= weightOf(q); if (r <= 0) return q; }
  return list[list.length-1];
}

function buildSession(mode){
  if (mode === "order") return QUESTIONS.slice();
  if (mode === "again"){
    const list = QUESTIONS.filter(q => state.wrongIds.includes(q.id));
    return list.length ? shuffle(list) : [];
  }
  const n = 10, out = [];
  let last = null;
  const used = new Set();
  while (out.length < n){
    const pool = QUESTIONS.filter(q => !used.has(q.id));
    const src = pool.length ? pool : QUESTIONS;
    const q = weightedPick(src, last);
    out.push(q); used.add(q.id); last = q.id;
  }
  return out;
}
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

// ---------- 採点 ----------
function normalize(s){
  return String(s)
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0)-0xFEE0)) // 全角→半角
    .replace(/[，、,]/g, "")
    .replace(/\s/g, "")
    .replace(/。$/, "")
    .trim();
}
const UNIT_RE = /(cm3|cm2|cm³|cm²|km|cm|m|本|枚|円|度|通り|個|台|人|才|才)$/;
function stripUnit(s){ let t = s; let prev; do { prev = t; t = t.replace(UNIT_RE, ""); } while (t !== prev); return t; }

function parseFraction(s){
  let m = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (m) return parseFloat(m[1]) / parseFloat(m[2]);
  m = s.match(/^(-?\d+)と(\d+)\/(\d+)$/); // 帯分数
  if (m) return parseInt(m[1],10) + parseInt(m[2],10)/parseInt(m[3],10);
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  return NaN;
}

function judge(input, q){
  const s = stripUnit(normalize(input));
  if (s === "") return false;
  const got = parseFraction(s);
  const want = parseFraction(q.ans);
  if (isNaN(got) || isNaN(want)) return false;
  return Math.abs(got - want) < 1e-9;
}

// ---------- 画面 ----------
const $ = sel => document.querySelector(sel);
const screens = ["title","modes","quiz","result"];
function show(id){ screens.forEach(s => $("#screen-"+s).classList.toggle("hidden", s !== id)); window.scrollTo(0,0); }

// ラガマフィンのふきだし＆リアクション
const cat = () => $("#cat");
function say(text, mood){
  const b = $("#bubble");
  b.innerHTML = text;
  b.classList.remove("hidden");
  cat().dataset.mood = mood || "idle";
  if (mood === "happy"){
    cat().classList.remove("jump"); void cat().offsetWidth; cat().classList.add("jump");
  }
}
function sparkle(){
  const box = $("#sparkles");
  box.innerHTML = "";
  for (let i=0;i<14;i++){
    const s = document.createElement("span");
    s.textContent = pick(["✨","⭐","💫","🌟"]);
    s.style.left = Math.random()*100 + "%";
    s.style.animationDelay = (Math.random()*0.4)+"s";
    box.appendChild(s);
  }
  setTimeout(()=>box.innerHTML="", 1400);
}

// ---------- セッション状態 ----------
let S = null;

function startSession(mode){
  const list = buildSession(mode);
  if (!list.length){
    alert("まだ「まちがえた問題」がないにゃ。ほかのモードで遊んでみて！");
    return;
  }
  S = { mode, list, i:0, correct:0, points:0, combo:0, bestCombo:0, missed:[], revenge:false, answered:false };
  show("quiz");
  renderQuestion();
}

function renderQuestion(){
  const q = S.list[S.i];
  S.answered = false;
  $("#q-progress").textContent = `${S.i+1} / ${S.list.length}`;
  $("#q-badge").textContent = (S.revenge ? "🔥リベンジタイム " : "") + FIELDS[q.field].emoji + FIELDS[q.field].name;
  $("#q-title").textContent = q.title || (q.big ? "だい" + q.big + "もん" : "");
  $("#q-setup").innerHTML = q.setup || "";
  $("#q-setup").classList.toggle("hidden", !q.setup);
  $("#q-text").textContent = q.q;
  $("#q-unit").textContent = q.type === "frac" ? "（分数は 1/4 のように書いてにゃ）" : (q.unit ? "（たんいはつけてもつけなくてもOK）" : "");
  const inp = $("#answer");
  inp.value = ""; inp.disabled = false;
  $("#btn-submit").disabled = false;
  $("#feedback").className = "feedback hidden";
  $("#feedback").innerHTML = "";
  $("#btn-next").classList.add("hidden");
  $("#hint-box").classList.add("hidden");
  $("#btn-hint").classList.remove("hidden");
  $("#combo").textContent = S.combo >= 2 ? `🔥 ${S.combo}れんぞく` : "";
  $("#pts").textContent = `⭐ ${S.points}`;
  say(pick([`いっしょにがんばろにゃ！`, `${NAME}ちゃん、いくにゃ〜`, `ふむふむ、この問題かにゃ`, `落ち着いていこうにゃ`]), "idle");
  inp.focus();
}

function submit(){
  if (S.answered) return;
  const q = S.list[S.i];
  const val = $("#answer").value;
  if (normalize(val) === ""){ say("まだ答えが書けてないにゃ〜", "idle"); return; }
  S.answered = true;
  $("#answer").disabled = true;
  $("#btn-submit").disabled = true;
  $("#btn-hint").classList.add("hidden");

  const ok = judge(val, q);
  const fb = $("#feedback");
  if (ok){
    S.correct++; S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
    const gain = 10 + (S.combo >= 3 ? 5 : 0);
    S.points += gain; state.points += gain;
    state.field[q.field].o++;
    state.wrongIds = state.wrongIds.filter(id => id !== q.id);
    fb.className = "feedback ok";
    fb.innerHTML = `<div class="mark">⭕️</div><div>せいかい！ <b>${q.ans}</b>${q.unit?unitLabel(q.unit):""} ＋${gain}ポイント</div>`;
    say(COMBO[Math.min(S.combo, COMBO.length-1)] || pick(PRAISE), "happy");
    if (S.combo >= 3) sparkle();
  } else {
    S.combo = 0;
    state.field[q.field].x++;
    if (!state.wrongIds.includes(q.id)) state.wrongIds.push(q.id);
    if (!S.revenge && !S.missed.includes(q.id)) S.missed.push(q.id);
    fb.className = "feedback ng";
    fb.innerHTML = `<div class="mark">💡</div><div>こたえは <b>${q.ans}</b>${q.unit?unitLabel(q.unit):""}<div class="exp"><b>ラガマフィン先生の解説</b><br>${q.exp}</div></div>`;
    say(pick(ENCOURAGE), "cheer");
  }
  $("#pts").textContent = `⭐ ${S.points}`;
  $("#combo").textContent = S.combo >= 2 ? `🔥 ${S.combo}れんぞく` : "";
  $("#btn-next").classList.remove("hidden");
  $("#btn-next").focus();
  save();
}
function unitLabel(u){ return { cm2:"cm²", cm3:"cm³" }[u] || u; }

function next(){
  S.i++;
  if (S.i < S.list.length){ renderQuestion(); return; }
  if (!S.revenge && S.missed.length){
    S.revenge = true;
    S.list = QUESTIONS.filter(q => S.missed.includes(q.id));
    S.i = 0;
    say(`さいごに<b>リベンジタイム</b>にゃ！さっきの問題、もう一回だけ挑戦にゃ🔥`, "happy");
    setTimeout(renderQuestion, 900);
    return;
  }
  finish();
}

function finish(){
  state.plays++; state.stamps = Math.min(state.stamps + 1, 30);
  updateBadges();
  save();
  const total = S.mode === "order" ? QUESTIONS.length : S.list.length;
  $("#r-count").textContent = `${S.correct}問せいかい`;
  $("#r-points").textContent = `⭐ ${S.points}ポイント`;
  $("#r-combo").textContent = `🔥 さいこう ${S.bestCombo}れんぞく`;
  $("#r-msg").innerHTML = S.correct === 0
    ? `きょうもいっしょに考えられて、ラガマフィンうれしかったにゃ。また遊ぼにゃ〜`
    : `${NAME}ちゃん、きょうもよくがんばったにゃ！ラガマフィンのポイントは合計 <b>${state.points}</b> だにゃ🐈`;
  renderStamps(); renderFields(); renderLevel();
  show("result");
  sparkle();
}

// ---------- 成長・バッジ・スタンプ ----------
function level(){ const p = state.points; return p>=600?4 : p>=350?3 : p>=150?2 : p>=50?1 : 0; }
const LEVEL_NAME = ["こねこラガマフィン","リボンつきラガマフィン","ぼうしラガマフィン","もふもふ王さまラガマフィン","でんせつのラガマフィン"];
function renderLevel(){
  const lv = level();
  document.querySelectorAll(".ragamuffin").forEach(el => el.dataset.level = lv);
  const el = $("#r-level"); if (el) el.textContent = `🐈 ${LEVEL_NAME[lv]}`;
  const t = $("#title-level"); if (t) t.textContent = LEVEL_NAME[lv];
}
function renderStamps(){
  const box = $("#stamps"); if (!box) return;
  box.innerHTML = "";
  for (let i=0;i<10;i++){
    const d = document.createElement("div");
    d.className = "stamp" + (i < state.stamps % 10 || (state.stamps>0 && state.stamps%10===0 && state.stamps>i) ? " on" : "");
    d.textContent = d.className.includes("on") ? "🐾" : "";
    box.appendChild(d);
  }
  $("#stamp-count").textContent = `あそんだ回数：${state.plays}回`;
}
function updateBadges(){
  Object.keys(FIELDS).forEach(f => {
    const s = state.field[f], n = s.o + s.x;
    if (n >= 5 && s.o / n >= 0.7 && !state.badges.includes(f)) state.badges.push(f);
  });
}
function renderFields(){
  document.querySelectorAll("#fields, #fields2").forEach(box => fillFields(box));
}
function fillFields(box){
  box.innerHTML = "";
  Object.entries(FIELDS).forEach(([k, f]) => {
    const s = state.field[k], n = s.o + s.x;
    const pct = n ? Math.round(s.o / n * 100) : 0;
    const el = document.createElement("div");
    el.className = "field";
    el.innerHTML = `<div class="field-head"><span>${f.emoji} ${f.name}</span>
      <span>${state.badges.includes(k) ? "🏅" : ""} ${n ? pct + "%" : "―"}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>`;
    box.appendChild(el);
  });
}

// ---------- ヒント ----------
function hint(){
  const q = S.list[S.i];
  $("#hint-box").innerHTML = `<b>ラガマフィンのヒント</b><br>${q.hint}`;
  $("#hint-box").classList.remove("hidden");
  say("ヒントだにゃ〜。ここまでわかれば、あと少しにゃ！", "idle");
}

// ---------- イベント ----------
window.addEventListener("DOMContentLoaded", () => {
  $("#btn-start").onclick = () => { show("modes"); renderStamps(); renderFields(); };
  document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => startSession(b.dataset.mode));
  $("#btn-submit").onclick = submit;
  $("#btn-next").onclick = next;
  $("#btn-hint").onclick = hint;
  $("#answer").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); S.answered ? next() : submit(); }});
  document.querySelectorAll(".btn-home").forEach(b => b.onclick = () => { show("title"); say(`また遊ぼうにゃ、${NAME}ちゃん！`, "idle"); });
  $("#btn-again").onclick = () => startSession(S ? S.mode : "weak");
  $("#btn-reset").onclick = () => {
    if (confirm("ポイントやスタンプをぜんぶ最初にもどすにゃ。いい？")){ state = defaultState(); save(); renderStamps(); renderFields(); renderLevel(); }
  };
  renderLevel(); renderStamps(); renderFields();
  say(`ようこそ、${NAME}ちゃん！きょうも算数であそぼにゃ🐈`, "idle");
});
