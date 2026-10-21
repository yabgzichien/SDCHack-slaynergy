import { newMarket, price, tradeToward, payout, cost, type Trade } from "./lmsr";
import { clamp, gaussian, hashString, logit, mulberry32, sigmoid } from "./math";
import { FUTURES, FUTURE_IDS, type FutureId } from "./futures-def";
import { futureProbs, trendProb, type Question } from "./questions";

// ---- ~200 simulated forecasters (always labelled "simulated" in the UI) ----
export type Kind = "optimist" | "sceptic" | "expert" | "chaser" | "noisy";
export type Forecaster = { id: string; kind: Kind; mix: Record<FutureId, number>; noise: number; bias: number };

const KIND_SPEC: { kind: Kind; n: number; mix: [number, number, number]; noise: number }[] = [
  { kind: "optimist", n: 45, mix: [0.1, 0.3, 0.6], noise: 0.5 },
  { kind: "sceptic", n: 45, mix: [0.6, 0.3, 0.1], noise: 0.5 },
  { kind: "expert", n: 40, mix: [0.25, 0.5, 0.25], noise: 0.25 },
  { kind: "chaser", n: 20, mix: [0.25, 0.5, 0.25], noise: 0.4 },
  { kind: "noisy", n: 50, mix: [0.34, 0.33, 0.33], noise: 1.1 },
];
export const KIND_LABEL: Record<Kind, string> = {
  optimist: "AI optimist", sceptic: "AI sceptic", expert: "careful expert", chaser: "trend chaser", noisy: "noisy guesser",
};

export const FORECASTERS: Forecaster[] = (() => {
  const out: Forecaster[] = [];
  let i = 0;
  for (const s of KIND_SPEC) {
    for (let k = 0; k < s.n; k++) {
      i++;
      const rng = mulberry32(hashString(`forecaster-${i}`));
      out.push({
        id: `F${String(i).padStart(3, "0")}`, kind: s.kind,
        mix: { slow: s.mix[0], medium: s.mix[1], fast: s.mix[2] },
        noise: s.noise, bias: (rng() - 0.5) * 0.4,
      });
    }
  }
  return out;
})();
export const forecasterName = (f: Forecaster) => `Computer-made player ${f.id.slice(1)} · ${KIND_LABEL[f.kind]}`;

export function belief(f: Forecaster, q: Question, probs = futureProbs(q)): number {
  // What each type reads: experts allow for scores near 100% slowing down; trend chasers repeat last quarter's change;
  // the others lean towards the future they believe in. Chasers blend their trend with the middle view.
  const own = f.kind === "expert" ? futureProbs(q, { saturation: true }) : probs;
  const mixed = f.kind === "chaser" ? 0.5 * trendProb(q) + 0.5 * own.medium : FUTURE_IDS.reduce((a, id) => a + f.mix[id] * own[id], 0);
  const rng = mulberry32(hashString(`${f.id}|${q.id}`));
  return clamp(sigmoid(logit(mixed) + f.bias + f.noise * gaussian(rng)), 0.03, 0.97);
}

// ---- one market ----
export type Weights = Record<string, number>; // forecaster id -> influence (mean 1)
export type AgentEvent = { agent: string; side: "yes" | "no"; shares: number; spent: number; price: number };
export type MarketRun = {
  q: Question;
  events: AgentEvent[]; // the simulated forecasters' trades, in order
  price: number; // closing LMSR price (the crowd probability)
  beliefs: Record<string, number>;
  trades: Record<string, Trade>;
  unweightedMean: number;
  probs: Record<FutureId, number>;
  state: { qy: number; qn: number; b: number };
};

const BUDGET_PER_UNIT = 25;
const ROUNDS = 2;
const B = 60;

export function runMarket(q: Question, w: Weights): MarketRun {
  const probs = futureProbs(q);
  const m = newMarket(B);
  const beliefs: Record<string, number> = {};
  const trades: Record<string, Trade> = {};
  const events: AgentEvent[] = [];
  // Deterministic order, different for each question.
  const order = [...FORECASTERS].sort((a, b) => hashString(`${a.id}|${q.id}|order`) - hashString(`${b.id}|${q.id}|order`));
  for (const f of FORECASTERS) beliefs[f.id] = belief(f, q, probs);
  // Two rounds at half budget, so the closing price depends on everyone's view and not on who traded last.
  for (let round = 0; round < ROUNDS; round++) {
    for (const f of order) {
      const t = tradeToward(m, beliefs[f.id], (BUDGET_PER_UNIT / ROUNDS) * (w[f.id] ?? 1));
      if (!t) continue;
      trades[f.id] = t; // the forecaster's latest trade
      events.push({ agent: f.id, side: t.side, shares: t.shares, spent: t.spent, price: price(m) });
    }
  }
  const mean = FORECASTERS.reduce((a, f) => a + beliefs[f.id], 0) / FORECASTERS.length;
  return { q, events, price: price(m), beliefs, trades, unweightedMean: mean, probs, state: { qy: m.qy, qn: m.qn, b: m.b } };
}

export const START_BALANCE = 1000;
export { price, cost, newMarket, tradeToward };
export { payout };

// Brier loss of a probability against an outcome.
export const brier = (p: number, outcome: boolean) => (p - (outcome ? 1 : 0)) ** 2;

// ---- influence follows accuracy: the Hedge (multiplicative weights) online-learning rule ----
// After each settled round, every forecaster's influence is multiplied by exp(-ETA x Brier loss) and the crowd is
// rescaled to an average of 1. Accurate forecasters gain influence; inaccurate ones lose it. Influence is the
// size of the budget a forecaster trades with, so it sets how far they can move the price.
export const ETA = 3;
export const INFLUENCE_MIN = 0.05, INFLUENCE_MAX = 6;
export type Guest = { id: string; prev: number; loss: number };
export function updateWeights(w: Weights, runs: MarketRun[], guests: Guest[] = []): Weights {
  const raw: Weights = {};
  for (const f of FORECASTERS) {
    let loss = 0;
    for (const r of runs) loss += brier(r.beliefs[f.id], r.q.outcome!);
    raw[f.id] = (w[f.id] ?? 1) * Math.exp(-ETA * loss);
  }
  // One scale for everyone, chosen so the capped influences average exactly 1. Clamping and then rescaling would push
  // the top forecasters back over the cap. Guests (you) are scored by the same rule and scale but do not set it.
  const meanAt = (s: number) => FORECASTERS.reduce((a, f) => a + clamp(raw[f.id] * s, INFLUENCE_MIN, INFLUENCE_MAX), 0) / FORECASTERS.length;
  let lo = 0, hi = 1 / Math.max(1e-300, Math.min(...FORECASTERS.map((f) => raw[f.id])));
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (meanAt(mid) < 1) lo = mid; else hi = mid; }
  const s = (lo + hi) / 2;
  const next: Weights = {};
  for (const f of FORECASTERS) next[f.id] = clamp(raw[f.id] * s, INFLUENCE_MIN, INFLUENCE_MAX);
  for (const g of guests) next[g.id] = clamp(g.prev * Math.exp(-ETA * g.loss) * s, INFLUENCE_MIN, INFLUENCE_MAX);
  return next;
}

export const logLik = (p: number, outcome: boolean) => Math.log(outcome ? p : 1 - p);
export { FUTURES };
