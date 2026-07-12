/* =========================================================
 * engine.js — 部長AI(ルールベース対話エンジン)と自動採点
 * ========================================================= */

/* ---------- 発言解析 ---------- */
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
    discountOffered: discountTalk && !discountRefused, // 値引きを申し出た(NG)
    discountRefused,                                   // 値引きを断った(GOOD)
    valueCats,
    isQuestion: QUESTION_RE.test(text),
    nextStep: NEXT_STEP_RE.test(text),
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================================================
 * 部長AI
 * respond(playerText) => { text, end, event }
 *   event: "walkout"(打ち切り) | "done"(シーン完了) | null
 * ========================================================= */
class BuchoAI {
  constructor(sceneId, modeId, themeId) {
    this.scene = SCENES.find((s) => s.id === sceneId);
    this.mode = MODES[modeId];
    this.themeId = themeId;
    this.beatIndex = 0;      // 次に進めるbeat
    this.nuggetIndex = 0;    // ヒアリングシーンの開示済み情報
    this.followupIndex = 0;
    this.strikes = 0;        // モードC: 歯切れの悪さの累積
    this.usedSimplifyB = false;
    this.askedJargon = new Set(); // 同じ用語で二度は聞き返さない
    this.injectedDiscountPush = false; // テーマ2で価格シーン以外に1回だけ値引き圧を注入
    this.lastCat = "need";   // 直前に部長が投げた質問カテゴリ(採点用)
    this.turns = [];         // {player:analysis, bucho:text, cat, interrupted, jargonAsked, discountPushed}
    this.finished = false;
  }

  openerText() {
    const t = this.scene.opener[this.mode.id];
    this.lastCat = "need";
    return t;
  }

  /* 相槌(モードA中心) */
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

    /* --- 3. プレイヤーが値引きを申し出た → 揺さぶり --- */
    if (a.discountOffered) {
      rec.discountPushed = true;
      if (this.mode.id === "C") this.strikes++;
      if (this.strikes >= this.mode.maxStrikes) return this.walkout(rec);
      return this.out(rec, pick(DISCOUNT_SHAKE[this.mode.id]));
    }

    /* --- 4. 値引きを断り価値で切り返した → 認める + 先へ進む --- */
    let prefix = "";
    if (a.discountRefused && a.valueCats.length >= 1) {
      prefix = VALUE_ACK[this.mode.id] + " ";
      this.strikes = Math.max(0, this.strikes - 1); // 良い切り返しは信頼回復
    }

    /* --- 5. モードB: わかりにくい説明に1回だけ聞き返す --- */
    if (
      this.mode.id === "B" && !this.usedSimplifyB &&
      a.len > 130 && !a.hasPlain && !a.conclusionFirst
    ) {
      this.usedSimplifyB = true;
      return this.out(rec, SIMPLIFY_B);
    }

    /* --- 6. モードC: 短く歯切れよく答えられたら信頼回復 --- */
    if (this.mode.id === "C" && (a.conclusionFirst || a.len <= 60)) {
      this.strikes = Math.max(0, this.strikes - 1);
    }

    /* --- 7. テーマ2: 価格シーン以外でも一度だけ値引き圧をかける --- */
    if (
      this.themeId === "t2" && !this.scene.priceScene &&
      !this.injectedDiscountPush && this.turns.length >= 2
    ) {
      this.injectedDiscountPush = true;
      rec.discountPushed = true;
      this.lastCat = "cost";
      const push = {
        A: "ところでね、お値段のことなんですが…他社さんはずいぶんお安くしてくださるみたいでね。おたくは、お値引きはどうなんですか？",
        B: "話は変わりますが、価格の件です。他社さんは値引きに応じるそうですよ。御社はいかがですか。",
        C: "ちょっと待って、先にお金の話。他社はもっと下げるって言ってるんだよ。おたくはいくら引けるの？",
      }[this.mode.id];
      return this.out(rec, prefix + push);
    }

    /* --- 8. ヒアリングシーン: 質問されたときだけ情報を開示 --- */
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

    /* --- 9. 通常シーン: 次のbeatへ進む --- */
    if (this.beatIndex < this.scene.beats.length) {
      const beat = this.scene.beats[this.beatIndex++];
      this.lastCat = beat.cat;
      if (beat.discountPush) rec.discountPushed = true;
      return this.out(rec, prefix + this.aizuchi() + beat.ask[this.mode.id]);
    }

    /* --- 10. beatを使い切ったら followup → クローズ --- */
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
    rec.bucho = text;
    return { text, event, end };
  }
}

/* =========================================================
 * 自動採点 — 選んだテーマ1つだけを評価する
 * 返り値: { score, grade, title, goodQuote, improvement:{point, example}, walkout }
 * ========================================================= */
function scoreSession(engine, walkout) {
  const turns = engine.turns.filter((t) => t.player && t.player.text.trim());
  const themeId = engine.themeId;
  let result;
  if (!turns.length) {
    result = {
      score: 0, grade: "×", goodQuote: null,
      improvement: {
        point: "発言がありませんでした。まずは一言、部長に話しかけてみましょう。",
        example: "「本日はお時間をいただきありがとうございます。結論から申しますと〜」",
      },
    };
  } else if (themeId === "t1") result = scoreT1(turns);
  else if (themeId === "t2") result = scoreT2(turns);
  else if (themeId === "t3") result = scoreT3(turns);
  else result = scoreT4(turns);

  if (walkout) result.score = Math.max(0, result.score - 15); // 打ち切りは減点
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

/* --- テーマ1: 専門用語を使わない説明 --- */
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
      // 同じ発言内で言い換えていれば減点半分
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
    // 専門用語なしで最も説明らしい(長めの)発言を引用
    const clean = turns.filter((t) => !t.player.jargon.length);
    if (clean.length) {
      goodQuote = clean.reduce((b, t) => (t.player.len > b.player.len ? t : b), clean[0]).player.text;
    }
  }

  const improvement = worstTerm
    ? {
        point: `専門用語「${worstTerm}」が部長には通じていません。使うなら必ず患者さん・病院のメリットに言い換えましょう。`,
        example: `「${worstTerm}」→「簡単に言うと、少ないX線でも血管がくっきり見える仕組みです。患者さんの被ばくが減ります」のように翻訳する。`,
      }
    : {
        point: "専門用語は避けられていました。次は「例えば〜」と身近なたとえを加えると、さらに伝わります。",
        example: "「例えば、写真でいうと暗い場所でもきれいに撮れるカメラのようなものです」",
      };
  return { score, grade: "", goodQuote, improvement, detail: `専門用語の使用: ${jargonCount}回` };
}

/* --- テーマ2: 値引き要求への切り返し --- */
function scoreT2(turns) {
  let score = 60; // 価値提示を積み上げる加点型
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
    // 部長が値引き圧をかけた直後の発言を重視
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
    ? {
        point: "値引きを口にしてしまいました。自社は値引き不可の設定です。価格の土俵に乗らず、価値の話に切り替えましょう。",
        example: "「申し訳ありません、お値引きは致しかねます。その代わり、患者さんの被ばくと処置時間を減らせます。1件あたりの時間が縮めば治療件数も増やせますので、決して高くないはずです」",
      }
    : catsUsed.size < 3
    ? {
        point: `価格以外の価値の引き出しが${catsUsed.size}種類でした。被ばく低減・処置時間短縮・安全性・実績・画質・保守など、複数の武器を組み合わせましょう。`,
        example: "「価格では他社様に及びませんが、患者さんの被ばくの少なさと、故障時の復旧の速さでは負けません」",
      }
    : {
        point: "価値の引き出しは十分です。次は部長の一番の関心事(院長・事務への説明材料)に絞って一言でまとめる練習をしましょう。",
        example: "「院長には『患者さんの被ばくを減らしながら治療件数を増やせる投資』とお伝えください」",
      };
  return { score, grade: "", goodQuote, improvement, detail: `価値カテゴリ: ${catsUsed.size}種類 / 値引き発言: ${offered}回` };
}

/* --- テーマ3: 結論から簡潔に --- */
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
    ? {
        point: "発言が長く、部長を待たせてしまう場面がありました。まず結論、理由は1つだけ、が鉄則です。",
        example: "「結論から申しますと、患者さんの被ばくを減らせることが一番のメリットです。理由は、少ないX線でも血管がくっきり見えるからです」",
      }
    : conclusionCount === 0
    ? {
        point: "発言は簡潔でしたが、「結論から言うと」という頭出しがありませんでした。最初の一言で相手の集中を掴みましょう。",
        example: "「結論から申しますと、御院の治療の待ち患者さんの問題はこの1台で改善できます」",
      }
    : {
        point: "結論から簡潔に話せています。次は数字を1つだけ添えると、さらに説得力が上がります。",
        example: "「結論から言うと、処置時間を1件あたり数分短縮できます」",
      };
  return { score, grade: "", goodQuote, improvement, detail: `平均文字数: ${Math.round(avg)}字 / 遮られた回数: ${interrupted}回` };
}

/* --- テーマ4: 質問の意図を汲み取る --- */
const CAT_KEYWORDS = {
  cost:   /円|万円|億|価格|費用|コスト|お見積|見積|投資|回収|修理代|維持費|ランニング/,
  diff:   /違い|他社|比べ|強み|選ぶ理由|差別化|当社は|弊社は|一番の|独自/,
  safety: /安全|安心|被ば?く|放射線|X線|エックス線|線量|体への|負担が少な|やさし/,
  ops:    /負担|処置時間|治療時間|短縮|件数|操作|使いやす|運用|先生|術者|看護師|スタッフ|時間|手間|故障|修理|保守|止ま/,
  sched:  /か月|ヶ月|カ月|半年|年度|納期|間に合|スケジュール|日程|発注|納入|設置|稼働/,
  need:   /ご提案|ご紹介|目的|課題|お役に立|解決|お手伝い|伺い|説明/,
  next:   /デモ|見学|お見積|見積|来週|次回|訪問|日程|資料|アポ|ご都合|お持ち/,
};

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

  const catNames = {
    cost: "費用・お金", diff: "他社との違い", safety: "患者さんの安全・被ばく",
    ops: "処置時間・スタッフの負担", sched: "納期・スケジュール", need: "用件・目的", next: "次のアクション",
  };
  const improvement = missedCat
    ? {
        point: `部長が「${catNames[missedCat]}」について聞いた場面で、質問の意図から外れた答えになっていました。まず聞かれたことに一言で答えてから、補足しましょう。`,
        example: `「はい、${catNames[missedCat]}についてお答えしますと〜」と、質問の言葉をオウム返ししてから答える。`,
      }
    : {
        point: "質問の意図はよく汲み取れていました。次は答えたあとに「ご質問の意図に合っていますか？」と確認する一言を加えましょう。",
        example: "「〜という理解でお答えしましたが、先生が気にされているのはこの点でよろしいですか？」",
      };
  return { score, grade: "", goodQuote, improvement, detail: `質問への的中: ${hit}/${asked}` };
}
