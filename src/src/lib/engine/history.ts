// The history timeline: the app as it stood on the day of each past DOSM release, using only what was public that day.
// Nothing here writes, settles or stores anything: every past figure is worked out from the data already loaded.
import { series, sourceById, prevQuarter, quarterIndex, perSnapshot } from "./data";
import { epochSettleDay, eventTitle, futureProbs, isoDay, ladder, makeQuestions, quarterPlain, type Question } from "./questions";
import { updateScores, zeroScores, type Scores } from "./replay";
import { futureWeights, type Weights3 } from "./futures";
import type { MarketRun } from "./market";

// The day each DOSM Job Market Insights edition was published, read from that edition's own page on dosm.gov.my
// ("Latest Release: ...", checked 29 Oct 2026). Never estimated: a quarter missing here and from the data has no date.
// The data's own publishedAt (set by the auto-update when a release comes out) wins over this list.
const RELEASE_PAGE = (q: string) => `https://www.dosm.gov.my/portal-main/release-content/big-data-analytics-job-market-insights-q${q[5]}${q.slice(0, 4)}`;
export const DOSM_RELEASE_DAYS: Record<string, string> = {
  "2024Q3": "2025-11-26",
  "2024Q4": "2025-12-22",
  "2025Q1": "2026-01-30",
  "2025Q2": "2026-02-26",
  "2025Q3": "2026-04-28",
  "2025Q4": "2026-05-25",
  "2026Q1": "2026-06-25",
  "2026Q2": "2026-08-18",
};
// The first stop: DOSM changed how it counts job ads from 2025 Q3 (matching.ts DOSM_BREAK), so the timeline starts there.
export const HISTORY_FROM = "2025Q3";
const BEFORE_ALL = "0000-00-00";

export const releaseDay = (q: string): string | null => series.dosm.publishedAt[q] ?? DOSM_RELEASE_DAYS[q] ?? null;
const firstDated = () => Object.keys({ ...DOSM_RELEASE_DAYS, ...series.dosm.publishedAt }).sort((a, b) => quarterIndex(a) - quarterIndex(b))[0];

// When a question's answer became public. DOSM: its release day. Quarters older than the oldest dated release came out
// before it (DOSM publishes quarters in order), so they count as settled before every stop. Epoch AI: 30 days after the
// quarter ends (questions.ts). null: not public yet, or no verified date.
export function settleDay(q: Pick<Question, "kind" | "quarter">): string | null {
  if (q.kind === "epoch") return epochSettleDay(q.quarter);
  const d = releaseDay(q.quarter);
  if (d) return d;
  return quarterIndex(q.quarter) < quarterIndex(firstDated()) ? BEFORE_ALL : null;
}
const settledBy = (q: Question, day: string) => { const s = settleDay(q); return s !== null && s <= day; };

// Decimal year of a day, for the skill-date clock (expiry.ts).
export function yearOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
  return y + (Date.UTC(y, m - 1, d) - start) / (end - start);
}
const quarterStart = (q: string) => `${q.slice(0, 4)}-${String((Number(q[5]) - 1) * 3 + 1).padStart(2, "0")}-01`;

// ---------- the stops ----------
export type Stop = { q: string; day: string; label: string; today: boolean; url: string };
export type Upcoming = { q: string; day: string | null; label: string };

export function historyStops(): Stop[] {
  const live = series.market.dosm.live;
  return series.dosm.quarters.map((d) => d.q)
    .filter((q) => quarterIndex(q) >= quarterIndex(HISTORY_FROM) && quarterIndex(q) <= quarterIndex(live) && releaseDay(q))
    .map((q) => ({ q, day: releaseDay(q)!, label: `DOSM ${q.replace("Q", " Q")}`, today: q === live, url: RELEASE_PAGE(q) }));
}
export function upcomingRelease(): Upcoming {
  const q = series.market.dosm.next;
  return { q, day: sourceById.dosm?.next ?? null, label: `DOSM ${q.replace("Q", " Q")}` };
}

// ---------- what was public on a day ----------
// The newest DOSM quarter published by that day, and the newest Epoch AI quarter settled by it.
export function dosmQuarterAt(day: string): string | null {
  const qs = series.dosm.quarters.map((d) => d.q).filter((q) => { const s = settleDay({ kind: "dosm", quarter: q }); return s !== null && s <= day; });
  return qs.at(-1) ?? null;
}
export function epochQuarterAt(day: string): string | null {
  const qs = [...new Set(Object.values(series.epoch).flatMap((e) => e.frontier.map((x) => x.q)))]
    .filter((q) => epochSettleDay(q) <= day).sort((a, b) => quarterIndex(a) - quarterIndex(b));
  return qs.at(-1) ?? null;
}

// The futures' stored scores from every question whose answer was public by that day: the same quarter-by-quarter
// update as the replay (replay.ts) and the release step (world.ts), each quarter holding only the questions settled by
// then. On a day after every answer is public it gives exactly today's stored scores (tested).
const batches = perSnapshot(() => {
  const qs = makeQuestions();
  const replay = qs.filter((q) => q.phase === "replay");
  const quarters = [...new Set(replay.map((q) => q.quarter))].sort((a, b) => quarterIndex(a) - quarterIndex(b));
  const run = (q: Question): MarketRun => ({ q, probs: futureProbs(q) } as MarketRun);
  const out: MarketRun[][] = quarters.map((qt) => replay.filter((q) => q.quarter === qt).map(run));
  // The release step settles the live questions on their main line (world.ts: baseRun(e.strikes[1])).
  out.push(qs.filter((q) => q.phase === "live").map((q) => run(ladder(q)[1])));
  return out;
});
export function scoresAt(day: string): Scores {
  let S = zeroScores();
  for (const b of batches()) {
    const runs = b.filter((r) => settledBy(r.q, day));
    if (runs.length) S = updateScores(S, runs);
  }
  return S;
}
export const weightsAt = (day: string): Weights3 => futureWeights(scoresAt(day), zeroScores());

// The questions that were open on that day: asked (their quarter had begun, or for DOSM the quarter before had been
// published) and not yet answered. Their answers are left out on purpose: they came out after that day.
export type OpenThen = { id: string; title: string; text: string; settles: string; source: { name: string; url: string } };
export function openQuestionsAt(day: string): OpenThen[] {
  return makeQuestions()
    .filter((q) => {
      const s = settleDay(q);
      if (s !== null && s <= day) return false;
      if (q.kind === "dosm") { const p = settleDay({ kind: "dosm", quarter: prevQuarter(q.quarter) }); return p !== null && p <= day; }
      return quarterStart(q.quarter) <= day;
    })
    // DOSM's release day is left out: it was not public on that day. Epoch AI's check day follows a fixed rule.
    .map((q) => ({
      id: q.id, title: eventTitle(q), text: q.text, source: q.source,
      settles: q.kind === "dosm" ? `DOSM numbers for ${quarterPlain(q.quarter)}` : `Epoch AI results for ${quarterPlain(q.quarter)}, checked from ${isoDay(epochSettleDay(q.quarter))}`,
    }));
}
