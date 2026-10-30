# Jobbery: final-round priority tasks

The step-by-step order of work for the final round (pitching on 1 Nov 2026, 10 minutes, live). It comes from two audits, `FINAL_AUDIT.md` (against the rubric) and `AUDIT_MAP_MARKET.md` (map and market design), and was then reviewed by three reviewers: a **rubric judge**, a **code review against the actual repo**, and a **product review against your recorded decisions**. Section 10 lists what the reviews changed.

There are no time estimates. Work top to bottom. Within a phase, the order matters.

**Each task lists:**
- **What:** what to build or change.
- **Done when:** the check a judge doing a live test would accept.
- **Needs:** what must come first.
- **Rubric:** which criterion it moves. I&C = Innovation & Creativity (25%), TE = Technical Execution (25%), I&F = Impact & Feasibility (20%), PSF = Problem-Solution Fit (15%, capped by any missing must-have), P&P = Presentation & Pitch (10%), D&UX = Design & UX (5%).

**Rules for every task**
- Every new user-facing string gets an i18n row in en, ms, zh and ta, and `tests/i18n.test.ts` stays green.
- Say "predict", never "guess". Never use "bet", "stake", "odds" or "Kalshi" in the UI.
- Every new engine function gets a test.
- Simulated players, synthetic people, projections and what-if figures are always labelled.
- Commit after each task, in small pieces.
- Never commit the Groq key. Never edit the submission .docx files: their wording goes in chat only.

---

## Status after pulling the GitHub remote (29 Oct)

The remote moved the app from `runway/` to **`src/`**: pages are now in `src/src/app/` and the engine in `src/src/lib/engine/`. Task pointers such as `view.ts:189` or `plan.ts:165` still match. Apart from the rename, the pull mostly changed the README, a salary map on the landing page, WebP mascot images and a note saying "we check for new releases automatically". **The engine itself didn't change**, so nearly every finding still stands.

**Already done upstream (crossed off or reduced)**
- T33, partly: the README now shows the live URL https://sdc-runway.vercel.app, says hosting is Vercel, says Replit was used only for code generation, and lists the four languages as available.
- T31, partly: WebP versions of the mascots were added. But the PNGs are still there, and `src/public` grew from 28 MB to 35 MB.
- **D2, done (29 Oct):** living-cost source decided: DOSM median monthly spending per person by state (HES 2024, Table 1.4). Limits are noted on the page, the README and the handoff.
- **T27, partly done (29 Oct):** the map shows "left after typical spending" in the state card, the move comparison and the states table. The job-specific pay estimate is still to do.

**Still open (checked against the new code)**
- **T2, slowdown:** not fixed. The two slow tests now pass only because their time limit was raised from 30 s to 120 s (`tests/engine.test.ts`). The tape replay (`tape.ts:17`) and the double `viewCore` (`view.ts:385`) are unchanged, so a demo session opened days before the pitch will still be slow.
- **T5, change the data live:** there's no "Check now" or timeline yet. The new notes on `/trends` and `/market` only say the app updates by itself.
- **T6, scenarios:** ranking still uses the blended weights (`view.ts:189`).
- **Map move toggle:** still local state that isn't saved (`map/page.tsx:32`).
- **T8, "what would raise this score":** nothing yet.
- **T10, SDG totals:** still hard-coded at `plan.ts:165` and `plan.ts:195`.
- **T11, radar:** sources are still collapsed at the bottom of the page.
- **T9, DOSM link:** still hard-coded at `jobs/[id]/page.tsx:81`.
- **T16, "LIVE" labels:** still on the market cards and "LIVE MARKET" on the landing page.
- **T20, T22, T23:** no team view, no counters and no "Delete my data".
- **T33, README wording:** the README still says "guess" in 5 places (lines 129, 139, 388, 394 and 492).

**New housekeeping (replaces T1)**
- **T1a. Local setup for the new folder.**
  - `src/` has no `node_modules`, so run `npm install` in `src/`.
  - Your Groq key file is still at `runway/.env.local`. Move it to `src/.env.local`, which is gitignored, and never commit it.
  - Move the `.vercel` link and the local `.data` database from `runway/` too if you still need them.
  - Then delete the leftover `runway/` folder.
  - Check that the Vercel project's **Root Directory** is now `src`, so the next deploy builds.
- **T1b. Lost local edits.**
  - At the start of this session, `runway/src/app/sources/page.tsx`, `AppShell.tsx`, `i18n/rows/updates.ts`, the README and the pitch deck had uncommitted changes.
  - Those files in `src/` now match the last commit, and the only stash is from 21 Oct. So those edits are not in the tree.
  - If they mattered, recover them from wherever they were made.
  - `pitch-deck/` is now untracked: commit it or confirm that leaving it out was intended.

---

## Done on 29 Oct (branch `feat/history-timeline`)

- **D1 / T5, change the trend data: done.** A small release picker sits on Statistics (above the job lists) and the Forecast page (above the questions), with stops for 2025 Q3 (28 Apr 2026), 2025 Q4 (25 May), 2026 Q1 (25 Jun) and Today (2026 Q2, 18 Aug). All dates come from DOSM's own release pages.
  - Picking an earlier release changes the job and skill lists and the forecast weights, using only data public on that day.
  - The Forecast page shows that day's questions as answered cards, labelled "Past release" and settled.
  - "What this release changed" lists each change with its source and date.
  - Read-only: nothing is saved, and other pages always show today.
  - Changed from this plan: there is no "Check for new data now" button (updates run automatically), no header button, and no banner on every page.
  - Tested in `tests/history.test.ts`.
- **T13: partly done.** The forecast weights are now recorded for every release. The Slow/Medium/Fast bands were dropped to keep the screen simple.
- **T14: done.** The Forecast page says that open questions move the forecast slightly, mostly through simulated players.
- **T16: done.** Every "LIVE" badge is now "Open · answer in N days". "LIVE MARKET" is now "The Forecast · simulated players".
- **T9: partly done.** The DOSM link on the job page now comes from the source data. The AEI pin still waits for D3.
- **T33: partly done.** The 5 uses of "guess" in the README now say "predict", and the README documents the release picker.
- **T1a: done.** The Groq key and the `.vercel` link were copied to `src/`, and `runway/` was deleted. Still to check: that the Vercel project's Root Directory is `src`.

**Later on 29 Oct (decisions in `docs/adr/0001–0002`, terms in `GLOSSARY.md`)**
- **T1: done.** Living-costs work committed in pieces; `pitch-deck/` is gitignored (it held only 58 MB of Python wheels; the PDF goes in the submission). T1b lost edits: dropped.
- **T2: done.** The simulated crowd calms down as a session ages (every ~6 s for the first hour, ~1 a minute to a day, then ~1 every 10 minutes). A 7-day session went from 13 s to about 0.4 s. The release diff's "before" view is built at the release moment. The two tests are back to the 30 s limit, and the whole suite takes ~12 s instead of ~125 s.
- **T3: done in code.** Background refreshes use `after()`, every API route that can start one has `maxDuration = 60`, and `tests/client-bundle.test.ts` fails if a client file reaches engine `plan`, `pathway` or `view`. **Still for you:** in Vercel, check that Root Directory is `src` and `DATABASE_URL` is set for Production, then confirm a refresh appears on `/trust`.
- **T4: done.** `scenarioMatches()` (view.scenarios) and `computeStakes()` (world.stakes, 2^n outcomes, settled in release order), with tests.
- **T6: done.** One AI speed picker (Our forecast / Slow / Medium / Fast) on Skills, Jobs, each job's page and Plan. Pure weights; clerical drift projected 4 quarters ahead for previews only. Jobs re-ranks with ▲/▼ chips and an aria-live line; Plan lists each speed's best job with "Plan for … instead". Hafiz: Slow → Loan officer, Medium → Procurement officer, Fast → ESG assistant. Map note ("AI speed doesn't change this map yet") not added: the map has no picker.

**Done on 30 Oct (decisions in `docs/adr/0003`, terms in `GLOSSARY.md`)**
- **T7: done.** All 97 course links opened in a browser on 30 Oct. 4 dead ones replaced (Excel → GCFGlobal "Excel: Foundations", Cisco IT Essentials new URL, OpenStax Environmental Science → LibreTexts, Khan AP Environmental Science new URL), 7 moved URLs updated, Google's retired "Fundamentals of digital marketing" removed (96 courses now). "counsellor" → "advisor" in the placeholder and notes; a test fails if any role skill has no real course. No HRD Corp courses added (only levy-paying employers can claim); bridge and reshape plans get an "ask your employer" line. **Still for you:** All About Circuits is behind a Cloudflare check; open it by hand.
- **T8: done.** The job page shows each part as points ("13 of 25") that add up exactly to the score, plus "What would raise it" (each missing skill and +2 h a week), following the AI speed picker. Faint striped ghost bars show what a raiser adds. Tested: learning the top skill gives exactly the predicted score.
- **T10: done.** Fixed 4.4/8.5/4.3 lists replaced by plan hours added up by each skill's SDG target (split evenly across a step's skills), plus a separate count of learning hours toward 4.4 and "% of course hours free". Hafiz: 58 h → 8.2, 39 h → 8.5, 74 learning hours → 4.4, 100% free.
- **T11: done.** "Future Skills Radar" label on Statistics; every row shows its number, source and date. At-risk jobs sort 70% ILO exposure + 30% falling DOSM ads. Note: one release back (2026 Q1) the same jobs stay and only their figures move, because 5 of the 6 are clerical and share one trend; 2025 Q4 shows different lists. Use 2025 Q4 in the demo.
- **T12: done.** The Groq reader also lists skills outside the 80-skill list (e.g. SAP FICO, Tally ERP), quote-checked, shown but never matched. Messages for AI off / not set up. Statistics and Sources name the last good figures when a source check fails. Tests for a thin profile and for edits reordering jobs. The optional "what would you enjoy learning" question was skipped.
- **Extra: resume score shown as equations.** Under each part of "Where your points come from", the rule with the resume's own counts, and a final sum line (e.g. 15 + 8 + 11 + 13.5 + 4 + 12 + 10.8 = 74.3 → 74).
- **Extra: i18n fix.** Translations of today's new text showed `{#n}` instead of numbers; fixed, and a test now catches it.
- **T29: partly addressed.** No re-tagging yet, but the real SDG totals make the 8.2 overuse visible (Hafiz's plan is all goal 8 apart from the 4.4 learning count).

---

## Phase 0: Decisions to make first

Each decision has a recommendation. Phase 1 needs them.

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| **D1** | How judges "change the trend data" live | **✅ Done 29 Oct (see above).** **Decided: a history timeline plus "Check for new data now".** A read-only timeline bar of real past releases changes the app's data as of any release date, with a history log of what each release changed. The session-only what-if is optional, only if judges should also type in their own figures. The timeline never settles or saves anything, so it is not the "Load the new figures" button removed on 22 Oct. | T5 |
| **D2** | Living-cost source for the map | **Decided (29 Oct): DOSM median monthly spending per person by state**, Household Expenditure Survey Report 2024, Table 1.4 (released 8 Oct 2025, all 16 states). It is on dosm.gov.my, not OpenDOSM (OpenDOSM has only per-household spending), so it is pinned with no auto-update. Limits are on the page, README and handoff: it counts children, pay is 2025 vs spending 2024, and pay is for all jobs. EPF Belanjawanku covers cities only. Built: "left after typical spending" on the map. | T27 |
| **D3** | Anthropic Economic Index pin | ✅ **Done 29 Oct (commit d8025b5):** re-pinned to release 2026-06-26 (Claude.ai usage, Apr–May 2026), matched to the app's job codes with O*NET 30.0 task lists and O*NET's 2010-to-2019 crosswalk. Live databases pick it up on their own as one logged snapshot, and the stale alert is cleared. | T9 |
| **D4** | Glossary: one name for each idea | Feature: **The Forecast**. Action: **predict / prediction**. Scenario: **AI speed: Slow / Medium / Fast (estimate)**, plus **"Our forecast"** for the blended view. Map measure: **"How common this job is"**. The T15 line: **"What these answers decide for you"**. | T10–T17, T23–T28 |

Hosting is already decided: **Vercel + Neon**, with Replit used for development only. So it isn't a decision here; only the docs need fixing (T33).

---

## Phase 1: Foundations (fix these before adding anything)

### T1. Clean the working tree
- **What:**
  - Commit or revert the 8 modified files.
  - Confirm the 2 deleted submission template files were meant to be deleted.
  - Commit the 2 untracked files: `pitch-deck/build/make-icons.js` and the pitch deck .pptx.
- **Done when:** `git status` is clean, and the steady commits through the hacking window start here.
- **Rubric:** TE (engineering)

### T2. Fix the slowdown with session age, and the 2 failing tests (P0) ✅ Done, see "Done" above
- **What:**
  - `computeView` slows down as a session ages: about 0.1s at 1 hour old, about 2s at 24 hours, about 14s at 7 days.
  - Cause: `runTape` replays every simulated trade (`tape.ts:139`, capped at one week, `tape.ts:17`). It runs for 15 strikes × 2 phases. `computeView` builds `viewCore` twice (`view.ts:382-386`), and actions call `computeView` up to twice per request (`api/action/route.ts`, then `respond.ts:44`).
  - Fix: memoise or snapshot the tape, or cap the live tape, and compute the view once per request.
- **Done when:**
  - A session that is 7 days old returns `/api/state` in under 500 ms.
  - The two tests that time out pass: "after the release, no persona's top job is one whose skills are at risk…" and "swaps a step's course only for one that teaches every skill…".
  - All 106 tests are green.
- **Why first:** a demo session opened days before 1 Nov would take 15–30 s per click, Vercel may time out, and T4, T15 and T16 all add more computation.
- **Rubric:** TE

### T3. Deployment safety on Vercel ✅ Done in code (Vercel settings still to check)
- **What:**
  - Confirm `DATABASE_URL` points at Neon in Production. Without it, `store.ts` falls back to SQLite, which can't write on Vercel.
  - Run background refreshes with `after()` from `next/server`, not `void maybeRefresh()` (`refresh.ts:50`), because Vercel can freeze work that runs after the response.
  - Set `maxDuration` on the data routes (each source fetch can take up to 60 s).
  - Add a test that no browser bundle imports `plan`, `pathway` or `view`, since the task cards hold the quiz's planted mistakes.
- **Done when:** a forced refresh completes on the live URL and its log entry appears on `/trust`.
- **Rubric:** TE

### T4. Shared engine helpers ✅ Done, see "Done" above
- **What:** two helpers that later tasks reuse.
  - **`scenarioMatches(input, asOf)`** in `view.ts`.
    - Returns the ranked list and top pick under **Slow, Medium, Fast and "Our forecast"**.
    - Uses the same top-pick rule as the app: `chosenRoleId || lasting || matches[0]` (`view.ts:205, 222`).
    - Reuses `planWeeks` instead of building 89 × 3 plans.
    - Runs only on the final view, not the release-0 view used for the diff.
  - **`computeStakes()`** inside `computeWorld`. It settles every combination of the 5 open questions, using the pattern at `world.ts:133-137`. `updateScores` runs separately for DOSM and Epoch, because they settle in different releases.
- **Done when:** both helpers have tests, and a check confirms Hafiz's top 4 differs between Slow and Fast. A run during review found: Slow gives billing clerk and loan officer; Medium and Fast give ESG assistant, procurement, compliance and AML.
- **Needs:** T2.
- **Rubric:** TE

---

## Phase 2: Must-haves that currently fail

### T5. History timeline: "change the trend data" with real past releases (must-have 2) ✅ Done 29 Oct, see "Done on 29 Oct"
- **What:**
  - **The engine can view the data "as of" a past release.** Pass an `asOf` release date into the view; use only data published by that date.
    - Pass quarter-limited data into `demandFor`/`matchRoles` (they already take `upTo`), Epoch frontiers up to that date, and the forecast weights from that point in the replay.
    - Move the expiry clock (`NOW = 2026.8` in `expiry.ts`) to the as-of date.
    - **Don't** swap the shared series with `withSeries`: that clears every user's tape and replay caches (`data.ts:122`, `tape.ts:42`).
    - Compute each past view once and cache it per profile.
  - **Release dates:** each tick is labelled by when the data was published, not by quarter end, so later data never leaks into an earlier view.
    - Only `2026Q2` has a recorded date (`publishedAt`). Fill the others in from DOSM's release calendar, or label them "approximate".
    - Epoch quarters follow the existing 30-day rule.
  - **Range:** start at 2025 Q1 or Q3. DOSM changed how it counts job ads from 2025 Q3 (`DOSM_BREAK`), so either start there or put a "method changed" marker on the bar.
  - **The timeline bar,** fixed at the bottom of the screen:
    - One tick per real release, with a greyed "17 Nov: not published yet" tick at the end.
    - Task 13's Slow / Medium / Fast bands sit above the bar, so one component does both.
    - Keyboard: arrow keys move between ticks, and every tick has a text label.
  - **History log:** each tick opens an entry built from `diffViews` between it and the tick before.
    - Example: "18 Aug 2026 · DOSM Q2 published · office admin ads 7.8 → 7.3 per 100 · 3 questions settled · Slow −3, Medium +3 · your top job: Budget analyst → Procurement officer".
    - `diffViews` currently reads `series.dosm` directly (`view.ts:373`). Make it take the as-of data.
  - **While viewing the past:**
    - A banner on every page: "Viewing the past: [date]. Today's AI exposure scores (ILO, Anthropic Economic Index) are used. Nothing is saved." It has a **Back to today** button.
    - The radar, skills, jobs, plan and forecast weights all render as of that date.
    - The Forecast shows the questions that were open then and how they settled, read-only, with no predicting.
  - **Rules:** the timeline never settles anything, never writes snapshots, never changes the live forecast weights, and never saves a session. Don't call it "Load…" or "release".
  - **"Check for new data now"** on `/sources`, behind the demo passcode and rate-limited. It runs the real refresh and shows "last checked" and the result. Before 17 Nov the honest result is "2026 Q3 not published yet".
  - **Optional:** the session-only what-if (edited DOSM shares as an override, with a "not real figures" banner), only if judges should also type their own figures.
- **Done when:**
  - A judge drags the timeline back one release. The radar, the job order, the plan and the forecast weights all change, and the history log names each change with its source and date.
  - No view uses data published after its tick date (test).
  - After "Back to today", or reloading in another browser, the shared snapshot hash and the live weights are unchanged.
  - Moving between ticks takes under 1 s once cached.
  - "Check now" updates the last-checked time and adds a log entry.
- **Needs:** D1, T2 (speed), T3, T4.
- **Rubric:** PSF (cap), TE, I&C

### T6. Scenarios that change the recommendations (must-have 6) ✅ Done, see "Done" above
- **What:** one shared **ScenarioBar** used on Skills, Jobs, Plan and Map, built on T4.
  - A read-only forecast chip: "Our forecast: mostly Medium · as of the 18 Aug release". It links to `/market`.
  - A preview switch: **Our forecast** (default) / Slow / Medium / Fast.
  - Previewing never saves weights, so the removed manual override stays removed (spec §23).
  - On Jobs, rank arrows ("▲3 under Fast") appear only after a switch, plus the top pick under each scenario.
  - On Plan: "Under Fast AI your best job would be X (N weeks)".
  - On Map: "Today's figures. AI speed doesn't change this map yet."
  - Feed `clericalDriftPp` into an optional `drift` argument on `demandFor` (default 0, clerical group only), labelled "projection, not a DOSM figure". **Decide** whether "Our forecast" also uses the weighted drift. If it does, re-check the persona tests.
  - Make sure `capMult` (the AI-progress pace) is visible on screen as a scenario setting, even though only adoption speed and drift reach the ranking. Say so honestly.
- **Done when:**
  - A test shows Slow vs Fast changes the top pick or the top-5 set for at least 3 of the 4 personas.
  - An aria-live message announces when the top pick changes.
  - Every scenario view is labelled "estimate".
- **Needs:** T4.
- **Rubric:** PSF (cap), TE, I&C

---

## Phase 3: Make every must-have pass the judges' spot checks

### T7. Course links, placeholders and HRD Corp ✅ Done, see "Done" above
- **What:**
  - A person opens every course URL. Pay special attention to the 7 that return 403 to automated checks. Update the `checked` dates and replace any dead ones.
  - Make sure no persona plan contains the fallback step "Find a free course … on e-LATiH, with your counsellor" (`plan.ts:60`). It also says "counsellor" where the app now says "advisor".
  - Add verified HRD Corp-claimable programmes as swap alternatives where they exist. Never add one you can't verify.
- **Done when:** every URL was opened by a person within 48 hours of the pitch, and the persona plans have 0 placeholder steps.
- **Rubric:** TE (spot checks), PSF

### T8. "What would raise this score" ✅ Done, see "Done" above
- **What:**
  - On `/jobs/[id]`, show each part as points (value × weight), then `− penalty − local penalty + SDG bonus` (`matching.ts:132-136`), adding up to the total.
  - Show the top raiser inline ("Learn SQL: +6 points, Khan Academy, 15 h"). Put the rest (more hours a week, picking an SDG goal) under "More ways to raise it". Name which AI speed the raisers assume.
- **Done when:** adding the top raiser's skill to the profile gives exactly the predicted score.
- **Needs:** T6.
- **Rubric:** TE, PSF

### T9. AEI pin and stale pointers
- **What:**
  - ~~Act on D3, and clear the "5 newer releases" alert.~~ Done (re-pin, commit d8025b5, 29 Oct). Re-check the Hafiz demo: data entry now fades Mar 2029, Daniel's plan moved to office supervisor, and Aina's top-ranked billing clerk is now flagged "at risk", though her best job and plan stay budget analyst.
  - Replace the hard-coded DOSM URL at `jobs/[id]/page.tsx:81` with the live source URL.
- **Needs:** D3.
- **Rubric:** TE

### T10. SDG contribution added up from the plan ✅ Done, see "Done" above
- **What:**
  - Replace the hard-coded `layer1` lists at **`plan.ts:165` and `plan.ts:195`** with plan hours totalled by each step's SDG target (steps already carry `sdgTarget`), plus the job's own target.
  - Show one total line on Plan, with an expand for detail.
  - Add "X% of this plan's hours are free".
- **Done when:**
  - Hours by target add up to the plan total.
  - Two personas show different totals.
  - Swapping a course changes the breakdown.
- **Rubric:** PSF (SDG test), I&F

### T11. Future Skills Radar: source and date on each row ✅ Done, see "Done" above
- **What:**
  - Put "Future Skills Radar" in the `/trends` heading.
  - Each row gets a chip with its number, source and date.
  - Sort declining jobs by DOSM demand as well as ILO exposure (`view.ts:151-157`).
- **Done when:** moving the T5 timeline back one release changes at least one rising row and one declining row.
- **Needs:** T5.
- **Rubric:** PSF (stage 2), TE

### T12. Intake and robustness ✅ Done, see "Done" above
- **What:**
  - Resume skills that aren't in the 80-skill list get one muted line: "not in our list yet, so not used".
  - Add an empty state and a test for a thin profile with no reachable roles.
  - Show the fallbacks on screen: "AI reader unavailable, rules only" (the Groq free tier allows about 2 scans a minute), and "Data source down, showing the last good figures from [date]".
  - Optional: one "what would you enjoy learning next?" question, so "potential" feeds the interest part of the score.
- **Done when:**
  - A synthetic CV naming 3 unknown skills lists all 3.
  - A profile with 1 skill, 1 month and 2 h a week renders `/jobs` and `/plan`.
  - Editing one skill or the hours visibly reorders `/jobs`.
- **Rubric:** TE (robustness), PSF (intake)

> **Checkpoint: first dry run.** Run the full journey as Hafiz, and also as a non-finance profile built live, before moving on (see T38).

---

## Phase 4: The Forecast (differentiator A)

### T13. "How the forecast has learned" chart (lives in the T5 timeline)
- **What:**
  - No history of the forecast weights exists today. Record `futureWeights(...)` each quarter in the replay loop (`replay.ts:71-73`), and append the release step from `computeWorld` (`world.ts:114`). The T5 timeline also needs this, so build this part with T5.
  - Draw Slow, Medium and Fast as stacked bands above the T5 timeline bar. Annotate each real release (including **18 Aug 2026, DOSM Q2**) and mark the next one (**17 Nov**).
  - Also show it on `/market`, where clicking a release opens the timeline at that date.
  - Label the earlier quarters "replayed on real past releases".
  - Include a text summary or table for screen readers.
- **Done when:** the bands render from engine data at desktop and phone width, the 18 Aug annotation matches the logged weights, and the bands line up with the timeline ticks.
- **Rubric:** I&C ("keeps updating, explains itself"), P&P (key slide)

### T14. Disclose what simulated players do ✅ Done 29 Oct
- **What:**
  - About 200 simulated forecasters set the crowd price, and open questions shift the forecast weights a little.
  - So either show this on screen ("Open questions move the forecast slightly, based on all players, mostly simulated"), or leave simulated players' prices out of the weights that users see.
- **Done when:** a judge asking "do fake players change my plan?" gets an answer from the screen.
- **Rubric:** TE (honesty), PSF

### T15. "What these answers decide for you"
- **What:**
  - At the top of `/market`, using `computeStakes()`: "Depending on the answers, your *data entry* skill could fade between Oct 2029 and Jul 2030, and Fast AI could end between 5% and 12%."
  - Label it "if the answers were…", not as a forecast.
  - Add one chip per card: "Moves your *data entry* date".
  - Note: settling a question removes its crowd effect, which is why both Yes and No can raise Fast.
  - **If the measured range is under about 6 months, reframe it:** for example, put the case on the long-run learning (T13) rather than a single quarter's stakes.
- **Needs:** T4, D4.
- **Rubric:** I&C, D&UX

### T16. Honest activity signals ✅ Done 29 Oct
- **What:**
  - Replace "LIVE" with **"Open · answer in N days"** on the cards, the question page **and `LandingLiveMarket`**.
  - Put "simulated" right next to every %.
  - Draw your own predictions as distinct dots.
  - Don't claim "N people": the market is per session (`world.ts:73`), so there is only one person.
- **Done when:** a search finds no "LIVE" left in the UI for settled or simulated activity.
- **Rubric:** TE (Common Mistakes: "presented as live")

### T17. One-tap prediction
- **What:**
  - The default form is Yes or No, then "How sure? Somewhat / Quite / Very", mapped to amounts within the cap.
  - The points box, Take back and the other versions of the question move under "More options".
  - The default amount never triggers the cap warning.
  - The rules collapse into one "Fair-play limits" disclosure.
  - Add a sticky Yes/No bar at phone width.
- **Rubric:** D&UX

### T18. Leaderboard clarity, and question order
- **What:**
  - Explain the vote rule inline. It covers why rank 1 (5.19×) can have less vote than rank 2 (6.00×): the cap and the fading of older quarters.
  - Add a **0.250 coin-flip** reference line.
  - Rename "Change" to "Vote change since last release".
  - Put the DOSM question first with "Start here", and use amber only on that card.
  - Group the questions under "Malaysia's job market" and "How fast AI is improving".
  - Apply the D4 naming everywhere.
- **Needs:** D4.
- **Rubric:** D&UX, TE

---

## Phase 5: Impact and evidence (20%, and the good-to-haves)

### T19. Log the missing events (before any more demo traffic)
- **What:** log these events, with persona and synthetic sessions flagged:
  - role chosen (`route.ts:151`)
  - quiz attempt and pass (`route.ts:184`; the demo button counted separately)
  - step done (`route.ts:173`)
  - meeting booked (`meetings/route.ts:43`)
- **Rubric:** I&F

### T20. Impact counters
- **What:**
  - On `/trust`: profiles, plans, quiz attempts and pass rate, steps done, meetings, badges.
  - Exclude synthetic sessions, label rehearsal traffic, and keep a running total instead of re-reading the whole log each time.
- **Done when:** the counters match the hash-log row counts.
- **Needs:** T19.
- **Rubric:** I&F (measured against the Phase 1 KPIs)

### T21. Impact simulation script (`npm run impact:sim`)
- **What:**
  - Run every intake occupation × deadline × hours through the engine.
  - Report: % with at least one reachable role, weeks to job-ready, % of plan hours free, SDG targets, the share of lasting top picks, and how often the top pick changes between Slow and Fast.
  - It must never call Groq.
- **Done when:** the output is committed and quoted in report Section 4.1.
- **Needs:** T6, T7, T10.
- **Rubric:** I&F (bonus proof)

### T22. "Delete my data" (PDPA)
- **What:** a visible button that removes the stored session row, not just the cookie. State the retention period on `/trust`.
- **Done when:** after deleting, the session ID is gone from the database.
- **Rubric:** I&F (privacy)

### T23. HR and career-centre team view
- **What:** `/team`, linked as "For HR and career centres" from the landing page and the ••• menu, not the worker steps. It shows:
  - a synthetic cohort, labelled "synthetic team";
  - a roles × skills gap heatmap, with numbers in the cells, not colour alone;
  - the top skills to train;
  - the share at risk under each AI speed;
  - the team's SDG totals.
- **Needs:** T4, T10.
- **Rubric:** I&C, I&F, PSF (the brief names HR and TVET as users)

### T23b. (Optional) Read-only MCP server for AI agents
- **What:** a Model Context Protocol endpoint, so career centres' and HR teams' own AI agents (Claude Code, Codex, Hermes and others) can query Jobbery's data and results.
  - **Endpoint:** a Next.js route at `/api/mcp` (Streamable HTTP), using the official MCP TypeScript SDK.
  - **Tools:** a thin layer over existing engine functions, with no new logic:
    - `get_forecast` returns the current Slow / Medium / Fast weights, as-of release and source.
    - `future_skills_radar` returns rising and declining skills and jobs, each with its source and date.
    - `match_roles` takes a synthetic profile (skills, months, hours, interests, qualification, area) and returns ranked roles with score parts and gaps. Optional AI speed, via T4.
    - `build_plan` takes a role and a profile and returns the ordered steps, hours, courses with URLs and checked dates, and SDG totals.
    - `list_sources` returns every dataset with its date, licence and URL.
    - `get_open_questions` returns the open questions, the release that settles each one and the crowd %, labelled simulated.
  - **Guardrails:**
    - Read-only. No sessions, no saved profiles, no predicting, no personal data stored or logged. Rate-limited.
    - Inputs are checked against Jobbery's own skill and role IDs, and unknown IDs are rejected with a clear message.
    - Every response carries `source`, `date` and `estimate: true` where relevant, plus a note that the results come from Jobbery's tables and the agent must not invent jobs or courses.
  - **Docs:** a README section, "Use Jobbery from your AI agent", with connection snippets for Claude Code (`claude mcp add --transport http …`), Codex and a generic MCP client, plus one example conversation.
- **Done when:**
  - Claude Code, connected to the live URL, answers "what should a payroll clerk with 6 months and 10 h a week train for?" using `match_roles` and `build_plan`. Every job and course in its answer exists in Jobbery's tables, with sources cited.
  - A tool test confirms that each tool's output equals the website's result for the same inputs.
  - Calling a tool with an unknown skill ID returns an error, not a guess.
- **Needs:** T2, T4 and T6 (it reuses the shared helpers and needs the speed fix). Do it only after Phases 1–5.
- **Pitch:** at most one slide or 20 seconds, as "a data service for career centres' own AI tools". Never present it as a chatbot.
- **Declare:** add the MCP TypeScript SDK to T34.
- **Rubric:** I&C (combining existing tools), I&F (reach through HR and TVET systems), TE (grounding)

---

## Phase 6: Job Map (differentiator B)

### T24. One saved move answer
- **What:**
  - Add a new `reach` action. Don't use `setProfile`, which resets the chosen job, progress and pathway (`route.ts:107`).
  - Replace the map's local Yes/No toggle (`map/page.tsx:32`) with onboarding's four options: stay / nearby states / pick states / anywhere.
  - Show the effect honestly. The area changes only the "few jobs nearby" adjustment, not which jobs are in reach. So say "Loan officer moves up 3 · 2 fewer jobs flagged 'few nearby'", not "N more jobs in reach".
- **Done when:** switching between "stay" and "anywhere" changes `/jobs`, and the choice persists after a reload.
- **Rubric:** PSF, TE

### T25. "How common this job is" as the default measure
- **What:**
  - Make concentration (`lq`, `geo.ts:60`) the default colour and headline: "Jobs like this are 2.1× more common in Selangor's workforce than across Malaysia".
  - An optional second measure, workers in this kind of work per unemployed person, must be labelled exactly that (there is no vacancy data by state).
  - Keep headcounts in the table.
  - Use even colour bins, and show values on the map, not colour alone.
- **Needs:** D4.
- **Rubric:** TE, D&UX

### T26. Home → destination comparison card
- **What:**
  - A side-by-side "Kedah → Selangor" card, sticky beside the map on desktop and fitting under it at 375 px. It shows: how common the job is, pay, unemployment, and the job's outlook.
  - A **"Talk this move through with an advisor"** button that books a meeting with the topic pre-filled. It never asks for approval.
  - A clear outline on the selected state, and fixed label collisions around Selangor and KL.
  - Optional: a home → destination arc that respects reduced motion.
- **Rubric:** D&UX, PSF (human-centred)

### T27. Pay and living costs (living costs done 29 Oct; job-specific pay still open)
- **What:**
  - Pay estimate for this job: national group pay × (state median ÷ national median), labelled "estimate".
  - Living costs: use the D2 source if it checks out, giving "pay left after typical living costs". If not, a **mandatory** row: "Living costs are not included yet". It must never read as relocation advice.
  - **Done 29 Oct:** living costs, against today's all-jobs state pay. The job-specific pay estimate above is still to do.
- **Needs:** D2.
- **Rubric:** TE (spot checks), PSF (human-centred)

### T28. Map details
- **What:**
  - A dated source chip under the legend.
  - One number format everywhere (Putrajaya shows "651", the others "1.1k").
  - Add a figure for Terengganu.
  - The table shows the top 5 plus your state, with the rest behind "Show all".
  - States reachable and labelled by keyboard.
- **Optional, for the region SDG view:** an "AI exposure by state" layer: each state's workers by occupation group × ILO exposure. It doesn't depend on the scenario. The earlier idea of recolouring the map by scenario was dropped: only the clerical group has a scenario setting, and it's national, so nothing would change by state.
- **Rubric:** D&UX, I&C (optional layer)

---

## Phase 7: Quality pass across the whole app

### T29. Data and content
- **What:**
  - Make SDG tags more specific (24 of the 89 roles use 8.2), and add second targets where honest.
  - Reconcile the app's targets with the Phase 1 proposal (9.2, 10.3, 4.4, 5.7, 8.5): either tag them where honest, or state why they changed.
- **Rubric:** PSF (SDG test)

### T30. Accessibility
- **What:**
  - Keyboard access and focus states on the map, the market and the ScenarioBar.
  - A text label for every colour cue: Yes/No, ▲▼, amber "Start here", map bins.
  - Text alternatives for the T13 chart and the T23 heatmap.
  - Amber contrast checked.
  - Reduced motion for pulsing badges and the arc.
- **Rubric:** D&UX, I&F (inclusive)

### T31. Phone layout and bandwidth
- **What:**
  - Real 375 px screenshots of every page (they failed in the design audit).
  - Convert the mascot PNGs to WebP (`public/` is 28 MB).
  - Check the landing page weight on a throttled connection.
- **Rubric:** D&UX, I&F (low-data)

### T32. Language sweep
- **What:**
  - In Tamil, visit every page and run `window.__i18n.missing()`.
  - Search the code for "guess", "bet", "stake", "odds" and "LIVE".
  - Check that Tamil and Malay text fit on cards and chips.
- **Rubric:** I&F (inclusive), D&UX

> **Checkpoint: timed first-time user.** Someone outside the team goes from the landing page to ranked jobs and a plan without help. Aim for under 3 minutes, and fix whatever stops them.

---

## Phase 8: Repo, documents and submission

### T33. README and docs
- **What:**
  - Hosting is **Vercel + Neon**, with Replit used for development (§14, §15, §17 still say Replit).
  - Live URL: https://sdc-runway.vercel.app.
  - Snapshots live in the database, not the repo.
  - Remove "Judges and users can make guesses too".
  - Move four languages out of §13 "Coming next".
  - Document every new feature.
- **Done when:** a search of the README, deck and declaration finds no Replit hosting claim, "TODO" or "guess", and every claim matches a screen.
- **Rubric:** TE (engineering)

### T34. Technical & Tools Declaration (wording in chat)
- **What:** list every item:
  - **services:** Vercel, Neon and Groq;
  - **model:** Qwen3.8 27B;
  - **AI coding tool:** Claude Code;
  - **datasets:** DOSM JMI, OpenDOSM, Epoch AI, ILO 2025, Anthropic Economic Index, O*NET, LFS 2024, geoBoundaries, UN SDG text, and any D2 source;
  - **libraries:** unpdf, mammoth, Recharts, Framer Motion and pg (plus the MCP TypeScript SDK if T23b is built);
  - **how the mascot images were made.**
- **Done when:** comparing the declaration against `package.json`, the data sources and the AI tools finds nothing missing.
- **Rubric:** eligibility (rules §9)

### T35. Final Solution Report (wording in chat if it's a .docx)
- **What:**
  - Core features, architecture, and how the product evolved since Phase 1.
  - Section 4, with these parts:
    - **Reach:** the first channel (PERKESO/MYFutureJobs, TVET and university career centres) and a sized, cited number.
    - **Freshness and cost:** a cost per user per month table at 1k, 10k and 35k users.
    - **Learning cost:** % of plan hours free.
    - **Measured results:** the Phase 1 KPIs (35k users, 90%, 50%, 40%) restated against leading indicators you can measure now (T20, T21).
    - **Privacy and fairness:** PDPA (T22) and the fairness tests.
  - Section 4.1 proof (T21 output), and the SDG reconciliation (T29).
- **Rubric:** I&F

### T36. Pitch deck
- **What:**
  - Add the learning chart (T13), the scenario switch (T6), the map comparison (T26), the team view (T23) and the impact numbers.
  - A **competitor slide** naming JobStreet, LinkedIn Learning, MYFutureJobs and Coursera, and what none of them does.
  - A **limits slide**: Brier 0.242 vs 0.25, simulated forecasters, what-if figures, the pinned sources.
  - Verify every statistic: 697k, 56% / 26%, 600k.
  - Update the "MyCOL queued" line if D2 adds a cost source.
- **Rubric:** P&P, I&C

---

## Phase 9: Demo readiness

### T37. Q&A drill (start now and repeat)
- **What:** at least two teammates answer the guide's six questions, plus these prepared answers:
  - Why a market that only just beats a coin flip should shape a plan: it scores the futures in public against official numbers.
  - Do simulated players change my plan? (T14)
  - What happens when Groq is rate-limited? (T12)
  - Is this course or number real? (T7)
  - Why is Selangor darker? (T25)
- **Rubric:** P&P

### T38. Full rehearsals
- **What:**
  - Run the pitch structure below as Hafiz, **and** as a non-finance profile a judge could build live.
  - The AI-at-work quiz exists only for finance. Make sure other sectors show the plain practice step cleanly.
  - Hold three timed runs at 9:30 or under. Also keep a 7-minute cut in case Q&A counts inside the 10 minutes.
- **Rubric:** P&P, TE

### T39. Backups
- **What:**
  - Record a backup video early (after Phase 2), and record it again after the final build.
  - Keep a local build running on the presenting laptop (`npm run build && npm start` with a local database) as the offline fallback the rubric mentions.
- **Rubric:** rules (backup required)

**The 10-minute pitch these tasks build towards**

| Time | Section | Content | Tasks |
|---|---|---|---|
| 0:00 | **Problem** | Hafiz, the 697k jobs at risk, one-off undated forecasts | |
| 1:00 | **Solution** | Dated data, a forecast scored against DOSM, relocation | T13 |
| 1:45 | **Live demo** | resume, radar with sources, drag the timeline back a release and read the history log, jobs with the score and raisers, Slow → Fast, a plan with a real course and its SDG total, The Forecast ("what these answers decide", one-tap prediction, "Open · 17 Nov"), Kedah → Selangor with the advisor button | T5, T6, T7, T8, T10, T11, T12, T15, T16, T17, T24, T26 |
| 7:00 | **Impact** | team view, counters, simulation, cost, four languages, fairness | T20, T21, T23 |
| 8:15 | **Honest limits** | Brier score, simulated players, what-if figures, pinned sources, the LLM named | T14, T36 |
| 9:15 | **Close** | Every other career tool gives one forecast. Ours is scored against the government's own numbers every quarter. | |

---

## 10. What the reviews changed

**Engineering review (against the code)**
- Found a **P0 not in the audits:** the view slows down with session age (up to about 14 s), and 2 tests time out at 30 s. I confirmed this with `npx vitest run`: 104 pass, 2 fail. Now T2.
- Added Vercel safety (T3) and shared helpers (T4).
- Changed how the what-if works: an override rather than swapping the shared data, which would clear every user's caches.
- Corrected T24: a move changes only the "few nearby" adjustment, not which jobs are in reach.
- Renamed the map measure: there is no vacancy data by state.
- Dropped the map's scenario recolouring: there is no setting by state.
- Dropped "let the judges predict": the market is per session.
- Added the second hard-coded SDG list (`plan.ts:195`).

**Rubric judge**
- Moved course checks, the AEI pin, the declaration and all impact work earlier.
- Added: the placeholder-course check, the simulated-player disclosure (T14), "Delete my data", % free, reach and cost, the README hosting fix, the competitor and limits slides, statistic checks, timed runs, the offline backup, and a non-finance demo profile.
- Sharpened every "Done when" so a judge's live check passes.

**Product review (against your decisions)**
- Recommended against a replay button, which would rebuild the one you removed. You then chose a read-only history timeline (D1), which settles nothing; the what-if became optional.
- Made the forecast chip read-only and previews unsaved (no return of the weight override).
- Removed gambling words; added the D4 glossary first.
- Merged the map and scenario widgets into one ScenarioBar.
- Kept the team view out of the worker's steps.
- Added accessibility, phone layout, language sweep and honest labels; moved the dry run, the backup video and the Q&A drill earlier.

**Changes from the earlier draft**
- Hosting is no longer a decision: your recorded choice is Vercel + Neon.
- The draft's T18 (map follows the scenario) and T19 (separate speed dial) were merged into T6.
- The draft's T34 (judges predict live) was dropped.
