import { makeQuestions, LAST_BEFORE, LIVE_QUARTER, NEXT_QUARTER, type Question } from "./questions";
import { FORECASTERS, runMarket, updateWeights, brier, logLik, type MarketRun, type Weights } from "./market";
import { FUTURE_IDS, UPDATE_STRENGTH, FADE_PER_QUARTER, type FutureId } from "./futures-def";
import { quarterIndex } from "./data";

export type Scores = Record<FutureId, number>;
export const zeroScores = (): Scores => ({ slow: 0, medium: 0, fast: 0 });

// Update the futures' stored scores from SETTLED outcomes only (never from the crowd).
export function updateScores(S: Scores, runs: MarketRun[]): Scores {
  const next = {} as Scores;
  for (const id of FUTURE_IDS) {
    let ll = 0;
    for (const r of runs) ll += logLik(r.probs[id], r.q.outcome!);
    next[id] = FADE_PER_QUARTER * S[id] + UPDATE_STRENGTH * ll;
  }
  return next;
}

export type ReplayStats = {
  questions: number;
  brierLmsr: number;
  brierWeightedMean: number;
  brierUnweighted: number;
  perQuarter: { q: string; n: number; brierLmsr: number; brierUnweighted: number }[];
};

export type Replay = {
  weights: Weights; // influence at the start of the live quarter
  scores: Scores; // futures' stored scores at the start of the live quarter
  stats: ReplayStats;
  agentBrier: Record<string, { sum: number; n: number }>;
};

let cache: Replay | null = null;

// Re-run every past release in order. Weights used for each question come only from earlier questions.
export function replayHistory(): Replay {
  if (cache) return cache;
  const all = makeQuestions().filter((q) => q.phase === "replay");
  const quarters = [...new Set(all.map((q) => q.quarter))].sort((a, b) => quarterIndex(a) - quarterIndex(b));
  let w: Weights = Object.fromEntries(FORECASTERS.map((f) => [f.id, 1]));
  let S = zeroScores();
  const agentBrier: Record<string, { sum: number; n: number }> = Object.fromEntries(FORECASTERS.map((f) => [f.id, { sum: 0, n: 0 }]));
  let sumL = 0, sumW = 0, sumU = 0, n = 0;
  const perQuarter: ReplayStats["perQuarter"] = [];
  for (const qt of quarters) {
    const runs = all.filter((q) => q.quarter === qt).map((q) => runMarket(q, w));
    let ql = 0, qu = 0;
    for (const r of runs) {
      const o = r.q.outcome!;
      const wm = FORECASTERS.reduce((a, f) => a + w[f.id] * r.beliefs[f.id], 0) / FORECASTERS.reduce((a, f) => a + w[f.id], 0);
      sumL += brier(r.price, o); sumW += brier(wm, o); sumU += brier(r.unweightedMean, o); n++;
      ql += brier(r.price, o); qu += brier(r.unweightedMean, o);
      for (const f of FORECASTERS) { agentBrier[f.id].sum += brier(r.beliefs[f.id], o); agentBrier[f.id].n++; }
    }
    perQuarter.push({ q: qt, n: runs.length, brierLmsr: ql / runs.length, brierUnweighted: qu / runs.length });
    S = updateScores(S, runs);
    w = updateWeights(w, runs);
  }
  cache = {
    weights: w, scores: S, agentBrier,
    stats: { questions: n, brierLmsr: sumL / n, brierWeightedMean: sumW / n, brierUnweighted: sumU / n, perQuarter },
  };
  return cache;
}

export function liveQuestions(phase: "live" | "next"): Question[] {
  return makeQuestions().filter((q) => q.phase === phase);
}
export { LAST_BEFORE, LIVE_QUARTER, NEXT_QUARTER };
