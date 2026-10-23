import { cost, newMarket, price as lprice, tradeToward, type Lmsr } from "./lmsr";
import { clamp, gaussian, hashString, logit, mulberry32, sigmoid } from "./math";
import { FORECASTERS, runMarket, type MarketRun, type Weights } from "./market";
import type { Question } from "./questions";
import { moveAllowance, moveLimit } from "../market-math";

// A market's "tape": every trade in time order, so the chart can move in real time.
//  - history (t < 0): the ~200 simulated forecasters' opening trades, spread over the last 6 hours
//  - live (t >= 0): simulated forecasters keep re-trading as they update their views, about one trade every 6 seconds
//  - your orders are merged in at the moment you placed them, and move the price for everyone
// Everything is a deterministic function of (question, influence weights, your orders, now): no hidden randomness.

export const HISTORY_SECONDS = 6 * 3600;
const LIVE_EVENTS = 700; // generated up front; more are added on demand as the session clock runs (see extendLive)
const MEAN_GAP = 6; // seconds between simulated live trades
const LIVE_LIMIT_S = 7 * 24 * 3600; // simulated players keep trading for a week of session time
export const TAPE_LIQUIDITY = 200; // depth of the live market: a 25-point order moves a mid-priced contract by about 6 cents
const HIST_PULL = 0.06; // opening trades move the price 6% of the way to each forecaster's view
const LIVE_PULL = 0.09; // each live trade moves the price 5% of the way to that forecaster's view, so your order's impact fades slowly

export type Order = { id: string; market: string; t: number; side: "yes" | "no"; action: "buy" | "sell"; amount: number };
export type Execution = {
  orderId: string; market: string; t: number; side: "yes" | "no"; action: "buy" | "sell";
  shares: number; points: number; avg: number; priceBefore: number; priceAfter: number;
};
export type TapePoint = { t: number; p: number; by: "agent" | "you" };
export type Position = { yes: number; no: number; yesCost: number; noCost: number; realised: number };
export type TapeResult = {
  series: TapePoint[]; price: number; hourAgo: number; opening: number; volume: number;
  executions: Execution[]; position: Position; trades: number; nowT: number;
  agents?: Record<string, { yes: number; no: number; spent: number }>;
};

type LiveEvent = { t: number; agent: string; target: number; budget: number };
type HistEvent = { agent: string; side: "yes" | "no"; shares: number; spent: number; price: number };
type Prepared = { run: MarketRun; histState: Lmsr; hist: TapePoint[]; histEvents: HistEvent[]; live: LiveEvent[]; next: () => LiveEvent };
const cache = new Map<string, Prepared>();

function prepare(q: Question, w: Weights, wkey: string): Prepared {
  const key = `${q.id}|${wkey}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const run = runMarket(q, w);
  const hm = newMarket(TAPE_LIQUIDITY);
  const histEvents: HistEvent[] = [];
  for (const e of run.events) {
    const cur = lprice(hm);
    const tr = tradeToward(hm, cur + HIST_PULL * (run.beliefs[e.agent] - cur), 25 * (w[e.agent] ?? 1));
    if (tr) histEvents.push({ agent: e.agent, side: tr.side, shares: tr.shares, spent: tr.spent, price: lprice(hm) });
  }
  const n = histEvents.length;
  const rngT = mulberry32(hashString(`hist|${q.id}`));
  const histT = histEvents.map((_, i) => {
    const u = (i + 1) / (n + 1);
    return -60 - (HISTORY_SECONDS - 60) * Math.pow(1 - u, 1.35) + (rngT() - 0.5) * 30;
  }).sort((a, b) => a - b);
  const hist: TapePoint[] = [{ t: -HISTORY_SECONDS, p: 0.5, by: "agent" }, ...histEvents.map((e, i) => ({ t: histT[i], p: e.price, by: "agent" as const }))];
  const rng = mulberry32(hashString(`live|${q.id}`));
  const live: LiveEvent[] = [];
  let t = 0;
  // The same seeded stream continues past the first batch, so the tape stays deterministic however long it runs.
  const next = (): LiveEvent => {
    t += -Math.log(Math.max(rng(), 1e-9)) * MEAN_GAP;
    const f = FORECASTERS[Math.floor(rng() * FORECASTERS.length)];
    const target = clamp(sigmoid(logit(run.beliefs[f.id]) + 0.8 * gaussian(rng)), 0.03, 0.97);
    return { t, agent: f.id, target, budget: 8 * (w[f.id] ?? 1) };
  };
  for (let i = 0; i < LIVE_EVENTS; i++) live.push(next());
  const p: Prepared = { run, histState: { ...hm }, hist, histEvents, live, next };
  cache.set(key, p);
  if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  return p;
}

const withShares = (m: Lmsr, side: "yes" | "no", s: number): Lmsr => (side === "yes" ? { ...m, qy: m.qy + s } : { ...m, qn: m.qn + s });

function sharesForPoints(m: Lmsr, side: "yes" | "no", points: number): number {
  let lo = 0, hi = 1;
  while (cost(withShares(m, side, hi)) - cost(m) < points && hi < 1e7) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (cost(withShares(m, side, mid)) - cost(m) > points) hi = mid; else lo = mid;
  }
  return lo;
}

// Without this the simulated players stopped after their first ~70 minutes and every chart went flat.
function extendLive(prep: Prepared, nowT: number) {
  const until = Math.min(nowT, LIVE_LIMIT_S);
  while (prep.live[prep.live.length - 1].t < until) prep.live.push(prep.next());
}

export function runTape(q: Question, w: Weights, wkey: string, orders: Order[], nowT: number, collectAgents = false): TapeResult {
  const prep = prepare(q, w, wkey);
  extendLive(prep, nowT);
  const m: Lmsr = { ...prep.histState };
  const series = [...prep.hist];
  const executions: Execution[] = [];
  const pos: Position = { yes: 0, no: 0, yesCost: 0, noCost: 0, realised: 0 };
  let volume = prep.histEvents.reduce((a, e) => a + e.spent, 0);
  let trades = prep.histEvents.length;
  const agents: Record<string, { yes: number; no: number; spent: number }> = {};
  const note = (id: string, side: "yes" | "no", shares: number, spent: number) => {
    const a = (agents[id] ??= { yes: 0, no: 0, spent: 0 });
    a[side] += shares; a.spent += spent;
  };
  if (collectAgents) for (const e of prep.histEvents) note(e.agent, e.side, e.shares, e.spent);

  const mine = orders.filter((o) => o.market === q.id && o.t <= nowT).sort((a, b) => a.t - b.t);
  let oi = 0;
  const applyOrder = (o: Order) => {
    const before = lprice(m);
    let shares = 0, points = 0;
    if (o.action === "buy") {
      // One prediction may move the price by at most MAX_MOVE; points beyond that stay with the player.
      const cap = Math.max(0, Math.abs(m.b * logit(moveLimit(before, o.side, moveAllowance(executions, o.t))) - (m.qy - m.qn)));
      shares = Math.min(sharesForPoints(m, o.side, Math.max(0, o.amount)), cap);
      points = cost(withShares(m, o.side, shares)) - cost(m);
      if (o.side === "yes") { m.qy += shares; pos.yes += shares; pos.yesCost += points; } else { m.qn += shares; pos.no += shares; pos.noCost += points; }
    } else {
      const held = o.side === "yes" ? pos.yes : pos.no;
      shares = Math.min(Math.max(0, o.amount), held);
      if (shares <= 1e-9) return;
      points = cost(m) - cost(withShares(m, o.side, -shares));
      const avgCost = (o.side === "yes" ? pos.yesCost / pos.yes : pos.noCost / pos.no) || 0;
      pos.realised += points - avgCost * shares;
      if (o.side === "yes") { m.qy -= shares; pos.yes -= shares; pos.yesCost -= avgCost * shares; } else { m.qn -= shares; pos.no -= shares; pos.noCost -= avgCost * shares; }
    }
    if (shares <= 1e-9) return;
    volume += points; trades++;
    const after = lprice(m);
    executions.push({ orderId: o.id, market: q.id, t: o.t, side: o.side, action: o.action, shares, points, avg: points / shares, priceBefore: before, priceAfter: after });
    series.push({ t: o.t, p: after, by: "you" });
  };

  for (const e of prep.live) {
    if (e.t > nowT) break;
    while (oi < mine.length && mine[oi].t <= e.t) applyOrder(mine[oi++]);
    const now = lprice(m);
    const tr = tradeToward(m, now + LIVE_PULL * (e.target - now), e.budget);
    if (tr) {
      volume += tr.spent; trades++;
      series.push({ t: e.t, p: lprice(m), by: "agent" });
      if (collectAgents) note(e.agent, tr.side, tr.shares, tr.spent);
    }
  }
  while (oi < mine.length) applyOrder(mine[oi++]);

  const price = lprice(m);
  const at = nowT - 3600;
  let hourAgo = series[0].p;
  for (const pt of series) { if (pt.t <= at) hourAgo = pt.p; else break; }
  return { series, price, hourAgo, opening: 0.5, volume, executions, position: pos, trades, nowT, agents: collectAgents ? agents : undefined };
}

export const baseRun = (q: Question, w: Weights, wkey: string) => prepare(q, w, wkey).run;
