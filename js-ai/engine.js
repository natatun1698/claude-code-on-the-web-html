/* =========================================================
 * js-ai/engine.js — 生成AI版の対話エンジン
 *
 * 元の ../js/engine.js を先に読み込み、RoleAI をそのまま継承する。
 * ルール(応答優先順位・状態管理)と採点(scoreSession)は元のコードが
 * そのまま動くので、手番と点数は元アプリと必ず一致する。
 *
 * このクラスが足すのは「元エンジンが今どの手番を選んだか」の観測だけ。
 * 文面を生成AIに書かせるかどうかは llm.js が決める。
 *
 * 手番(move):
 *   INTERRUPT / WALKOUT / SIMPLIFY ... 定型セリフのまま(生成AIを呼ばない)
 *   ASK_JARGON / DISCOUNT_SHAKE / DISCOUNT_PUSH / BEAT / FOLLOWUP /
 *   NUGGET / NO_QUESTION / CLOSE ... 文面を生成AIに任せてよい
 * ========================================================= */

class AIRoleEngine extends RoleAI {
  openerText() {
    this.opener = super.openerText();
    return this.opener;
  }

  /* 元エンジンに1ターン進めさせ、選ばれた手番を返す。
   * 返り値: { move, modeId, term, ack, mustPush, cat, ref, canned, event, end, rec } */
  decide(playerText) {
    const before = {
      beat: this.beatIndex,
      followup: this.followupIndex,
      nugget: this.nuggetIndex,
      simplify: this.usedSimplifyB,
      inject: this.injectedDiscountPush,
    };
    const res = super.respond(playerText);
    const rec = this.turns[this.turns.length - 1];
    const a = rec.player;

    let move;
    let ref = null;
    if (res.event === "walkout") move = "WALKOUT";
    else if (rec.interrupted) move = "INTERRUPT";
    else if (rec.jargonAsked) move = "ASK_JARGON";
    else if (this.usedSimplifyB && !before.simplify) move = "SIMPLIFY";
    else if (this.injectedDiscountPush && !before.inject) move = "DISCOUNT_PUSH";
    else if (this.beatIndex > before.beat) { move = "BEAT"; ref = before.beat; }
    else if (this.followupIndex > before.followup) { move = "FOLLOWUP"; ref = before.followup; }
    else if (this.nuggetIndex > before.nugget) { move = "NUGGET"; ref = before.nugget; }
    else if (res.event === "done") move = "CLOSE";
    else if (a.discountOffered) move = "DISCOUNT_SHAKE";
    else move = "NO_QUESTION";

    const ackText = VALUE_ACK[this.mode.id];
    return {
      move,
      modeId: this.mode.id,
      term: rec.jargonAsked,
      ack: a.discountRefused && a.valueCats.length >= 1 && res.text.startsWith(ackText),
      mustPush: !!rec.discountPushed && move !== "DISCOUNT_SHAKE",
      cat: this.lastCat,
      ref,
      canned: res.text,
      event: res.event,
      end: res.end,
      rec,
    };
  }

  /* 実際に顧客役が話した文面を記録する(採点は rec.npc を使わない) */
  commit(decision, text) {
    decision.rec.npc = text;
    decision.rec.npcCommitted = true;
  }

  /* 生成AIに渡す直近の会話。プレイヤー発言は長さを切り詰める。 */
  history(maxTurns, maxPlayerChars) {
    const out = [];
    if (this.opener) out.push({ role: "customer", text: this.opener });
    for (const t of this.turns) {
      out.push({ role: "sales", text: t.player.text.slice(0, maxPlayerChars) });
      if (t.npc && t.npcCommitted) out.push({ role: "customer", text: t.npc });
    }
    return out.slice(-(maxTurns * 2 + 1));
  }
}
