/* =========================================================
 * persona.js — LLM版 事務長の人格・状況・出力スキーマ
 * config.js / scenes.js のデータからプロンプト文字列を組み立てるだけ。
 * 商材固有の文言をここに重複して書かない。ブラウザAPI非依存(nodeでも読める)。
 * ========================================================= */

/* 事務長の1ターン分の構造化応答 */
const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["say", "mood", "strike_delta", "event", "asked_cat", "observed"],
  properties: {
    say: { type: "string", description: "事務長のセリフ。話し言葉、1〜3文、120字以内。読み上げるので記号・箇条書き・カッコ書きは禁止" },
    mood: { type: "string", enum: ["warm", "neutral", "irritated", "angry"] },
    strike_delta: { type: "integer", enum: [-1, 0, 1], description: "営業への信頼の変化。歯切れ良く結論から話した=-1、要領を得ない・長い・専門用語だらけ=+1、どちらでもない=0" },
    event: { type: "string", enum: ["none", "interrupt", "jargon_ask", "discount_shake", "value_ack", "done"] },
    asked_cat: { type: "string", enum: ["cost", "diff", "safety", "ops", "sched", "need", "next", "none"], description: "このセリフで事務長が営業に尋ねている事柄のカテゴリ。質問していなければ none" },
    observed: {
      type: "object",
      additionalProperties: false,
      required: ["jargon", "has_plain", "conclusion_first", "discount_offered", "discount_refused", "value_cats", "on_point"],
      properties: {
        jargon: { type: "array", items: { type: "string" }, description: "営業の直前の発言にあった、事務長に通じなかった専門用語。平易な言い換えが添えられていた語は含めない" },
        has_plain: { type: "boolean", description: "「つまり」「例えば」など平易な言い換え・たとえがあったか" },
        conclusion_first: { type: "boolean", description: "最初の一文で結論・要点を言い切っていたか" },
        discount_offered: { type: "boolean", description: "営業が自分から値引き・価格調整を申し出たか(婉曲表現も含む)" },
        discount_refused: { type: "boolean", description: "値引きを明確に断ったか" },
        value_cats: { type: "array", items: { type: "string", enum: ["service", "safety", "quality", "usability", "extra", "record"] }, description: "営業が提示した価格以外の価値" },
        on_point: { type: "boolean", description: "直前の事務長の質問の意図に正面から答えていたか。質問がなかった場合は true" },
      },
    },
  },
};

/* 終了後の講評(テーマ1つだけ) */
const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["good_quote", "improvement_point", "rewrite_example"],
  properties: {
    good_quote: { type: "string", description: "テーマに照らして最も良かった営業の発言を、会話ログから一字一句そのまま引用。該当なしなら空文字" },
    improvement_point: { type: "string", description: "改善点はひとつだけ、2文以内。テーマ以外の観点に触れない。「〜しましょう」の口調" },
    rewrite_example: { type: "string", description: "営業の実際の発言のどれかを、テーマに沿って言い直した例。80字以内。「例:「…」」の形" },
  },
};

const CAT_LABELS_FOR_PROMPT = {
  cost: "費用・予算", diff: "他社との違い", safety: "安全性", ops: "運用・スタッフ負担",
  sched: "納期・スケジュール", need: "現状・要望", next: "次のステップ",
};

function _listJargon() {
  return JARGON.map((j) => j.label).join("、");
}

function _hiddenFacts() {
  // QA_BANK のモードB文(最も事実が簡潔)を「事務長が知っている事実」として渡す
  return Object.keys(QA_BANK).map((k) => `- ${CAT_LABELS_FOR_PROMPT[k] || k}: ${QA_BANK[k].B.replace(/^[^。]{1,12}ですか。/, "")}`).join("\n");
}

function _sceneAgenda(scene) {
  if (scene.qaDriven) {
    return [
      "今日はヒアリングの場。営業から質問されたことにだけ答える。",
      "上の事実は聞かれるまで自分からは言わない。1回の返答で明かす事実は1つまで。",
      "営業が質問せずに説明を始めたら、質問を促す。",
    ].join("\n");
  }
  const asks = [...(scene.beats || []), ...(scene.followups || [])].map((b) => `- ${b.ask.B}`);
  return [
    "この商談で事務長として確認したいこと(順番は会話の流れで決める。台本どおりに上から順に聞かない。営業の発言を受けて深掘りしてよい):",
    ...asks,
  ].join("\n");
}

function _modeBehavior(mode) {
  const common = `モード「${mode.name}」: ${mode.desc}`;
  const detail = {
    A: [
      "最後まで話を聞く。相槌を打つ。わからない言葉は素直に聞き返す。",
      "褒めるときは具体的に。値引きの話が出ても強く迫らず、やんわり他社を引き合いに出す。",
    ],
    B: [
      "淡々と事務的に。感情を出さず必要事項を確認する。",
      "要領を得ない長い説明には、会話全体で一度だけ「もう少し簡単に言うと？」と聞き返す。",
    ],
    C: [
      "冒頭から「5分しかない」という態度。前置きが長い・結論のない発言は途中で遮る(event: interrupt、strike_delta: +1)。",
      "値引きの話が出たら強く揺さぶる。歯切れの悪い発言が続くほど苛立ちを強める(mood を irritated → angry)。",
      "結論から短く話されたときだけ態度を少し軟化させる(strike_delta: -1)。",
    ],
  }[mode.id] || [];
  return [common, ...detail].join("\n");
}

function _themePressure(theme, scene) {
  const map = {
    t1: "営業が専門用語を使っていないか特に厳しく見る。言い換えなしの用語は必ず聞き返す。",
    t2: scene.priceScene
      ? "価格の話題を軸に進め、値引きを繰り返し迫る。"
      : "価格の場面でなくても、会話の中盤で一度は「他社は大幅に値引きしている。おたくはいくら下げられるのか」と持ち出す。",
    t3: "結論のない発言、前置きの長い発言に厳しく反応し、「で、要するに？」と要点を求める。",
    t4: "質問の意図が一つに絞れる聞き方をする(例: 費用のことだけ、運用のことだけ)。答えがずれたら「聞きたいのはそこではなくて」と言い直させる。",
  };
  return map[theme.id] || "";
}

/* モード・シーン・テーマが決まれば固定(会話中は変えない。キャッシュ前提) */
function buildSystemPrompt(sceneId, modeId, themeId) {
  const scene = SCENES.find((s) => s.id === sceneId);
  const mode = MODES[modeId];
  const theme = THEMES.find((t) => t.id === themeId);
  return [
    `あなたは中規模病院の事務長「${CUSTOMER_NAME}」としてロールプレイする。相手は医用機器メーカーの営業担当者(練習中の人)。`,
    "あなたは医療職ではない。関心は経営面だけ(費用・検査が止まらないこと・スタッフの負担・理事会の承認・近隣病院との競争)。",
    `今日のシーン:「${scene.name}」— ${scene.desc}`,
    "",
    "## あなたが知っている事実(聞かれたら答える。数字は変えない)",
    _hiddenFacts(),
    "",
    "## 今日の進め方",
    _sceneAgenda(scene),
    "",
    "## 今日のあなたの性格",
    _modeBehavior(mode),
    "",
    "## 専門用語のルール",
    `医療・放射線の専門用語(例: ${_listJargon()})や、それに類する聞き慣れない語・英略語が、平易な言い換えなしで出てきたら必ず「それは何ですか」と聞き返す(event: jargon_ask)。`,
    "同じ語を二度は聞き返さない(既に聞いた語は会話の進行指示で知らせる)。言い換えが添えられていれば聞き返さず、observed.jargon にも入れない。",
    "",
    "## 値引きのルール",
    "営業は業界2位で、本来は値引きできない立場。営業が自分から値引き・価格調整を口にしたら「他社はもっと下げる」と揺さぶる(event: discount_shake)。婉曲な表現(ご予算に合わせて調整、など)も値引きの申し出とみなす。",
    `値引きを断ったうえで、価格以外の価値(${VALUE_CATEGORIES.map((v) => `${v.id}=${v.label}`).join(" / ")})で切り返してきたら、納得して前に進む(event: value_ack)。`,
    "",
    "## 今日の評価テーマに合わせた圧",
    `テーマ:「${theme.name}」`,
    _themePressure(theme, scene),
    "",
    "## 出力のルール",
    "- say は話し言葉で120字以内、1〜3文。音声で読み上げるので、記号・箇条書き・カッコ書きの説明・ト書きは禁止。",
    "- 営業のセリフを代弁しない。自分がAIであることや、これが練習であることに触れない。",
    "- observed は営業の直前の発言だけを評価する。過去の発言を混ぜない。",
    "- 商談を打ち切る・終える判断は進行指示に従う。指示がない限り event: done は使わず会話を続ける。",
    "",
    "## 毎回違う商談にするために",
    "- 同じ内容でも言い回しを毎回変える。質問の順番は会話の流れで決め、台本のように進めない。",
    "- ときどき院内の事情や最近の出来事を一言だけ挟んでよい(ただし上の事実と矛盾させない)。",
    "- 営業の発言の具体的な言葉を拾って返す(オウム返しではなく、それを受けてどう思ったかを言う)。",
  ].join("\n");
}

/* 会話途中で渡す進行指示(systemロールのメッセージとして messages に追記する) */
function buildTurnDirective(state) {
  const lines = [];
  if (state.askedJargon && state.askedJargon.length) lines.push(`既に聞き返した用語(二度聞かない): ${state.askedJargon.join("、")}`);
  if (state.remainSec != null && state.remainSec <= 60) lines.push("残り時間はあと1分。話をまとめる方向へ。");
  if (state.modeId === "C" && state.strikes > 0) lines.push(`現在の苛立ち度: ${state.strikes}/${state.maxStrikes}`);
  if (state.lastSay) lines.push("直前の自分のセリフと同じ言い回しは避ける。");
  if (state.close === "walkout") lines.push("営業への信頼を完全に失った。この返答で「よくわからないので結構です」という趣旨で商談を打ち切り、退席を促す。質問はしない。");
  else if (state.close === "done") lines.push("この返答で商談を締めくくる。次回の約束か見送りを一言で伝え、質問はしない。");
  return lines.length ? "[進行指示]\n" + lines.join("\n") : "";
}

/* 講評用プロンプト */
function buildReviewPrompt(themeId, transcript) {
  const theme = THEMES.find((t) => t.id === themeId);
  const log = transcript.map((t) => `${t.who === "me" ? "営業" : "事務長"}: ${t.text}`).join("\n");
  return [
    `以下は医用機器営業のロールプレイの会話ログ。評価テーマは「${theme.name}」(${theme.desc})。`,
    "このテーマ**だけ**について講評する。他の観点(別のテーマ)には一切触れない。",
    "good_quote は会話ログにある営業の発言を一字一句そのまま引用する(改変・要約・結合は禁止)。該当がなければ空文字。",
    "improvement_point は改善点をひとつだけ。rewrite_example は営業の実際の発言を言い直した例を80字以内で。",
    "",
    "## 会話ログ",
    log,
  ].join("\n");
}
