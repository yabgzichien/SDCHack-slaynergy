# Jobbery: Revised Product Requirements Document

SDC Hackathon 2026 · Domain 1: Aiversecity Future-Ready Workforce · Final round

| | |
|---|---|
| **Team** | #slaynergy (Xiamen University Malaysia) |
| **Version** | 2.0, final round |
| **Date** | 31 October 2026 |
| **Replaces** | The preliminary project proposal, submitted 25 October 2026 |
| **Live demo** | https://sdc-runway.vercel.app/ |
| **Code** | https://github.com/yabgzichien/SDCHack-slaynergy |

This revises the preliminary proposal after the Online Upgrading Round. It says what Jobbery is meant to do, how it does it, and, in section 2, what changed since the preliminary round and why. The README has the full detail behind each point.

## 1. Summary

Jobbery gives fresh graduates and people already in work a **deadline-based career plan**. It forecasts which skills and jobs AI will change, from public, dated data. It ranks the jobs the person can reach before their deadline, with a score they can open up. It then builds a week-by-week plan from real free courses, with every step tagged to a UN SDG. A **points-only prediction market**, whose questions settle on real data releases, decides how likely each of three AI futures is.

- **Problem:** people do not know which of their skills AI will take over, which jobs are growing, or what to learn first. Existing "AI job risk" tools give one fixed score from old research.
- **Approach:** public, dated data → three possible AI futures, weighted by real releases and a points-only market → ranked reachable jobs with a skills gap → an SDG-tagged plan that fits the person's deadline, with one meeting with an advisor.
- **Outcome:** the person gets from "who I am today" to a sourced plan in minutes. They choose; nothing is decided for them, and a person (the advisor) is there to ask.

## 2. What changed since the preliminary round, and why

The product idea, the six must-haves, the three AI futures and the points-only market did not change. What changed is how well each part stands up to the checks that judges are told to run: switch the AI speed, change the trend data, open a course link, ask "why this score, and what would raise it?", and find where a number comes from. The reasons below come from the Finalist Guide, the marking rubric and our own audit of the app against them.

| Area | Preliminary proposal (25 Oct 2026) | Final round | Why |
|---|---|---|---|
| **AI speeds** (uncertainty) | Slow, medium and fast gave different skill dates only. | One **AI speed** picker (Our forecast, Slow, Medium, Fast) re-ranks the jobs and shows the best job under each speed. Plan offers "Plan for … instead". A preview never changes the plan by itself. | The rubric tests uncertainty by asking whether the recommendations shift between scenarios. Ours did not. |
| **Changing the data** (trend layer) | Dated public files, downloaded and parsed to JSON. | The server checks DOSM, Epoch AI and OpenDOSM by itself (daily, hourly around a DOSM release), checks new numbers before saving them and keeps the last good data if a check fails. A **history picker** shows the app as it stood on each of four real DOSM releases (read-only). | The guide asks for a refresh that can be shown live. The next DOSM release (17 Nov) is after the final, so we replay real past releases and never invent figures. |
| **Job score** | Skill overlap, future outlook, job demand, time to reach, interests. | Six parts: adds **qualifications and experience** (10%). The job page shows the score as points that add up exactly, an equation, and **what would raise it** (each missing skill, two more hours a week), all following the AI speed. | Judges are told to ask "why this score, and what would raise it?". A job also depends on whether the person has the education and the years of work it asks for. |
| **SDG mapping** | Every role and skill tagged. Focus targets named: 9.2, 10.3, 4.4, 5.7, 8.5. | Still tagged. The plan's hours are **totalled by SDG target** (for Hafiz: 58 h toward 8.2, 39 h toward 8.5, 74 h of learning toward 4.4). The goal picker is the first stop on the Jobs page. Targets Jobbery itself advances: 4.3, 4.4, 8.5, 8.6, 1.3, 10.2. | A fixed list of goals shown to every user was decoration, and the rubric asks for the contribution to be added up. We now claim only the targets the product acts on. |
| **Prediction market** | Free tokens; accurate forecasters earn a bigger vote. | Points only, never money. Three strike levels per question, priced by LMSR; forecasters scored with the Brier score. One person moves an answer by a fixed 0.1% however many points they use, and the page confirms the prediction. The crowd is simulated, labelled, and calms down as a session ages. Wording is "predict". | One user must not be able to swing a market, and a prediction needs clear feedback. A week-old session took 13 s to load and now takes about 0.4 s, which matters for a live demo. |
| **Course steps** | AI courses and quizzes; KPI 3 counts courses completed and quizzes passed. | A course step is finished by uploading its **certificate**. The AI only reads it; plain code checks it matches the course, and the file is never stored. The course list grew to 175 courses from 49 providers, at least two for every skill, each with a checked date and link status. | KPI 3 needs evidence, not a tick. Judges open course links. |
| **AI models** | Groq (Qwen3.8 27B) used only to read resumes. RunPod not used. | A chain: KrackedDev AI API (DeepSeek V4.1 Flash), then Qwen2.5 14B on RunPod, then Groq, then rules alone. The same chain reads certificates. A model also helps find a changed DOSM release page, and never supplies a number. AI-found skills come ticked for the person to confirm. | Groq's free tier allows only about two resume scans a minute. Every AI use is limited, checked by code and explainable. |
| **Validation** (promised for Phase 2) | The proposal said the AI resume reader and the prediction market needed validation. | The server drops any skill with no quoted resume line and any rewrite that adds a number (tested; we also tried a resume that carries injected instructions, and the model ignored them). The market is replayed on real past releases and reported honestly (Brier 0.242 against 0.25 for a coin flip). A test shows that age and gender never change the matches. | The proposal named these as the open risks. |
| **Resume report** | Résumé analysis and course recommendations. | A score out of 100 from seven rule-based parts, each shown with the resume's own counts and a worked sum, plus suggested fixes. Skills outside our list are named, not used. The page says when the AI or a source is down. | Anything that scores a person must be explainable, and unknown skills were being dropped without a word. |
| **Explanation pages** | Not in the proposal. | **How we worked this out** (skill dates) and **See the full calculation** (AI speeds) show the formulas with the person's own numbers. Each step has a **What backs this up** box and a reference list of 23 published sources. Tests recompute the numbers by hand. | Judges ask where a number comes from, and new AI-assisted parts must be explainable. |
| **Job map** | Jobs, pay and unemployment by state. | Adds pay **left after typical living costs** (DOSM Household Expenditure Survey 2024) and a "would you move for work?" comparison, with the limits stated on the page. | A pay gap with no living costs misleads: "move to KL, earn RM1,300 more" says nothing about rent. |
| **Employers** | Employers and educators named in the problem. | An illustrative **employer page** (a team skills-gap heatmap) on demo data, not computed from real staff data. | The problem statement names employers, HR and learning managers, and educators as affected. |
| **Running live** | Hosted on Vercel. | Background refreshes do not block requests, long routes have a 60 s limit, a daily Vercel Cron makes sure the data check runs, and a test fails if a browser file imports the heavy engine modules. | "The most important feature runs live" is part of the feasibility score. Vercel's free plan rejects hourly cron jobs. |

**What we did not do.** The proposal said Phase 2 would gather user feedback; we have not run a user study. The impact counters and the "delete my data" button are not built (see Not built yet). The Phase 1 KPIs are unchanged and are restated honestly under How we will know it works.

## 3. Problem

**Domain 1 brief:** how might we build an AI-powered solution that tracks AI advancement to predict which skills and jobs will emerge or decline, matches today's workforce and tomorrow's talent to the right future roles, and generates personalised reskilling pathways, while showing how each role and skill connects to the UN Sustainable Development Goals?

Evidence, as cited in the preliminary proposal:
- **The scale:** 1.6 million workers were projected to be replaced by AI by 2026, mostly in high- and middle-skill jobs (Mohd Arshad, 2024). On 24 June 2026 the Human Resources Minister said 697,000 jobs are highly affected by AI, digitalisation and the green economy if workers do not upskill within three to five years.
- **Graduates:** graduate unemployment looks healthy at 3.2% (DOSM, 2024), but many graduates take non-technical jobs, and finding a job that uses their degree gets harder as AI displaces skilled roles.
- **The training gap:** Malaysia ranked 83rd of 130 countries in digital skills (World Economic Forum, 2023), and 68% of Malaysian firms lack training in AI adaptation (MDEC, 2022).
- **The forecasting gap:** existing tools score a job title once, from fixed research. They do not show several futures, do not update when new data arrives, and do not plan around the person's own deadline.

## 4. Users

| User | Need |
|---|---|
| **Fresh graduates** | To understand their skills, explore reachable first jobs and build a weekly learning plan. |
| **Everyone in the workforce**: employed people, career changers, jobseekers and people returning to work | To keep skills relevant, explore growing roles and plan the next step around their own deadline. |
| **Advisor** (for example an employment officer) | To meet each user once (a mock interview, advice, or anything else they ask), seeing their profile and plan. |
| **Forecasters** (simulated now, real people later) | To make checkable predictions about upcoming data and build a track record. |
| **Employers and HR** (illustrative page only) | To see a team's skills gap. Demo data; not built on real staff data. |

**Demo persona (synthetic):** Hafiz, 27, a bank operations executive, with 5 months and 10 hours a week. A judge sees the whole journey with the **Try as Hafiz** button.

## 5. What Jobbery must do: the six must-haves

| Must-have | How it is met |
|---|---|
| **1. Skills profile intake** | A short step-by-step questionnaire (it also supports students), or a resume scan (PDF, Word or text) that fills it in. The resume is read in memory and never stored. An optional AI reader proposes extra skills, each quoting a resume line; skills outside our 80 are named but not used. |
| **2. AI-trend signal layer** | Four dated signals: capability (Epoch AI), adoption (Anthropic Economic Index), exposure (ILO) and hiring (DOSM job ads). Each is a numbered, hashed snapshot with a source and date chip on every screen. Checked automatically; the history picker shows any of four real past releases. |
| **3. Future-role matching and skills gap** | 89 roles in 10 sectors and 80 skills. Only roles reachable before the deadline are ranked, with a six-part score the person can open, what would raise it, and a gap list showing each missing skill's importance, expiry date and covering course. |
| **4. Personalised reskilling pathway** | A week-by-week plan from the skills gap, the person's weekly hours and deadline. It uses real free or low-cost courses (175, none invented), in three strands: job skills, AI at work and people skills, ending with an advisor meeting and the application. Course steps finish with a certificate. |
| **5. SDG mapping** | Every role and skill carries an SDG target, a one-line reason and the official UN text. The goal picker re-ranks jobs (+12 points) and shows the trade-off. Each plan step shows its SDG, and the plan's hours are added up by target. |
| **6. Handling uncertainty** | Three futures (Slow, Medium, Fast) with stated assumptions, weighted by how well each predicted real past releases and by a points-only market. Each skill gets an expiry date per future. The AI speed picker re-ranks jobs. Every screen says these are estimates. |

**The main differentiator: a prediction market that settles on real data.** Questions are checkable ("Will clerical job ads rise by more than 3 points in the next DOSM release?"). When the release is published, the questions settle, the futures that matched reality gain weight, and every user's dates, job ranking and plan update. Rules we hold ourselves to:
- **Points only, never money.** Gambling law, Muslim users and financially vulnerable users all rule out real money.
- **No future is ever ruled out.** None falls below 5%.
- **One person cannot swing a market.** A prediction moves an answer by a fixed 0.1%.
- **Simulated forecasters are always labelled.** About 200 of them earned track records by replaying real past releases. Real forecasters are for a later version.
- **Honest results.** In the replay the market only just beats a coin flip (Brier 0.242 against 0.25). Its main job is to score the futures in public against official numbers.
- **Forecasts are fixed before the data comes out.** The crowd's forecasts for open questions are hashed into the repository, so nobody, including us, can change them afterwards.

## 6. Also in the product

- **A person to ask.** The user can book a 30-minute meeting with an advisor at any time. Every plan has one meeting step. Nothing waits on an advisor's approval, and no automated decision is made about anyone.
- **Trust.** Every prediction, settlement, advice note and badge goes into a hash-chained log, and its fingerprint is committed to the repository. A fairness test shows that age, gender and background never change the matches. Simulated people and forecasters are always labelled.
- **Privacy.** The resume and any certificate are read once, in memory, and never stored. The session keeps only the score, the fixes, the skill IDs, and that a certificate was verified.
- **Motivation.** A visible timeline against the deadline, badges for finished steps, a leaderboard, and a LinkedIn badge at the end that anyone can check against the log.
- **Language and plain wording.** English, Bahasa Malaysia, Chinese and Tamil, and pages written for someone who has never read a chart like these.
- **Where to work.** A map of Malaysia that shows where jobs like the chosen one are, with pay left after typical living costs.

## 7. Data sources

All data is public or synthetic. Every source is a dated snapshot. DOSM Job Market Insights (2026 Q2), Epoch AI benchmarking data, the Anthropic Economic Index (release of 26 June 2026), ILO 2025 generative AI exposure scores, O\*NET, OpenDOSM (employment, unemployment and wages by state), the DOSM Household Expenditure Survey 2024, geoBoundaries and the UN SDG target text. The course list has 175 courses from 49 providers. Demo personas and about 200 simulated forecasters are synthetic and labelled. The full table with dates and licences is in the README, section 4.

## 8. SDG alignment

- **Targets Jobbery itself advances:** 4.3 (affordable lifelong learning, through free courses), 4.4 (skills for decent work), 8.5 (full employment and decent work), 8.6 (youth not in employment), 1.3 (social protection) and 10.2 (inclusion).
- **Tags on everything:** all 89 roles and 80 skills carry a target, a one-line reason and the official UN wording.
- **SDGs change choices, not just labels:** the goal picker re-ranks jobs and shows what it costs (for example "+3 weeks of training, but this role fights financial crime, SDG 16.4"), and the path contribution is added up from the plan's own hours.
- **SDG-positive roles a finance worker can reach** are deliberately included, such as ESG reporting assistant (12.6), anti-money-laundering analyst (16.4), healthcare claims administrator (3.8) and microfinance officer (8.10).

## 9. Technical approach and AI use

- **App:** Next.js 16 and React 19 in TypeScript, Tailwind CSS, Recharts and a hand-drawn SVG map. Hosted on Vercel. PostgreSQL (SQLite locally). Code written with Replit and Claude Code, and reviewed and tested by the team.
- **Engine:** plain, tested TypeScript, with no model in the loop. It holds the LMSR market, the simulated forecasters, history replay, futures weights, expiry dates, matching and planning, so the same inputs always give the same answer.
- **Generative AI** is limited to three jobs, and in each the model only reads or proposes, and code checks it:
  - **Resume reader:** proposes skills (each with a quoted line) and better wording for weak lines.
  - **Certificate reader:** copies down what a certificate says; plain code decides whether it counts.
  - **Data-source finder:** proposes where a changed DOSM release page or table now sits; it never supplies a number.
- **Providers:** KrackedDev AI API (DeepSeek V4.1 Flash), then Qwen2.5 14B on RunPod Serverless, then Groq, then rules alone.
- **Guardrails:** jobs, skills and courses come from fixed, hand-checked lists. Explanations are filled in from templates. There is no chatbot, and the app cannot invent a job, a course or a statistic.

## 10. How we will know it works

The Phase 1 KPIs and 5-year targets are unchanged. What we can show now is a leading indicator for each; the 5-year numbers need real users over time.

| Phase 1 KPI | 5-year target | What we can show now |
|---|---|---|
| Growth in website users | 35,000 users | The site is live. Sessions and profiles are recorded in the event log, but no counters page is built yet. |
| Users still relying on the AI resources | 90% | Not measured yet. |
| Users who complete the AI courses and pass the AI quiz | 50% | A course step now finishes only with a verified certificate, and the quiz result is kept per user. The share who finish is not yet counted. |
| Users who find employment within 3 years | 40% | Needs a follow-up study. It cannot be measured in a hackathon. |

Things we can already show: the share of a plan's hours that are free (shown on the Plan page), the fairness test, and the market's replay score against a coin flip.

## 11. Risks and fallbacks

| Risk | Fallback |
|---|---|
| **Hardest: the market looks like random numbers.** | Questions settle only on real releases. Track records come from replaying real past releases. Open forecasts are hashed into the repository before the data comes out. We report the Brier score honestly against a coin flip. Simulated forecasters are labelled. |
| A source changes its website or file layout. | New numbers are checked against the old ones before they are saved, and the last good data stays if a check fails. A model may help find the new page, but never supplies a number. Pinned sources raise an alert for a person to review. |
| An AI provider is down or slow. | Three providers in turn, then the rule-based scan alone. A certificate that cannot be read leaves its step open, and the page says so; it never ticks a step it could not check. A labelled demo button lets a judge skip the check. |
| The model makes something up. | Closed lists, server checks on every AI answer, computed scores and templated explanations. |
| A course link goes stale. | Every course has a checked date and link status, and `scripts/check-links.mjs` re-checks them. |
| The live demo fails. | A recorded backup video, and the app runs from one hosted URL. |

## 12. Not built yet

- **Impact counters** for the KPIs above, and a script that runs every starting profile through the engine to report the share of profiles with a reachable job and the share of free hours.
- **A "delete my data" button** (the reset action exists, but is not shown as a privacy control).
- **Real forecasters** (judges, advisors, employers), real recruitment or PERKESO connections, payments, and anything with real money.
- **An accessibility pass** (a full screen-reader and keyboard check, larger text, high contrast), a low-bandwidth mode, and task cards for the nine sectors beyond finance.
- **Automatic re-planning** when a person falls behind or a release shortens a skill's life. Today the plan is rebuilt when they change their job, hours or course, or when new data moves the futures.
- **An employer view on real data** instead of the illustrative page.
