import { scoredForecast } from "../market-math";
import { prevQuarter, series, sourceById } from "./data";
import { FUTURES, FUTURE_IDS, type FutureId } from "./futures-def";
import { crowdTilt, futureWeights, type Weights3 } from "./futures";
import { FORECASTERS, KIND_LABEL, brier, forecasterName, updateWeights, START_BALANCE, type Kind, type MarketRun, type Weights } from "./market";
import { liveQuestions, replayHistory, updateScores, type Scores } from "./replay";
import { epochSettleDay, eventTitle, factFor, isoDay, ladder, LIVE_QUARTER, quarterEnd, quarterPlain, type Question, type Strike } from "./questions";
import { ETA, INFLUENCE_MAX } from "./market";
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
  // Last day new predictions are taken (an Epoch AI question closes when its quarter ends, because Epoch publishes
  // results as they come in). Null for DOSM: its numbers stay unknown until the release.
  closesAt: string | null;
  // Settled before this session could predict on it: predictions here are practice and not scored.
  practice: boolean;
  // What the main answer would do to the three futures once it settles, before anyone knows the answer. Null once settled.
  whatIf: { now: Weights3; yes: Weights3; no: Weights3 } | null;
};
// You are scored like every simulated forecaster: on each question's headline line (the middle strike).
// Your forecast there is the chance you left the market at after your last trade; no trade counts as 50%.
export const MAX_ORDER = 50; // points per prediction at normal influence; at most double that for the most accurate players
export type YouStats = {
  // practice: made on a question that was never open to you (its numbers were already out), so it is not scored.
  forecasts: { eventId: string; title: string; forecast: number | null; outcome: boolean | null; practice: boolean }[];
  brier: number | null; scored: number; traded: number; influenceBefore: number; influence: number; maxOrder: number;
};
export type ForecasterRow = { id: string; name: string; kind: string; influence: number; brier: number | null; roi: number | null };

export type World = {
  release: 0 | 1;
  asOfQuarter: string;
  asOfLabel: string;
  latestLabel: string; // the latest release in words, e.g. "Apr to Jun 2026"
  // When the open questions get their answers (ISO days): DOSM's announced release day, if known, and the first day the
  // open Epoch AI quarter can settle.
  nextAnswers: { dosm: string | null; epoch: string | null };
  events: EventView[];
  settledEvents: EventView[];
  futures: { id: FutureId; name: string; blurb: string; weight: number; earned: number; tilt: number; capMult: number; adoptMult: number; drift: number }[];
  weights: Weights3;
  scores: Record<FutureId, number>;
  // What the open questions' crowd prices add to each future's score before the weights are worked out (futures.ts crowdTilt).
  crowdTilt: Scores;
  forecasters: ForecasterRow[];
  kindSummary: { kind: string; count: number; influence: number }[];
  user: { balance: number; netCash: number; won: number; rank: number | null; of: number; roi: number | null; orders: number; positionValue: number };
  replay: { questions: number; brierLmsr: number; brierWeighted: number; brierUnweighted: number; brierCoin: number; brierBaseRate: number; brierBestFuture: number; bestFuture: string };
  you: YouStats;
  agentRoi: Record<string, number>; // points won per point spent on settled markets, per simulated forecaster
  clericalHistory: { q: string; share: number }[];
  // The newest Epoch AI quarter in this view. Today it is asOfQuarter; a past view uses the quarter settled by its day.
  epochQuarter?: string;
  // Set only while viewing the past (history timeline): the release whose day this view is as of.
  past?: { q: string; day: string; label: string; url: string } | null;
  // Every way the open questions' main answers could come out, and the forecast weights each would leave. Null while
  // viewing the past.
  stakes?: Stakes | null;
};
export type Stakes = { questions: { id: string; kind: "dosm" | "epoch" }[]; outcomes: { answers: boolean[]; weights: Weights3 }[] };

// Settle every combination of the open questions' main answers (2^n; 5 questions give 32) and return the forecast
// weights each would leave once all are in. Questions settle in their release order (settleOrder): each release fades
// the older scores once, as updateScores does when a real release settles. With every answer in, no crowd tilt is left.
export function computeStakes(S: Scores, runs: MarketRun[], settleOrder: ("dosm" | "epoch")[]): Stakes {
  const n = runs.length;
  const outcomes: Stakes["outcomes"] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const answers = runs.map((_, i) => ((mask >> i) & 1) === 1);
    const settled = runs.map((r, i) => ({ ...r, q: { ...r.q, outcome: answers[i] } }));
    let s = S;
    for (const kind of settleOrder) {
      const batch = settled.filter((r) => r.q.kind === kind);
      if (batch.length) s = updateScores(s, batch);
    }
    outcomes.push({ answers, weights: futureWeights(s, { slow: 0, medium: 0, fast: 0 }) });
  }
  return { questions: runs.map((r) => ({ id: r.q.id, kind: r.q.kind })), outcomes };
}

export const YOU = "you";
const top20 = (w: Weights) => [...FORECASTERS].sort((a, b) => (w[b.id] ?? 1) - (w[a.id] ?? 1)).slice(0, 20).map((f) => f.id);

type Phase = { events: { q: Question; strikes: Strike[]; tapes: TapeResult[] }[]; nowT: number; t0: number };

function tapesFor(qs: Question[], W: Weights, wkey: string, state: SessionState, nowT: number | ((q: Question) => number), collect: boolean) {
  return qs.map((q) => {
    const strikes = ladder(q);
    const t = typeof nowT === "number" ? nowT : nowT(q);
    const fw = series.market.tapeWeights?.[q.id];
    return { q, strikes, tapes: strikes.map((s) => runTape(s, fw ?? W, fw ? "F" : wkey, state.orders, t, collect)) };
  });
}

export function computeWorld(state: SessionState, nowMs: number = Date.now()): World {
  const base = replayHistory();
  const W0 = base.weights;
  const released = state.release === 1;
  const t0 = state.clock ? Date.parse(state.clock.t0) : nowMs;
  // Sessions start with the latest figures loaded, so the open markets' clock starts with the session.
  const t1 = released ? (state.clock?.t1 ? Date.parse(state.clock.t1) : t0) : nowMs;
  const nowT0 = Math.max(0, ((released ? t1 : nowMs) - t0) / 1000);
  const nowT1 = Math.max(0, (nowMs - t1) / 1000);

  const liveQs = liveQuestions("live");
  // A question that settled while this session was open stops trading at the moment it settled, so the predictions
  // made on it while it was open count; one that settled before the session started stops at the session's start.
  const settledT = (q: Question) => {
    const at = series.market.frozen[q.id]?.settledAt;
    return at ? Math.min(Math.max(0, (Date.parse(at) - t0) / 1000), Math.max(0, (nowMs - t0) / 1000)) : nowT0;
  };
  const p0: Phase = { events: tapesFor(liveQs, W0, "W0", state, released ? settledT : nowT0, released), nowT: nowT0, t0 };

  // settle: base-strike outcomes update influence and the futures' stored scores
  let W: Weights = W0;
  let S = base.scores;
  const baseRuns0: MarketRun[] = p0.events.map((e) => baseRun(e.strikes[1], W0, "W0"));
  // A prediction on a question counts only if the question was still open when it was made. The questions settled by
  // the release a session starts after were never open to it: predictions on them are practice and are not scored.
  const yourForecasts = p0.events.map((e) => {
    return { eventId: e.q.id, title: eventTitle(e.q), forecast: scoredForecast(e.tapes[1].executions), outcome: released ? e.strikes[1].outcome ?? null : null, practice: !series.market.frozen[e.q.id]?.settledAt };
  });
  // Rank and influence use the same score: every headline question counts, and one you did not trade counts as 50%.
  // You are scored on a release only if you made a prediction on it while it was open.
  const scorable = yourForecasts.filter((f) => !f.practice);
  const traded = scorable.filter((f) => f.forecast !== null).length;
  const scoredYou = released && traded > 0;
  const yourLoss = scoredYou ? scorable.reduce((a, f) => a + brier(f.forecast ?? 0.5, f.outcome!), 0) : 0;
  if (released) {
    W = updateWeights(W0, baseRuns0, scoredYou ? [{ id: YOU, prev: 1, loss: yourLoss }] : []);
    S = updateScores(base.scores, baseRuns0);
  }
  const you: YouStats = {
    forecasts: yourForecasts, scored: scoredYou ? scorable.length : 0, traded,
    brier: scoredYou ? yourLoss / scorable.length : null,
    influenceBefore: 1, influence: W[YOU] ?? 1, maxOrder: Math.round(MAX_ORDER * Math.min(2, W[YOU] ?? 1)),
  };
  const p1: Phase | null = released ? { events: tapesFor(liveQuestions("next"), W, "W1", state, nowT1, false), nowT: nowT1, t0: t1 } : null;
  const open = released ? p1! : p0;

  const openBase = open.events.map((e) => {
    const run = baseRun(e.strikes[1], released ? W : W0, released ? "W1" : "W0");
    return { ...run, price: e.tapes[1].price } as MarketRun;
  });
  const tilt = crowdTilt(openBase);
  const stored = futureWeights(S, { slow: 0, medium: 0, fast: 0 });
  const weights = futureWeights(S, tilt);
  // "What if?": settle one open question's main answer as Yes or No, keep the crowd's tilt from the others.
  const whatIf: Record<string, EventView["whatIf"]> = {};
  openBase.forEach((r, i) => {
    const rest = crowdTilt(openBase.filter((_, j) => j !== i));
    const settle = (o: boolean) => futureWeights(updateScores(S, [{ ...r, q: { ...r.q, outcome: o } }]), rest);
    whatIf[open.events[i].q.id] = { now: weights, yes: settle(true), no: settle(false) };
  });

  // The release whose answers come out first settles first; an unknown release day goes last.
  const day = (k: "dosm" | "epoch") => (k === "dosm" ? sourceById.dosm?.next : series.market.epoch.open.length ? epochSettleDay(series.market.epoch.open[0]) : null) ?? "9999";
  const stakes = computeStakes(S, openBase, (["dosm", "epoch"] as const).slice().sort((a, b) => day(a).localeCompare(day(b))));

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
        id: q.id, quarter: q.quarter, title: eventTitle(q), short: q.kind === "dosm" ? "Office admin jobs" : series.epoch[q.series].name, text: q.text, source: q.source, settles: q.settles, reason: q.reason, phase,
        strikes: views, clockStart: ph.t0, nowT: tapes[0]?.nowT ?? ph.nowT, fact: settleNow ? factFor(q) : null, settled: settleNow,
        closesAt: !settleNow && q.kind === "epoch" ? quarterEnd(q.quarter) : null,
        practice: settleNow && !series.market.frozen[q.id]?.settledAt,
        whatIf: settleNow ? null : whatIf[q.id] ?? null,
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

  const live = LIVE_QUARTER(), pub = series.dosm.publishedAt[live];
  const asOfQuarter = released ? live : prevQuarter(live);
  return {
    release: state.release, asOfQuarter,
    asOfLabel: released ? `DOSM ${live.replace("Q", " Q")}${pub ? ` (published ${isoDay(pub)})` : ""}` : `DOSM ${asOfQuarter.replace("Q", " Q")}; ${live.replace("Q", " Q")} release held back`,
    latestLabel: quarterPlain(live),
    nextAnswers: { dosm: sourceById.dosm?.next ?? null, epoch: series.market.epoch.open.length ? epochSettleDay(series.market.epoch.open[0]) : null },
    events, settledEvents: settledOut,
    futures: FUTURES.map((f) => ({
      id: f.id, name: f.name, blurb: f.blurb, weight: weights[f.id], earned: stored[f.id], tilt: weights[f.id] - stored[f.id],
      capMult: f.capMult, adoptMult: f.adoptMult, drift: f.clericalDriftPp,
    })),
    weights, scores: S, crowdTilt: tilt, forecasters, kindSummary, stakes,
    user: { balance: START_BALANCE + netCash + won, netCash, won, rank, of: Object.keys(roi).length + 1, roi: userRoi, orders, positionValue },
    clericalHistory: series.dosm.quarters.filter((d) => d.q >= "2023Q1" && d.q <= asOfQuarter).map((d) => ({ q: d.q, share: d.clerical_share })),
    replay: { questions: base.stats.questions, brierLmsr: base.stats.brierLmsr, brierWeighted: base.stats.brierWeightedMean, brierUnweighted: base.stats.brierUnweighted, brierCoin: base.stats.brierCoin, brierBaseRate: base.stats.brierBaseRate,
      ...(() => { const f = FUTURES.reduce((a, b) => (base.stats.brierFutures[b.id] < base.stats.brierFutures[a.id] ? b : a)); return { brierBestFuture: base.stats.brierFutures[f.id], bestFuture: f.name }; })() },
    you, agentRoi: roi,
  };
}
export { FUTURE_IDS };

// ---------- leaderboard: every forecaster, ranked by accuracy ----------
export type LeaderRow = {
  id: string; name: string; kind: string; you: boolean;
  brier: number | null; questions: number; influenceBefore: number; influence: number; roi: number | null; rank: number | null;
};
export type Leaderboard = {
  released: boolean; rows: LeaderRow[]; eta: number;
  history: { q: string; byKind: Record<Kind, number> }[]; kinds: { kind: Kind; label: string; count: number; brier: number; influence: number }[];
  baselines: { coin: number; baseRate: number; market: number; weighted: number; unweighted: number };
  // Where the computer-made players' records come from: real past releases, replayed in order before you arrived.
  track: { questions: number; from: string; to: string; quarters: number };
  influenceMax: number;
};

export function computeLeaderboard(state: SessionState, nowMs: number = Date.now()): Leaderboard {
  const w = computeWorld(state, nowMs);
  const base = replayHistory();
  const released = state.release === 1;
  const W0 = base.weights;
  const live = liveQuestions("live");
  const runs = live.map((q) => baseRun(ladder(q)[1], W0, "W0"));
  const W = released ? updateWeights(W0, runs, w.you.scored ? [{ id: YOU, prev: 1, loss: w.you.forecasts.filter((f) => !f.practice).reduce((a, f) => a + brier(f.forecast ?? 0.5, f.outcome!), 0) }] : []) : W0;
  const roiById = w.agentRoi;
  const rows: LeaderRow[] = FORECASTERS.map((f) => {
    let { sum, n } = base.agentBrier[f.id];
    if (released) for (const r of runs) { sum += brier(r.beliefs[f.id], r.q.outcome!); n++; }
    return { id: f.id, name: forecasterName(f), kind: KIND_LABEL[f.kind], you: false, brier: n ? sum / n : null, questions: n, influenceBefore: W0[f.id], influence: W[f.id], roi: roiById[f.id] ?? null, rank: null };
  });
  rows.push({ id: YOU, name: "You", kind: "you", you: true, brier: w.you.brier, questions: w.you.scored, influenceBefore: 1, influence: w.you.influence, roi: w.user.roi, rank: null });
  rows.sort((a, b) => (a.brier ?? 9) - (b.brier ?? 9) || b.influence - a.influence);
  let k = 0;
  for (const r of rows) if (r.brier !== null) r.rank = ++k;
  const kindIds = [...new Set(FORECASTERS.map((f) => f.kind))];
  const kinds = kindIds.map((kind) => {
    const m = rows.filter((r) => !r.you && FORECASTERS.find((f) => f.id === r.id)!.kind === kind);
    return { kind, label: KIND_LABEL[kind], count: m.length, brier: mean(m.map((r) => r.brier ?? 0)), influence: mean(m.map((r) => r.influence)) };
  });
  const history = released
    ? [...base.influenceHistory, { q: LIVE_QUARTER(), byKind: Object.fromEntries(kinds.map((x) => [x.kind, x.influence])) as Record<Kind, number> }]
    : base.influenceHistory;
  return {
    released, rows, eta: ETA, history, kinds,
    track: { questions: base.stats.questions, from: base.stats.perQuarter[0].q, to: base.stats.perQuarter[base.stats.perQuarter.length - 1].q, quarters: base.stats.perQuarter.length },
    influenceMax: INFLUENCE_MAX,
    baselines: { coin: base.stats.brierCoin, baseRate: base.stats.brierBaseRate, market: base.stats.brierLmsr, weighted: base.stats.brierWeightedMean, unweighted: base.stats.brierUnweighted },
  };
}
