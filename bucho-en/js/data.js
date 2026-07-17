/* =========================================================
 * data.js — Product, scene, director-mode, and evaluation-theme
 * definitions. The single source of truth read by the rule-based
 * director AI and the automatic scorer.
 * To swap in a different product/customer, edit only this file.
 *
 * Player : a sales rep for a medical device maker (#2 in the
 *          industry). Cannot offer discounts.
 * Customer: Director of Cardiology (Dr. Harrison). Clinically expert,
 *          but doesn't know radiology-engineering jargon (DICOM,
 *          X-ray shielding, installation work, device specs).
 *          Cares only about the patient's perspective (radiation
 *          exposure, procedure time, safety) and the management
 *          perspective (utilization, revenue, differentiation).
 * ========================================================= */

const ROLE_LABEL = "Director";

/* --- Speech-synthesis voice preference (read by speech.js) --- */
const VOICE_PREF = {
  genderRegex: /male|david|mark|daniel|james|alex|man\b/i, // Director = Dr. Harrison
  pitch: 0.95,
};

const PRODUCT = {
  name: 'Angiography system "Trinias OPERA B8"',
  plainName: "An angiography (vascular imaging) system used for procedures like cardiac catheterization",
  priceFrom: 1000000, // USD (unit only, no options)
  strengths: [
    "Clear vessel imaging with less X-ray (lower radiation exposure for patients and staff)",
    "Shorter procedure times (less burden on patients, more cases handled per day)",
    "Safety and support that keeps treatment from stopping (strong for emergency catheterizations)",
    "A strong track record of installations at hospitals nationwide",
    "High image quality, visible down to fine vessels and devices",
    "AI features that assist the operator (auto-tracking, image adjustment)",
    "Fast on-site response and recovery if something breaks",
  ],
  schedule: "Select the model within the fiscal year; install and go live within six months",
};

/* --- Jargon the director doesn't know (radiology/device/installation. Using it always gets you asked back) --- */
const JARGON = [
  { label: "DICOM", re: /DICOM/i },
  { label: "PACS", re: /PACS/i },
  { label: "FPD", re: /FPD|flat[- ]panel( detector)?/i },
  { label: "tube voltage", re: /tube voltage/i },
  { label: "tube current", re: /tube current/i },
  { label: "kV", re: /\d+\s*kV|kilovolt/i },
  { label: "mAs", re: /(^|[^a-zA-Z])mAs?([^a-zA-Z]|$)/ },
  { label: "heat unit", re: /heat unit(s)?|(tube )?heat capacity/i },
  { label: "DQE", re: /(^|[^a-zA-Z])DQE([^a-zA-Z]|$)/ },
  { label: "grid", re: /\bgrid\b/i },
  { label: "collimator", re: /collimat(or|ion)/i },
  { label: "scatter radiation", re: /scatter(ed)? radiation/i },
  { label: "SCORE", re: /\bSCORE\b|Score[- ]?Pro/i },
  { label: "pulse rate", re: /pulse rate|frame rate|(^|[^a-zA-Z])fps([^a-zA-Z]|$)/i },
  { label: "X-ray shielding", re: /X-?ray shielding|radiation shielding|shielding (work|construction)/i },
  { label: "leakage dose", re: /leakage dose/i },
  { label: "power capacity", re: /power capacity|electrical supply capacity/i },
  { label: "floor load capacity", re: /floor load(-bearing)? capacity|structural reinforcement/i },
];

/* --- Signals of a plain-language explanation (a sign that jargon is being translated) --- */
const PLAIN_MARKERS = /for example|for instance|simply put|in simple terms|to put it simply|think of it like|it'?s like|in other words|basically|put another way/i;

/* --- Signal of leading with the conclusion --- */
const CONCLUSION_MARKERS = /^(in conclusion|to conclude|the bottom line is|the point is|in short|my proposal is|what i'?d like to say is|the key point is)/i;

/* --- Discount talk (distinguish offering it from refusing it) --- */
const DISCOUNT_RE = /discount|lower the price|reduce the price|cut the price|special (price|pricing)|price break|knock (off|down) the price|give you a deal|cheaper|come down on (the )?price/i;
const DISCOUNT_REFUSAL_RE = /can'?t|cannot|unable to|not able to|difficult|i'?m afraid|we don'?t offer|not our policy|no can do|won'?t be able to/i;

/* --- Value categories beyond price (used to score discount pushback / differentiation) --- */
const VALUE_CATEGORIES = [
  { id: "dose",   label: "Reduced radiation dose (gentler on patients and staff)", re: /radiation (dose|exposure)|dose reduction|lower dose|low[- ]dose|less radiation|gentle(r)? on (the )?patient/i },
  { id: "time",   label: "Shorter procedure time", re: /procedure time|treatment time|exam time|shorten(ed)?|reduce(d)? (the )?time|throughput|per (case|procedure)/i },
  { id: "safety", label: "Safety (treatment with peace of mind)", re: /safe(ty)?|peace of mind|prevent(ing)? (accidents|errors)|reduce(d)? risk|miss(ed)? (findings|diagnosis)/i },
  { id: "track",  label: "Installation track record", re: /track record|installations?|(number of )?hospitals|nationwide|university hospitals?|market share/i },
  { id: "image",  label: "High image quality (visible down to fine vessels)", re: /image quality|(sharp|clear|crisp) image(s)?|clearly visible|fine vessels|resolution/i },
  { id: "ai",     label: "AI-assisted operation", re: /(^|[^a-zA-Z])AI([^a-zA-Z]|$)|artificial intelligence|automatically (adjust|track|correct|recognize)/i },
  { id: "maint",  label: "Fast maintenance / service response", re: /maintenance|service (support|response)|repair|breakdown|on[- ]site (support|response)|recovery time|inspection/i },
  { id: "uptime", label: "Uptime, no treatment interruptions", re: /uptime|(won'?t|doesn'?t) stop|downtime|keep (treating|running)|continue (treatment|exams)/i },
  { id: "profit", label: "Revenue and case-volume growth", re: /revenue|profit|case volume|increase(d)? (cases|referrals)|management|patient volume/i },
  { id: "diff",   label: "Differentiation from other hospitals", re: /differentiat(e|ion)|other hospitals|nearby hospitals|stand out|regional|competitive edge/i },
];

/* --- Signal of proposing a next action (used to score closing) --- */
const NEXT_STEP_RE = /demo|live demonstration|site visit|tour|quote|estimate|next week|this week|next time|visit you|bring (a )?catalog|(send|share) materials|schedule|appointment|availability|seminar|workshop|conference/i;

/* --- Signal of asking a question (used to score the hearing scene) --- */
const QUESTION_RE = /[?？]|could you (tell|share|explain)|what (is|are|about)|how (is|are|about|much|many)|please (tell|share|explain)|i'?d like to (know|ask)|can you (tell|share)/i;

/* =========================================================
 * Director modes
 * ========================================================= */
const MODES = {
  A: {
    id: "A", name: "Friendly Director", emoji: "😊",
    desc: "Listens all the way through and nods along. Asks honestly when something's unclear.",
    aizuchi: ["I see, I see.", "Right.", "Oh, is that so?", "Mm-hmm.", "I see, go on."],
    aizuchiRate: 0.5,
    interruptLen: Infinity, // never interrupts
    maxStrikes: Infinity,
  },
  B: {
    id: "B", name: "Neutral Director", emoji: "😐",
    desc: "Calmly confirms what's needed. Asks 'could you put that more simply?' just once if an explanation is unclear.",
    aizuchi: ["Right.", "Okay."],
    aizuchiRate: 0.2,
    interruptLen: Infinity,
    maxStrikes: Infinity,
  },
  C: {
    id: "C", name: "Busy & Intimidating Director", emoji: "😠",
    desc: "States upfront that they only have 5 minutes. Cuts off long preambles, and ends the meeting after 3 unclear answers in a row.",
    aizuchi: [],
    aizuchiRate: 0,
    interruptLen: 110, // interrupts any utterance longer than this
    maxStrikes: 3,      // repeated unclear answers end the meeting
  },
};

/* =========================================================
 * Evaluation themes (only one theme per session)
 * ========================================================= */
const THEMES = [
  {
    id: "t1", name: "Explaining without jargon",
    desc: "Can you avoid device-spec terminology and \"translate\" it into benefits for patients and the hospital?",
    tip: "Terms like DICOM, FPD, or tube voltage mean nothing to a cardiology director. Use phrases like \"for example\" or \"simply put\" to translate them into what matters to patients and the hospital.",
  },
  {
    id: "t2", name: "Countering discount requests",
    desc: "Can you counter a discount request with value beyond price?",
    tip: "Your company is #2 in the industry. You can't win on price against #1, and you can't discount. Fight with value: reduced radiation dose, shorter procedure times, safety, track record, maintenance.",
  },
  {
    id: "t3", name: "Leading with the conclusion, concisely",
    desc: "Can you speak concisely and lead with the conclusion for a busy counterpart?",
    tip: "Start with \"to conclude\" or \"the key point is,\" and keep each statement short. For a director squeezed between patients, a long preamble is fatal.",
  },
  {
    id: "t4", name: "Grasping the intent of a question",
    desc: "Are you correctly grasping the intent of the other person's question and answering it directly?",
    tip: "The director cares about the patient's perspective (dose, procedure time, safety) and the management perspective (utilization, revenue, differentiation). Answer what's actually being asked.",
  },
];

/* =========================================================
 * Titles (score -> title)
 * ========================================================= */
const TITLES = [
  { min: 90, title: "Director-Conquering Master" },
  { min: 80, title: "Skilled Negotiator" },
  { min: 70, title: "Competent Negotiator" },
  { min: 55, title: "Negotiation Apprentice" },
  { min: 40, title: "Rookie Sales Rep" },
  { min: 0,  title: "Roleplay Trainee" },
];

function titleFor(score) {
  return TITLES.find((t) => score >= t.min).title;
}

/* =========================================================
 * Scene definitions
 * beat: a line the director uses to move the scene forward. ask is per mode (A/B/C).
 * cat  : the intent category of the question (used to score theme 4)
 *   cost=cost / diff=differentiation / safety=safety & exposure / ops=procedure time & operations /
 *   sched=schedule / need=purpose & needs / next=next action
 * ========================================================= */
const SCENES = [
  {
    id: "opening", name: "Opening", emoji: "🚪",
    desc: "First contact and icebreaking. State your purpose concisely and open the door to trust.",
    opener: {
      A: "Hello, I'm Dr. Harrison, Director of Cardiology. Thanks for coming all this way today. Please, have a seat.",
      B: "Harrison, Cardiology. Right on time. So, what did you want to discuss today?",
      C: "Harrison. Sorry, but outpatient clinic's running long — I've only got 5 minutes. Please be quick. So, what is this about?",
    },
    beats: [
      { cat: "need", ask: {
        A: "So, what did you want to talk to me about today?",
        B: "Could you tell me what this is regarding?",
        C: "So, bottom line — what's this about?" } },
      { cat: "diff", ask: {
        A: "Honestly, I don't know much about your company. What kind of company are you?",
        B: "Could you briefly introduce your company? You're an angiography system manufacturer, correct?",
        C: "What makes your company different from the others? One sentence." } },
      { cat: "need", ask: {
        A: "How much do you actually know about our cath lab?",
        B: "How much research have you done into our department's practice beforehand?",
        C: "You did your homework on our cath lab before coming here, right?" } },
      { cat: "sched", ask: {
        A: "Actually, our cath lab's equipment is getting old too. We need to pick a system before the fiscal year ends.",
        B: "We're actually reviewing an angiography system replacement. The plan is to select a model within the fiscal year and be operational within six months. Can you meet that?",
        C: "We need to select a model this fiscal year and be running within six months. Can you keep up with that? If not, this conversation's over." } },
      { cat: "next", ask: {
        A: "We're about out of time today, so let's continue another time. What's the next step?",
        B: "Let's stop here for today. Do you have a proposal for the next step?",
        C: "Right, time's up. So what's next? Be specific." } },
    ],
    followups: [
      { cat: "need", ask: {
        A: "Is there anything else you wanted to bring up?",
        B: "Anything else we should cover?",
        C: "Anything else? Make it quick." } },
    ],
    closer: {
      A: "Thank you for today. I'd love to hear more from you again.",
      B: "Understood. Let's proceed that way then. Thank you for today.",
      C: "...Fine. That's settled then. I'm heading back to the clinic, excuse me.",
    },
  },
  {
    id: "hearing", name: "Needs Assessment", emoji: "👂",
    desc: "Draw out the director's current challenges and priorities by asking questions. If you don't ask, nothing comes out.",
    qaDriven: true, // a special scene where info is revealed one piece at a time, only when asked
    opener: {
      A: "Hello, I'm Dr. Harrison, Director of Cardiology. You wanted to hear about the current state of our cath lab, right? Ask me anything.",
      B: "Harrison, Cardiology. This is the needs-assessment session, right? Go ahead with your questions.",
      C: "Harrison. I've only got 5 minutes between patients, so if you have questions, make them quick.",
    },
    // revealed one at a time, in order, each time a question is asked
    nuggets: [
      { cat: "ops",   text: { A: "Actually, our current angiography system is already 13 years old. It's been acting up more lately, and the images feel dimmer too.", B: "Our current system has been in use for 13 years. Malfunctions are increasing, and the image quality has gotten worse than before.", C: "Current system's 13 years old. Breaks down constantly, images are hard to read. That's the main problem." } },
      { cat: "ops",   text: { A: "Each treatment's been taking longer too. We're hitting a ceiling on how many cases we can do in a day, and patients are having to wait.", B: "Procedures are taking longer, and we've hit a ceiling on daily case volume. The waitlist keeps growing.", C: "Procedures take too long, can't get through enough cases. Patients are waiting. Next." } },
      { cat: "safety", text: { A: "With longer procedures, I do worry about radiation exposure for patients, and for our younger doctors and nurses too. Protecting them is part of my job as director.", B: "During longer procedures, I'm concerned about radiation exposure for both patients and staff. Protecting our junior staff is part of my responsibility.", C: "Long procedures mean a bigger radiation burden on patients and staff. Protecting the junior staff is my responsibility." } },
      { cat: "diff",  text: { A: "I hear a hospital in the next city over installed a new system, and referrals from local clinics seem to be drifting that way.", B: "A nearby hospital installed a new system, and some of our referred patients have shifted there. We're conscious of differentiating ourselves regionally.", C: "The hospital across town got a new system and it's taking our referrals. That must sting for you too." } },
      { cat: "cost",  text: { A: "The hospital director and finance office keep telling me to 'make sure the numbers are solid.' It's an expensive purchase, so I'm the one who has to explain it.", B: "The hospital director and finance department are strict about cost. I'll need to justify the investment at the management meeting myself.", C: "The director and finance are ruthless about money. If I can't explain why it's worth the price, it won't get approved." } },
      { cat: "sched", text: { A: "So, we'd like to select a model within the fiscal year and start using it within six months. Can you make that work?", B: "The plan is to select a model within the fiscal year and be installed and operational within six months. Please propose with that timeline in mind.", C: "Model selection this fiscal year, running within six months. That's non-negotiable. If you can't deliver, we'll look elsewhere." } },
    ],
    noQuestion: { // response when the player keeps talking without asking a question
      A: "Mm, I see... So, what did you want to ask me? Feel free.",
      B: "...So, what would you like to ask? Go ahead.",
      C: "Skip the explanation. If you don't have a question, are we done here?",
    },
    closer: {
      A: "I think I've told you most of what's going on here. Thanks for listening so carefully.",
      B: "That covers the current situation. Please bring a concrete proposal next time.",
      C: "I've told you everything I can. Bring me a proposal next time. Time's up.",
    },
  },
  {
    id: "explain", name: "Product Explanation", emoji: "📋",
    desc: "Explain without device-spec jargon, translating everything into benefits for patients and the hospital.",
    opener: {
      A: "I'm Dr. Harrison, Director of Cardiology. Today's the product explanation, right? I'm a clinician, not a technical person, so please keep it easy to follow.",
      B: "Harrison. Product explanation, correct? I don't understand device specs. Explain it in terms of what's good for patients and the hospital. Go ahead.",
      C: "Harrison. Five minutes between patients. Skip the specs — just tell me what's in it for the patients and this hospital.",
    },
    beats: [
      { cat: "need", ask: {
        A: "So, what's good for our hospital if we bring this system in?",
        B: "If we install this system, what concrete benefits do we get?",
        C: "So what do we gain by bringing this in? Bottom line." } },
      { cat: "diff", ask: {
        A: "How is it different from the old system we're currently using?",
        B: "Compared to our current system, what specifically changes?",
        C: "What's different from the current one? Skip the bragging, just the differences." } },
      { cat: "safety", ask: {
        A: "Is there anything good in it for the patients? With longer procedures, radiation is something I worry about.",
        B: "What's the benefit for patients? If exposure is reduced, tell me how.",
        C: "What's in it for the patients? Does exposure go down or not? Which is it?" } },
      { cat: "ops", ask: {
        A: "We handle a lot of cases here. What happens to the time per procedure, and to staff workload?",
        B: "Does procedure time go down? I also want to know how staff workload changes.",
        C: "Does procedure time go down? Pointless if daily case volume doesn't go up." } },
      { cat: "track", ask: {
        A: "Is it used at other hospitals too? Ones our size?",
        B: "Tell me about your installation track record. Any examples from hospitals our size?",
        C: "Any track record elsewhere? I'm not letting our patients be the test case." } },
      { cat: "ops", ask: {
        A: "What happens if it breaks down? If we can't do an emergency catheter procedure, that's a matter of life and death.",
        B: "What's your response if there's a breakdown? Any downtime where we can't handle emergency catheterizations is a problem.",
        C: "What if it breaks? If the cath lab goes down, patients' lives are on the line. How many hours to fix it?" } },
    ],
    followups: [
      { cat: "diff", ask: {
        A: "How does it compare to the biggest company's system?",
        B: "How does it compare to the market leader's system?",
        C: "How's it different from the market leader's? I hear theirs is cheaper." } },
      { cat: "cost", ask: {
        A: "Are there ongoing maintenance costs?",
        B: "What's the running cost after installation?",
        C: "Costs money after we buy it too, right? How much?" } },
    ],
    closer: {
      A: "I feel like I understand it quite a bit now. Thank you.",
      B: "I understand the overview. I'll hear the rest along with the quote.",
      C: "...Fine, I get the gist. Come back with a quote. Time's up.",
    },
  },
  {
    id: "price", name: "Price Presentation", emoji: "💰",
    desc: "Counter discount requests. Your company is #2 and can't discount — win on value instead of price.",
    priceScene: true,
    opener: {
      A: "I'm Dr. Harrison, Cardiology. Today's the pricing discussion, right? Honestly, that's what I've been most curious about.",
      B: "Harrison. Today is the price presentation, correct? Go ahead.",
      C: "Harrison. Five minutes, so let's cut to it. So, how much?",
    },
    beats: [
      { cat: "cost", ask: {
        A: "So, roughly how much does this run?",
        B: "Please give me the price. A rough figure is fine.",
        C: "So how much? Give me the number first." } },
      { cat: "cost", ask: {
        A: "One million dollars...! Just for the unit itself? That's a huge amount. I don't know what the director will say...",
        B: "One million for the unit alone? Frankly, that's higher than I expected. Can you help me understand the basis for that figure so I can explain it to the director and finance?",
        C: "A million?! Just for the unit? There's no way the director signs off on that. Why is it so expensive?" } },
      { cat: "cost", discountPush: true, ask: {
        A: "Actually, other companies have told us they could offer it 'more affordably.' Can you offer any kind of discount?",
        B: "We've received discount proposals from other vendors. How much room do you have?",
        C: "The other guys say they'll come down on price. How much can you knock off? If you can't, we're going with them." } },
      { cat: "diff", ask: {
        A: "So, on price, the other companies would have the edge, is that right? Even so, why should we choose you?",
        B: "It sounds like the competition has the price advantage. Even so, what's the reason to choose you?",
        C: "You're losing on price — why should I pick you anyway? Convince me." } },
      { cat: "cost", ask: {
        A: "I'm the one who has to convince the director and finance... Besides the price, what's the one reason, in a word, we should pick you?",
        B: "I need material for the management meeting. Sum up, in one line, the value that makes up for the price gap.",
        C: "Last one. Give me, in one sentence, the reason to pick you even though you're pricier. That's what decides it." } },
    ],
    followups: [
      { cat: "cost", discountPush: true, ask: {
        A: "Really, is there truly no room to come down even a little...?",
        B: "Is even a small rounding adjustment difficult?",
        C: "Seriously, not even a dollar? Show me some good faith." } },
    ],
    closer: {
      A: "Understood. I'll talk to the director about the price again.",
      B: "I understand the situation. I'll take these materials and discuss with the director.",
      C: "...Logic's understood. How I explain it to the director is my problem. Time's up.",
    },
  },
  {
    id: "closing", name: "Closing", emoji: "🤝",
    desc: "Push for a next appointment or decision. Lock in a concrete next action.",
    opener: {
      A: "I'm Dr. Harrison, Cardiology. Thank you for explaining things so many times already. Today wraps things up, I believe.",
      B: "Harrison. I've heard the full explanation. Today's the summary session, correct?",
      C: "Harrison. How many times is this now? We're deciding today, right? Wrap it up in 5 minutes.",
    },
    beats: [
      { cat: "need", ask: {
        A: "So, how are you going to sum things up for me today?",
        B: "Could you summarize today's key points?",
        C: "So what's the decision today? Bottom line." } },
      { cat: "diff", ask: {
        A: "To be honest, I'm still talking with other companies too.",
        B: "Frankly, we're evaluating other vendors in parallel. I'd like a final deciding factor.",
        C: "I'll level with you — we're talking to other companies too. Tell me again why it should be you." } },
      { cat: "sched", ask: {
        A: "We need to select a model within the fiscal year, right? If we go with you, will it really be up and running within six months?",
        B: "Selection within the fiscal year, operational within six months — that's the requirement. Can you guarantee that?",
        C: "Selection this fiscal year, running in six months. Even one day late and there'll be trouble. Can you make it?" } },
      { cat: "next", ask: {
        A: "So, what happens next? What should I be doing?",
        B: "Please propose the next concrete step, including dates.",
        C: "What's next? Decide the date and details right here, right now." } },
    ],
    followups: [
      { cat: "cost", ask: {
        A: "One last thing. How should I explain this to the director?",
        B: "Give me one line to explain this to the director.",
        C: "Give it to me in one sentence — how do I sell this to the director?" } },
    ],
    closer: {
      A: "Understood. Let's move forward on that schedule then. I'm looking forward to it.",
      B: "That works. Let's proceed on that timeline.",
      C: "...Fine, go ahead with that. Don't be late next time. That's it, we're done.",
    },
  },
];

/* --- Asking back about jargon (templates per mode. {term} is substituted. Same term only once) --- */
const JARGON_REPLIES = {
  A: [
    "Sorry, what is \"{term}\"? I'm a clinician, not a device expert. Could you explain it in terms of what's good for the patient?",
    "Hm? \"{term}\"...? What's that? Radiology's outside my expertise. Could you put it more simply?",
  ],
  B: [
    "What is \"{term}\"? I don't know device jargon. Please explain it in terms of the benefit to patients and the hospital, not the spec.",
    "Sorry, I don't know \"{term}\". Please translate that into a benefit, not a spec.",
  ],
  C: [
    "\"{term}\"? Don't throw jargon at me. Just tell me what's in it for the patients and this hospital.",
    "So what is \"{term}\" anyway? Skip the jargon, keep it simple.",
  ],
};

/* --- Pushback when the player offers a discount --- */
const DISCOUNT_SHAKE = {
  A: [
    "Oh, you can offer a discount? But the other company said they'd come down even further...",
    "I appreciate the gesture, but that still leaves the other company cheaper...",
  ],
  B: [
    "A discount, is it? The other vendor is offering more. That's not enough to be the deciding factor.",
    "At that level, the other company still wins on price. Do you have anything else?",
  ],
  C: [
    "That's it? The other guys say they'll go lower. Then I'll go with them.",
    "If that's all you've got on price, you should've led with something else instead.",
  ],
};

/* --- Reaction when the player firmly refuses a discount and counters with value (good flow) --- */
const VALUE_ACK = {
  A: "...I see. So it's not just about the price, is it.",
  B: "...I see. Don't decide on price alone — fair point.",
  C: "...Hmph. Fine, I get it — it's not just about the price.",
};

/* --- Mode C's interruption (when the preamble is too long) --- */
const INTERRUPT_C = [
  "Hold on, that's too long a preamble! Lead with the conclusion.",
  "...And? What's the bottom line here? Sum it up in one line.",
  "I told you I don't have time. Just the key points!",
];

/* --- Mode B's "could you simplify that?" (once only) --- */
const SIMPLIFY_B = "Sorry, that's a bit hard to follow. Could you put that more simply?";

/* --- Mode C's walkout (strike limit reached) --- */
const WALKOUT_C = "...I don't really understand, so let's leave it there. I need to get back to the clinic — please see yourself out.";

/* --- Theme 2: discount pressure injected once even outside the price scene (per mode) --- */
const DISCOUNT_PUSH_INJECT = {
  A: "By the way, about the price... the other company seems willing to come down quite a bit. What about a discount from you?",
  B: "Changing topics — the price. I hear the other vendor is open to a discount. What about you?",
  C: "Hold on, money first. The other guys say they'll go lower. How much can you knock off?",
};

/* --- Theme 4: keywords per question category (tuned to the director's vocabulary) --- */
const CAT_KEYWORDS = {
  cost:   /dollar|price|cost|budget|quote|estimate|invest(ment)?|payback|repair cost|running cost/i,
  diff:   /differen(t|ce)|other (company|companies|vendor)|compare|strength|reason to choose|our (company|product) is|unique|one of a kind/i,
  safety: /safe(ty)?|peace of mind|radiation|exposure|dose|x-?ray|gentle(r)? on|less burden/i,
  ops:    /workload|procedure time|treatment time|shorten|case volume|operate|easy to use|workflow|physician|operator|nurse|staff|time|effort|breakdown|repair|maintenance|stop(ped)?/i,
  sched:  /month|half[- ]a[- ]year|fiscal year|delivery|in time|schedule|timeline|order|installation|operational/i,
  need:   /proposal|introduce|purpose|challenge|help (with|you)|solve|assist|visit|explain/i,
  next:   /demo|tour|quote|estimate|next week|next time|visit|schedule|materials|appointment|availability|bring/i,
};
const CAT_NAMES = {
  cost: "Cost / price", diff: "Differentiation from competitors", safety: "Patient safety / radiation exposure",
  ops: "Procedure time / staff workload", sched: "Delivery / schedule", need: "Purpose / requirements", next: "Next steps",
};

/* --- Feedback copy per evaluation theme (improvement point + rewrite example) --- */
const FEEDBACK = {
  t1: {
    bad: (term) => ({
      point: `The jargon term "${term}" doesn't land with the director. If you use it, always translate it into a benefit for the patient or hospital.`,
      example: `Translate "${term}" → "Simply put, it's a way to get a clear image of the blood vessels using less X-ray. That means less radiation exposure for the patient."`,
    }),
    good: () => ({
      point: "You avoided jargon well. Adding \"for example\" with a familiar comparison next time will make it land even better.",
      example: "\"For example, it's like a camera that can still take a clear photo in a dark room.\"",
    }),
  },
  t2: {
    offered: () => ({
      point: "You brought up a discount. Your company can't offer one. Don't step onto the price battlefield — pivot to value instead.",
      example: "\"I'm sorry, we're not able to offer a discount. What we can offer is reduced radiation exposure and shorter procedure times for your patients. If time per case goes down, you can handle more cases too — so it's not as expensive as it looks.\"",
    }),
    lowValue: (n) => ({
      point: `You surfaced ${n} value point(s) beyond price. Combine multiple strengths — reduced dose, shorter procedure time, safety, track record, image quality, maintenance — for a stronger case.`,
      example: "\"We can't match them on price, but we won't lose on how little radiation your patients are exposed to, or on how fast we get you back up and running if something breaks.\"",
    }),
    sufficient: () => ({
      point: "You brought up enough value points. Next, practice summing it up in one line focused on the director's top concern: material to justify it to the hospital director and finance.",
      example: "\"Tell the director: this is an investment that reduces patient radiation exposure while increasing case volume.\"",
    }),
  },
  t3: {
    longOrInterrupted: () => ({
      point: "There were moments where you spoke too long and made the director wait. Lead with the conclusion, and give only one reason — that's the rule.",
      example: "\"To conclude, the biggest benefit is reduced radiation exposure for patients. The reason is that the image stays clear even with less X-ray.\"",
    }),
    noConclusion: () => ({
      point: "Your statements were concise, but you never opened with \"to conclude.\" Grab their attention with the first sentence.",
      example: "\"To conclude, this one system can solve your patient wait-time problem.\"",
    }),
    good: () => ({
      point: "You're leading with the conclusion concisely. Adding a single number next time will make it even more persuasive.",
      example: "\"To conclude, we can shorten procedure time by several minutes per case.\"",
    }),
  },
  t4: {
    missed: (catName) => ({
      point: `When the director asked about "${catName}", your answer drifted from what was actually being asked. Answer the question directly in one line first, then add detail.`,
      example: `Start with, "To answer your question about ${catName} directly, ..." — echo the topic back before answering.`,
    }),
    good: () => ({
      point: "You grasped the intent of the questions well. Next, try adding a check-in afterward: \"Does that address what you were asking?\"",
      example: "\"That's my answer based on that understanding — does that address the point you were concerned about, Doctor?\"",
    }),
  },
};
