/* =========================================================
 * app.js — Screen flow, timer, chat UI, and record-keeping (localStorage)
 * Screens: top(scene) -> mode -> theme -> setup(duration) -> play -> result
 * ========================================================= */

const state = {
  scene: null,
  mode: null,
  theme: null,
  duration: 10, // minutes
  engine: null,
  timerId: null,
  remaining: 0,
  sessionActive: false,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- Screen transitions ---------- */
function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === `screen-${id}`));
  window.scrollTo(0, 0);
}

/* ---------- Record-keeping (localStorage) ---------- */
const STORAGE_KEY = "salesRoleplayStatsEn";
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
      ? `🔥 ${stats.streak}-day streak ／ ${stats.plays} total sessions ／ Best score ${stats.best}`
      : "Start practicing today!";
}

/* ---------- Selection screens ---------- */
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
    <div class="summary-row"><span>Scene</span><strong>${state.scene.emoji} ${state.scene.name}</strong></div>
    <div class="summary-row"><span>${ROLE_LABEL}</span><strong>${state.mode.emoji} ${state.mode.name}</strong></div>
    <div class="summary-row"><span>Theme</span><strong>🎯 ${state.theme.name}</strong></div>`;
  $("#theme-tip").textContent = "💡 " + state.theme.tip;
  $$("#duration-list .chip").forEach((c) => {
    c.classList.toggle("selected", Number(c.dataset.min) === state.duration);
  });
  const sttNote = $("#stt-note");
  if (!SpeechIO.sttSupported()) {
    sttNote.textContent = "⚠️ Speech recognition isn't available in this browser, so you'll start in text-input mode.";
    sttNote.hidden = false;
  } else {
    sttNote.hidden = true;
  }
}

/* ---------- Chat UI ---------- */
function addBubble(role, text) {
  const log = $("#chat-log");
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  const label = role === "npc" ? ROLE_LABEL : "You";
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

/* ---------- Timer ---------- */
function startTimer() {
  state.remaining = state.duration * 60;
  updateTimerDisplay();
  state.timerId = setInterval(() => {
    state.remaining--;
    updateTimerDisplay();
    if (state.remaining === 60) showToast("⏰ 1 minute left. Time to wrap up.");
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

/* ---------- Session ---------- */
function startSession() {
  state.engine = new RoleAI(state.scene.id, state.mode.id, state.theme.id);
  state.sessionActive = true;
  $("#chat-log").innerHTML = "";
  $("#play-header-info").textContent = `${state.scene.name}｜${state.mode.name}｜🎯${state.theme.name}`;
  $("#text-input").value = "";

  // Lock to text mode if speech recognition isn't available
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
        return;
      }
      // If the player spoke by voice, restart the mic automatically after the reply
      if (state.sessionActive && state.inputMode === "voice" && state.lastInputVoice) {
        setTimeout(() => {
          if (state.sessionActive && state.inputMode === "voice" && !SpeechIO.listening) {
            SpeechIO.startListening(true);
          }
        }, 300);
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

/* ---------- Input mode (voice/text) ---------- */
function setInputMode(mode) {
  const voice = mode === "voice";
  if (!voice) SpeechIO.stopListening();
  $("#voice-controls").hidden = !voice;
  $("#text-controls").hidden = voice;
  $("#btn-input-toggle").textContent = voice ? "⌨️ Switch to text input" : "🎤 Switch to voice input";
  state.inputMode = mode;
}

/* ---------- Result screen ---------- */
function renderResult(r, stats) {
  $("#result-theme").textContent = `🎯 Evaluation theme: ${state.theme.name}`;
  $("#result-grade").textContent = r.grade;
  $("#result-grade").className = "grade grade-" + { "◎": "best", "○": "good", "△": "ok", "×": "bad" }[r.grade];
  $("#result-score").textContent = `${ROLE_LABEL} conquest score: ${r.score}`;
  $("#result-title").textContent = `Title: ${r.title}`;
  $("#result-detail").textContent = r.detail || "";
  $("#result-walkout").hidden = !r.walkout;

  $("#result-quote").textContent = r.goodQuote
    ? `"${r.goodQuote}"`
    : "There wasn't a quotable line this time. Try speaking a bit more next round.";
  $("#result-improve-point").textContent = r.improvement.point;
  $("#result-improve-example").textContent = r.improvement.example;

  $("#result-stats").textContent =
    `🔥 ${stats.streak}-day streak ／ ${stats.plays} total sessions ／ Best score ${stats.best}`;
}

/* ---------- Initialization ---------- */
document.addEventListener("DOMContentLoaded", () => {
  SpeechIO.init();
  SpeechIO.onResult = (text) => {
    state.lastInputVoice = true;
    playerSpoke(text);
  };
  SpeechIO.onStateChange = (listening) => {
    const btn = $("#btn-mic");
    btn.classList.toggle("listening", listening);
    btn.querySelector(".mic-label").textContent = listening ? "Listening… (tap to stop)" : "Tap to speak";
  };
  SpeechIO.onError = (msg) => showToast(msg);

  renderSceneCards();
  renderModeCards();
  renderThemeCards();
  renderStatsBadge();

  // Duration selection
  $$("#duration-list .chip").forEach((c) => {
    c.onclick = () => {
      state.duration = Number(c.dataset.min);
      $$("#duration-list .chip").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
    };
  });

  // Back buttons
  $$("[data-back]").forEach((b) => (b.onclick = () => showScreen(b.dataset.back)));

  // Start session
  $("#btn-start").onclick = startSession;

  // Mic (tap to talk)
  $("#btn-mic").onclick = () => {
    if (SpeechIO.listening) SpeechIO.stopListening();
    else SpeechIO.startListening();
  };

  // Text send
  const sendText = () => {
    const input = $("#text-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    state.lastInputVoice = false;
    playerSpoke(text);
  };
  $("#btn-send").onclick = sendText;
  $("#text-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendText();
    }
  });

  // Toggle input mode
  $("#btn-input-toggle").onclick = () =>
    setInputMode(state.inputMode === "voice" ? "text" : "voice");

  // Voice readout ON/OFF
  $("#btn-tts-toggle").onclick = () => {
    SpeechIO.ttsEnabled = !SpeechIO.ttsEnabled;
    if (!SpeechIO.ttsEnabled) SpeechIO.stopSpeaking();
    $("#btn-tts-toggle").textContent = SpeechIO.ttsEnabled ? "🔊 Voice ON" : "🔇 Voice OFF";
  };

  // End button
  $("#btn-end").onclick = () => {
    if (confirm("End the roleplay and see your results?")) endSession(false);
  };

  // Result screen navigation
  $("#btn-retry").onclick = () => { renderSetup(); showScreen("setup"); };
  $("#btn-next-theme").onclick = () => showScreen("theme");
  $("#btn-top").onclick = () => { renderStatsBadge(); showScreen("top"); };
});
