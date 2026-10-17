/* マンスリーテスト10月号(国語)アプリ ― ことだま☆5といっしょ */
"use strict";

const NAME = "弥花";
const STORE = "kokugo-monthly10-v1";

const FANSA = ["ウインク😉","指ハート🫰","ピース✌️","手をふってくれた👋","ハイタッチ🙌","ガッツポーズ💪","ハートポーズ🫶"];
const COMBO = [null, null, null,
  "3れんぞく！ペンライトが光ってる〜✨",
  "4れんぞく！会場がざわついてる…！",
  "5れんぞく！{n}ちゃん、もうセンターだよ🌟"
];
const pick = a => a[Math.floor(Math.random() * a.length)];
const fill = s => s.replace(/\{n\}/g, NAME);

// ---------- 保存データ ----------
const defaultState = () => ({
  oshi: "ren", points: 0, plays: 0, stamps: 0, wrongIds: [],
  field: { 2:{o:0,x:0}, 3:{o:0,x:0}, 4:{o:0,x:0}, 5:{o:0,x:0}, 6:{o:0,x:0} }
});
let state = load();
function load(){
  try {
    const s = Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE) || "{}"));
    if (!MEMBERS[s.oshi]) s.oshi = "ren";
    return s;
  } catch(e){ return defaultState(); }
}
function save(){ try { localStorage.setItem(STORE, JSON.stringify(state)); } catch(e){} }

// ---------- アイドルのイラスト(SVGのみ・画像ファイルなし) ----------
const HAIR = [
  "M34 52 Q44 30 80 35 Q70 45 58 46 Q50 55 38 60Z",                                   // サイドに流す
  "M34 54 Q44 32 60 34 Q52 46 44 54Z M86 54 Q76 32 60 34 Q68 46 76 54Z",              // センター分け
  "M32 56 L38 36 L45 48 L51 31 L58 45 L66 30 L70 45 L79 35 L81 50 L88 56 Q88 28 60 25 Q32 28 32 56Z", // ツンツン
  "M32 58 Q35 38 47 47 Q52 35 61 45 Q68 35 75 47 Q84 39 88 58 Q90 26 60 24 Q30 26 32 58Z", // ふわふわ
  "M30 74 Q24 28 60 24 Q96 28 90 74 Q86 48 74 38 Q60 50 40 46 Q33 54 30 74Z"          // 長め
];
function idolSVG(key){
  const m = MEMBERS[key], skin = "#ffe4d2";
  const eye = x => `<ellipse cx="${x}" cy="66" rx="5.6" ry="7" fill="#2a2140"/>
    <ellipse cx="${x}" cy="67.5" rx="4" ry="4.8" fill="${m.color}"/>
    <circle cx="${x+2}" cy="63" r="2" fill="#fff"/><circle cx="${x-2}" cy="70" r="1" fill="#fff"/>`;
  const glasses = key === "minato"
    ? `<g fill="none" stroke="#5a4a6a" stroke-width="1.8"><circle cx="49" cy="66" r="9"/><circle cx="71" cy="66" r="9"/><path d="M58 65 h4"/></g>` : "";
  return `<svg class="idol-svg" viewBox="0 0 120 132" aria-hidden="true">
    <path d="M14 132 Q18 100 60 97 Q102 100 106 132Z" fill="${m.color}"/>
    <path d="M47 98 L60 115 L73 98Z" fill="#fff"/>
    <text x="34" y="124" font-size="12" fill="#fff">★</text>
    <g class="head">
      <rect x="53" y="84" width="14" height="16" fill="${skin}"/>
      <path d="M30 70 Q26 24 60 23 Q94 24 90 70 Q92 40 60 34 Q28 40 30 70Z" fill="${m.hair}"/>
      <circle cx="33" cy="68" r="5" fill="${skin}"/><circle cx="87" cy="68" r="5" fill="${skin}"/>
      <ellipse cx="60" cy="63" rx="27" ry="29" fill="${skin}"/>
      <path d="M31 60 Q28 26 60 25 Q92 26 89 60 L86 50 Q60 34 34 50Z" fill="${m.hair}"/>
      <path d="${HAIR[m.style]}" fill="${m.hair}"/>
      <path d="M43 57 q6 -3 11 0 M66 57 q5 -3 11 0" stroke="#4a3550" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <g class="e-open">${eye(49)}${eye(71)}</g>
      <g class="e-happy" stroke="#2a2140" stroke-width="2.6" fill="none" stroke-linecap="round">
        <path d="M43 67 Q49 60 55 67"/><path d="M65 67 Q71 60 77 67"/></g>
      ${glasses}
      <ellipse cx="42" cy="76" rx="5" ry="2.6" fill="#ff9fb4" opacity=".55"/>
      <ellipse cx="78" cy="76" rx="5" ry="2.6" fill="#ff9fb4" opacity=".55"/>
      <path class="m-norm" d="M54 80 Q60 85 66 80" stroke="#c0566b" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path class="m-happy" d="M52 79 Q60 91 68 79Z" fill="#e8667a"/>
      <path d="M31 70 Q34 84 49 84" stroke="#333" stroke-width="1.8" fill="none"/><circle cx="50" cy="84" r="2.4" fill="#333"/>
    </g>
  </svg>`;
}
function paintFace(el, key){ el.innerHTML = idolSVG(key); }

// ---------- 出題ロジック ----------
const weightOf = q => state.wrongIds.includes(q.id) ? 5 : 3;
function weightedPick(list){
  const total = list.reduce((s,q)=>s+weightOf(q),0);
  let r = Math.random()*total;
  for (const q of list){ r -= weightOf(q); if (r <= 0) return q; }
  return list[list.length-1];
}
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function buildSession(mode){
  if (mode === "order") return QUESTIONS.slice();
  if (mode === "again") return shuffle(QUESTIONS.filter(q => state.wrongIds.includes(q.id)));
  if (mode.startsWith("big")) return QUESTIONS.filter(q => q.big === +mode.slice(3));
  const out = [], pool = QUESTIONS.slice();
  while (out.length < 10 && pool.length){
    const q = weightedPick(pool);
    out.push(q); pool.splice(pool.indexOf(q), 1);
  }
  // 詩の問題はまとめて読めるよう、大問順にならべる
  return out.sort((a,b) => QUESTIONS.indexOf(a) - QUESTIONS.indexOf(b));
}

// ---------- 採点 ----------
const normalize = s => String(s).normalize("NFKC").replace(/[\s「」『』。、.,]/g, "");

// ---------- 画面 ----------
const $ = sel => document.querySelector(sel);
const screens = ["title","modes","quiz","result"];
function show(id){ screens.forEach(s => $("#screen-"+s).classList.toggle("hidden", s !== id)); window.scrollTo(0,0); }

function setOshi(key){
  state.oshi = key; save();
  const m = MEMBERS[key];
  document.documentElement.style.setProperty("--oshi", m.color);
  document.documentElement.style.setProperty("--oshi-light", m.light);
  paintFace($("#oshi"), key);
  document.querySelectorAll(".member").forEach(b => b.classList.toggle("on", b.dataset.key === key));
}
function say(text, mood){
  const m = MEMBERS[state.oshi];
  const b = $("#bubble");
  b.innerHTML = `<b class="who">${m.name}</b>${fill(text)}`;
  b.classList.remove("hidden", "fade");
  clearTimeout(say.t); say.t = setTimeout(() => b.classList.add("fade"), 4500); // スマホではふきだしが問題にかぶらないよう消す
  const o = $("#oshi");
  o.classList.toggle("happy", mood === "happy");
  if (mood === "happy"){ o.classList.remove("jump"); void o.offsetWidth; o.classList.add("jump"); }
}
function fansa(){
  const f = $("#fansa");
  f.textContent = pick(FANSA);
  f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
}
function sparkle(color){
  const box = $("#sparkles");
  box.innerHTML = "";
  for (let i=0;i<16;i++){
    const s = document.createElement("span");
    s.textContent = pick(["★","♥","✦","♪"]);
    s.style.color = color || MEMBERS[state.oshi].color;
    s.style.left = Math.random()*100 + "%";
    s.style.animationDelay = (Math.random()*0.4)+"s";
    box.appendChild(s);
  }
  setTimeout(()=>box.innerHTML="", 1500);
}

// ---------- セッション ----------
let S = null;

function startSession(mode){
  const list = buildSession(mode);
  if (!list.length){ alert("まだ「まちがえた問題」がないよ！ほかのモードであそんでね"); return; }
  S = { mode, list, i:0, correct:0, points:0, combo:0, bestCombo:0, missed:[], revenge:false, answered:false };
  show("quiz");
  renderQuestion();
}

function renderQuestion(){
  const q = S.list[S.i], m = MEMBERS[q.member];
  S.answered = false; S.sel = []; S.lines = [];
  const card = $("#screen-quiz .card");
  card.style.setProperty("--c", m.color); card.style.setProperty("--cl", m.light);
  $("#q-progress").textContent = `${S.i+1} / ${S.list.length}`;
  $("#q-badge").textContent = (S.revenge ? "🔁アンコール " : "") + FIELDS[q.big].emoji + FIELDS[q.big].name;
  paintFace($("#q-face"), q.member);
  $("#q-presenter").textContent = `担当：${m.name}`;
  $("#q-title").textContent = `だい${q.big}もん ${q.no}`;
  $("#q-poem").classList.toggle("hidden", !q.poem);
  if (q.poem) renderPoem(q.type === "lines");
  $("#q-setup").innerHTML = q.setup || "";
  $("#q-setup").classList.toggle("hidden", !q.setup);
  $("#q-text")[q.html ? "innerHTML" : "textContent"] = q.q;
  $("#feedback").className = "feedback hidden"; $("#feedback").innerHTML = "";
  $("#btn-next").classList.add("hidden");
  $("#hint-box").classList.add("hidden");
  $("#btn-hint").classList.remove("hidden");
  $("#combo").textContent = S.combo >= 2 ? `🔥 ${S.combo}れんぞく` : "";
  $("#pts").textContent = `💖 ${S.points}`;
  RENDER[q.type](q, $("#q-area"));
  if (q.member === state.oshi) say(pick(["この問題はぼくの担当！見ててね","推しの担当問題だよ💖", "ここはまかせて！いっしょに解こう"]).replace("ぼく", q.member === "ren" ? "オレ" : "ぼく"), "idle");
  else say(pick(["いっしょにがんばろう！", "{n}ちゃん、いくよ〜", "落ち着いて、問題をよく読もう", `つぎは${m.name}の担当問題だね`]), "idle");
}

// 詩のたて書き表示(lines のときは行をタップできる)
function renderPoem(tappable){
  const html = POEM.map((t, i) => {
    let s = t;
    if (i === 0) s = s.replace("地平線", `<span class="ul">①地平線</span>`);
    if (i === 4) s = s.replace("ぼくは収縮する", `<span class="ul">②ぼくは収縮する</span>`);
    return `<span class="pl" data-n="${i+1}"><span class="ln">${i+1}</span>${s}</span>`;
  }).join("");
  $("#q-poem").innerHTML = `<div class="poem${tappable ? " tappable" : ""}">
    <span class="pt"><span class="box"></span></span><span class="au">村野四郎</span>${html}</div>`;
  const wrap = $("#q-poem");
  wrap.scrollLeft = wrap.scrollWidth; // たて書きは右(1行目)から見せる
}

// ---------- 問題タイプごとの表示 ----------
const RENDER = {
  choice(q, area){
    area.innerHTML = `<div class="choices${q.long ? " long" : ""}${q.grid ? " grid" : ""}">` +
      q.choices.map(([k,t]) => `<button class="choice" data-k="${k}"><b>${k}</b><span>${t}</span></button>`).join("") + `</div>`;
    area.querySelectorAll(".choice").forEach(b => b.onclick = () => {
      if (S.answered) return;
      const ok = b.dataset.k === q.ans;
      area.querySelectorAll(".choice").forEach(c => {
        c.disabled = true;
        if (c.dataset.k === q.ans) c.classList.add("right");
      });
      if (!ok) b.classList.add("wrong");
      result(ok, q);
    });
  },
  multi(q, area){
    area.innerHTML = `<div class="choices">` +
      q.choices.map(([k,t]) => `<button class="choice" data-k="${k}"><b>${k}</b><span>${t}</span></button>`).join("") +
      `</div><p class="mini">${q.pick}つえらんでね</p><button id="btn-decide" class="btn primary" disabled>けってい！</button>`;
    const dec = $("#btn-decide");
    area.querySelectorAll(".choice").forEach(b => b.onclick = () => {
      if (S.answered) return;
      const k = b.dataset.k;
      if (S.sel.includes(k)) S.sel = S.sel.filter(x => x !== k);
      else if (S.sel.length < q.pick) S.sel.push(k);
      area.querySelectorAll(".choice").forEach(c => c.classList.toggle("on", S.sel.includes(c.dataset.k)));
      dec.disabled = S.sel.length !== q.pick;
    });
    dec.onclick = () => {
      const ok = S.sel.slice().sort().join() === q.ans.slice().sort().join();
      area.querySelectorAll(".choice").forEach(c => {
        c.disabled = true; c.classList.remove("on");
        if (q.ans.includes(c.dataset.k)) c.classList.add("right");
        else if (S.sel.includes(c.dataset.k)) c.classList.add("wrong");
      });
      dec.classList.add("hidden");
      result(ok, q);
    };
  },
  text(q, area){
    area.innerHTML = `<div class="answer-row"><input id="answer" type="text" autocomplete="off" placeholder="こたえを入力">
      <button id="btn-submit" class="btn primary">こたえる</button></div>
      <p class="mini">${q.ime ? "漢字でもひらがな（読み方）でもOK" : ""}</p><div id="near"></div>`;
    const inp = $("#answer");
    const go = () => {
      if (S.answered) return;
      const v = normalize(inp.value);
      if (!v){ say("まだ答えが書けてないよ〜", "idle"); return; }
      if (q.near && q.near[v] !== undefined){
        $("#near").innerHTML = `<div class="near">🤔 ${q.near[v]}</div>`;
        say("おしい！もうひと工夫してみて", "idle");
        return;
      }
      inp.disabled = true; $("#btn-submit").disabled = true;
      result(q.accept.map(normalize).includes(v), q);
    };
    $("#btn-submit").onclick = go;
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing){ e.preventDefault(); go(); } });
    inp.focus();
  },
  lines(q, area){
    area.innerHTML = `<p class="lines-status" id="lines-status"></p>
      <div class="row"><button id="btn-lines-reset" class="btn ghost small">えらびなおす</button>
      <button id="btn-decide" class="btn primary" disabled>けってい！</button></div>`;
    const update = () => {
      const [a, b] = S.lines;
      $("#lines-status").textContent = a == null ? "👉 二つ目の連の「はじめの行」をタップ"
        : b == null ? `はじめ：${a}行目　👉 つぎは「おわりの行」をタップ` : `${a}行目 〜 ${b}行目`;
      document.querySelectorAll(".poem .pl").forEach(el => {
        const n = +el.dataset.n;
        el.classList.toggle("edge", n === a || n === b);
        el.classList.toggle("sel", a != null && b != null && n > a && n < b);
      });
      $("#btn-decide").disabled = b == null;
    };
    document.querySelectorAll(".poem .pl").forEach(el => el.onclick = () => {
      if (S.answered) return;
      const n = +el.dataset.n;
      if (S.lines.length >= 2) S.lines = [];
      S.lines.push(n);
      S.lines.sort((x,y) => x-y);
      update();
    });
    $("#btn-lines-reset").onclick = () => { if (!S.answered){ S.lines = []; update(); } };
    $("#btn-decide").onclick = () => {
      $("#btn-decide").disabled = true; $("#btn-lines-reset").disabled = true;
      result(S.lines[0] === q.ans[0] && S.lines[1] === q.ans[1], q);
    };
    update();
  },
  kanji(q, area){
    const n = q.ans.length, box = 120;
    area.innerHTML = `<div class="pad-wrap"><canvas class="pad" id="pad"></canvas>
      <div class="row"><button id="btn-clear" class="btn ghost small">🧽 けす</button>
      <button id="btn-reveal" class="btn primary">こたえを見る</button></div>
      <p class="mini">紙に書いてからでもOK！</p></div><div id="reveal"></div>`;
    const cv = $("#pad"), dpr = window.devicePixelRatio || 1;
    const w = Math.min(n * box, area.clientWidth || n * box), h = Math.min(box, w / n);
    cv.style.width = w + "px"; cv.style.height = h + "px";
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    const guide = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#f0d6ea"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      const bw = w / n;
      for (let i = 0; i < n; i++){
        ctx.beginPath(); ctx.moveTo(bw*i + bw/2, 4); ctx.lineTo(bw*i + bw/2, h-4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bw*i + 4, h/2); ctx.lineTo(bw*(i+1) - 4, h/2); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.strokeStyle = "#d9b8d6"; ctx.lineWidth = 2;
      for (let i = 1; i < n; i++){ ctx.beginPath(); ctx.moveTo(bw*i, 0); ctx.lineTo(bw*i, h); ctx.stroke(); }
    };
    guide();
    let drawing = false;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.onpointerdown = e => { drawing = true; cv.setPointerCapture(e.pointerId); const [x,y] = pos(e);
      ctx.strokeStyle = "#3b2a4a"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x, y); };
    cv.onpointermove = e => { if (!drawing) return; const [x,y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
    cv.onpointerup = cv.onpointercancel = () => { drawing = false; };
    $("#btn-clear").onclick = guide;
    $("#btn-reveal").onclick = () => {
      $("#btn-reveal").classList.add("hidden");
      $("#btn-hint").classList.add("hidden");
      $("#reveal").innerHTML = `<p class="reveal center">${q.ans}<small>（${q.yomi}）</small></p>
        <p class="center mini">自分の字とくらべてみて。とめ・はね・はらいもチェック！</p>
        <div class="selfcheck"><button class="btn primary" id="sc-ok">⭕ 書けた！</button>
        <button class="btn ghost" id="sc-ng">❌ まちがえた</button></div>`;
      $("#sc-ok").onclick = () => { $("#reveal .selfcheck").remove(); result(true, q); };
      $("#sc-ng").onclick = () => { $("#reveal .selfcheck").remove(); result(false, q); };
    };
  }
};

// 表示用の答え
function ansLabel(q){
  if (q.type === "multi") return q.ans.join("・");
  if (q.type === "lines") return `${q.ans[0]}行目〜${q.ans[1]}行目`;
  if (q.type === "choice") return `${q.ans}（${q.choices.find(c => c[0] === q.ans)[1].replace(/<small>(.*)<\/small>/, "・$1")}）`;
  return q.ans;
}

function result(ok, q){
  S.answered = true;
  $("#btn-hint").classList.add("hidden");
  const fb = $("#feedback"), m = MEMBERS[q.member];
  if (ok){
    S.correct++; S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
    const gain = 10 + (S.combo >= 3 ? 5 : 0);
    S.points += gain; state.points += gain;
    state.field[q.big].o++;
    state.wrongIds = state.wrongIds.filter(id => id !== q.id);
    fb.className = "feedback ok";
    fb.innerHTML = `<div class="mark">⭕️</div><div>せいかい！ <b>${ansLabel(q)}</b>　＋${gain}💖
      <div class="exp"><b>${m.name}のワンポイント</b><br>${q.exp}</div></div>`;
    say(COMBO[Math.min(S.combo, COMBO.length-1)] || pick(MEMBERS[state.oshi].praise), "happy");
    fansa(); sparkle();
  } else {
    S.combo = 0;
    state.field[q.big].x++;
    if (!state.wrongIds.includes(q.id)) state.wrongIds.push(q.id);
    if (!S.revenge && !S.missed.includes(q.id)) S.missed.push(q.id);
    fb.className = "feedback ng";
    fb.innerHTML = `<div class="mark">💡</div><div>こたえは <b>${ansLabel(q)}</b>
      <div class="exp"><b>${m.name}の解説</b><br>${q.exp}</div></div>`;
    say(pick(MEMBERS[state.oshi].cheer), "idle");
  }
  $("#pts").textContent = `💖 ${S.points}`;
  $("#combo").textContent = S.combo >= 2 ? `🔥 ${S.combo}れんぞく` : "";
  $("#btn-next").classList.remove("hidden");
  $("#btn-next").focus({ preventScroll:true });
  fb.scrollIntoView({ behavior:"smooth", block:"nearest" });
  save();
}

function next(){
  S.i++;
  if (S.i < S.list.length){ renderQuestion(); window.scrollTo(0,0); return; }
  if (!S.revenge && S.missed.length){
    S.revenge = true;
    S.list = QUESTIONS.filter(q => S.missed.includes(q.id));
    S.i = 0;
    say("<b>アンコール！</b>さっきの問題、もう一回だけいっしょにやろう🔥", "happy");
    setTimeout(() => { renderQuestion(); window.scrollTo(0,0); }, 900);
    return;
  }
  finish();
}

function finish(){
  state.plays++; state.stamps = Math.min(state.stamps + 1, 30);
  save();
  const m = MEMBERS[state.oshi];
  paintFace($("#r-face"), state.oshi);
  $("#r-face").classList.add("happy");
  $("#r-count").textContent = `${S.correct}問せいかい`;
  $("#r-points").textContent = `💖 ${S.points}ハートゲット`;
  $("#r-combo").textContent = `🔥 さいこう ${S.bestCombo}れんぞく`;
  $("#r-msg").innerHTML = `<b>${m.name}より💌</b><br>` + (S.correct === 0
    ? fill(`今日もいっしょに考えてくれてありがとう、{n}ちゃん。また会いにきてね`)
    : fill(`{n}ちゃん、今日のライブ最高だった！ハートは合計 <b>${state.points}</b> こ。次のライブも待ってるね`));
  renderAll();
  show("result");
  say(pick(m.praise), "happy");
  sparkle(); fansa();
}

// ---------- ファンランク・チケット・がんばり度 ----------
function level(){ const p = state.points; return p>=800?4 : p>=450?3 : p>=200?2 : p>=60?1 : 0; }
const LEVEL_NAME = ["🌱 しんじんファン","🪭 うちわファン","🔦 ペンライトマスター","💺 さいぜんれつファン","👑 ことだま☆5公式サポーター"];
function renderAll(){
  const lv = LEVEL_NAME[level()];
  $("#title-level").textContent = lv;
  $("#r-level").textContent = `ファンランク：${lv}`;
  const box = $("#stamps");
  box.innerHTML = "";
  const on = state.stamps === 0 ? 0 : ((state.stamps - 1) % 10) + 1;
  for (let i=0;i<10;i++){
    const d = document.createElement("div");
    d.className = "stamp" + (i < on ? " on" : "");
    d.textContent = i < on ? "🎫" : "";
    box.appendChild(d);
  }
  $("#stamp-count").textContent = `ライブに行った回数：${state.plays}回`;
  document.querySelectorAll("#fields, #fields2").forEach(el => {
    el.innerHTML = "";
    Object.entries(FIELDS).forEach(([k, f]) => {
      const s = state.field[k], n = s.o + s.x, pct = n ? Math.round(s.o / n * 100) : 0;
      const c = MEMBERS[f.member].color;
      el.insertAdjacentHTML("beforeend", `<div class="field"><div class="field-head">
        <span>${f.emoji} ${f.name}（${MEMBERS[f.member].name}）</span><span>${n ? pct + "%" : "―"}</span></div>
        <div class="bar"><i style="width:${pct}%; background:${c}"></i></div></div>`);
    });
  });
}

function hint(){
  const q = S.list[S.i];
  $("#hint-box").innerHTML = `<b>${MEMBERS[q.member].name}のヒント</b><br>${q.hint}`;
  $("#hint-box").classList.remove("hidden");
  say("ヒントだよ。ここまでわかれば、あと少し！", "idle");
}

// ---------- はじめに ----------
window.addEventListener("DOMContentLoaded", () => {
  $("#title-name").textContent = NAME;
  const mb = $("#members");
  Object.entries(MEMBERS).forEach(([key, m]) => {
    const b = document.createElement("button");
    b.className = "member"; b.dataset.key = key;
    b.style.setProperty("--c", m.color); b.style.setProperty("--cl", m.light);
    b.innerHTML = `<div class="face">${idolSVG(key)}</div><span class="nm">${m.name}</span><span class="rl">${m.role}担当</span>`;
    b.onclick = () => { setOshi(key); say(pick(m.hello), "happy"); sparkle(m.color); };
    mb.appendChild(b);
  });
  const pb = $("#pick-big");
  Object.entries(FIELDS).forEach(([big, f]) => {
    const m = MEMBERS[f.member], n = QUESTIONS.filter(q => q.big === +big).length;
    const b = document.createElement("button");
    b.style.setProperty("--c", m.color); b.style.setProperty("--cl", m.light);
    b.innerHTML = `<span class="face-xs">${idolSVG(f.member)}</span><span>大問${big}<br>${f.name}（${n}問）</span>`;
    b.onclick = () => startSession("big" + big);
    pb.appendChild(b);
  });

  $("#btn-start").onclick = () => { show("modes"); renderAll(); say("今日はどのセトリでいく？", "idle"); };
  document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => startSession(b.dataset.mode));
  $("#btn-next").onclick = next;
  $("#btn-hint").onclick = hint;
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && S && S.answered && !$("#screen-quiz").classList.contains("hidden")
        && !["INPUT","BUTTON"].includes(document.activeElement && document.activeElement.tagName)){ e.preventDefault(); next(); }
  });
  document.querySelectorAll(".btn-home").forEach(b => b.onclick = () => { show("title"); renderAll(); say("また会いにきてね、{n}ちゃん！", "idle"); });
  $("#btn-again").onclick = () => startSession(S ? S.mode : "weak");
  $("#btn-reset").onclick = () => {
    if (confirm("ハートやチケットをぜんぶ最初にもどすよ。いい？")){
      const oshi = state.oshi; state = defaultState(); state.oshi = oshi; save(); renderAll();
    }
  };
  setOshi(state.oshi);
  renderAll();
  say(pick(MEMBERS[state.oshi].hello), "happy");
});
