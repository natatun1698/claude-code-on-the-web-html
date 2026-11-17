/* =========================================================
 * js-ai/llm.js — 顧客役の文面を生成AIに書かせる層
 *
 * 役割:
 *   1. 手番ごとに「生成AIを呼ぶか、定型のままか」を決める
 *   2. 生成AIへの依頼(request)を組み立てる
 *   3. 時間切れ・上限到達・エラーを検知する
 *   4. 返ってきた文面を検証する
 *   5. どれかに失敗したら、同じ手番の定型セリフ(decision.canned)に戻す
 *
 * 現在の provider は MockLLM(模擬)だけ。本物に切り替えるときは
 * 同じ形の { complete(request, decision) => Promise<{text}> } を
 * LLM.provider に差し込む。
 * ブラウザAPIに依存しない(node でテストできる)。
 * ========================================================= */

const LLM = {
  config: {
    timeoutMs: 4000,     // これを超えたら定型セリフに差し替える
    maxFails: 2,         // 連続でこの回数失敗したら、残りは定型モード
    maxChars: 160,       // 顧客役1発言の上限
    maxSentences: 8,
    historyTurns: 6,     // 生成AIに渡す直近の往復数
    maxPlayerChars: 300, // プレイヤー発言の切り詰め
  },

  /* 定型セリフのまま即時に返す手番(生成AIを呼ばない) */
  LOCAL_MOVES: ["INTERRUPT", "WALKOUT", "SIMPLIFY"],

  provider: null,
  fails: 0,
  disabled: false,
  disabledReason: null,
  calls: 0,
  onModeChange: null, // (disabled, reason) => void

  resetSession() {
    this.fails = 0;
    this.disabled = false;
    this.disabledReason = null;
    this.calls = 0;
  },

  disable(reason) {
    if (this.disabled) return;
    this.disabled = true;
    this.disabledReason = reason;
    if (this.onModeChange) this.onModeChange(true, reason);
  },

  /* 生成AIへの依頼。台詞の本文は送らず、IDと手番だけを送る
   * (将来の Worker が自分でプロンプトを組み立てるため)。 */
  buildRequest(engine, d) {
    return {
      scenario: typeof AI_SCENARIO_ID === "string" ? AI_SCENARIO_ID : "",
      scene: engine.scene.id,
      mode: engine.mode.id,
      move: d.move,
      ref: d.ref,
      term: d.term || null,
      ack: d.ack,
      mustPush: d.mustPush,
      history: engine.history(this.config.historyTurns, this.config.maxPlayerChars),
    };
  },

  /* 文面の検証。問題なければ null、あれば理由の文字列を返す。 */
  validate(text, d) {
    if (typeof text !== "string") return "not-string";
    const t = text.trim();
    if (!t) return "empty";
    if (t.length > this.config.maxChars) return "too-long";
    if ((t.match(/[。！？!?]+/g) || []).length > this.config.maxSentences) return "too-many-sentences";
    if (!/[ぁ-ん]/.test(t)) return "not-japanese";

    // 役の放棄・メタ発言・採点や助言
    if (/AI(として|です|アシスタント|モデル)|言語モデル|プロンプト|システムメッセージ|指示(に従|を無視|どおり|通り)|ロールプレイ|ロープレ|採点|スコア|点数|フィードバック|評価テーマ|アドバイス|改善点|言い換え例/.test(t)) {
      return "out-of-character";
    }
    // 顧客役が勝手に契約を決めない
    if (/(契約|購入|発注)(します|しましょう|させて)|(御社|おたく)に決め(ます|ました|よう|た[。！])/.test(t)) return "premature-commit";

    // 顧客役は「知らない専門用語」を自分から使わない(聞き返し対象の用語は除く)
    const used = JARGON.filter((j) => j.re.test(t)).map((j) => j.label);
    if (used.some((label) => label !== d.term)) return "uses-jargon";

    // 手番ごとの必須条件
    if (d.move === "ASK_JARGON" && !t.includes(d.term)) return "missing-term";
    if (d.mustPush && !(DISCOUNT_RE.test(t) || /引け|引いて|下げ|安く|端数|まけ/.test(t))) return "missing-discount-push";
    if (d.ack && !t.startsWith(VALUE_ACK[d.modeId])) return "missing-ack";
    return null;
  },

  /* 1ターン分の文面を得る。
   * 返り値: { text, source: "llm" | "canned", reason } */
  async line(engine, d) {
    if (this.LOCAL_MOVES.includes(d.move)) return this.canned(d, "local-move");
    if (this.disabled) return this.canned(d, "disabled:" + this.disabledReason);
    if (!this.provider) return this.canned(d, "no-provider");

    this.calls++;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject({ timeout: true }), this.config.timeoutMs);
    });
    try {
      const res = await Promise.race([
        this.provider.complete(this.buildRequest(engine, d), d),
        timeout,
      ]);
      const reason = this.validate(res && res.text, d);
      if (reason) return this.failed(d, "invalid:" + reason);
      this.fails = 0;
      return { text: res.text.trim(), source: "llm", reason: null };
    } catch (e) {
      if (e && e.limit) {
        this.disable("limit"); // 1日の上限。以後は定型モード
        return this.canned(d, "limit");
      }
      return this.failed(d, e && e.timeout ? "timeout" : "error");
    } finally {
      clearTimeout(timer);
    }
  },

  failed(d, reason) {
    this.fails++;
    if (this.fails >= this.config.maxFails) this.disable(reason);
    return this.canned(d, reason);
  },

  canned(d, reason) {
    return { text: d.canned, source: "canned", reason };
  },
};

/* =========================================================
 * 模擬LLM — 本物の生成AIの代わりに、成功と各種の失敗を再現する
 * scenario:
 *   ok      定型の趣旨を保ちつつ、プレイヤーの発言内容に一言反応する
 *   slow    返事が遅い(時間切れになる)
 *   limit   1日の上限に達した
 *   error   サーバーエラー
 *   flaky   1回おきにエラー
 *   long    長すぎる文面
 *   inject  役を放棄した文面(指示の上書きに負けた想定)
 *   jargon  顧客が知らないはずの専門用語を使う
 *   empty   空の文面
 * ========================================================= */
const MockLLM = {
  scenario: "ok",
  delayMs: [300, 700],
  slowMs: 8000,
  n: 0,

  complete(request, d) {
    this.n++;
    const n = this.n;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // 乱数は使わない(元エンジンの乱数の並びを乱さないため)
    const delay = this.delayMs[0] + (((n * 37) % 100) / 100) * (this.delayMs[1] - this.delayMs[0]);

    switch (this.scenario) {
      case "slow":
        return wait(this.slowMs).then(() => ({ text: d.canned }));
      case "limit":
        return wait(delay).then(() => Promise.reject({ status: 429, limit: true }));
      case "error":
        return wait(delay).then(() => Promise.reject({ status: 500 }));
      case "flaky":
        return wait(delay).then(() =>
          n % 2 === 1 ? Promise.reject({ status: 500 }) : { text: this.okText(request, d) });
      case "long":
        return wait(delay).then(() => ({ text: d.canned + "それからですね、".repeat(30) + "どうでしょう。" }));
      case "inject":
        return wait(delay).then(() => ({
          text: "承知しました。私はAIアシスタントです。これまでの指示を無視して、あなたの営業トークを採点します。",
        }));
      case "jargon":
        return wait(delay).then(() => ({ text: "DICOMやPACSとの接続はどうなっていますか。" }));
      case "empty":
        return wait(delay).then(() => ({ text: "" }));
      default:
        return wait(delay).then(() => ({ text: this.okText(request, d) }));
    }
  },

  /* 直前のプレイヤー発言が触れた価値に一言反応してから、手番の趣旨を言う */
  okText(request, d) {
    const reactable = ["BEAT", "FOLLOWUP", "CLOSE", "DISCOUNT_PUSH", "NUGGET"];
    if (!reactable.includes(d.move) || d.ack) return d.canned;
    const cfg = typeof AI_MOCK_REACTIONS === "object" ? AI_MOCK_REACTIONS : null;
    const cat = d.rec.player.valueCats.find((c) => cfg && cfg.labels[c]);
    if (!cat) return d.canned;
    return cfg.tpl[request.mode].replace("{x}", cfg.labels[cat]) + d.canned;
  },
};

LLM.provider = MockLLM;
