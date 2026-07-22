/* =========================================================
 * app.js — Fluxo de telas, cronômetro, UI de chat e registro (localStorage)
 * Telas: top(cena) -> mode -> theme -> setup(duração) -> play -> result
 * ========================================================= */

const state = {
  scene: null,
  mode: null,
  theme: null,
  duration: 10, // minutos
  engine: null,
  timerId: null,
  remaining: 0,
  sessionActive: false,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- Transição de telas ---------- */
function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === `screen-${id}`));
  window.scrollTo(0, 0);
}

/* ---------- Registro (localStorage) ---------- */
const STORAGE_KEY = "salesRoleplayStatsPt";
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
      ? `🔥 ${stats.streak} dia(s) seguidos ／ ${stats.plays} sessões no total ／ Melhor pontuação: ${stats.best}`
      : "Comece a praticar hoje!";
}

/* ---------- Telas de seleção ---------- */
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
    <div class="summary-row"><span>Cena</span><strong>${state.scene.emoji} ${state.scene.name}</strong></div>
    <div class="summary-row"><span>${ROLE_LABEL}</span><strong>${state.mode.emoji} ${state.mode.name}</strong></div>
    <div class="summary-row"><span>Tema</span><strong>🎯 ${state.theme.name}</strong></div>`;
  $("#theme-tip").textContent = "💡 " + state.theme.tip;
  $$("#duration-list .chip").forEach((c) => {
    c.classList.toggle("selected", Number(c.dataset.min) === state.duration);
  });
  const sttNote = $("#stt-note");
  if (!SpeechIO.sttSupported()) {
    sttNote.textContent = "⚠️ O reconhecimento de voz não está disponível neste navegador, então você começará no modo de entrada de texto.";
    sttNote.hidden = false;
  } else {
    sttNote.hidden = true;
  }
}

/* ---------- UI de chat ---------- */
function addBubble(role, text) {
  const log = $("#chat-log");
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  const label = role === "npc" ? ROLE_LABEL : "Você";
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

/* ---------- Cronômetro ---------- */
function startTimer() {
  state.remaining = state.duration * 60;
  updateTimerDisplay();
  state.timerId = setInterval(() => {
    state.remaining--;
    updateTimerDisplay();
    if (state.remaining === 60) showToast("⏰ Falta 1 minuto. Hora de concluir.");
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

/* ---------- Sessão ---------- */
function startSession() {
  state.engine = new RoleAI(state.scene.id, state.mode.id, state.theme.id);
  state.sessionActive = true;
  $("#chat-log").innerHTML = "";
  $("#play-header-info").textContent = `${state.scene.name}｜${state.mode.name}｜🎯${state.theme.name}`;
  $("#text-input").value = "";

  // Trava no modo texto se o reconhecimento de voz não estiver disponível
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
      // Se o jogador falou por voz, reinicia o microfone automaticamente após a resposta
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

/* ---------- Modo de entrada (voz/texto) ---------- */
function setInputMode(mode) {
  const voice = mode === "voice";
  if (!voice) SpeechIO.stopListening();
  $("#voice-controls").hidden = !voice;
  $("#text-controls").hidden = voice;
  $("#btn-input-toggle").textContent = voice ? "⌨️ Mudar para entrada de texto" : "🎤 Mudar para entrada de voz";
  state.inputMode = mode;
}

/* ---------- Tela de resultado ---------- */
function renderResult(r, stats) {
  $("#result-theme").textContent = `🎯 Tema avaliado: ${state.theme.name}`;
  $("#result-grade").textContent = r.grade;
  $("#result-grade").className = "grade grade-" + { "◎": "best", "○": "good", "△": "ok", "×": "bad" }[r.grade];
  $("#result-score").textContent = `Pontuação de conquista do(a) ${ROLE_LABEL}: ${r.score}`;
  $("#result-title").textContent = `Título: ${r.title}`;
  $("#result-detail").textContent = r.detail || "";
  $("#result-walkout").hidden = !r.walkout;

  $("#result-quote").textContent = r.goodQuote
    ? `"${r.goodQuote}"`
    : "Não houve uma fala para citar desta vez. Tente falar um pouco mais na próxima rodada.";
  $("#result-improve-point").textContent = r.improvement.point;
  $("#result-improve-example").textContent = r.improvement.example;

  $("#result-stats").textContent =
    `🔥 ${stats.streak} dia(s) seguidos ／ ${stats.plays} sessões no total ／ Melhor pontuação: ${stats.best}`;
}

/* ---------- Inicialização ---------- */
document.addEventListener("DOMContentLoaded", () => {
  SpeechIO.init();
  SpeechIO.onResult = (text) => {
    state.lastInputVoice = true;
    playerSpoke(text);
  };
  SpeechIO.onStateChange = (listening) => {
    const btn = $("#btn-mic");
    btn.classList.toggle("listening", listening);
    btn.querySelector(".mic-label").textContent = listening ? "Ouvindo… (toque para parar)" : "Toque para falar";
  };
  SpeechIO.onError = (msg) => showToast(msg);

  renderSceneCards();
  renderModeCards();
  renderThemeCards();
  renderStatsBadge();

  // Seleção de duração
  $$("#duration-list .chip").forEach((c) => {
    c.onclick = () => {
      state.duration = Number(c.dataset.min);
      $$("#duration-list .chip").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
    };
  });

  // Botões de voltar
  $$("[data-back]").forEach((b) => (b.onclick = () => showScreen(b.dataset.back)));

  // Iniciar sessão
  $("#btn-start").onclick = startSession;

  // Microfone (toque para falar)
  $("#btn-mic").onclick = () => {
    if (SpeechIO.listening) SpeechIO.stopListening();
    else SpeechIO.startListening();
  };

  // Enviar texto
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

  // Alternar modo de entrada
  $("#btn-input-toggle").onclick = () =>
    setInputMode(state.inputMode === "voice" ? "text" : "voice");

  // Leitura em voz alta ON/OFF
  $("#btn-tts-toggle").onclick = () => {
    SpeechIO.ttsEnabled = !SpeechIO.ttsEnabled;
    if (!SpeechIO.ttsEnabled) SpeechIO.stopSpeaking();
    $("#btn-tts-toggle").textContent = SpeechIO.ttsEnabled ? "🔊 Voz ativada" : "🔇 Voz desativada";
  };

  // Botão de encerrar
  $("#btn-end").onclick = () => {
    if (confirm("Encerrar a simulação e ver o resultado?")) endSession(false);
  };

  // Navegação da tela de resultado
  $("#btn-retry").onclick = () => { renderSetup(); showScreen("setup"); };
  $("#btn-next-theme").onclick = () => showScreen("theme");
  $("#btn-top").onclick = () => { renderStatsBadge(); showScreen("top"); };
});
