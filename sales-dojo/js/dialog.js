/* =========================================================
 * dialog.js — 事務長AI(ルールベース)と自動採点
 * ブラウザAPI非依存。node でも単体テスト可能。
 * ========================================================= */

/* ---------- 発言解析 ---------- */
function analyze(text) {
  const jargon = JARGON.filter((j) => j.re.test(text)).map((j) => j.label);
  const discountTalk = DISCOUNT_RE.test(text);
  const refused = discountTalk && DISCOUNT_REFUSAL_RE.test(text);
  return {
    text,
    len: text.length,
    jargon,
    hasPlain: PLAIN_MARKERS.test(text),
    conclusionFirst: CONCLUSION_MARKERS.test(text.trim()),
    discountOffered: discountTalk && !refused,
    discountRefused: refused,
    valueCats: VALUE_CATEGORIES.filter((v) => v.re.test(text)).map((v) => v.id),
    isQuestion: QUESTION_RE.test(text),
    nextStep: NEXT_STEP_RE.test(text),
  };
}

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================================================
 * 事務長AI
 * reply(playerText) => { text, event, end }
 *   event: "walkout" | "done" | null
 * ========================================================= */
class CustomerAI {
  constructor(sceneId, modeId, themeId) {
    this.scene = SCENES.find((s) => s.id === sceneId);
    this.mode = MODES[modeId];
    this.themeId = themeId;
    this.beatIdx = 0;
    this.nuggetIdx = 0;
    this.followIdx = 0;
    this.strikes = 0;               // モードC: 打ち切りカウント
    this.simplifyUsed = false;      // モードB: 聞き返しは1回だけ
    this.askedJargon = new Set();   // 同じ用語は1回だけ聞き返す
    this.pushInjected = false;      // テーマ2の値引き圧注入は1回だけ
    this.lastCat = "need";
    this.turns = [];                // 採点用ログ
    this.finished = false;
  }

  opener() {
    return this.scene.opener[this.mode.id];
  }

  aizuchi() {
    const m = this.mode;
    return m.aizuchi.length && Math.random() < m.aizuchiRate ? randomOf(m.aizuchi) + " " : "";
  }

  reply(playerText) {
    const a = analyze(playerText);
    const rec = { player: a, cat: this.lastCat, interrupted: false, jargonAsked: null, discountPushed: false };
    this.turns.push(rec);

    /* 1. モードC: 結論のない長話は遮る */
    if (a.len > this.mode.interruptLen && !a.conclusionFirst) {
      rec.interrupted = true;
      if (++this.strikes >= this.mode.maxStrikes) return this._walkout(rec);
      return this._say(rec, randomOf(INTERRUPT_C));
    }

    /* 2. 専門用語には必ず聞き返す(同じ用語は1回) */
    const term = a.jargon.find((t) => !this.askedJargon.has(t));
    if (term) {
      this.askedJargon.add(term);
      rec.jargonAsked = term;
      if (this.mode.id === "C" && ++this.strikes >= this.mode.maxStrikes) return this._walkout(rec);
      return this._say(rec, randomOf(JARGON_REPLIES[this.mode.id]).replace(/\{term\}/g, term));
    }

    /* 3. 値引きの申し出には揺さぶり */
    if (a.discountOffered) {
      rec.discountPushed = true;
      if (this.mode.id === "C" && ++this.strikes >= this.mode.maxStrikes) return this._walkout(rec);
      return this._say(rec, randomOf(DISCOUNT_SHAKE[this.mode.id]));
    }

    /* 4. 値引きを断り価値で切り返した → 認めて前進 */
    let prefix = "";
    if (a.discountRefused && a.valueCats.length) {
      prefix = VALUE_ACK[this.mode.id] + " ";
      this.strikes = Math.max(0, this.strikes - 1);
    }

    /* 5. モードB: わかりにくい長話に1回だけ聞き返す */
    if (this.mode.id === "B" && !this.simplifyUsed && a.len > 130 && !a.hasPlain && !a.conclusionFirst) {
      this.simplifyUsed = true;
      return this._say(rec, SIMPLIFY_B);
    }

    /* 6. モードC: 歯切れのよい返答で信頼回復 */
    if (this.mode.id === "C" && (a.conclusionFirst || a.len <= 60)) {
      this.strikes = Math.max(0, this.strikes - 1);
    }

    /* 7. テーマ2: 価格シーン以外でも1回だけ値引き圧を注入 */
    if (this.themeId === "t2" && !this.scene.priceScene && !this.pushInjected && this.turns.length >= 2) {
      this.pushInjected = true;
      rec.discountPushed = true;
      this.lastCat = "cost";
      return this._say(rec, prefix + DISCOUNT_PUSH_INJECT[this.mode.id]);
    }

    /* 8. ヒアリング: 質問されたときだけ課題を1つ開示 */
    if (this.scene.qaDriven) {
      if (a.isQuestion) {
        if (this.nuggetIdx < this.scene.nuggets.length) {
          const n = this.scene.nuggets[this.nuggetIdx++];
          this.lastCat = n.cat;
          return this._say(rec, prefix + this.aizuchi() + n.text[this.mode.id]);
        }
        return this._finish(rec, prefix);
      }
      if (this.mode.id === "C" && ++this.strikes >= this.mode.maxStrikes) return this._walkout(rec);
      return this._say(rec, prefix + this.scene.noQuestion[this.mode.id]);
    }

    /* 9. 通常シーン: beat → followup → クローズ */
    if (this.beatIdx < this.scene.beats.length) {
      const b = this.scene.beats[this.beatIdx++];
      this.lastCat = b.cat;
      if (b.discountPush) rec.discountPushed = true;
      return this._say(rec, prefix + this.aizuchi() + b.ask[this.mode.id]);
    }
    if (this.followIdx < (this.scene.followups || []).length) {
      const f = this.scene.followups[this.followIdx++];
      this.lastCat = f.cat;
      return this._say(rec, prefix + this.aizuchi() + f.ask[this.mode.id]);
    }
    return this._finish(rec, prefix);
  }

  _finish(rec, prefix = "") {
    this.finished = true;
    return this._say(rec, prefix + this.scene.closer[this.mode.id], "done", true);
  }

  _walkout(rec) {
    this.finished = true;
    return this._say(rec, WALKOUT_C, "walkout", true);
  }

  _say(rec, text, event = null, end = false) {
    rec.npc = text;
    return { text, event, end };
  }
}

/* =========================================================
 * 自動採点 — 選択テーマ1つだけを評価
 * => { score, grade, title, goodQuote, improvement:{point,example}, detail, walkout }
 * ========================================================= */
function scoreSession(ai, walkout) {
  const turns = ai.turns.filter((t) => t.player && t.player.text.trim());
  let r;
  if (!turns.length) {
    r = {
      score: 0, goodQuote: null, detail: "発言なし",
      improvement: {
        point: `発言がありませんでした。まずは一言、${CUSTOMER_NAME}に話しかけてみましょう。`,
        example: "「本日はお時間をいただきありがとうございます。結論から申しますと〜」",
      },
    };
  } else {
    r = { t1: _scoreT1, t2: _scoreT2, t3: _scoreT3, t4: _scoreT4 }[ai.themeId](turns);
  }
  if (walkout) r.score -= 15;
  r.score = Math.max(0, Math.min(100, Math.round(r.score)));
  r.grade = r.score >= 85 ? "◎" : r.score >= 70 ? "○" : r.score >= 50 ? "△" : "×";
  r.title = titleFor(r.score);
  r.walkout = !!walkout;
  return r;
}

/* テーマ1: 専門用語を使わない説明 */
function _scoreT1(turns) {
  let score = 100, count = 0, worst = null, bonus = 0, quote = null;
  for (const t of turns) {
    const a = t.player;
    for (const term of a.jargon) {
      count++;
      score -= a.hasPlain ? 6 : 12; // 同じ発言内で言い換えていれば減点半分
      if (!worst) worst = term;
    }
    if (a.hasPlain && !a.jargon.length) {
      bonus = Math.min(bonus + 4, 12);
      if (!quote || a.text.length > quote.length) quote = a.text;
    }
  }
  score += bonus;
  if (!quote) {
    const clean = turns.filter((t) => !t.player.jargon.length);
    if (clean.length) quote = clean.reduce((b, t) => (t.player.len > b.player.len ? t : b)).player.text;
  }
  return {
    score, goodQuote: quote,
    improvement: worst ? FEEDBACK.t1.bad(worst) : FEEDBACK.t1.good(),
    detail: `専門用語の使用: ${count}回`,
  };
}

/* テーマ2: 値引き切り返し(基礎60点の加点型) */
function _scoreT2(turns) {
  let score = 60, offered = 0, quote = null, best = 0, answeredPush = false;
  const cats = new Set();
  turns.forEach((t, i) => {
    const a = t.player;
    if (a.discountOffered) { offered++; score -= 30; }
    if (a.discountRefused) score += 10;
    const pushed = i > 0 && turns[i - 1].discountPushed;
    for (const c of a.valueCats) {
      if (!cats.has(c)) { cats.add(c); score += pushed ? 10 : 6; }
    }
    if (pushed && a.valueCats.length) answeredPush = true;
    if (a.valueCats.length > best && !a.discountOffered) { best = a.valueCats.length; quote = a.text; }
  });
  if (!offered && answeredPush) score += 10;
  return {
    score, goodQuote: quote,
    improvement: offered ? FEEDBACK.t2.offered() : cats.size < 3 ? FEEDBACK.t2.lowValue(cats.size) : FEEDBACK.t2.sufficient(),
    detail: `価値の提示: ${cats.size}種類 / 値引き発言: ${offered}回`,
  };
}

/* テーマ3: 結論から簡潔に */
function _scoreT3(turns) {
  let score = 100, interrupted = 0, longs = 0, conclusions = 0, quote = null;
  const avg = turns.reduce((s, t) => s + t.player.len, 0) / turns.length;
  for (const t of turns) {
    const a = t.player;
    if (t.interrupted) { interrupted++; score -= 12; }
    else if (a.len > 120) { longs++; score -= 6; }
    if (a.conclusionFirst) {
      conclusions++;
      score += 4;
      if (!quote) quote = a.text;
    }
  }
  if (avg > 100) score -= 10;
  if (!conclusions) score -= 10;
  if (!quote) {
    const short = turns.find((t) => t.player.len >= 15 && t.player.len <= 80);
    if (short) quote = short.player.text;
  }
  return {
    score, goodQuote: quote,
    improvement: interrupted || longs ? FEEDBACK.t3.longOrInterrupted() : !conclusions ? FEEDBACK.t3.noConclusion() : FEEDBACK.t3.good(),
    detail: `平均${Math.round(avg)}字 / 遮られ${interrupted}回`,
  };
}

/* テーマ4: 質問の意図を汲む(的中率で採点) */
function _scoreT4(turns) {
  let asked = 0, hit = 0, quote = null, missed = null;
  for (const t of turns) {
    const re = CAT_KEYWORDS[t.cat];
    if (!re) continue;
    asked++;
    if (re.test(t.player.text)) {
      hit++;
      if (!quote || t.player.len < quote.length) quote = t.player.text;
    } else if (!missed) missed = t.cat;
  }
  return {
    score: 30 + (asked ? hit / asked : 0) * 70,
    goodQuote: quote,
    improvement: missed ? FEEDBACK.t4.missed(CAT_NAMES[missed]) : FEEDBACK.t4.good(),
    detail: `質問への的中: ${hit}/${asked}`,
  };
}
