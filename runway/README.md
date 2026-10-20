# Runway

Helps young office workers who have just been laid off find a future-proof job before their time runs out.
SDC Hackathon 2026 · Domain 1 (Aiversecity Future-Ready Workforce).

Forecast → Match → Plan. Skill and job forecasts come from public, dated data. A prediction market
(points only, never money) whose questions settle on real data releases decides how likely each of three
futures (slow, medium, fast AI progress) is. The worker leaves with a week-by-week plan that a counsellor approves.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # engine tests: fairness, LMSR, futures weights, replay, release, log
npm run typecheck
npm run build && npm start
```

Without `DATABASE_URL` the app keeps sessions and the hash log in `.data/runway.db` (SQLite). On Replit, set
`DATABASE_URL` to the built-in Postgres and `SESSION_SECRET` to a random string (see `.env.example`).

## Jobs, sectors and qualifications

89 roles in 10 sectors (computing, engineering, science, finance, business, sales and service, logistics, health, trades, education), each with an
O*NET-SOC source ID confirmed to exist in the Anthropic Economic Index release (a few titles are marked "closest match", for example
Quality assurance engineer maps to Industrial Engineers). 80 skills, each with an ILO exposure score, an Economic Index task share and an SDG tag.
Each role states the **qualification it needs** (SPM or certificate, diploma, degree). The worker gives their highest qualification; jobs that need more
are not ranked and are listed as longer-term paths. The Jobs page can be browsed by sector. A role's practice and certification time shrinks as you already
hold more of its skills, so a civil engineer is matched to civil engineering rather than to something unrelated. A small bonus rewards staying in your own field.

## Resume scan

`/resume` reads a PDF, Word (.docx) or text resume (or pasted text), scores it out of 100, and lists what to fix first
with before/after examples, a line-by-line highlighted view, and the skills it found (each with a shelf life).
The user confirms the skills and the app builds their profile from them. The scan is rule-based (no AI model,
`src/lib/engine/resume.ts`), runs in memory for the request, and never stores the text: the session keeps only the
score, the findings (titles and fixes, no quoted lines) and the skill ids. The plan page then shows resume tips for the chosen job.

## Job map (Malaysia)

`/map` shows where jobs like the one you picked are, state by state, on a map of Malaysia you can drag and zoom
(quick views: all Malaysia, Peninsular, Sabah and Sarawak). Colours can show jobs like this, unemployment or median pay.
Pick your state and "Would you move for work?" to compare your state with any other ("Selangor has 5.3× as many jobs like
this as Kedah"). Your state is optional, only used by the map, and a test checks it never changes your matches.

Malaysia publishes no open data on job ads by state and occupation, so "jobs like this" counts workers in the industries
the job belongs to (DOSM employed persons by industry and state, 2021, scaled to each state's 2026 Q2 employment). It is
labelled as an estimate. Unemployment (2026 Q2) and median wages (2025) are from OpenDOSM. Boundaries: geoBoundaries
(OpenStreetMap, ODbL), drawn without a third-party base map. Rebuild with `npm run data:build` (`scripts/build-geo.mjs`).

## Prediction market (Kalshi-style)

Each question is an **event** with a ladder of three **strikes** (for example "rises by more than 1.5 / 3.0 / 4.5 points").
Every strike is its own Yes/No market priced in cents by an LMSR market maker. You can **buy Yes, buy No, or sell** what you hold;
each contract pays 1 point if right (points only, never money). The chart is a **live tape**: about 200 simulated forecasters opened the
market over the last 6 hours and keep trading about every 6 seconds, so prices move while you watch (the page polls `/api/market` every 3 seconds).
Your orders are replayed into the tape at the moment you placed them, so they move the price for everyone and fade slowly.
Orders and settlement are computed on the server (`src/lib/engine/tape.ts`); the ticket's instant quote uses the same maths (`src/lib/market-math.ts`, tested to agree).
The headline strike (the middle one) feeds the futures' weights; the others are extra markets.

## Demo path

1. **Try as Hafiz** (home page) or **Scan my resume** (use the sample resume) → skills → jobs → plan. Forecasts live under the ••• menu.
2. On **Forecasts** (••• menu), optionally place a bet. Then press **New data released** (top bar, any page).
   The server settles five questions against the real, held-back DOSM 2026 Q2 release and Epoch AI data,
   updates forecaster influence, re-weights the futures, and recomputes expiry dates, job ranking and the plan.
   The **What changed and why** panel lists every change with its source and date.
3. **Jobs**: pick SDG goals to re-rank jobs and see the trade-off.
4. **Plan** → *Send to counsellor* → switch to **Counsellor** (top bar) → approve.
5. **/trust**: fairness check, hash-chain verification, data sources.

## Layout

| Path | What |
|---|---|
| `src/lib/engine/` | Pure engine, no framework imports: LMSR, simulated forecasters, history replay, futures weights, expiry dates, matching, plan, diff |
| `src/lib/server/` | Postgres/SQLite store, hash-chained log, signed session cookie |
| `src/app/api/` | `state`, `action`, `resume`, `log`, `fairness` |
| `src/app/*` | Pages: `/`, `/start`, `/resume`, `/profile`, `/skills`, `/futures` (Forecasts), `/jobs`, `/plan`, `/counsellor`, `/trust` |
| `data/` | Committed snapshots and closed lists: `series.json` (generated), `roles.json`, `skills.json`, `courses.json`, `occupations.json`, `personas.json`, `sdg.json` |
| `scripts/` | `build-series.mjs` (raw files → `data/series.json`), `anchor-log.mjs` (publish log fingerprint) |
| `docs/` | Data feasibility notes and the method write-up |

## Data and updating

`data/raw/` (git-ignored) holds the source downloads; `npm run data:build` turns them into `data/series.json`:

| Source | File | Used for |
|---|---|---|
| DOSM Job Market Insights (2026 Q2 release, 18 Aug 2026) | `data/raw/dosm/jmi_q2_2026.xlsx` | clerical share of online ads; job demand by occupation group |
| Epoch AI benchmarking data (retrieved 2026-10-20, CC-BY) | `data/raw/epoch/*.csv` | market questions and history replay |
| Anthropic Economic Index, release 2025-02-10 (CC-BY) | `data/raw/aei_2025_02_10/` | share of an occupation's tasks seen in AI use |
| ILO 2025 GenAI exposure scores (CC BY 4.0) | `data/raw/ilo/ilo.xlsx` | exposure of each occupation to generative AI |

To update: put a newer DOSM workbook (and Epoch zip) in `data/raw/`, change the cut-off constants in
`scripts/build-series.mjs` and `src/lib/engine/questions.ts`, and re-run `npm run data:build`.

## Guardrails

- Roles, skills and courses come only from the files in `data/`. Scores are computed; explanations are filled from templates with a source and date.
- Age, gender and background are never inputs: matching takes a whitelisted input type (`pickInputs`), and a test and a live page check it.
- Simulated forecasters and made-up profiles are always labelled. No real CVs or personal data. No LLM at run time.
- Every bet, release, submission and approval is appended to a hash-chained log. `npm run anchor` writes the latest fingerprint to `anchors/` for committing.

Licence: Apache-2.0.
