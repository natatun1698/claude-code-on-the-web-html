# Per-language constants

Single source of truth for everything that differs between language
variants. Add a column when adding a language; add a row to the scenario
table when adding a scenario.

| | English | Spanish | Portuguese |
|---|---|---|---|
| Suffix / shared folder | `-en` / `js-en/` | `-es` / `js-es/` | `-pt` / `js-pt/` |
| `<html lang>` | `en` | `es` | `pt-BR` |
| `speech.js` locale (`rec.lang`, `u.lang`) | `en-US` | `es-ES` (use `es-MX` / `es-419` if a scenario targets a specific market) | `pt-BR` |
| Voice pick | `v.lang.startsWith("en")` | `v.lang.startsWith("es")` | `v.lang.startsWith("pt")` |
| `STORAGE_KEY` (app.js) | `salesRoleplayStatsEn` | `salesRoleplayStatsEs` | `salesRoleplayStatsPt` |
| `VOICE_PREF.genderRegex` example (male) | `/male\|david\|mark\|daniel/i` | `/male\|jorge\|diego\|carlos\|hombre\b/i` | `/male\|daniel\|ricardo\|felipe\|homem\b/i` |
| Titles 90+ / 80+ / 70+ / 55+ / 40+ / below | Master / Skilled / Competent / Apprentice / Rookie / Trainee | Maestro / Hábil / Competente / Aprendiz / Novato / Practicante | Mestre / Habilidoso / Competente / Aprendiz / Iniciante / Estagiário |
| Example score line | "Director conquest score 72: Negotiation Apprentice" | "Puntuación de conquista del Director: 72 — Aprendiz de Negociación" | "Pontuação de conquista do Diretor: 72 — Aprendiz de Negociação" |

The Japanese original uses `js/`, no suffix, `ja-JP`, `salesRoleplayStats`
and the titles 達人 / 敏腕交渉人 / 一人前 / 見習い / 駆け出し / 修行中.

## Existing scenarios

| Language | Folder | Customer role | Product |
|---|---|---|---|
| en | `bucho-en/` | Director of Cardiology (Dr. Harrison — clinically expert, radiology-engineering jargon outside his expertise) | Angiography system "Trinias OPERA B8", approx. $1,000,000 |
| es | `bucho-es/` | Director de Cardiología (Dr. Ramírez — clínicamente experto, la jerga técnica de radiología está fuera de su especialidad) | Sistema de angiografía "Trinias OPERA B8", aprox. US$ 1.000.000 |
| pt | `bucho-pt/` | Diretor de Cardiologia (Dr. Ricardo — clinicamente especialista, jargão técnico de radiologia fora de sua área) | Sistema de angiografia "Trinias OPERA B8", aprox. US$ 1.000.000 |

Japanese scenarios available to port: `jimucho/`, `bucho/`, `gc-center/`,
`gc-qa/`, `gc-lab/` (see the scenario table in the Japanese skill).
