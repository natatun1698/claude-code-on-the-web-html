/* =========================================================
 * llm.js — Claude API をブラウザから直接呼ぶ(BYOK)事務長AI
 *   LlmSettings   : APIキー・モデル・ON/OFF(localStorage)
 *   callClaude()  : fetch で /v1/messages。構造化JSONで受ける
 *   LlmCustomerAI : CustomerAI と同じ reply()/turns/finished を持ち、
 *                   失敗時はその発言から CustomerAI にフォールバックする
 * fetch と localStorage 以外のブラウザAPIに依存しない(nodeでモック可)。
 * ========================================================= */

const LLM_KEY_STORAGE = "salesDojoApiKey";
const LLM_SETTINGS_STORAGE = "salesDojoLlm";
const LLM_MODELS = [
  { id: "claude-opus-5-5", name: "Opus 5.5(既定・最も自然)" },
  { id: "claude-sonnet-5-5", name: "Sonnet 5.5(速い・安い)" },
  { id: "claude-haiku-5-5", name: "Haiku 5.5(最も安い)" },
];
const LLM_API_URL = "https://api.anthropic.com/v1/messages";
const LLM_TIMEOUT_MS = 20000;
const LLM_MAX_TURNS = 12;      // これ以上は締めに入る
const LLM_CLOSE_REMAIN_SEC = 90; // 残り時間がこれ以下なら締めに入る

const LlmSettings = {
  _store() {
    try { return JSON.parse(localStorage.getItem(LLM_SETTINGS_STORAGE)) || {}; } catch (_) { return {}; }
  },
  apiKey() {
    try { return (localStorage.getItem(LLM_KEY_STORAGE) || "").trim(); } catch (_) { return ""; }
  },
  setApiKey(k) {
    try {
      if (k && k.trim()) localStorage.setItem(LLM_KEY_STORAGE, k.trim());
      else localStorage.removeItem(LLM_KEY_STORAGE);
    } catch (_) {}
  },
  model() {
    const m = this._store().model;
    return LLM_MODELS.some((x) => x.id === m) ? m : LLM_MODELS[0].id;
  },
  on() {
    const s = this._store();
    return s.on !== false; // 既定ON(キーがあれば使う)
  },
  save(patch) {
    try { localStorage.setItem(LLM_SETTINGS_STORAGE, JSON.stringify({ ...this._store(), ...patch })); } catch (_) {}
  },
  /* AI事務長を使える状態か */
  enabled() {
    return !!this.apiKey() && this.on();
  },
};

class LlmError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

/* ---------- API呼び出し ---------- */
async function callClaude({ apiKey, model, system, messages, schema, maxTokens = 1024, effort = "low", timeoutMs = LLM_TIMEOUT_MS, fetchImpl }) {
  const f = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!f) throw new LlmError("nofetch");
  if (!apiKey) throw new LlmError("nokey");
  const body = {
    model,
    max_tokens: maxTokens,
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  };
  const once = async () => {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      return await f(LLM_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2026-10-21",
          "anthropic-dangerous-direct-browser-access": "true",
          "anthropic-beta": "server-side-fallback-2026-07-01",
        },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (e) {
      throw new LlmError(e && e.name === "AbortError" ? "timeout" : "network");
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  let res = await once();
  if (res.status >= 500) { // 5xxは1回だけ再試行
    await new Promise((r) => setTimeout(r, 1500));
    res = await once();
  }
  if (res.status === 401 || res.status === 403) throw new LlmError("auth");
  if (res.status === 429) throw new LlmError("rate");
  if (!res.ok) throw new LlmError("http" + res.status);
  let data;
  try { data = await res.json(); } catch (_) { throw new LlmError("badjson"); }
  if (data.stop_reason === "refusal") throw new LlmError("refusal");
  if (data.stop_reason === "max_tokens") throw new LlmError("truncated");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let obj;
  try { obj = JSON.parse(text); } catch (_) { throw new LlmError("badjson"); }
  for (const k of schema.required || []) if (!(k in obj)) throw new LlmError("schema");
  return obj;
}

/* 接続テスト(設定画面用)。成功なら true、失敗なら LlmError を投げる */
async function testClaude(apiKey, model, fetchImpl) {
  return callClaude({
    apiKey, model, fetchImpl, maxTokens: 64,
    system: "必ず {\"ok\": true} というJSONだけを返す。",
    messages: [{ role: "user", content: "ping" }],
    schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } },
  }).then(() => true);
}

/* =========================================================
 * LLM事務長
 * reply(playerText, ctx) => Promise<{ text, event, end, viaFallback }>
 *   ctx: { remainSec }
 * ========================================================= */
class LlmCustomerAI {
  constructor(sceneId, modeId, themeId, opts = {}) {
    this.scene = SCENES.find((s) => s.id === sceneId);
    this.mode = MODES[modeId];
    this.themeId = themeId;
    this.apiKey = opts.apiKey != null ? opts.apiKey : LlmSettings.apiKey();
    this.model = opts.model || LlmSettings.model();
    this.fetchImpl = opts.fetchImpl;
    this.fallback = new CustomerAI(sceneId, modeId, themeId);
    this.system = buildSystemPrompt(sceneId, modeId, themeId);
    this.history = [];            // Claude API に送る messages
    this.transcript = [];         // 講評用 { who: "npc"|"me", text }
    this.turns = [];              // scoreSession 用(CustomerAI 互換)
    this.strikes = 0;
    this.askedJargon = [];
    this.lastSay = "";
    this.lastAskedCat = "need";
    this.fallbackCount = 0;
    this.lastError = null;
    this.finished = false;
    this.isLlm = true;
  }

  opener() {
    const text = this.scene.opener[this.mode.id];
    this._pushNpc(text, { say: text, mood: "neutral", strike_delta: 0, event: "none", asked_cat: "need", observed: null });
    return text;
  }

  _pushNpc(text, obj) {
    this.lastSay = text;
    this.transcript.push({ who: "npc", text });
    this.history.push({ role: "assistant", content: JSON.stringify(obj) });
  }

  /* observed → analyze() 互換の形 */
  _toPlayer(text, o) {
    return {
      text, len: text.length,
      jargon: Array.isArray(o.jargon) ? o.jargon.filter((s) => typeof s === "string" && s) : [],
      hasPlain: !!o.has_plain,
      conclusionFirst: !!o.conclusion_first,
      discountOffered: !!o.discount_offered && !o.discount_refused,
      discountRefused: !!o.discount_refused,
      valueCats: Array.isArray(o.value_cats) ? o.value_cats.filter((c) => VALUE_CATEGORIES.some((v) => v.id === c)) : [],
      isQuestion: QUESTION_RE.test(text),
      nextStep: NEXT_STEP_RE.test(text),
      onPoint: !!o.on_point,
    };
  }

  async reply(playerText, ctx = {}) {
    if (this.finished) return { text: "", event: null, end: true };
    this.transcript.push({ who: "me", text: playerText });
    const turnNo = this.turns.length + 1;
    const mustClose = turnNo >= LLM_MAX_TURNS || (ctx.remainSec != null && ctx.remainSec <= LLM_CLOSE_REMAIN_SEC);

    let obj;
    try {
      obj = await this._ask(playerText, { remainSec: ctx.remainSec, close: mustClose ? "done" : null });
      if (obj.say === this.lastSay) { // 同一セリフの連続は一度だけ作り直す
        obj = await this._ask(playerText, { remainSec: ctx.remainSec, close: mustClose ? "done" : null, repeat: true });
      }
    } catch (e) {
      return this._fallbackReply(playerText, e);
    }

    const o = obj.observed || {};
    const rec = {
      player: this._toPlayer(playerText, o),
      cat: this.lastAskedCat,
      interrupted: obj.event === "interrupt",
      jargonAsked: obj.event === "jargon_ask" ? ((Array.isArray(o.jargon) && o.jargon[0]) || "専門用語") : null,
      discountPushed: obj.event === "discount_shake" || (obj.asked_cat === "cost" && /値引|下げ|安く|勉強/.test(obj.say)),
      npc: obj.say,
    };
    this.turns.push(rec);
    for (const j of rec.player.jargon) if (!this.askedJargon.includes(j)) this.askedJargon.push(j);
    if (obj.asked_cat && obj.asked_cat !== "none") this.lastAskedCat = obj.asked_cat;

    /* 打ち切り判断はJS側(決定論)。セリフだけLLMに作らせる */
    if (this.mode.id === "C") {
      let d = Number(obj.strike_delta) || 0;
      if (d === 0 && ["interrupt", "jargon_ask", "discount_shake"].includes(obj.event)) d = 1;
      this.strikes = Math.max(0, this.strikes + d);
      if (this.strikes >= this.mode.maxStrikes) {
        this._pushNpc(obj.say, obj);
        return this._closeWith("walkout", playerText);
      }
    }

    const end = mustClose || (obj.event === "done" && turnNo >= 8);
    this._pushNpc(obj.say, obj);
    if (end) this.finished = true;
    return { text: obj.say, event: end ? "done" : null, end, viaFallback: false };
  }

  async _ask(playerText, state) {
    const directive = buildTurnDirective({
      askedJargon: this.askedJargon, remainSec: state.remainSec, modeId: this.mode.id,
      strikes: this.strikes, maxStrikes: this.mode.maxStrikes, lastSay: state.repeat ? this.lastSay : "", close: state.close,
    });
    const messages = [...this.history, { role: "user", content: playerText }];
    if (directive) messages.push({ role: "system", content: directive });
    return callClaude({
      apiKey: this.apiKey, model: this.model, fetchImpl: this.fetchImpl,
      system: this.system, messages, schema: REPLY_SCHEMA, maxTokens: 1024, effort: "low",
    });
  }

  /* 打ち切り/締めのセリフを生成(失敗時は定型文) */
  async _closeWith(kind, playerText) {
    this.finished = true;
    let text;
    try {
      const obj = await callClaude({
        apiKey: this.apiKey, model: this.model, fetchImpl: this.fetchImpl, system: this.system,
        messages: [...this.history, { role: "user", content: "(続けて)" }, { role: "system", content: buildTurnDirective({ close: kind }) }],
        schema: REPLY_SCHEMA, maxTokens: 512, effort: "low",
      });
      text = obj.say;
    } catch (_) {
      text = kind === "walkout" ? WALKOUT_C : this.scene.closer[this.mode.id];
    }
    this.transcript.push({ who: "npc", text });
    return { text, event: kind, end: true, viaFallback: false };
  }

  /* その発言だけルールベースに任せる(会話は止めない) */
  _fallbackReply(playerText, err) {
    this.lastError = err && err.code ? err.code : "unknown";
    this.fallbackCount++;
    const res = this.fallback.reply(playerText);
    const rec = this.fallback.turns[this.fallback.turns.length - 1];
    if (rec) {
      rec.cat = this.lastAskedCat;
      this.turns.push(rec);
      for (const j of rec.player.jargon) if (!this.askedJargon.includes(j)) this.askedJargon.push(j);
    }
    this._pushNpc(res.text, { say: res.text, mood: "neutral", strike_delta: 0, event: res.event || "none", asked_cat: this.fallback.lastCat || "none", observed: null });
    this.lastAskedCat = this.fallback.lastCat || this.lastAskedCat;
    if (res.end) this.finished = true;
    return { ...res, viaFallback: true };
  }

  /* 講評(テーマ1つだけ)。失敗時は null を返し、呼び出し側は定型文のまま */
  async review() {
    try {
      const obj = await callClaude({
        apiKey: this.apiKey, model: this.model, fetchImpl: this.fetchImpl,
        system: "あなたは医用機器営業の教育担当。ロールプレイの会話ログを読み、指定された評価テーマだけについて短く講評する。",
        messages: [{ role: "user", content: buildReviewPrompt(this.themeId, this.transcript) }],
        schema: REVIEW_SCHEMA, maxTokens: 2048, effort: "medium",
      });
      const mine = this.transcript.filter((t) => t.who === "me").map((t) => t.text);
      const q = (obj.good_quote || "").trim();
      return {
        goodQuote: q && mine.some((m) => m.includes(q)) ? q : null, // 実在しない引用は捨てる
        point: (obj.improvement_point || "").trim() || null,
        example: (obj.rewrite_example || "").trim() || null,
      };
    } catch (_) {
      return null;
    }
  }
}
