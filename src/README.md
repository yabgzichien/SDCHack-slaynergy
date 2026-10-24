# Jobbery

Helps young office workers who have just been laid off find a future-proof job before their time runs out.
SDC Hackathon 2026 · Domain 1 (Aiversecity Future-Ready Workforce).

Forecast → Match → Plan. Skill and job forecasts come from public, dated data. A prediction market
(points only, never money) whose questions settle on real data releases decides how likely each of three
futures (slow, medium, fast AI progress) is. The worker leaves with a week-by-week plan they choose, and can book an advisor for a second opinion.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # engine tests: fairness, LMSR, futures weights, replay, data refresh, settlement, log
npm run typecheck
npm run build && npm start
```

Without `DATABASE_URL` the app keeps sessions and the hash log in `.data/jobbery.db` (SQLite). For a deployment with
PostgreSQL, set `DATABASE_URL` and a random `SESSION_SECRET` in the Vercel project environment (see `.env.example`).

## Home page

The landing page (`/`, and `/about` once you have a profile) leads with one sentence and two buttons, **Get started** and
**Try a sample** (signs in as the made-up worker Hafiz). Below: what Jobbery is, three steps, a statistics section led by one
figure from Epoch AI data (how long a task AI can now finish on its own), and the crowd forecast, which leads with the
best guess across the three AI futures beside the live open questions. Headings use Libre Baskerville; body text uses
Instrument Sans. The language picker in the header switches the whole site between English, Bahasa Malaysia, 中文 and தமிழ்.

## Advisors (for judges)

**Meet an advisor** (`/advisor`) is the worker's side. It shows a two-week calendar of 30-minute slots in Malaysia time. The
worker picks a slot, a topic (a mock interview, which job to aim for, courses, time, interviews, or something else) and an
optional question, and books it. Every plan includes one "Meet an advisor" step, and the pathway badge is issued only after it. A worker
can have one upcoming booking and can cancel it. A made-up **Demo advisor** always has weekday slots, so the calendar is
never empty.

**Advisor view** (`/counsellor`) is the advisor's side. Click one of the **demo advisor buttons** to sign in with one click, or sign in with any name and the passcode
**`counsellor-demo`**. It has
two tabs, under a "needs you" strip that lists meetings still waiting for advice:

- **Meetings**: bookings with you or the demo advisor. Opening one shows the worker's question, profile, top jobs, plan and
  the futures behind Jobbery's advice. You write advice (it appears on the worker's Plan page) or cancel with a reason. Every plan has one "Meet an advisor"
  step (a mock interview, advice, or anything else); sending advice for the meeting completes it.
- **My free times**: click half hours on a 14-day grid to open or close them. Workers see them beside the demo advisor's.

**Add a made-up meeting** books a made-up worker with a full plan into your next free half hour, so you can try the desk alone. To try both roles at once, use
the worker app in one browser and the advisor view in a private window. The hash log records the advisor's name and a short
id (`c-` plus 8 hex characters, from the name) on every piece of advice, and the badge names the advisor the worker met. For advice it stores a hash of the
note, not the text.

The passcode is shared and comes from the `COUNSELLOR_PASSCODE` secret; without it the demo code above works. A real
deployment would give each advisor their own login (for example the agency's single sign-on).

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
(OpenStreetMap, ODbL), drawn without a third-party base map. Unemployment and wages refresh automatically (see
[Data and updating](#data-and-updating)); rebuild the starting data with `npm run data:build` (`scripts/build-geo.ts`).

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
2. On **Forecasts** (••• menu), optionally make a prediction on an open question. The latest real release (DOSM 2026 Q2
   and Epoch AI to Jun 2026) is already loaded: **What changed and why** lists what it changed, with sources and dates.
   Open questions settle by themselves when the next real release arrives (see [Data and updating](#data-and-updating)).
3. **Jobs**: pick SDG goals to re-rank jobs and see the trade-off.
4. **Plan** → *Send to counsellor* → switch to **Counsellor** (top bar) → approve.
5. **/trust**: fairness check, hash-chain verification, data sources.

## Layout

| Path | What |
|---|---|
| `src/lib/engine/` | Pure engine, no framework imports: LMSR, simulated forecasters, history replay, futures weights, expiry dates, matching, plan, diff |
| `src/lib/server/` | Postgres/SQLite store, hash-chained log, signed session cookie, automatic data refresh (`refresh.ts`, `sources.ts`) |
| `src/lib/datasrc/` | Source-file parsers and the validation checks, shared by the build scripts and the server |
| `src/app/api/` | `state`, `action`, `resume`, `log`, `fairness`, `data` (the active data snapshot and each source's status) |
| `src/app/*` | Pages: `/`, `/start`, `/resume`, `/profile`, `/skills`, `/futures` (Forecasts), `/jobs`, `/plan`, `/counsellor`, `/trust` |
| `data/` | Committed snapshots and closed lists: `series.json` (generated), `roles.json`, `skills.json`, `courses.json`, `occupations.json`, `personas.json`, `sdg.json` |
| `scripts/` | `build-series.ts` and `build-geo.ts` (raw files → snapshot 0), `data-refresh.ts` (one refresh by hand), `anchor-log.mjs` (publish log fingerprint) |
| `docs/` | Data feasibility notes and the method write-up |

## Data and updating

The data updates itself. The server keeps its data as numbered **snapshots** in the database. Snapshot 0 is the
committed `data/series.json` and `data/states.json`. Every API request calls `ensureData()`
(`src/lib/server/refresh.ts`): it loads the newest snapshot and, when the last check is old enough, starts a background
refresh without making the request wait. There is no scheduler to run: the first visit after the interval does the
check. It checks daily, hourly from DOSM's announced release day until two days after, and weekly for the pinned-source
alerts. A database lock lets only one refresh run at a time.

| Source | How it updates | Used for |
|---|---|---|
| DOSM Job Market Insights | **Automatic.** The server opens the next quarter's release page (`…/big-data-analytics-job-market-insights-q32026`), downloads the documents it links and keeps the one that is a real xlsx. An unpublished page lists no documents. | clerical share of online ads; job demand; the DOSM questions |
| Epoch AI benchmarking data (CC-BY) | **Automatic.** `benchmark_data.zip`, complete quarters only | the AI questions and history replay |
| OpenDOSM labour force and wages by state (CC BY 4.0) | **Automatic.** `lfs_qtr_state.csv`, `wages_state.csv` | the job map |
| ILO 2025 GenAI exposure scores (CC BY 4.0) | **Pinned; alert only** | exposure of each occupation; skill expiry dates |
| Anthropic Economic Index, release 2025-02-10 (CC-BY) | **Pinned; alert only** | share of an occupation's tasks seen in AI use |
| DOSM Labour Force Survey Report 2024 (tables B4.5, B4.8) | **Pinned; alert only** | workers by state and industry or occupation (job map) |

The pinned sources change how things are measured when a new edition comes out, so a weekly check only lists a new
version on the Sources page (and in the log) for a person to review. It never applies one.

**Checks before going live** (`src/lib/datasrc/validate.ts`): the parsers' shape checks; no quarter disappears; past
values move only a little (DOSM revisions up to 0.5 points, Epoch past best scores may rise from late results but never
fall); new values are believable (a clerical share move of under 5 points a quarter). If a source fails, the server
keeps its last good data and settles nothing for it. It logs `snapshot_rejected` with the reason, shows it on the
Sources page, and tries again at the next check.

**Settling** (`src/lib/engine/calendar.ts`): the quarters the market is on come from the data, not from constants.
- **DOSM:** a quarter settles when its release arrives.
- **Epoch AI:** a quarter settles on the first check at least 30 days after it ends, and only once every live benchmark
  has a result for it, because results for late-quarter models arrive weeks later. An Epoch question closes to new
  predictions when its quarter ends.
- **Questions are frozen:** each question keeps the wording, lines and forecaster influence it was first asked with.
- **Settlements are final:** once a question settles it keeps the two values it settled on. A later revision is logged
  as `revision` and never re-settles.
- **Logging:** every new snapshot's SHA-256 hash is written to the hash-chained log (`data_snapshot`), with the
  settlements (`data_release`).
- **Scoring:** predictions on a release that was already out when a session started count as practice and are not scored.

Commands:
- `npm run data:refresh` runs one refresh now against the app's database.
- `DATA_REFRESH=off` switches automatic checks off on a server.
- To rebuild snapshot 0 from the raw files (for example after reviewing a new ILO or AEI release), run
  `scripts/fetch-sources.sh`, then `npm run data:build`. Rebuilding keeps the questions already frozen in `series.json`.

On Vercel, a refresh starts when a request finds a check due. If the instance stops mid-refresh, the lock runs out
after 10 minutes and the next visit tries again.

## Guardrails

- Roles, skills and courses come only from the files in `data/`. Scores are computed; explanations are filled from templates with a source and date.
- Age, gender and background are never inputs: matching takes a whitelisted input type (`pickInputs`), and a test and a live page check it.
- Simulated forecasters and made-up profiles are always labelled. No real CVs or personal data. No LLM at run time.
- Every bet, release, submission and approval is appended to a hash-chained log. `npm run anchor` writes the latest fingerprint to `anchors/` for committing.

Licence: Apache-2.0.
