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
  useLlm: false,       // AI事務長(Claude API)で動いているか
  busy: false,         // AI事務長の返答待ち(二重送信防止)
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
  renderHomeAiStatus();
}

/* ---------- AI事務長の設定画面 ---------- */
function renderHomeAiStatus() {
  const el = $("home-ai-status");
  if (!el) return;
  if (LlmSettings.enabled()) el.textContent = "🤖 AI事務長モード(毎回違う反応)で練習します。⚙️で変更できます。";
  else if (LlmSettings.apiKey()) el.textContent = "📋 定型(台本)モードで練習します。⚙️でAI事務長をONにできます。";
  else el.textContent = "📋 定型(台本)モードで練習します。⚙️にAPIキーを入れるとAI事務長になります。";
}

function buildSettings() {
  const sel = $("llm-model");
  sel.innerHTML = "";
  for (const m of LLM_MODELS) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.name;
    sel.appendChild(o);
  }
  sel.value = LlmSettings.model();
  $("llm-key").value = LlmSettings.apiKey();
  $("llm-on").checked = LlmSettings.on();
  setLlmStatus(LlmSettings.apiKey() ? "キーは保存済みです。" : "キーは未設定です。", "");
}

function setLlmStatus(msg, cls) {
  const el = $("llm-status");
  el.textContent = msg;
  el.className = "ai-status " + (cls || "");
}

function bindSettings() {
  $("btn-settings").onclick = () => { buildSettings(); show("screen-settings"); };
  $("btn-llm-save").onclick = () => {
    LlmSettings.setApiKey($("llm-key").value);
    LlmSettings.save({ model: $("llm-model").value, on: $("llm-on").checked });
    setLlmStatus(LlmSettings.enabled() ? "保存しました。次のロープレからAI事務長になります。" : "保存しました(定型モード)。", "ok");
    renderHomeAiStatus();
  };
  $("btn-llm-clear").onclick = () => {
    LlmSettings.setApiKey("");
    $("llm-key").value = "";
    setLlmStatus("キーを削除しました。定型モードで動きます。", "");
    renderHomeAiStatus();
  };
  $("btn-llm-test").onclick = async () => {
    const key = $("llm-key").value.trim();
    if (!key) { setLlmStatus("先にAPIキーを入力してください。", "ng"); return; }
    setLlmStatus("接続を確認しています…", "");
    $("btn-llm-test").disabled = true;
    try {
      await testClaude(key, $("llm-model").value);
      setLlmStatus("接続できました。「保存する」を押すと有効になります。", "ok");
    } catch (e) {
      setLlmStatus(llmErrorMessage(e), "ng");
    } finally {
      $("btn-llm-test").disabled = false;
    }
  };
}

function llmErrorMessage(e) {
  const code = e && e.code;
  if (code === "auth") return "APIキーが認証されませんでした。キーを確認してください。";
  if (code === "rate") return "呼び出し回数の上限に達しています。少し待ってからお試しください。";
  if (code === "timeout") return "応答がありませんでした(タイムアウト)。通信環境を確認してください。";
  if (code === "network") return "api.anthropic.com に接続できませんでした。通信環境を確認してください。";
  return "接続に失敗しました(" + (code || "unknown") + ")。";
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
  const ai = LlmSettings.enabled()
    ? "🤖 AI(毎回違う反応)"
    : LlmSettings.apiKey() ? "📋 定型(台本)" : "📋 定型(⚙️でAI化)";
  $("prep-summary").innerHTML += `<div><span>事務長役</span><strong>${ai}</strong></div>`;
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
  App.useLlm = LlmSettings.enabled();
  App.ai = App.useLlm
    ? new LlmCustomerAI(App.sceneId, App.modeId, App.themeId)
    : new CustomerAI(App.sceneId, App.modeId, App.themeId);
  App.ended = false;
  App.busy = false;
  App.spokeByVoice = false;
  $("chat-log").innerHTML = "";
  $("text-input").value = "";
  $("play-title").textContent =
    SCENES.find((s) => s.id === App.sceneId).name + " / " + MODES[App.modeId].icon;
  setInputMode(Voice.hasSTT() ? "voice" : "text");
  if (!Voice.hasSTT()) notice("このブラウザは音声認識に未対応のため、テキスト入力モードで開始します。");
  if (App.useLlm) notice("🤖 AI事務長モード。返答に数秒かかることがあります。");
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

function addBubble(who, text, tag) {
  const log = $("chat-log");
  const div = document.createElement("div");
  div.className = "bubble " + who;
  const name = who === "npc" ? CUSTOMER_NAME : "あなた";
  div.innerHTML = `<small>${name}</small><p></p>`;
  if (tag) {
    const t = document.createElement("span");
    t.className = "ai-tag";
    t.textContent = tag;
    div.querySelector("small").appendChild(t);
  }
  div.querySelector("p").textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

/* AI事務長の返答待ち表示 */
function setBusy(on) {
  App.busy = on;
  $("btn-send").disabled = on;
  $("btn-mic").disabled = on;
  const old = document.getElementById("thinking-bubble");
  if (old) old.remove();
  if (on) {
    const div = addBubble("npc", "考えています");
    div.classList.add("thinking");
    div.id = "thinking-bubble";
  }
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
  if (App.ended || App.busy || !App.ai || App.ai.finished) return;
  App.spokeByVoice = byVoice;
  addBubble("me", text);
  if (App.useLlm) {
    // AI事務長: 非同期。待ち時間はマイクを止めて「考えています」を表示
    Voice.stopListening();
    setBusy(true);
    Promise.resolve(App.ai.reply(text, { remainSec: App.remain }))
      .catch(() => ({ text: "……すみません、もう一度お願いします。", event: null, end: false, viaFallback: true }))
      .then((res) => {
        if (App.ended) return;
        setBusy(false);
        if (res.viaFallback) notice("(AIに接続できないため、この返答は定型モードです)");
        deliverNpc(res);
      });
    return;
  }
  const res = App.ai.reply(text);
  setTimeout(() => {
    if (App.ended) return;
    deliverNpc(res);
  }, 350);
}

/* 事務長の返答を表示・読み上げし、終了イベントとマイク再開を処理する */
function deliverNpc(res) {
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

  // AI事務長のときは、点数はそのままに引用・改善点だけAI講評で差し替える(結果表示は待たせない)
  if (App.useLlm && App.ai && typeof App.ai.review === "function" && App.ai.turns.length) {
    const ai = App.ai;
    $("result-note").textContent += " 🤖 AI講評を作成中…";
    ai.review().then((rv) => {
      if (App.ai !== ai) return; // 次のセッションが始まっていたら捨てる
      $("result-note").textContent = $("result-note").textContent.replace(" 🤖 AI講評を作成中…", rv ? " 🤖 AI講評つき" : "");
      if (!rv) return;
      if (rv.goodQuote) $("result-quote").textContent = `「${rv.goodQuote}」`;
      if (rv.point) $("result-improve-point").textContent = rv.point;
      if (rv.example) $("result-improve-example").textContent = rv.example;
    });
  }
}

/* ---------- 起動 ---------- */
window.addEventListener("DOMContentLoaded", () => {
  Voice.init();
  buildHome();
  bindPlayControls();
  bindSettings();

  document.querySelectorAll("[data-back]").forEach((b) => {
    b.onclick = () => show(b.dataset.back);
  });
  $("btn-start").onclick = startSession;
  $("btn-again").onclick = startSession;
  $("btn-next-theme").onclick = () => { buildThemes(); show("screen-theme"); };
  $("btn-home").onclick = () => { buildHome(); show("screen-home"); };
});
