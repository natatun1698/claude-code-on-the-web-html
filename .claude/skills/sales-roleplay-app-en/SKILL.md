---
name: sales-roleplay-app-en
description: Build and extend the English-language voice roleplay practice web app for medical/analytical device sales reps (e.g. /bucho-en/). A salesperson (player) talks by voice with an AI customer role and gets feedback on a single theme per session — a login-free static web app. English sibling of the sales-roleplay-app skill: uses its own shared JS (js-en/) so the original Japanese apps and skill are never touched. Use for requests like "English sales roleplay app", "English version of the director conquest app", "English voice roleplaying app".
---

# Sales Roleplay App (English)

A skill for building or extending an English-language voice sales-roleplay
practice web app for medical device sales reps. This is the English sibling
of the `sales-roleplay-app` skill — same architecture and design rules, but
with its own shared logic folder (`js-en/`) so the existing Japanese apps
and skill are never modified.

**Never edit the original Japanese apps or their shared files** (`js/`,
`style.css`, any `<scenario>/` folder without an `-en` suffix, or the
`sales-roleplay-app` skill). Those are live and in use. All English work
happens in `js-en/` and `<scenario>-en/` folders, and is documented in
this skill.

## Repository layout (must be followed)

Implemented as a **fully client-side static web app**. No server, no API
keys, no login — so "just click the URL" works for anyone.

Each scenario (a customer role + product pairing) gets **its own
subdirectory** with an `-en` suffix. Shared logic
(`engine.js`/`speech.js`/`app.js`) lives once under `js-en/` at the repo
root and is reused by every English scenario. `style.css` at the repo root
is language-neutral (no text content) and is shared directly — do not copy
it.

```
/
  style.css             shared with the Japanese apps: layout/colors/chat bubbles (no text, safe to reuse as-is)
  js-en/
    engine.js            shared: analyzeUtterance() / RoleAI class / scoreSession() — English comments/strings, logic identical to js/engine.js
    speech.js             shared: SpeechIO wrapper, locked to en-US (lang, voice selection, error messages)
    app.js                 shared: screen flow / timer / chat UI / localStorage — all UI copy in English
  <scenario-name>-en/       e.g. bucho-en
    index.html               this scenario's page body (title/copy hardcoded here, lang="en")
    js/data.js                 this scenario's product, jargon, dialogue, feedback copy — in English
```

`index.html`'s `<script>`/`<link>` paths reference the shared files as
`../style.css`, `../js-en/engine.js`, `../js-en/speech.js`,
`../js-en/app.js`. Only `data.js` is scenario-local, at `js/data.js`
inside the scenario folder. Load order must be
`js/data.js` → `../js-en/engine.js` → `../js-en/speech.js` → `../js-en/app.js`.

**To add a new English scenario**, copy an existing `-en` scenario folder
(`index.html` + `js/data.js`) and rewrite the product/dialogue. Do not
touch `js-en/` — if a change seems to require it, that copy almost always
belongs in `data.js`'s `FEEDBACK`/`SCENES` instead (see the parity note
below).

**To port a new Japanese scenario into English**, read the source
scenario's `<scenario>/index.html` and `<scenario>/js/data.js` under the
original `sales-roleplay-app` skill for content, and translate it into a
new `<scenario>-en/` folder using this skill's structure — never edit the
Japanese source files in the process.

## Parity with `js/engine.js`

`js-en/engine.js` must stay behaviorally identical to `js/engine.js` (same
`RoleAI` response-priority logic, same `scoreSession` scoring formulas —
see the original skill's algorithm section for the exact rules). If you
fix a bug or improve scoring logic, apply the same fix to both files, since
they've now diverged into separate copies by design (to avoid touching the
shared file other live apps depend on).

## Globals `data.js` must provide (read by engine.js/speech.js/app.js)

Same contract as the Japanese skill, values in English:

| Definition | Content |
|---|---|
| `ROLE_LABEL` | Customer role name (e.g. "Director"). Interpolated into UI copy and feedback text |
| `VOICE_PREF` | `{ genderRegex, pitch }`. Used by speech.js for English voice selection/pitch — `genderRegex` should match English TTS voice names (e.g. `/male|david|mark|daniel/i`) |
| `PRODUCT` | Product name, plain-language name, price, strengths, install schedule (documentation only — not read by shared code) |
| `JARGON` | List of terms the customer doesn't know (`{label, re}`), English regexes |
| `PLAIN_MARKERS` / `CONCLUSION_MARKERS` | English phrase patterns detecting plain-language rephrasing / leading with the conclusion |
| `DISCOUNT_RE` / `DISCOUNT_REFUSAL_RE` | English patterns for discount mentions / refusals |
| `VALUE_CATEGORIES` | Value categories beyond price (`{id, label, re}`), English regexes |
| `NEXT_STEP_RE` / `QUESTION_RE` | English patterns for proposing next steps / asking questions |
| `MODES` | The 3 modes A/B/C (`aizuchi`, `interruptLen`, `maxStrikes`, etc.), English acknowledgment phrases |
| `THEMES` | The 4 evaluation themes (`id, name, desc, tip`), in English |
| `TITLES` / `titleFor()` | Score → title mapping, English titles |
| `SCENES` | Per-scene script (opener/beats/followups/closer; `qaDriven` scenes have `nuggets`), all English dialogue |
| `JARGON_REPLIES` / `DISCOUNT_SHAKE` / `VALUE_ACK` / `INTERRUPT_C` / `SIMPLIFY_B` / `WALKOUT_C` | Per-mode stock lines, English |
| `DISCOUNT_PUSH_INJECT` | Theme-2 one-time discount-pressure line outside the price scene, per mode |
| `CAT_KEYWORDS` / `CAT_NAMES` | Theme-4 scoring keywords/display names per question category, tuned to English vocabulary |
| `FEEDBACK` | Per-theme improvement point + rewrite example templates (`t1.bad/good`, `t2.offered/lowValue/sufficient`, `t3.longOrInterrupted/noConclusion/good`, `t4.missed/good`) |

`js-en/engine.js`/`speech.js`/`app.js` depend only on the globals above —
**never hardcode product copy or role names in them**. If adding a
scenario seems to require touching the shared files, that's a sign the
copy belongs in `data.js`'s templates instead.

## Design principles (reflect these in the UX)

Identical to the Japanese app's principles, translated:

- A casual "just 5–20 minutes before tomorrow's meeting" practice session. 20-minute session cap, remaining-time timer (warns at 1 minute left).
- Not a full scripted negotiation — practiced **scene by scene**: opening / needs assessment / product explanation / price presentation / closing.
- Feedback covers **exactly one evaluation theme per session**. Never comment on anything outside the chosen theme (e.g. tone of voice).
- Game-like framing: 100-point score, a title (e.g. "Director conquest score 72: Negotiation Apprentice"), a daily-streak record. Stored under the `salesRoleplayStatsEn` localStorage key — **use a distinct key per language** so English practice stats never mix with the Japanese apps' `salesRoleplayStats` key.

## Customer-role persona rules (shared pattern)

The customer role is defined along two axes: "doesn't know some jargon"
and "has fixed priorities." Any jargon use **always** triggers "what's
that?" (same term only once). Instead of spec explanations outside their
interests, the role demands a "translation" into what matters to them.

3 switchable modes:
- **Mode A (Friendly)**: nods along, asks honestly, never interrupts.
- **Mode B (Neutral)**: calmly confirms. Asks "could you put that more simply?" **once** for a confusing explanation (>130 chars, no plain-language marker, no conclusion-first marker).
- **Mode C (Busy & intimidating)**: states "I only have 5 minutes" up front. Interrupts preambles over 110 chars. Accumulates strikes for unclear answers; 3 strikes → "I don't really understand, let's leave it there" and **ends the meeting** (walkout → penalty on the result screen). Short, conclusion-first answers restore strikes.

## Player constraint: industry #2, no discounts

If the player **offers** a discount (discount language without a refusal
phrase), the customer role pushes back with "the other company will go
lower" / "then I'll go with them." If the player refuses the discount and
counters with a value category, the role acknowledges "so it's not just
about price" and moves on.

## Existing English scenarios

| Scenario | Folder | Customer role | Product |
|---|---|---|---|
| Cardiology Director Conquest | `bucho-en/` | Director of Cardiology (Dr. Harrison — clinically expert, radiology-engineering jargon is outside his expertise) | Angiography system "Trinias OPERA B8", approx. $1,000,000 |

When translating additional Japanese scenarios (`jimucho/`, `gc-center/`,
`gc-qa/`, `gc-lab/`, etc.) into English, follow the same `-en` suffix
convention and add a row here.

## Dialogue engine response priority (`RoleAI.respond`, fixed logic in `js-en/engine.js`)

1. Mode C: long preamble → interrupt (strike++)
2. New jargon term → ask back
3. Discount offered → push back
4. Discount refused + value offered → acknowledgment prefix (strike recovery)
5. Mode B: confusing explanation → ask back once
6. When theme "countering discounts" is selected: inject discount pressure once outside the price scene (`DISCOUNT_PUSH_INJECT`)
7. The needs-assessment scene is special (`qaDriven`): reveal one challenge nugget **only when asked** a question. Otherwise: "so what did you want to ask?"
8. Normal scene: work through beats (5–6) in order → followup → closer ends the session

## Evaluation themes and scoring (`scoreSession`, fixed logic in `js-en/engine.js`)

Theme is chosen before starting; only the chosen theme is scored:

1. **Explaining without jargon**: -12 per jargon use (-6 if the same utterance also has a plain-language marker), bonus for plain-language phrasing
2. **Countering discount requests**: base 60, additive. Offering a discount -30, refusing +10, each new value category first use +6 (+10 if right after discount pressure)
3. **Leading with the conclusion, concisely**: base 100. Interrupted -12, >120 chars -6, conclusion marker +4, average >100 chars -10
4. **Grasping question intent**: `CAT_KEYWORDS` category (cost/diff/safety/ops/sched/need/next) matched against the immediate reply, scored as 30 + 70 × hit-rate

Result format (required; copy comes from `FEEDBACK` templates):
1. Theme achievement: ◎(85+)/○(70+)/△(50+)/×
2. A good line (quote one actual utterance)
3. One improvement point only, with a concrete rewrite example
4. Score out of 100 + title (90+ Master/80+ Skilled/70+ Competent/55+ Apprentice/40+ Rookie/below Trainee)

## Screen flow

Top (scene selection) → customer-mode selection → evaluation-theme selection →
setup screen (selection summary + theme tip + duration 5/10/15/20 min) →
roleplay screen (timer / chat log / mic button / text-input toggle / voice ON-OFF / end) →
result screen (try again / next theme / top)

## Technical requirements checklist

- [ ] Works on iPhone Safari / Windows Chrome & Edge (webkitSpeechRecognition support)
- [ ] Browsers without STT support fall back to text-input mode automatically; the toggle button is always present
- [ ] TTS picks an English voice via `voiceschanged` (`VOICE_PREF.genderRegex` for gender leaning); a fallback timer guards against Safari's `onend` not firing
- [ ] Mic uses tap-to-talk (no listening while TTS is speaking, to avoid picking up the app's own voice). After a voice turn, the mic restarts automatically once the reply finishes
- [ ] **A SpeechRecognition instance is never reused — create a new one on every start()** (iOS Safari stops responding to `start()` on a reused instance after the first run). `start()` exceptions get one automatic retry with a fresh instance
- [ ] Mobile layout uses `100dvh` + `env(safe-area-inset-bottom)`
- [ ] Tap targets ≥44px; textarea Enter-to-send excludes `isComposing` (IME composition)
- [ ] All localStorage access wrapped in try/catch (private browsing)
- [ ] `lang="en"` on `<html>`; `speech.js`'s recognition/synthesis locale is `en-US`

## How to verify

Serve the repo root with `python3 -m http.server` and open
`/<scenario-name>-en/` in a browser; run through each scene × each mode at
least once in text-input mode.

The engine can be checked standalone with node (no browser APIs required):
`node -e "$(cat <scenario-name>-en/js/data.js js-en/engine.js) …"` to
exercise `RoleAI`/`scoreSession` responses. **When adding a new English
scenario, run this check for every English scenario** to confirm no side
effects leaked into the shared `js-en/engine.js`.

Playwright (`/opt/pw-browsers/chromium`) can run an E2E smoke test too —
mock an unsupported-STT environment via `addInitScript` to exercise the
text-input fallback. With multiple scenarios, repeat the same test against
each `/<scenario-name>-en/` path.
