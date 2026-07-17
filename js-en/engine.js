/* =========================================================
 * engine.js — Rule-based counterpart AI and automatic scoring.
 * Shared logic reused across every English-language scenario
 * (bucho-en, etc.). Product, dialogue, and feedback copy for each
 * scenario live in that scenario's data.js.
 * Globals data.js must provide:
 *   ROLE_LABEL, JARGON, PLAIN_MARKERS, CONCLUSION_MARKERS,
 *   DISCOUNT_RE, DISCOUNT_REFUSAL_RE, VALUE_CATEGORIES, NEXT_STEP_RE,
 *   QUESTION_RE, MODES, THEMES, TITLES, titleFor(), SCENES,
 *   JARGON_REPLIES, DISCOUNT_SHAKE, VALUE_ACK, INTERRUPT_C,
 *   SIMPLIFY_B, WALKOUT_C, DISCOUNT_PUSH_INJECT,
 *   CAT_KEYWORDS, CAT_NAMES, FEEDBACK
 * ========================================================= */

/* ---------- Utterance analysis ---------- */
function analyzeUtterance(text) {
  const jargon = JARGON.filter((j) => j.re.test(text)).map((j) => j.label);
  const hasPlain = PLAIN_MARKERS.test(text);
  const discountTalk = DISCOUNT_RE.test(text);
  const discountRefused = discountTalk && DISCOUNT_REFUSAL_RE.test(text);
  const valueCats = VALUE_CATEGORIES.filter((v) => v.re.test(text)).map((v) => v.id);
  return {
    text,
    len: text.length,
    jargon,
    hasPlain,
    conclusionFirst: CONCLUSION_MARKERS.test(text.trim()),
    discountOffered: discountTalk && !discountRefused, // offered a discount (bad)
    discountRefused,                                   // refused a discount (good)
    valueCats,
    isQuestion: QUESTION_RE.test(text),
    nextStep: NEXT_STEP_RE.test(text),
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================================================
 * Counterpart AI
 * respond(playerText) => { text, end, event }
 *   event: "walkout" | "done" (scene complete) | null
 * ========================================================= */
class RoleAI {
  constructor(sceneId, modeId, themeId) {
    this.scene = SCENES.find((s) => s.id === sceneId);
    this.mode = MODES[modeId];
    this.themeId = themeId;
    this.beatIndex = 0;      // next beat to advance to
    this.nuggetIndex = 0;    // info already revealed in the hearing scene
    this.followupIndex = 0;
    this.strikes = 0;        // mode C: accumulated unclear-answer strikes
    this.usedSimplifyB = false;
    this.askedJargon = new Set(); // never ask back about the same term twice
    this.injectedDiscountPush = false; // theme 2: inject discount pressure once outside the price scene
    this.lastCat = "need";   // category of the counterpart's last question (for scoring)
    this.turns = [];         // {player:analysis, npc:text, cat, interrupted, jargonAsked, discountPushed}
    this.finished = false;
  }

  openerText() {
    const t = this.scene.opener[this.mode.id];
    this.lastCat = "need";
    return t;
  }

  /* Acknowledgment murmur (mostly mode A) */
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
      interrupted: false, jargonAsked: null, discountPushed: false,
    };
    this.turns.push(rec);

    /* --- 1. Mode C: long preamble -> interrupt --- */
    if (a.len > this.mode.interruptLen && !a.conclusionFirst) {
      rec.interrupted = true;
      this.strikes++;
      if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      return this.out(rec, pick(INTERRUPT_C));
    }

    /* --- 2. Jargon -> always ask back (same term only once) --- */
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

    /* --- 3. Player offered a discount -> push back --- */
    if (a.discountOffered) {
      rec.discountPushed = true;
      if (this.mode.id === "C") this.strikes++;
      if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      return this.out(rec, pick(DISCOUNT_SHAKE[this.mode.id]));
    }

    /* --- 4. Refused discount and countered with value -> acknowledge + move on --- */
    let prefix = "";
    if (a.discountRefused && a.valueCats.length >= 1) {
      prefix = VALUE_ACK[this.mode.id] + " ";
      this.strikes = Math.max(0, this.strikes - 1); // a good comeback restores trust
    }

    /* --- 5. Mode B: ask for clarification once on a confusing explanation --- */
    if (
      this.mode.id === "B" && !this.usedSimplifyB &&
      a.len > 130 && !a.hasPlain && !a.conclusionFirst
    ) {
      this.usedSimplifyB = true;
      return this.out(rec, SIMPLIFY_B);
    }

    /* --- 6. Mode C: a short, crisp answer restores trust --- */
    if (this.mode.id === "C" && (a.conclusionFirst || a.len <= 60)) {
      this.strikes = Math.max(0, this.strikes - 1);
    }

    /* --- 7. Theme 2: apply discount pressure once even outside the price scene --- */
    if (
      this.themeId === "t2" && !this.scene.priceScene &&
      !this.injectedDiscountPush && this.turns.length >= 2
    ) {
      this.injectedDiscountPush = true;
      rec.discountPushed = true;
      this.lastCat = "cost";
      return this.out(rec, prefix + DISCOUNT_PUSH_INJECT[this.mode.id]);
    }

    /* --- 8. Hearing scene: only reveal info when asked --- */
    if (this.scene.qaDriven) {
      if (a.isQuestion) {
        if (this.nuggetIndex < this.scene.nuggets.length) {
          const n = this.scene.nuggets[this.nuggetIndex++];
          this.lastCat = n.cat;
          return this.out(rec, prefix + this.aizuchi() + n.text[this.mode.id]);
        }
        return this.finishScene(rec, prefix);
      }
      if (this.mode.id === "C") {
        this.strikes++;
        if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      }
      return this.out(rec, prefix + this.scene.noQuestion[this.mode.id]);
    }

    /* --- 9. Normal scene: advance to the next beat --- */
    if (this.beatIndex < this.scene.beats.length) {
      const beat = this.scene.beats[this.beatIndex++];
      this.lastCat = beat.cat;
      if (beat.discountPush) rec.discountPushed = true;
      return this.out(rec, prefix + this.aizuchi() + beat.ask[this.mode.id]);
    }

    /* --- 10. Once beats run out: followup -> closer --- */
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
 * Automatic scoring — evaluates only the one theme chosen.
 * Returns: { score, grade, title, goodQuote, improvement:{point, example}, walkout }
 * ========================================================= */
function scoreSession(engine, walkout) {
  const turns = engine.turns.filter((t) => t.player && t.player.text.trim());
  const themeId = engine.themeId;
  let result;
  if (!turns.length) {
    result = {
      score: 0, grade: "×", goodQuote: null,
      improvement: {
        point: `You didn't say anything. Start by saying just one line to the ${ROLE_LABEL}.`,
        example: "\"Thank you for your time today. To conclude, ...\"",
      },
    };
  } else if (themeId === "t1") result = scoreT1(turns);
  else if (themeId === "t2") result = scoreT2(turns);
  else if (themeId === "t3") result = scoreT3(turns);
  else result = scoreT4(turns);

  if (walkout) result.score = Math.max(0, result.score - 15); // penalty for walkout
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

/* --- Theme 1: explaining without jargon --- */
function scoreT1(turns) {
  let score = 100;
  let jargonCount = 0;
  let worstTerm = null;
  let plainBonus = 0;
  let goodQuote = null;

  for (const t of turns) {
    const a = t.player;
    for (const term of a.jargon) {
      jargonCount++;
      // half penalty if the same utterance also includes a plain-language rephrase
      score -= a.hasPlain ? 6 : 12;
      if (!worstTerm && !a.hasPlain) worstTerm = term;
      if (!worstTerm) worstTerm = term;
    }
    if (a.hasPlain && !a.jargon.length) {
      plainBonus = Math.min(plainBonus + 4, 12);
      if (!goodQuote || a.text.length > goodQuote.length) goodQuote = a.text;
    }
  }
  score += plainBonus;

  if (!goodQuote) {
    // quote the longest jargon-free, explanation-like utterance
    const clean = turns.filter((t) => !t.player.jargon.length);
    if (clean.length) {
      goodQuote = clean.reduce((b, t) => (t.player.len > b.player.len ? t : b), clean[0]).player.text;
    }
  }

  const improvement = worstTerm ? FEEDBACK.t1.bad(worstTerm) : FEEDBACK.t1.good();
  return { score, grade: "", goodQuote, improvement, detail: `Jargon used: ${jargonCount} time(s)` };
}

/* --- Theme 2: countering discount requests --- */
function scoreT2(turns) {
  let score = 60; // additive scoring built up from value points offered
  let offered = 0;
  const catsUsed = new Set();
  let goodQuote = null;
  let bestCats = 0;
  let answeredPush = false;

  turns.forEach((t, i) => {
    const a = t.player;
    if (a.discountOffered) {
      offered++;
      score -= 30;
    }
    if (a.discountRefused) score += 10;
    // weight the utterance right after the counterpart applies discount pressure
    const pushed = i > 0 && turns[i - 1].discountPushed;
    for (const c of a.valueCats) {
      if (!catsUsed.has(c)) {
        catsUsed.add(c);
        score += pushed ? 10 : 6;
      }
    }
    if (pushed && a.valueCats.length) answeredPush = true;
    if (a.valueCats.length > bestCats && !a.discountOffered) {
      bestCats = a.valueCats.length;
      goodQuote = a.text;
    }
  });

  if (offered === 0 && answeredPush) score += 10;

  const improvement = offered
    ? FEEDBACK.t2.offered()
    : catsUsed.size < 3
    ? FEEDBACK.t2.lowValue(catsUsed.size)
    : FEEDBACK.t2.sufficient();
  return { score, grade: "", goodQuote, improvement, detail: `Value categories: ${catsUsed.size} / Discount mentions: ${offered}` };
}

/* --- Theme 3: leading with the conclusion, concisely --- */
function scoreT3(turns) {
  let score = 100;
  let interrupted = 0;
  let longCount = 0;
  let conclusionCount = 0;
  let goodQuote = null;

  const avg = turns.reduce((s, t) => s + t.player.len, 0) / turns.length;
  for (const t of turns) {
    const a = t.player;
    if (t.interrupted) { interrupted++; score -= 12; }
    else if (a.len > 120) { longCount++; score -= 6; }
    if (a.conclusionFirst) {
      conclusionCount++;
      score += 4;
      if (!goodQuote) goodQuote = a.text;
    }
  }
  if (avg > 100) score -= 10;
  if (conclusionCount === 0) score -= 10;
  if (!goodQuote) {
    const short = turns.filter((t) => t.player.len <= 80 && t.player.len >= 15);
    if (short.length) goodQuote = short[0].player.text;
  }

  const improvement = interrupted || longCount
    ? FEEDBACK.t3.longOrInterrupted()
    : conclusionCount === 0
    ? FEEDBACK.t3.noConclusion()
    : FEEDBACK.t3.good();
  return { score, grade: "", goodQuote, improvement, detail: `Average length: ${Math.round(avg)} chars / Times interrupted: ${interrupted}` };
}

/* --- Theme 4: grasping the intent of a question --- */
function scoreT4(turns) {
  let asked = 0, hit = 0;
  let goodQuote = null;
  let missedCat = null;

  for (const t of turns) {
    const cat = t.cat;
    if (!cat || !CAT_KEYWORDS[cat]) continue;
    asked++;
    const a = t.player;
    const matched = CAT_KEYWORDS[cat].test(a.text);
    if (matched) {
      hit++;
      if (!goodQuote || a.len < goodQuote.length) goodQuote = a.text;
    } else if (!missedCat) {
      missedCat = cat;
    }
  }
  const ratio = asked ? hit / asked : 0;
  let score = 30 + ratio * 70;

  const improvement = missedCat ? FEEDBACK.t4.missed(CAT_NAMES[missedCat]) : FEEDBACK.t4.good();
  return { score, grade: "", goodQuote, improvement, detail: `Questions answered on-target: ${hit}/${asked}` };
}
