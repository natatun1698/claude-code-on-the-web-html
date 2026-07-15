/* =========================================================
 * engine.js — 田中課長AI(ルールベース対話エンジン)と自動採点
 * センサー営業「価値提案トレーニング」専用。data.js のグローバルに依存する。
 * 評価テーマ:
 *   v1: 特徴ではなく利点・価値を売れ(利点表現+金額/時間換算の検出)
 *   v2: 潜在ニーズを掘る質問(未来・仮定に踏み込む質問の検出)
 * ========================================================= */

/* ---------- 発言解析 ---------- */
function analyzeUtterance(text) {
  const jargon = JARGON.filter((j) => j.re.test(text)).map((j) => j.label);
  const discountTalk = DISCOUNT_RE.test(text);
  const discountRefused = discountTalk && DISCOUNT_REFUSAL_RE.test(text);
  const benefitCats = BENEFIT_CATEGORIES.filter((b) => b.re.test(text)).map((b) => b.id);
  const quantified = QUANT_VALUE_RE.test(text);
  const isQuestion = QUESTION_RE.test(text);
  return {
    text,
    len: text.length,
    jargon,
    hasPlain: PLAIN_MARKERS.test(text),
    conclusionFirst: CONCLUSION_MARKERS.test(text.trim()),
    discountOffered: discountTalk && !discountRefused,
    discountRefused,
    featureTalk: FEATURE_RE.test(text),
    benefitCats,
    quantified,
    customerContext: CUSTOMER_CONTEXT_RE.test(text),
    isQuestion,
    latentQ: isQuestion && LATENT_Q_RE.test(text),
    surfaceQ: isQuestion && SURFACE_Q_RE.test(text),
    nextStep: NEXT_STEP_RE.test(text),
  };
}

/* 特徴語りのみ(利点にも数字にも翻訳されていない)か */
function isFeatureOnly(a) {
  return a.featureTalk && !a.benefitCats.length && !a.quantified;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================================================
 * 田中課長AI
 * respond(playerText) => { text, end, event }
 * ========================================================= */
class RoleAI {
  constructor(sceneId, modeId, themeId) {
    this.scene = SCENES.find((s) => s.id === sceneId);
    this.mode = MODES[modeId];
    this.themeId = themeId;
    this.beatIndex = 0;
    this.nuggetIndex = 0;       // 顕在情報の開示位置
    this.latentIndex = 0;       // 潜在情報(latentNuggets)の開示位置
    this.followupIndex = 0;
    this.strikes = 0;
    this.usedSimplifyB = false;
    this.featurePushCount = 0;  // 特徴語りへの突っ込み回数(上限2)
    this.askedJargon = new Set();
    this.injectedDiscountPush = false;
    this.lastCat = "need";
    this.turns = [];
    this.finished = false;
  }

  openerText() {
    this.lastCat = "need";
    return this.scene.opener[this.mode.id];
  }

  aizuchi() {
    if (this.mode.aizuchi.length && Math.random() < this.mode.aizuchiRate) {
      return pick(this.mode.aizuchi) + " ";
    }
    return "";
  }

  respond(playerText) {
    const a = analyzeUtterance(playerText);
    const rec = {
      player: a, cat: this.lastCat,
      interrupted: false, jargonAsked: null, discountPushed: false, featurePushed: false,
    };
    this.turns.push(rec);

    /* --- 1. モードC: 前置きが長い → 遮る --- */
    if (a.len > this.mode.interruptLen && !a.conclusionFirst) {
      rec.interrupted = true;
      this.strikes++;
      if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      return this.out(rec, pick(INTERRUPT_C));
    }

    /* --- 2. 専門用語 → 必ず聞き返す(同じ用語は1回だけ) --- */
    const newJargon = a.jargon.find((t) => !this.askedJargon.has(t));
    if (newJargon) {
      this.askedJargon.add(newJargon);
      rec.jargonAsked = newJargon;
      if (this.mode.id === "C") {
        this.strikes++;
        if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      }
      const tpl = pick(JARGON_REPLIES[this.mode.id]);
      return this.out(rec, tpl.replace(/\{term\}/g, newJargon));
    }

    /* --- 3. 値引きの申し出 → 相見積もりで揺さぶる --- */
    if (a.discountOffered) {
      rec.discountPushed = true;
      if (this.mode.id === "C") this.strikes++;
      if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      return this.out(rec, DISCOUNT_SHAKE[this.mode.id]);
    }

    /* --- 4. 値引きを断り価値で切り返した → 認める(信頼回復) --- */
    let prefix = "";
    if (a.discountRefused && (a.benefitCats.length || a.quantified)) {
      prefix = VALUE_ACK[this.mode.id] + " ";
      this.strikes = Math.max(0, this.strikes - 1);
    }

    /* --- 5. スペック自慢(特徴語りのみ) → 「うちに何のメリット？」 --- */
    if (isFeatureOnly(a) && !a.isQuestion && this.featurePushCount < 2) {
      this.featurePushCount++;
      rec.featurePushed = true;
      if (this.mode.id === "C") {
        this.strikes++;
        if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      }
      return this.out(rec, FEATURE_PUSHBACK[this.mode.id]);
    }

    /* --- 6. モードB: わかりにくい説明に1回だけ聞き返す --- */
    if (
      this.mode.id === "B" && !this.usedSimplifyB &&
      a.len > 130 && !a.hasPlain && !a.conclusionFirst
    ) {
      this.usedSimplifyB = true;
      return this.out(rec, SIMPLIFY_B);
    }

    /* --- 7. モードC: 短く歯切れよく → 信頼回復 --- */
    if (this.mode.id === "C" && (a.conclusionFirst || a.len <= 60)) {
      this.strikes = Math.max(0, this.strikes - 1);
    }

    /* --- 8. テーマv1: 価格シーン以外でも一度だけ値引き圧をかける --- */
    if (
      this.themeId === "v1" && !this.scene.priceScene &&
      !this.injectedDiscountPush && this.turns.length >= 2
    ) {
      this.injectedDiscountPush = true;
      rec.discountPushed = true;
      this.lastCat = "cost";
      return this.out(rec, prefix + DISCOUNT_PUSH_INJECT[this.mode.id]);
    }

    /* --- 9. ヒアリングシーン: 質問されたときだけ情報を開示 --- */
    if (this.scene.qaDriven) {
      if (a.isQuestion) {
        // 潜在ニーズ質問なら隠れ情報(latentNuggets)を優先開示
        if (a.latentQ && this.latentIndex < (this.scene.latentNuggets || []).length) {
          const n = this.scene.latentNuggets[this.latentIndex++];
          this.lastCat = n.cat;
          rec.latentOpened = true;
          return this.out(rec, prefix + n.text[this.mode.id]);
        }
        if (this.nuggetIndex < this.scene.nuggets.length) {
          const n = this.scene.nuggets[this.nuggetIndex++];
          this.lastCat = n.cat;
          return this.out(rec, prefix + this.aizuchi() + n.text[this.mode.id]);
        }
        if (this.latentIndex < (this.scene.latentNuggets || []).length) {
          // 顕在情報が尽きたら、良い質問でなくても最後は匂わせて締めに向かう
          return this.finishScene(rec, prefix);
        }
        return this.finishScene(rec, prefix);
      }
      if (this.mode.id === "C") {
        this.strikes++;
        if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      }
      return this.out(rec, prefix + this.scene.noQuestion[this.mode.id]);
    }

    /* --- 10. 通常シーン: 次のbeatへ --- */
    if (this.beatIndex < this.scene.beats.length) {
      const beat = this.scene.beats[this.beatIndex++];
      this.lastCat = beat.cat;
      if (beat.discountPush) rec.discountPushed = true;
      return this.out(rec, prefix + this.aizuchi() + beat.ask[this.mode.id]);
    }

    /* --- 11. followup → クローズ --- */
    if (this.followupIndex < (this.scene.followups || []).length) {
      const f = this.scene.followups[this.followupIndex++];
      this.lastCat = f.cat;
      if (f.discountPush) rec.discountPushed = true;
      return this.out(rec, prefix + this.aizuchi() + f.ask[this.mode.id]);
    }

    return this.finishScene(rec, prefix);
  }

  finishScene(rec, prefix = "") {
    this.finished = true;
    return this.out(rec, prefix + this.scene.closer[this.mode.id], "done", true);
  }

  walkout(rec) {
    this.finished = true;
    return this.out(rec, WALKOUT_C, "walkout", true);
  }

  out(rec, text, event = null, end = false) {
    rec.npc = text;
    return { text, event, end };
  }
}

/* =========================================================
 * 自動採点 — 選んだテーマ1つだけを評価
 * ========================================================= */
function scoreSession(engine, walkout) {
  const turns = engine.turns.filter((t) => t.player && t.player.text.trim());
  let result;
  if (!turns.length) {
    result = {
      score: 0, grade: "×", goodQuote: null,
      improvement: {
        point: `発言がありませんでした。まずは一言、${ROLE_LABEL}に話しかけてみましょう。`,
        example: "「本日はお時間をいただきありがとうございます。結論から申しますと〜」",
      },
    };
  } else if (engine.themeId === "v1") result = scoreV1(turns);
  else result = scoreV2(turns);

  if (walkout) result.score = Math.max(0, result.score - 15);
  result.score = Math.max(0, Math.min(100, Math.round(result.score)));
  result.grade = gradeFor(result.score);
  result.title = titleFor(result.score);
  result.walkout = walkout;
  return result;
}

function gradeFor(score) {
  if (score >= 85) return "◎";
  if (score >= 70) return "○";
  if (score >= 50) return "△";
  return "×";
}

/* --- テーマv1: 特徴ではなく利点・価値を売れ --- */
function scoreV1(turns) {
  let score = 40; // 価値への翻訳を積み上げる加点型
  let featureOnlyCount = 0;
  let featureOnlyQuote = null;
  let quantCount = 0;
  let contextBonus = 0;
  let offered = 0;
  const catsUsed = new Set();
  let goodQuote = null;
  let bestRank = -1;

  turns.forEach((t, i) => {
    const a = t.player;
    if (a.discountOffered) { offered++; score -= 25; }
    if (isFeatureOnly(a) && !a.isQuestion) {
      featureOnlyCount++;
      score -= 8;
      if (!featureOnlyQuote) featureOnlyQuote = a.text;
    }
    for (const c of a.benefitCats) {
      if (!catsUsed.has(c)) { catsUsed.add(c); score += 8; }
    }
    if (a.quantified && (a.benefitCats.length || a.featureTalk || a.discountRefused)) {
      if (quantCount < 3) score += 12;
      quantCount++;
      // 値引き圧の直後に数字で切り返せたらさらに加点
      if (i > 0 && turns[i - 1].discountPushed) score += 10;
    }
    if (a.customerContext && (a.benefitCats.length || a.quantified) && contextBonus < 2) {
      contextBonus++;
      score += 6;
    }
    // 良かった発言: 利点+数字 > 利点のみ の順で選ぶ
    const rank = (a.quantified ? 2 : 0) + (a.benefitCats.length ? 1 : 0);
    if (rank > bestRank && !a.discountOffered && rank > 0) {
      bestRank = rank;
      goodQuote = a.text;
    }
  });

  const improvement = offered
    ? FEEDBACK.v1.discount()
    : featureOnlyCount > 0
    ? FEEDBACK.v1.featureOnly(truncate(featureOnlyQuote, 40))
    : quantCount === 0
    ? FEEDBACK.v1.noQuant()
    : FEEDBACK.v1.good();
  return {
    score, grade: "", goodQuote, improvement,
    detail: `利点カテゴリ: ${catsUsed.size}種類 ／ 金額・時間換算: ${quantCount}回 ／ 特徴語りのみ: ${featureOnlyCount}回`,
  };
}

/* --- テーマv2: 潜在ニーズを掘る質問 --- */
function scoreV2(turns) {
  let score = 30;
  let latentCount = 0;
  let surfaceCount = 0;
  let questionCount = 0;
  let offered = 0;
  let noQStreak = 0;
  let maxNoQStreak = 0;
  let goodQuote = null;

  turns.forEach((t, i) => {
    const a = t.player;
    if (a.discountOffered) { offered++; score -= 25; }
    if (a.isQuestion) {
      questionCount++;
      noQStreak = 0;
      if (a.latentQ) {
        latentCount++;
        if (latentCount <= 3) score += 15;
        if (!goodQuote || t.latentOpened) goodQuote = a.text;
      } else {
        surfaceCount++;
        if (surfaceCount <= 4) score += 4;
        if (!goodQuote) goodQuote = a.text;
      }
    } else {
      noQStreak++;
      maxNoQStreak = Math.max(maxNoQStreak, noQStreak);
    }
    // 値引き圧に質問(価値の材料集め)で返すのも良い流れ
    if (i > 0 && turns[i - 1].discountPushed && a.isQuestion && !a.discountOffered) score += 6;
  });

  if (maxNoQStreak >= 3) score -= 10;

  const improvement = offered
    ? FEEDBACK.v2.discount()
    : questionCount === 0 || maxNoQStreak >= 3
    ? FEEDBACK.v2.noQuestion()
    : latentCount === 0
    ? FEEDBACK.v2.surfaceOnly()
    : FEEDBACK.v2.good();
  return {
    score, grade: "", goodQuote, improvement,
    detail: `質問: ${questionCount}回(うち潜在ニーズ質問: ${latentCount}回)`,
  };
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
