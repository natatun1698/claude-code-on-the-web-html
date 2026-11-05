---
name: sales-roleplay-app-i18n
description: Build and extend the non-Japanese language variants (English /bucho-en/, Spanish /bucho-es/, Portuguese /bucho-pt/, or a new language) of the medical/analytical device sales voice roleplay web app. Each language has its own shared JS folder (js-en/, js-es/, js-pt/) so the original Japanese apps and the other languages are never touched. Use for requests like "English sales roleplay app", "versión en español del app del director", "aplicativo de roleplay em português", "add a French version of the roleplay app", "port the jimucho scenario to English". For the Japanese apps use the sales-roleplay-app skill instead.
---

# Sales Roleplay App — language variants (en / es / pt / new)

One skill for every non-Japanese variant of the sales roleplay app. The
architecture, data.js contract, persona rules, engine priority, scoring
formulas, screen flow and technical checklist are **all defined once in
the Japanese skill** `.claude/skills/sales-roleplay-app/SKILL.md`. Read
that file first; this skill only adds what differs per language.

Per-language constants (folder suffix, locale, storage key, voice regex,
titles, existing scenarios) live in `references/languages.md`. When you add
a language or a scenario, update that table — not this file.

## Isolation rule (never break)

Each language is a separate, live deployment. Work only inside the folders
of the language you were asked about:

| Language | Shared logic | Scenario folders | Storage key |
|---|---|---|---|
| Japanese (original) | `js/` | `<scenario>/` (no suffix) | `salesRoleplayStats` |
| Other language `<xx>` | `js-<xx>/` | `<scenario>-<xx>/` | `salesRoleplayStats<Xx>` |

- Never edit `js/`, `style.css`, any no-suffix scenario folder, or the
  `sales-roleplay-app` skill while working on a language variant.
- Never edit another language's `js-<yy>/` or `<scenario>-<yy>/` folders.
- `style.css` at the repo root has no text and is shared by every language
  as-is via `../style.css`. Do not copy it.

## Layout of one language variant

```
/
  style.css                   shared, language-neutral
  js-<xx>/
    engine.js                 analyzeUtterance() / RoleAI / scoreSession() — logic identical to js/engine.js, strings in <xx>
    speech.js                 SpeechIO locked to the language's locale (rec.lang / u.lang, voice pick by v.lang.startsWith("<xx>"))
    app.js                    screen flow / timer / chat UI / localStorage (STORAGE_KEY = salesRoleplayStats<Xx>), UI copy in <xx>
  <scenario>-<xx>/
    index.html                lang="<locale>", page copy in <xx>
    js/data.js                product / jargon / dialogue / FEEDBACK in <xx>
```

`index.html` loads, in this order: `js/data.js` → `../js-<xx>/engine.js`
→ `../js-<xx>/speech.js` → `../js-<xx>/app.js`.

## Three kinds of task

1. **Add a scenario to an existing language.** Copy an existing
   `<scenario>-<xx>/` folder, rewrite `index.html` and `js/data.js`. Do not
   touch `js-<xx>/`. If a change seems to need the shared files, the copy
   belongs in `data.js` (`FEEDBACK` / `SCENES`) instead.
2. **Port a Japanese scenario** (`jimucho/`, `gc-center/`, `gc-qa/`,
   `gc-lab/` …). Read the source `index.html` + `js/data.js` for content,
   translate into a new `<scenario>-<xx>/` folder. Never edit the source.
   Regexes (`JARGON`, `PLAIN_MARKERS`, `DISCOUNT_RE`, `CAT_KEYWORDS` …) must
   be rewritten for the target language's vocabulary, not transliterated.
3. **Add a new language `<xx>`.** Copy `js-en/` to `js-<xx>/`, then change
   only: the locale strings in `speech.js`, `STORAGE_KEY` in `app.js`, and
   every user-visible string. Add a column to `references/languages.md`
   and a trigger phrase in this skill's `description`. Create the first
   scenario as in task 2.

## Engine parity

`js-en/engine.js`, `js-es/engine.js`, `js-pt/engine.js` (and any new
language) must stay **behaviorally identical** to `js/engine.js`: same
`RoleAI.respond` priority order, same `scoreSession` formulas, same
thresholds (130 / 110 / 120 chars, strike counts). They are deliberate
copies, so a logic fix found in one must be applied to all copies in the
same commit. Only strings and comments may differ. Quick check:

```bash
for l in en es pt; do echo "js-$l:"; diff <(sed 's#//.*##' js/engine.js) <(sed 's#//.*##' js-$l/engine.js) | grep -c '^[<>]'; done
```

A jump in that count after your change means logic diverged. Inspect it.

## Language-specific requirements (in addition to the Japanese checklist)

- [ ] `<html lang="<locale>">` and `speech.js` recognition/synthesis locale match `references/languages.md`
- [ ] `VOICE_PREF.genderRegex` in `data.js` matches voice names that exist for that locale (examples in the table)
- [ ] `STORAGE_KEY` is unique per language so streaks never mix
- [ ] Titles, achievement marks and `FEEDBACK` templates are natural in the target language, not machine-literal
- [ ] Character-length thresholds in the engine are unchanged even though Latin-script sentences run longer; adjust `SIMPLIFY_B` wording, not the numbers

## How to verify

Serve the repo root with `python3 -m http.server`, open
`/<scenario>-<xx>/`, and run each scene × each mode once in text mode.

Engine check without a browser:

```bash
node -e "$(cat <scenario>-<xx>/js/data.js js-<xx>/engine.js) …"
```

Run it for **every scenario of that language** after any change to
`js-<xx>/`. Playwright at `/opt/pw-browsers/chromium` can run the same E2E
smoke test as the Japanese skill, with STT mocked off via `addInitScript`.
