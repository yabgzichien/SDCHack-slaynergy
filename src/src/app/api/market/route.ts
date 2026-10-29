import { NextResponse } from "next/server";
import { computeWorld } from "@/lib/engine/world";
import { series } from "@/lib/engine/data";
import { ladder } from "@/lib/engine/questions";
import { liveQuestions, replayHistory } from "@/lib/engine/replay";
import { updateWeights } from "@/lib/engine/market";
import { baseRun, runTape } from "@/lib/engine/tape";
import { getSessionId } from "@/lib/server/session";
import { loadState, saveState } from "@/lib/server/store";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";
// A background data refresh (run with after()) can take up to a minute: each source fetch has a 60 s timeout.
export const maxDuration = 60;

// Live chart feed for one event: every strike's price history plus the latest trades. The client polls this every few seconds.
export async function GET(req: Request) {
  await ensureData();
  const sid = (await getSessionId())!;
  let state = await loadState(sid);
  if (!state.clock) { state = { ...state, clock: { t0: new Date().toISOString() } }; await saveState(sid, state); }
  const released = state.release === 1;
  const url = new URL(req.url);
  const w = computeWorld(state);
  const ev = w.events.find((e) => e.id === url.searchParams.get("event")) ?? w.settledEvents.find((e) => e.id === url.searchParams.get("event"));
  if (!ev) return NextResponse.json({ error: "Unknown event." }, { status: 404 });

  const base = replayHistory();
  const isSettledPhase = ev.phase === "live" && released;
  const live = liveQuestions("live");
  const baseRuns0 = live.map((q) => baseRun(ladder(q)[1], base.weights, "W0"));
  const fw = series.market.tapeWeights?.[ev.id];
  const W = fw ?? (ev.phase === "next" ? updateWeights(base.weights, baseRuns0) : base.weights);
  const wkey = fw ? "F" : ev.phase === "next" ? "W1" : "W0";
  const q = (ev.phase === "next" ? liveQuestions("next") : live).find((x) => x.id === ev.id)!;
  const nowT = ev.nowT;

  const strikes = ladder(q).map((s) => {
    const t = runTape(s, W, wkey, state.orders, nowT);
    const view = ev.strikes.find((x) => x.marketId === s.id)!;
    const keep = t.series.filter((pt, i) => pt.t >= -1800 || pt.by === "you" || i % 3 === 0 || i === t.series.length - 1);
    return {
      id: s.id, label: s.label, series: keep.map((pt) => [Math.round(pt.t), +pt.p.toFixed(4), pt.by === "you" ? 1 : 0]),
      price: view.price, close: view.close, change1h: view.change1h, volume: view.volume, trades: view.trades,
      position: view.position, executions: view.executions, settled: view.settled,
    };
  });
  return NextResponse.json({ event: ev.id, phase: ev.phase, settled: isSettledPhase, nowT, clockStart: ev.clockStart, serverNow: Date.now(), strikes, balance: w.user.balance });
}
