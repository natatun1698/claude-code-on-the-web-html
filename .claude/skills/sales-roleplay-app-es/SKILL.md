---
name: sales-roleplay-app-es
description: Build and extend the Spanish-language (es) voice roleplay practice web app for medical/analytical device sales reps (e.g. /bucho-es/). A salesperson (player) talks by voice with an AI customer role and gets feedback on a single theme per session — a login-free static web app. Spanish sibling of the sales-roleplay-app skill: uses its own shared JS (js-es/) so the original Japanese apps/skill and the English/Portuguese siblings (js-en/, js-pt/, sales-roleplay-app-en, sales-roleplay-app-pt) are never touched. Use for requests like "aplicación de roleplay de ventas en español", "versión en español del app de conquista del director", "Spanish sales roleplay app".
---

# Sales Roleplay App (Spanish / es)

A skill for building or extending a Spanish-language voice sales-roleplay
practice web app for medical device sales reps. This is the Spanish
sibling of the `sales-roleplay-app` skill (and of its English and
Portuguese siblings `sales-roleplay-app-en` / `sales-roleplay-app-pt`) —
same architecture and design rules, but with its own shared logic folder
(`js-es/`) so none of the other language apps/skills are ever modified.

**Never edit the original Japanese apps or their shared files** (`js/`,
`style.css`, any `<scenario>/` folder without a `-es`/`-en`/`-pt` suffix,
or the `sales-roleplay-app` skill), **and never edit the English or
Portuguese siblings** (`js-en/`, `js-pt/`, any `<scenario>-en/` or
`<scenario>-pt/` folder, or `sales-roleplay-app-en` / `sales-roleplay-app-pt`).
Those are live and in use. All Spanish work happens in `js-es/` and
`<scenario>-es/` folders, documented in this skill.

## Repository layout (must be followed)

Implemented as a **fully client-side static web app**. No server, no API
keys, no login — so "just click the URL" works for anyone.

Each scenario (a customer role + product pairing) gets **its own
subdirectory** with an `-es` suffix. Shared logic
(`engine.js`/`speech.js`/`app.js`) lives once under `js-es/` at the repo
root and is reused by every Spanish scenario. `style.css` at the repo root
is language-neutral (no text content) and is shared directly with the
Japanese, English, and Portuguese apps — do not copy it.

```
/
  style.css             shared with all language variants: layout/colors/chat bubbles (no text, safe to reuse as-is)
  js-es/
    engine.js            shared: analyzeUtterance() / RoleAI class / scoreSession() — Spanish comments/strings, logic identical to js/engine.js, js-en/engine.js, js-pt/engine.js
    speech.js             shared: SpeechIO wrapper, locked to es-ES (lang, voice selection, error messages)
    app.js                 shared: screen flow / timer / chat UI / localStorage — all UI copy in Spanish
  <scenario-name>-es/       e.g. bucho-es
    index.html               this scenario's page body (title/copy hardcoded here, lang="es")
    js/data.js                 this scenario's product, jargon, dialogue, feedback copy — in Spanish
```

`index.html`'s `<script>`/`<link>` paths reference the shared files as
`../style.css`, `../js-es/engine.js`, `../js-es/speech.js`,
`../js-es/app.js`. Only `data.js` is scenario-local, at `js/data.js`
inside the scenario folder. Load order must be
`js/data.js` → `../js-es/engine.js` → `../js-es/speech.js` → `../js-es/app.js`.

**To add a new Spanish scenario**, copy an existing `-es` scenario folder
(`index.html` + `js/data.js`) and rewrite the product/dialogue. Do not
touch `js-es/` — if a change seems to require it, that copy almost always
belongs in `data.js`'s `FEEDBACK`/`SCENES` instead (see the parity note
below).

**To port a new scenario into Spanish**, read the source scenario's
`<scenario>/index.html` and `<scenario>/js/data.js` (Japanese, under
`sales-roleplay-app`) or `<scenario>-en/` / `<scenario>-pt/` (English /
Portuguese) for content, and translate it into a new `<scenario>-es/`
folder using this skill's structure — never edit the source files in the
process.

## Parity with `js/engine.js`, `js-en/engine.js`, `js-pt/engine.js`

`js-es/engine.js` must stay behaviorally identical to the other language
engines (same `RoleAI` response-priority logic, same `scoreSession`
scoring formulas — see the original skill's algorithm section for the
exact rules). If you fix a bug or improve scoring logic, apply the same
fix to all copies, since they've diverged into separate files by design
(to avoid touching shared files other live apps depend on).

## Globals `data.js` must provide (read by engine.js/speech.js/app.js)

Same contract as the other language skills, values in Spanish:

| Definition | Content |
|---|---|
| `ROLE_LABEL` | Customer role name (e.g. "Director"). Interpolated into UI copy and feedback text |
| `VOICE_PREF` | `{ genderRegex, pitch }`. Used by speech.js for Spanish voice selection/pitch — `genderRegex` should match Spanish TTS voice names (e.g. `/male|jorge|diego|carlos|hombre\b/i`) |
| `PRODUCT` | Product name, plain-language name, price, strengths, install schedule (documentation only — not read by shared code) |
| `JARGON` | List of terms the customer doesn't know (`{label, re}`), Spanish regexes |
| `PLAIN_MARKERS` / `CONCLUSION_MARKERS` | Spanish phrase patterns detecting plain-language rephrasing / leading with the conclusion |
| `DISCOUNT_RE` / `DISCOUNT_REFUSAL_RE` | Spanish patterns for discount mentions / refusals |
| `VALUE_CATEGORIES` | Value categories beyond price (`{id, label, re}`), Spanish regexes |
| `NEXT_STEP_RE` / `QUESTION_RE` | Spanish patterns for proposing next steps / asking questions |
| `MODES` | The 3 modes A/B/C (`aizuchi`, `interruptLen`, `maxStrikes`, etc.), Spanish acknowledgment phrases |
| `THEMES` | The 4 evaluation themes (`id, name, desc, tip`), in Spanish |
| `TITLES` / `titleFor()` | Score → title mapping, Spanish titles |
| `SCENES` | Per-scene script (opener/beats/followups/closer; `qaDriven` scenes have `nuggets`), all Spanish dialogue |
| `JARGON_REPLIES` / `DISCOUNT_SHAKE` / `VALUE_ACK` / `INTERRUPT_C` / `SIMPLIFY_B` / `WALKOUT_C` | Per-mode stock lines, Spanish |
| `DISCOUNT_PUSH_INJECT` | Theme-2 one-time discount-pressure line outside the price scene, per mode |
| `CAT_KEYWORDS` / `CAT_NAMES` | Theme-4 scoring keywords/display names per question category, tuned to Spanish vocabulary |
| `FEEDBACK` | Per-theme improvement point + rewrite example templates (`t1.bad/good`, `t2.offered/lowValue/sufficient`, `t3.longOrInterrupted/noConclusion/good`, `t4.missed/good`) |

`js-es/engine.js`/`speech.js`/`app.js` depend only on the globals above —
**never hardcode product copy or role names in them**. If adding a
scenario seems to require touching the shared files, that's a sign the
copy belongs in `data.js`'s templates instead.

## Design principles (reflect these in the UX)

Identical to the other language apps' principles, translated:

- A casual "just 5–20 minutes before tomorrow's meeting" practice session. 20-minute session cap, remaining-time timer (warns at 1 minute left).
- Not a full scripted negotiation — practiced **scene by scene**: opening / needs assessment / product explanation / price presentation / closing.
- Feedback covers **exactly one evaluation theme per session**. Never comment on anything outside the chosen theme (e.g. tone of voice).
- Game-like framing: 100-point score, a title (e.g. "Puntuación de conquista del Director: 72 — Aprendiz de Negociación"), a daily-streak record. Stored under the `salesRoleplayStatsEs` localStorage key — **use a distinct key per language** so Spanish practice stats never mix with the Japanese (`salesRoleplayStats`), English (`salesRoleplayStatsEn`), or Portuguese (`salesRoleplayStatsPt`) apps' keys.

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

## Existing Spanish scenarios

| Scenario | Folder | Customer role | Product |
|---|---|---|---|
| Conquista del Director de Cardiología | `bucho-es/` | Director de Cardiología (Dr. Ramírez — clínicamente experto, la jerga técnica de radiología está fuera de su especialidad) | Sistema de angiografía "Trinias OPERA B8", aprox. US$ 1.000.000 |

When translating additional scenarios (`jimucho/`, `gc-center/`,
`gc-qa/`, `gc-lab/`, etc.) into Spanish, follow the same `-es` suffix
convention and add a row here.

## Dialogue engine response priority (`RoleAI.respond`, fixed logic in `js-es/engine.js`)

1. Mode C: long preamble → interrupt (strike++)
2. New jargon term → ask back
3. Discount offered → push back
4. Discount refused + value offered → acknowledgment prefix (strike recovery)
5. Mode B: confusing explanation → ask back once
6. When theme "countering discounts" is selected: inject discount pressure once outside the price scene (`DISCOUNT_PUSH_INJECT`)
7. The needs-assessment scene is special (`qaDriven`): reveal one challenge nugget **only when asked** a question. Otherwise: "so what did you want to ask?"
8. Normal scene: work through beats (5–6) in order → followup → closer ends the session

## Evaluation themes and scoring (`scoreSession`, fixed logic in `js-es/engine.js`)

Theme is chosen before starting; only the chosen theme is scored:

1. **Explaining without jargon**: -12 per jargon use (-6 if the same utterance also has a plain-language marker), bonus for plain-language phrasing
2. **Countering discount requests**: base 60, additive. Offering a discount -30, refusing +10, each new value category first use +6 (+10 if right after discount pressure)
3. **Leading with the conclusion, concisely**: base 100. Interrupted -12, >120 chars -6, conclusion marker +4, average >100 chars -10
4. **Grasping question intent**: `CAT_KEYWORDS` category (cost/diff/safety/ops/sched/need/next) matched against the immediate reply, scored as 30 + 70 × hit-rate

Result format (required; copy comes from `FEEDBACK` templates):
1. Theme achievement: ◎(85+)/○(70+)/△(50+)/×
2. A good line (quote one actual utterance)
3. One improvement point only, with a concrete rewrite example
4. Score out of 100 + title (90+ Maestro/80+ Hábil/70+ Competente/55+ Aprendiz/40+ Novato/below Practicante)

## Screen flow

Top (scene selection) → customer-mode selection → evaluation-theme selection →
setup screen (selection summary + theme tip + duration 5/10/15/20 min) →
roleplay screen (timer / chat log / mic button / text-input toggle / voice ON-OFF / end) →
result screen (try again / next theme / top)

## Technical requirements checklist

- [ ] Works on iPhone Safari / Windows Chrome & Edge (webkitSpeechRecognition support)
- [ ] Browsers without STT support fall back to text-input mode automatically; the toggle button is always present
- [ ] TTS picks a Spanish voice via `voiceschanged` (`VOICE_PREF.genderRegex` for gender leaning); a fallback timer guards against Safari's `onend` not firing
- [ ] Mic uses tap-to-talk (no listening while TTS is speaking, to avoid picking up the app's own voice). After a voice turn, the mic restarts automatically once the reply finishes
- [ ] **A SpeechRecognition instance is never reused — create a new one on every start()** (iOS Safari stops responding to `start()` on a reused instance after the first run). `start()` exceptions get one automatic retry with a fresh instance
- [ ] Mobile layout uses `100dvh` + `env(safe-area-inset-bottom)`
- [ ] Tap targets ≥44px; textarea Enter-to-send excludes `isComposing` (IME composition)
- [ ] All localStorage access wrapped in try/catch (private browsing)
- [ ] `lang="es"` on `<html>`; `speech.js`'s recognition/synthesis locale is `es-ES` (swap to a regional locale like `es-MX`/`es-419` if a scenario targets a specific market)

## How to verify

Serve the repo root with `python3 -m http.server` and open
`/<scenario-name>-es/` in a browser; run through each scene × each mode at
least once in text-input mode.

The engine can be checked standalone with node (no browser APIs required):
`node -e "$(cat <scenario-name>-es/js/data.js js-es/engine.js) …"` to
exercise `RoleAI`/`scoreSession` responses. **When adding a new Spanish
scenario, run this check for every Spanish scenario** to confirm no side
effects leaked into the shared `js-es/engine.js`.

Playwright (`/opt/pw-browsers/chromium`) can run an E2E smoke test too —
mock an unsupported-STT environment via `addInitScript` to exercise the
text-input fallback. With multiple scenarios, repeat the same test against
each `/<scenario-name>-es/` path.
