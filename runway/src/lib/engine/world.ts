import { series } from "./data";
import { FUTURES, FUTURE_IDS, type FutureId } from "./futures-def";
import { crowdTilt, futureWeights, normaliseOverride, type Weights3 } from "./futures";
import { FORECASTERS, KIND_LABEL, brier, forecasterName, updateWeights, START_BALANCE, type MarketRun, type Weights } from "./market";
import { liveQuestions, replayHistory, updateScores } from "./replay";
import { eventTitle, factFor, ladder, type Question, type Strike } from "./questions";
import type { SessionState } from "./state";
import { baseRun, runTape, type Execution, type TapeResult } from "./tape";
import { mean } from "./math";

export type StrikeView = {
  marketId: string; label: string; threshold: number; base: boolean;
  price: number; close: number; change1h: number; volume: number; trades: number;
  best: number; futures: Record<FutureId, number>;
  position: { yes: number; no: number; avgYes: number | null; avgNo: number | null; value: number; unrealised: number; realised: number };
  executions: Execution[];
  settled: null | { outcome: boolean; payout: number; pnl: number };
};
export type EventView = {
  id: string; quarter: string; title: string; short: string; text: string; source: { name: string; url: string }; settles: string; reason: string;
  phase: "live" | "next"; strikes: StrikeView[]; clockStart: number; nowT: number; fact: string | null; settled: boolean;
};
export type ForecasterRow = { id: string; name: string; kind: string; influence: number; brier: number | null; roi: number | null };

export type World = {
  release: 0 | 1;
  asOfQuarter: string;
  asOfLabel: string;
  events: EventView[];
  settledEvents: EventView[];
  futures: { id: FutureId; name: string; blurb: string; weight: number; earned: number; tilt: number; capMult: number; adoptMult: number; drift: number }[];
  weights: Weights3;
  usingOverride: boolean;
  scores: Record<FutureId, number>;
  forecasters: ForecasterRow[];
  kindSummary: { kind: string; count: number; influence: number }[];
  user: { balance: number; netCash: number; won: number; rank: number | null; of: number; roi: number | null; orders: number; positionValue: number };
  replay: { questions: number; brierLmsr: number; brierWeighted: number; brierUnweighted: number };
  clericalHistory: { q: string; share: number }[];
};

const top20 = (w: Weights) => [...FORECASTERS].sort((a, b) => (w[b.id] ?? 1) - (w[a.id] ?? 1)).slice(0, 20).map((f) => f.id);

type Phase = { events: { q: Question; strikes: Strike[]; tapes: TapeResult[] }[]; nowT: number; t0: number };

function tapesFor(qs: Question[], W: Weights, wkey: string, state: SessionState, nowT: number, collect: boolean) {
  return qs.map((q) => {
    const strikes = ladder(q);
    return { q, strikes, tapes: strikes.map((s) => runTape(s, W, wkey, state.orders, nowT, collect)) };
  });
}

export function computeWorld(state: SessionState, nowMs: number = Date.now()): World {
  const base = replayHistory();
  const W0 = base.weights;
  const released = state.release === 1;
  const t0 = state.clock ? Date.parse(state.clock.t0) : nowMs;
  const t1 = released ? (state.clock?.t1 ? Date.parse(state.clock.t1) : nowMs) : nowMs;
  const nowT0 = Math.max(0, ((released ? t1 : nowMs) - t0) / 1000);
  const nowT1 = Math.max(0, (nowMs - t1) / 1000);

  const liveQs = liveQuestions("live");
  const p0: Phase = { events: tapesFor(liveQs, W0, "W0", state, nowT0, released), nowT: nowT0, t0 };

  // settle: base-strike outcomes update influence and the futures' stored scores
  let W: Weights = W0;
  let S = base.scores;
  const baseRuns0: MarketRun[] = p0.events.map((e) => baseRun(e.strikes[1], W0, "W0"));
  if (released) {
    W = updateWeights(W0, baseRuns0);
    S = updateScores(base.scores, baseRuns0);
  }
  const p1: Phase | null = released ? { events: tapesFor(liveQuestions("next"), W, "W1", state, nowT1, false), nowT: nowT1, t0: t1 } : null;
  const open = released ? p1! : p0;

  const openBase = open.events.map((e) => {
    const run = baseRun(e.strikes[1], released ? W : W0, released ? "W1" : "W0");
    return { ...run, price: e.tapes[1].price } as MarketRun;
  });
  const tilt = crowdTilt(openBase);
  const stored = futureWeights(S, { slow: 0, medium: 0, fast: 0 });
  const shown = futureWeights(S, tilt);
  const weights = state.override ? normaliseOverride(state.override) : shown;

  const t20 = top20(W);
  let netCash = 0, won = 0, buyPoints = 0, pnlSettled = 0, orders = 0, positionValue = 0;
  const agentTotals: Record<string, { spent: number; payout: number }> = {};

  const mk = (ph: Phase, wkey: "W0" | "W1", Wt: Weights, phase: "live" | "next", settleNow: boolean): EventView[] =>
    ph.events.map(({ q, strikes, tapes }) => {
      const views: StrikeView[] = strikes.map((s, k) => {
        const t = tapes[k];
        const run = baseRun(s, Wt, wkey);
        const pos = t.position;
        const bw = t20.reduce((a, id) => a + (Wt[id] ?? 1), 0);
        const outcome = settleNow ? s.outcome : undefined;
        const cash = t.executions.reduce((a, e) => a + (e.action === "buy" ? -e.points : e.points), 0);
        let settled: StrikeView["settled"] = null;
        netCash += cash;
        buyPoints += t.executions.filter((e) => e.action === "buy").reduce((a, e) => a + e.points, 0);
        orders += t.executions.length;
        if (outcome !== undefined) {
          const payout = outcome ? pos.yes : pos.no;
          settled = { outcome, payout, pnl: cash + payout };
          won += payout; pnlSettled += cash + payout;
          if (t.agents) for (const [id, a] of Object.entries(t.agents)) {
            const x = (agentTotals[id] ??= { spent: 0, payout: 0 });
            x.spent += a.spent; x.payout += outcome ? a.yes : a.no;
          }
        } else {
          positionValue += pos.yes * t.price + pos.no * (1 - t.price);
        }
        const yesMark = t.price, noMark = 1 - t.price;
        return {
          marketId: s.id, label: s.label, threshold: s.threshold, base: s.base,
          price: outcome !== undefined ? (outcome ? 1 : 0) : t.price, close: t.price, change1h: t.price - t.hourAgo, volume: t.volume, trades: t.trades,
          best: t20.reduce((a, id) => a + (Wt[id] ?? 1) * run.beliefs[id], 0) / bw, futures: run.probs,
          position: {
            yes: pos.yes, no: pos.no, avgYes: pos.yes > 1e-9 ? pos.yesCost / pos.yes : null, avgNo: pos.no > 1e-9 ? pos.noCost / pos.no : null,
            value: pos.yes * yesMark + pos.no * noMark, unrealised: pos.yes * yesMark - pos.yesCost + pos.no * noMark - pos.noCost, realised: pos.realised,
          },
          executions: t.executions, settled,
        };
      });
      return {
        id: q.id, quarter: q.quarter, title: eventTitle(q), short: q.kind === "dosm" ? "Clerical job-ad share" : series.epoch[q.series].name, text: q.text, source: q.source, settles: q.settles, reason: q.reason, phase,
        strikes: views, clockStart: ph.t0, nowT: ph.nowT, fact: settleNow ? factFor(q) : null, settled: settleNow,
      };
    });

  const settledEvents = mk(p0, "W0", W0, "live", released);
  const events = released ? mk(p1!, "W1", W, "next", false) : settledEvents;
  const settledOut = released ? settledEvents : [];

  const roi: Record<string, number> = {};
  for (const [id, a] of Object.entries(agentTotals)) if (a.spent > 0) roi[id] = (a.payout - a.spent) / a.spent;
  const userRoi = released && buyPoints > 0 ? pnlSettled / buyPoints : null;
  const rank = userRoi === null ? null : 1 + Object.values(roi).filter((x) => x > userRoi).length;

  const brierOf = (id: string) => {
    let { sum, n } = base.agentBrier[id];
    if (released) for (const r of baseRuns0) { sum += brier(r.beliefs[id], r.q.outcome!); n++; }
    return n ? sum / n : null;
  };
  const forecasters: ForecasterRow[] = [...FORECASTERS].sort((a, b) => W[b.id] - W[a.id]).slice(0, 10)
    .map((f) => ({ id: f.id, name: forecasterName(f), kind: KIND_LABEL[f.kind], influence: W[f.id], brier: brierOf(f.id), roi: roi[f.id] ?? null }));
  const kinds = [...new Set(FORECASTERS.map((f) => f.kind))];
  const kindSummary = kinds.map((k) => {
    const m = FORECASTERS.filter((f) => f.kind === k);
    return { kind: KIND_LABEL[k], count: m.length, influence: mean(m.map((f) => W[f.id])) };
  });

  const asOfQuarter = released ? "2026Q2" : "2026Q1";
  return {
    release: state.release, asOfQuarter,
    asOfLabel: released ? `DOSM 2026 Q2 (published 18 Aug 2026)` : `DOSM 2026 Q1; 2026 Q2 release held back`,
    events, settledEvents: settledOut,
    futures: FUTURES.map((f) => ({
      id: f.id, name: f.name, blurb: f.blurb, weight: weights[f.id], earned: stored[f.id], tilt: shown[f.id] - stored[f.id],
      capMult: f.capMult, adoptMult: f.adoptMult, drift: f.clericalDriftPp,
    })),
    weights, usingOverride: !!state.override, scores: S, forecasters, kindSummary,
    user: { balance: START_BALANCE + netCash + won, netCash, won, rank, of: Object.keys(roi).length + 1, roi: userRoi, orders, positionValue },
    clericalHistory: series.dosm.quarters.filter((d) => d.q >= "2023Q1" && d.q <= asOfQuarter).map((d) => ({ q: d.q, share: d.clerical_share })),
    replay: { questions: base.stats.questions, brierLmsr: base.stats.brierLmsr, brierWeighted: base.stats.brierWeightedMean, brierUnweighted: base.stats.brierUnweighted },
  };
}
export { FUTURE_IDS };
