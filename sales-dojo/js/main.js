/* =========================================================
 * main.js — 画面遷移・タイマー・チャットUI・成績記録
 * 画面: home → mode → theme → prep → play → result
 * ========================================================= */

const $ = (id) => document.getElementById(id);

const App = {
  sceneId: null,
  modeId: null,
  themeId: null,
  minutes: 10,
  ai: null,
  timerId: null,
  remain: 0,
  spokeByVoice: false, // 直前の発言が音声なら相手の返答後にマイク自動再開
  ended: false,
};

/* ---------- 成績記録(localStorageはtry/catchで包む) ---------- */
function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (_) { return {}; }
}
function saveRecords(r) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch (_) {}
}
function recordSession(score) {
  const r = loadRecords();
  const today = new Date().toISOString().slice(0, 10);
  r.total = (r.total || 0) + 1;
  r.best = Math.max(r.best || 0, score);
  if (r.lastDay !== today) {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    r.streak = r.lastDay === y ? (r.streak || 0) + 1 : 1;
    r.lastDay = today;
  }
  saveRecords(r);
  return r;
}
function renderStats() {
  const r = loadRecords();
  $("stat-total").textContent = r.total || 0;
  $("stat-streak").textContent = r.streak || 0;
  $("stat-best").textContent = r.best || "-";
}

/* ---------- 画面遷移 ---------- */
function show(screen) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(screen).classList.add("active");
  window.scrollTo(0, 0);
}

/* ---------- 選択画面の構築 ---------- */
function buildHome() {
  const box = $("scene-list");
  box.innerHTML = "";
  for (const s of SCENES) {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = `<span class="card-icon">${s.icon}</span><span class="card-body"><strong>${s.name}</strong><small>${s.desc}</small></span>`;
    b.onclick = () => { App.sceneId = s.id; buildModes(); show("screen-mode"); };
    box.appendChild(b);
  }
  renderStats();
}

function buildModes() {
  const box = $("mode-list");
  box.innerHTML = "";
  for (const m of Object.values(MODES)) {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = `<span class="card-icon">${m.icon}</span><span class="card-body"><strong>${m.name}</strong><small>${m.desc}</small></span>`;
    b.onclick = () => { App.modeId = m.id; buildThemes(); show("screen-theme"); };
    box.appendChild(b);
  }
}

function buildThemes() {
  const box = $("theme-list");
  box.innerHTML = "";
  for (const t of THEMES) {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = `<span class="card-icon">🎯</span><span class="card-body"><strong>${t.name}</strong><small>${t.desc}</small></span>`;
    b.onclick = () => { App.themeId = t.id; buildPrep(); show("screen-prep"); };
    box.appendChild(b);
  }
}

function buildPrep() {
  const scene = SCENES.find((s) => s.id === App.sceneId);
  const mode = MODES[App.modeId];
  const theme = THEMES.find((t) => t.id === App.themeId);
  $("prep-summary").innerHTML =
    `<div><span>シーン</span><strong>${scene.icon} ${scene.name}</strong></div>` +
    `<div><span>相手</span><strong>${mode.icon} ${mode.name}</strong></div>` +
    `<div><span>テーマ</span><strong>🎯 ${theme.name}</strong></div>`;
  $("prep-tip").textContent = "コツ: " + theme.tip;
  document.querySelectorAll("#time-list button").forEach((b) => {
    b.classList.toggle("selected", Number(b.dataset.min) === App.minutes);
    b.onclick = () => {
      App.minutes = Number(b.dataset.min);
      document.querySelectorAll("#time-list button").forEach((x) => x.classList.toggle("selected", x === b));
    };
  });
}

/* ---------- ロープレ本体 ---------- */
function startSession() {
  App.ai = new CustomerAI(App.sceneId, App.modeId, App.themeId);
  App.ended = false;
  App.spokeByVoice = false;
  $("chat-log").innerHTML = "";
  $("text-input").value = "";
  $("play-title").textContent =
    SCENES.find((s) => s.id === App.sceneId).name + " / " + MODES[App.modeId].icon;
  setInputMode(Voice.hasSTT() ? "voice" : "text");
  if (!Voice.hasSTT()) notice("このブラウザは音声認識に未対応のため、テキスト入力モードで開始します。");
  show("screen-play");
  startTimer();
  const opener = App.ai.opener();
  addBubble("npc", opener);
  Voice.say(opener);
}

function startTimer() {
  App.remain = App.minutes * 60;
  drawTimer();
  clearInterval(App.timerId);
  App.timerId = setInterval(() => {
    App.remain--;
    drawTimer();
    if (App.remain === 60) notice("残り1分です。まとめに入りましょう。");
    if (App.remain <= 0) endSession(false, "timeup");
  }, 1000);
}
function drawTimer() {
  const m = Math.floor(Math.max(0, App.remain) / 60);
  const s = Math.max(0, App.remain) % 60;
  const el = $("timer");
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
  el.classList.toggle("warn", App.remain <= 60);
}

function addBubble(who, text) {
  const log = $("chat-log");
  const div = document.createElement("div");
  div.className = "bubble " + who;
  const name = who === "npc" ? CUSTOMER_NAME : "あなた";
  div.innerHTML = `<small>${name}</small><p></p>`;
  div.querySelector("p").textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function notice(msg) {
  const log = $("chat-log");
  const div = document.createElement("div");
  div.className = "notice";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function playerSaid(text, byVoice) {
  if (App.ended || !App.ai || App.ai.finished) return;
  App.spokeByVoice = byVoice;
  addBubble("me", text);
  const res = App.ai.reply(text);
  setTimeout(() => {
    if (App.ended) return;
    addBubble("npc", res.text);
    Voice.say(res.text, () => {
      if (App.ended) return;
      if (res.end) {
        endSession(res.event === "walkout", res.event);
      } else if (App.spokeByVoice && $("panel-voice").style.display !== "none") {
        Voice.listen(true); // 音声で話した後は自動でマイク再開
      }
    });
    if (res.end && !Voice.ttsOn) endSession(res.event === "walkout", res.event);
  }, 350);
}

/* ---------- 入力(音声/テキスト切替) ---------- */
function setInputMode(mode) {
  $("panel-voice").style.display = mode === "voice" ? "" : "none";
  $("panel-text").style.display = mode === "text" ? "" : "none";
  $("btn-input-toggle").textContent = mode === "voice" ? "⌨️ テキストに切替" : "🎤 音声に切替";
  $("btn-input-toggle").dataset.mode = mode;
  if (mode === "text") Voice.stopListening();
}

function bindPlayControls() {
  $("btn-mic").onclick = () => {
    if (Voice.listening) Voice.stopListening();
    else Voice.listen(false);
  };
  Voice.onState = (on) => {
    $("btn-mic").classList.toggle("listening", on);
    $("btn-mic").textContent = on ? "🎙 聞き取り中…タップで停止" : "🎤 タップして話す";
  };
  Voice.onText = (text) => playerSaid(text, true);
  Voice.onInterim = (text) => {
    // 聞き取り中の途中経過をボタンに表示(認識が動いていることを可視化)
    const t = text.length > 15 ? "…" + text.slice(-15) : text;
    $("btn-mic").textContent = "🎙 " + t;
  };
  Voice.onNotice = (msg) => notice(msg);

  $("btn-input-toggle").onclick = () => {
    if ($("btn-input-toggle").dataset.mode === "voice") setInputMode("text");
    else if (Voice.hasSTT()) setInputMode("voice");
    else notice("このブラウザでは音声入力を利用できません。");
  };

  const sendText = () => {
    const t = $("text-input").value.trim();
    if (!t) return;
    $("text-input").value = "";
    playerSaid(t, false);
  };
  $("btn-send").onclick = sendText;
  $("text-input").addEventListener("keydown", (e) => {
    // 日本語IMEの変換確定Enterでは送信しない
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendText();
    }
  });

  $("btn-tts").onclick = () => {
    Voice.ttsOn = !Voice.ttsOn;
    if (!Voice.ttsOn) Voice.hush();
    $("btn-tts").textContent = Voice.ttsOn ? "🔊 読み上げON" : "🔇 読み上げOFF";
  };

  $("btn-quit").onclick = () => endSession(false, "quit");
}

/* ---------- 終了と結果 ---------- */
function endSession(walkout, reason) {
  if (App.ended) return;
  App.ended = true;
  clearInterval(App.timerId);
  Voice.stopListening();
  Voice.hush();

  const r = scoreSession(App.ai, walkout);
  const rec = recordSession(r.score);
  const theme = THEMES.find((t) => t.id === App.themeId);

  $("result-grade").textContent = r.grade;
  $("result-theme").textContent = theme.name;
  $("result-score").textContent = `事務長攻略度${r.score}点`;
  $("result-title").textContent = r.title;
  $("result-detail").textContent = r.detail || "";
  $("result-note").textContent =
    r.walkout ? "※商談を打ち切られました(減点)。歯切れよく、結論から話す練習をしましょう。"
    : reason === "timeup" ? "※時間切れで終了しました。"
    : reason === "quit" ? "※途中終了した時点までの評価です。" : "";
  $("result-quote").textContent = r.goodQuote ? `「${r.goodQuote}」` : "(引用できる発言がありませんでした)";
  $("result-improve-point").textContent = r.improvement.point;
  $("result-improve-example").textContent = r.improvement.example;
  $("result-streak").textContent = `通算${rec.total}回 / 連続${rec.streak}日 / 自己ベスト${rec.best}点`;
  show("screen-result");
}

/* ---------- 起動 ---------- */
window.addEventListener("DOMContentLoaded", () => {
  Voice.init();
  buildHome();
  bindPlayControls();

  document.querySelectorAll("[data-back]").forEach((b) => {
    b.onclick = () => show(b.dataset.back);
  });
  $("btn-start").onclick = startSession;
  $("btn-again").onclick = startSession;
  $("btn-next-theme").onclick = () => { buildThemes(); show("screen-theme"); };
  $("btn-home").onclick = () => { buildHome(); show("screen-home"); };
});
