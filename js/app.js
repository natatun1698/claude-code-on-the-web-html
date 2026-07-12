/* =========================================================
 * app.js — 画面フロー・タイマー・チャットUI・記録(localStorage)
 * 画面: top(シーン) → mode → theme → setup(時間) → play → result
 * ========================================================= */

const state = {
  scene: null,
  mode: null,
  theme: null,
  duration: 10, // 分
  engine: null,
  timerId: null,
  remaining: 0,
  sessionActive: false,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- 画面遷移 ---------- */
function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === `screen-${id}`));
  window.scrollTo(0, 0);
}

/* ---------- 記録(localStorage) ---------- */
const STORAGE_KEY = "salesRoleplayStats";
function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { plays: 0, streak: 0, lastDate: null, best: 0 };
  } catch (_) {
    return { plays: 0, streak: 0, lastDate: null, best: 0 };
  }
}
function saveResultToStats(score) {
  const stats = loadStats();
  const today = new Date().toISOString().slice(0, 10);
  if (stats.lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    stats.streak = stats.lastDate === yesterday ? stats.streak + 1 : 1;
    stats.lastDate = today;
  }
  stats.plays++;
  stats.best = Math.max(stats.best, score);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) {}
  return stats;
}
function renderStatsBadge() {
  const stats = loadStats();
  $("#stats-badge").textContent =
    stats.plays > 0
      ? `🔥 連続${stats.streak}日 ／ 通算${stats.plays}回 ／ 自己ベスト${stats.best}点`
      : "今日から練習をはじめましょう！";
}

/* ---------- 選択画面の描画 ---------- */
function renderSceneCards() {
  const box = $("#scene-list");
  box.innerHTML = "";
  SCENES.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.innerHTML = `<span class="card-emoji">${s.emoji}</span><span class="card-title">${s.name}</span><span class="card-desc">${s.desc}</span>`;
    btn.onclick = () => { state.scene = s; showScreen("mode"); };
    box.appendChild(btn);
  });
}

function renderModeCards() {
  const box = $("#mode-list");
  box.innerHTML = "";
  Object.values(MODES).forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.innerHTML = `<span class="card-emoji">${m.emoji}</span><span class="card-title">${m.name}</span><span class="card-desc">${m.desc}</span>`;
    btn.onclick = () => { state.mode = m; showScreen("theme"); };
    box.appendChild(btn);
  });
}

function renderThemeCards() {
  const box = $("#theme-list");
  box.innerHTML = "";
  THEMES.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.innerHTML = `<span class="card-emoji">🎯</span><span class="card-title">${t.name}</span><span class="card-desc">${t.desc}</span>`;
    btn.onclick = () => { state.theme = t; renderSetup(); showScreen("setup"); };
    box.appendChild(btn);
  });
}

function renderSetup() {
  $("#setup-summary").innerHTML = `
    <div class="summary-row"><span>シーン</span><strong>${state.scene.emoji} ${state.scene.name}</strong></div>
    <div class="summary-row"><span>${ROLE_LABEL}</span><strong>${state.mode.emoji} ${state.mode.name}</strong></div>
    <div class="summary-row"><span>評価テーマ</span><strong>🎯 ${state.theme.name}</strong></div>`;
  $("#theme-tip").textContent = "💡 " + state.theme.tip;
  $$("#duration-list .chip").forEach((c) => {
    c.classList.toggle("selected", Number(c.dataset.min) === state.duration);
  });
  const sttNote = $("#stt-note");
  if (!SpeechIO.sttSupported()) {
    sttNote.textContent = "⚠️ このブラウザでは音声認識が使えないため、テキスト入力モードで始まります。";
    sttNote.hidden = false;
  } else {
    sttNote.hidden = true;
  }
}

/* ---------- チャットUI ---------- */
function addBubble(role, text) {
  const log = $("#chat-log");
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  const label = role === "npc" ? ROLE_LABEL : "あなた";
  div.innerHTML = `<span class="bubble-label">${label}</span><span class="bubble-text"></span>`;
  div.querySelector(".bubble-text").textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 4000);
}

/* ---------- タイマー ---------- */
function startTimer() {
  state.remaining = state.duration * 60;
  updateTimerDisplay();
  state.timerId = setInterval(() => {
    state.remaining--;
    updateTimerDisplay();
    if (state.remaining === 60) showToast("⏰ 残り1分です。まとめに入りましょう。");
    if (state.remaining <= 0) endSession(false);
  }, 1000);
}
function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}
function updateTimerDisplay() {
  const m = Math.floor(state.remaining / 60);
  const s = state.remaining % 60;
  const el = $("#timer");
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
  el.classList.toggle("warning", state.remaining <= 60);
}

/* ---------- セッション ---------- */
function startSession() {
  state.engine = new RoleAI(state.scene.id, state.mode.id, state.theme.id);
  state.sessionActive = true;
  $("#chat-log").innerHTML = "";
  $("#play-header-info").textContent = `${state.scene.name}｜${state.mode.name}｜🎯${state.theme.name}`;
  $("#text-input").value = "";

  // 音声認識が使えなければテキストモード固定
  const voiceOk = SpeechIO.sttSupported();
  setInputMode(voiceOk ? "voice" : "text");
  $("#btn-input-toggle").hidden = !voiceOk;

  showScreen("play");
  startTimer();

  const opener = state.engine.openerText();
  addBubble("npc", opener);
  SpeechIO.speak(opener);
}

function playerSpoke(text) {
  if (!state.sessionActive || !text.trim()) return;
  addBubble("player", text);
  const res = state.engine.respond(text);
  setTimeout(() => {
    if (!state.sessionActive) return;
    addBubble("npc", res.text);
    SpeechIO.speak(res.text, () => {
      if (res.end && state.sessionActive) {
        setTimeout(() => endSession(res.event === "walkout"), 800);
      }
    });
    if (res.end && !SpeechIO.ttsEnabled) {
      setTimeout(() => { if (state.sessionActive) endSession(res.event === "walkout"); }, 2500);
    }
  }, 450);
}

function endSession(walkout) {
  if (!state.sessionActive) return;
  state.sessionActive = false;
  stopTimer();
  SpeechIO.stopSpeaking();
  SpeechIO.stopListening();
  const result = scoreSession(state.engine, walkout);
  const stats = saveResultToStats(result.score);
  renderResult(result, stats);
  showScreen("result");
}

/* ---------- 入力モード(音声/テキスト) ---------- */
function setInputMode(mode) {
  const voice = mode === "voice";
  $("#voice-controls").hidden = !voice;
  $("#text-controls").hidden = voice;
  $("#btn-input-toggle").textContent = voice ? "⌨️ テキスト入力に切替" : "🎤 音声入力に切替";
  state.inputMode = mode;
}

/* ---------- 結果画面 ---------- */
function renderResult(r, stats) {
  $("#result-theme").textContent = `🎯 評価テーマ：${state.theme.name}`;
  $("#result-grade").textContent = r.grade;
  $("#result-grade").className = "grade grade-" + { "◎": "best", "○": "good", "△": "ok", "×": "bad" }[r.grade];
  $("#result-score").textContent = `${ROLE_LABEL}攻略度 ${r.score}点`;
  $("#result-title").textContent = `称号：${r.title}`;
  $("#result-detail").textContent = r.detail || "";
  $("#result-walkout").hidden = !r.walkout;

  $("#result-quote").textContent = r.goodQuote
    ? `「${r.goodQuote}」`
    : "引用できる発言がありませんでした。次はもう少し長く話してみましょう。";
  $("#result-improve-point").textContent = r.improvement.point;
  $("#result-improve-example").textContent = r.improvement.example;

  $("#result-stats").textContent =
    `🔥 連続${stats.streak}日 ／ 通算${stats.plays}回 ／ 自己ベスト${stats.best}点`;
}

/* ---------- 初期化 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  SpeechIO.init();
  SpeechIO.onResult = (text) => playerSpoke(text);
  SpeechIO.onStateChange = (listening) => {
    const btn = $("#btn-mic");
    btn.classList.toggle("listening", listening);
    btn.querySelector(".mic-label").textContent = listening ? "聞き取り中…（タップで停止）" : "タップして話す";
  };
  SpeechIO.onError = (msg) => showToast(msg);

  renderSceneCards();
  renderModeCards();
  renderThemeCards();
  renderStatsBadge();

  // 練習時間の選択
  $$("#duration-list .chip").forEach((c) => {
    c.onclick = () => {
      state.duration = Number(c.dataset.min);
      $$("#duration-list .chip").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
    };
  });

  // 戻るボタン
  $$("[data-back]").forEach((b) => (b.onclick = () => showScreen(b.dataset.back)));

  // セッション開始
  $("#btn-start").onclick = startSession;

  // マイク(押して話す)
  $("#btn-mic").onclick = () => {
    if (SpeechIO.listening) SpeechIO.stopListening();
    else SpeechIO.startListening();
  };

  // テキスト送信
  const sendText = () => {
    const input = $("#text-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    playerSpoke(text);
  };
  $("#btn-send").onclick = sendText;
  $("#text-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendText();
    }
  });

  // 入力モード切替
  $("#btn-input-toggle").onclick = () =>
    setInputMode(state.inputMode === "voice" ? "text" : "voice");

  // 読み上げON/OFF
  $("#btn-tts-toggle").onclick = () => {
    SpeechIO.ttsEnabled = !SpeechIO.ttsEnabled;
    if (!SpeechIO.ttsEnabled) SpeechIO.stopSpeaking();
    $("#btn-tts-toggle").textContent = SpeechIO.ttsEnabled ? "🔊 読み上げON" : "🔇 読み上げOFF";
  };

  // 終了ボタン
  $("#btn-end").onclick = () => {
    if (confirm("ロープレを終了して結果を見ますか？")) endSession(false);
  };

  // 結果画面の導線
  $("#btn-retry").onclick = () => { renderSetup(); showScreen("setup"); };
  $("#btn-next-theme").onclick = () => showScreen("theme");
  $("#btn-top").onclick = () => { renderStatsBadge(); showScreen("top"); };
});
