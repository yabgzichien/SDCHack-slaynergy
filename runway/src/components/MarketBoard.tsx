"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventView } from "@/lib/engine/world";
import { quoteBuy, quoteSell } from "@/lib/market-math";
import { useApp } from "./AppProvider";
import { Btn, Card, Chip, DemoLabel, SourceChip } from "./ui";

type Execution = { orderId: string; t: number; side: "yes" | "no"; action: "buy" | "sell"; shares: number; points: number; avg: number; priceBefore: number; priceAfter: number };
type Strike = {
  id: string; label: string; series: [number, number, number][]; price: number; close: number; change1h: number; volume: number; trades: number;
  position: { yes: number; no: number; avgYes: number | null; avgNo: number | null; value: number; unrealised: number; realised: number };
  executions: Execution[]; settled: null | { outcome: boolean; payout: number; pnl: number };
};
type Feed = { event: string; settled: boolean; nowT: number; clockStart: number; serverNow: number; strikes: Strike[]; balance: number };

const cents = (p: number) => `${Math.round(p * 100)}¢`;
const pct = (p: number) => `${Math.round(p * 100)}%`;
const RANGES = [{ id: "15m", label: "15M", s: 900 }, { id: "1h", label: "1H", s: 3600 }, { id: "all", label: "ALL", s: 21600 + 3600 }] as const;
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function MarketBoard({ event }: { event: EventView }) {
  const { act, busy, refresh } = useApp();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [sel, setSel] = useState(1);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("25");
  const [range, setRange] = useState<"15m" | "1h" | "all">("1h");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((x) => x + 1), []);

  useEffect(() => {
    let on = true;
    const pull = async () => {
      try {
        const r = await fetch(`/api/market?event=${encodeURIComponent(event.id)}`, { cache: "no-store" });
        if (r.ok) { const d = await r.json(); if (on) setFeed(d); }
      } catch { /* keep the last picture */ }
    };
    pull();
    if (event.settled) return () => { on = false; };
    const id = window.setInterval(() => { if (document.visibilityState === "visible") pull(); }, 3000);
    return () => { on = false; window.clearInterval(id); };
  }, [event.id, event.settled, tick]);

  const strikes = useMemo(() => feed?.strikes ?? [], [feed]);
  const cur = strikes[sel];
  const settled = !!feed?.settled;
  const nowMs = feed ? feed.clockStart + feed.nowT * 1000 : 0;

  const chart = useMemo(() => {
    if (!feed || !cur) return null;
    const win = (RANGES.find((r) => r.id === range)!.s);
    const from = feed.nowT - win;
    const toData = (s: Strike) => {
      const pts = s.series.map(([t, p]) => ({ x: feed.clockStart + t * 1000, p: p * 100, t }));
      const first = pts.findIndex((q) => q.t >= from);
      const vis = first <= 0 ? pts : pts.slice(first - 1);
      const lastP = settled ? (s.settled?.outcome ? 100 : 0) : vis.length ? vis[vis.length - 1].p : 50;
      return [...vis, { x: feed.clockStart + feed.nowT * 1000, p: lastP, t: feed.nowT }];
    };
    return { sel: toData(cur), others: strikes.map((s, i) => ({ i, d: toData(s) })).filter((o) => o.i !== sel), from: feed.clockStart + Math.max(from, -21600) * 1000, to: feed.clockStart + feed.nowT * 1000 };
  }, [feed, cur, strikes, sel, range, settled]);

  if (!feed || !cur || !chart) return <Card><p className="text-sm text-muted">Opening the market…</p></Card>;

  const price = cur.price;
  const yesP = settled ? (cur.settled?.outcome ? 1 : 0) : price;
  const sidePrice = side === "yes" ? yesP : 1 - yesP;
  const held = side === "yes" ? cur.position.yes : cur.position.no;
  const amt = Math.max(0, Number(amount) || 0);
  const q = mode === "buy" ? quoteBuy(price, side, amt) : quoteSell(price, side, Math.min(amt, held));
  const insufficient = mode === "buy" ? amt > feed.balance + 1e-6 : amt > held + 1e-6;
  const canPlace = !settled && !busy && amt > 0 && !insufficient && q.shares > 0.0001;
  const hasPos = cur.position.yes > 1e-6 || cur.position.no > 1e-6;
  const dChange = Math.round(cur.change1h * 100);

  const place = async () => {
    setMsg(null);
    const r = await act("order", { market: cur.id, side, action: mode, amount: amt });
    if (!r) { setMsg({ ok: false, text: "That order could not be placed." }); return; }
    setMsg({ ok: true, text: mode === "buy" ? `Bought ${q.shares.toFixed(1)} ${side === "yes" ? "Yes" : "No"} for ${q.points.toFixed(1)} points (average ${cents(q.avg)}).` : `Sold ${q.shares.toFixed(1)} ${side === "yes" ? "Yes" : "No"} for ${q.points.toFixed(1)} points (average ${cents(q.avg)}).` });
    reload(); await refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xl font-bold leading-tight">{event.title}</h3>
              <p className="mt-1 text-sm text-muted">{cur.label}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {settled ? <Chip tone={cur.settled?.outcome ? "rise" : "fall"}>Settled: {cur.settled?.outcome ? "Yes" : "No"}</Chip> : <Chip tone="rise"><span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-rise" /> Live</Chip>}
              <DemoLabel />
            </div>
          </div>

          <div className="mt-3 flex items-end gap-3">
            <p className="num text-4xl font-extrabold tracking-tight" aria-live="polite">{pct(yesP)}</p>
            <p className="pb-1 text-sm text-muted">chance of Yes</p>
            {!settled && <p className={`num pb-1 text-sm font-semibold ${dChange >= 0 ? "text-rise" : "text-fall"}`} title="Change over the last hour">{dChange >= 0 ? "▲" : "▼"} {Math.abs(dChange)} pts in 1h</p>}
          </div>

          <div className="mt-2 h-60" role="img" aria-label={`Price history of ${cur.label}, currently ${pct(yesP)}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ left: -8, right: 12, top: 8 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
                <XAxis type="number" dataKey="x" domain={[chart.from, chart.to]} tickFormatter={clock} tick={{ fontSize: 11, fill: "var(--muted)" }} tickCount={5} allowDataOverflow />
                <YAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "var(--muted)" }} orientation="right" width={40} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Chance"]} labelFormatter={(x) => clock(Number(x))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12 }} />
                {chart.others.map((o) => <Line key={o.i} data={o.d} dataKey="p" type="stepAfter" stroke="var(--muted)" strokeOpacity={0.45} strokeWidth={1.25} dot={false} isAnimationActive={false} />)}
                <Line data={chart.sel} dataKey="p" type="stepAfter" stroke="var(--accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                {cur.executions.map((e) => <ReferenceDot key={e.orderId} x={feed.clockStart + e.t * 1000} y={e.priceAfter * 100} r={5} fill="var(--fast)" stroke="var(--surface)" />)}
                {!settled && <ReferenceDot x={chart.to} y={chart.sel[chart.sel.length - 1].p} r={5} fill="var(--accent)" stroke="var(--surface)" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="num text-xs text-muted">{Math.round(cur.volume).toLocaleString()} points traded · {cur.trades.toLocaleString()} trades · orange dots are your orders</p>
            <div role="tablist" aria-label="Chart range" className="flex gap-1">
              {RANGES.map((r) => <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)} className={`press min-h-9 rounded-full px-3 text-xs font-bold ${range === r.id ? "bg-ink text-bg" : "text-muted hover:bg-surface2"}`}>{r.label}</button>)}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2"><SourceChip name={event.source.name} date={`settles on ${event.settles}`} url={event.source.url} /></div>
          <p className="mt-2 text-sm text-muted">{event.reason}</p>
        </Card>

        <Card className="p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted"><span>Strike</span><span>Chance · price to buy</span></div>
          <ul>
            {strikes.map((s, i) => {
              const yes = s.settled ? (s.settled.outcome ? 1 : 0) : s.price;
              const d = Math.round(s.change1h * 100);
              const active = i === sel;
              return (
                <li key={s.id} className={`flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-b-0 ${active ? "bg-accentsoft" : ""}`}>
                  <button onClick={() => setSel(i)} className="press min-w-0 flex-1 text-left" aria-pressed={active}>
                    <p className="font-semibold leading-tight">{s.label}</p>
                    <p className="text-xs text-muted">{s.position.yes > 1e-6 || s.position.no > 1e-6 ? `You hold ${s.position.yes > 1e-6 ? `${s.position.yes.toFixed(0)} Yes` : ""}${s.position.yes > 1e-6 && s.position.no > 1e-6 ? " · " : ""}${s.position.no > 1e-6 ? `${s.position.no.toFixed(0)} No` : ""}` : "Tap to see this strike"}</p>
                  </button>
                  <div className="text-right">
                    <p className="num text-2xl font-extrabold leading-none">{pct(yes)}</p>
                    {!s.settled && <p className={`num text-xs font-semibold ${d >= 0 ? "text-rise" : "text-fall"}`}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)}</p>}
                  </div>
                  {s.settled ? <Chip tone={s.settled.outcome ? "rise" : "fall"}>{s.settled.outcome ? "Yes won" : "No won"}</Chip> : (
                    <div className="flex gap-2">
                      <button onClick={() => { setSel(i); setSide("yes"); setMode("buy"); }} className="press min-h-10 min-w-[5.2rem] rounded-full border border-rise/60 bg-risesoft px-3 text-sm font-bold text-rise">Yes {cents(s.price)}</button>
                      <button onClick={() => { setSel(i); setSide("no"); setMode("buy"); }} className="press min-h-10 min-w-[5.2rem] rounded-full border border-fall/60 bg-fallsoft px-3 text-sm font-bold text-fall">No {cents(1 - s.price)}</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <div className="flex items-center justify-between">
            <div role="tablist" aria-label="Order type" className="flex gap-4">
              {(["buy", "sell"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setMsg(null); setAmount(m === "sell" ? String(Math.floor(held)) : "25"); }}
                  className={`press min-h-10 text-sm font-extrabold uppercase tracking-wider ${mode === m ? "text-ink" : "text-muted"}`}>{m}</button>
              ))}
            </div>
            <p className="num text-sm text-muted">{feed.balance.toFixed(0)} points</p>
          </div>
          <p className="mt-3 text-sm text-muted">{event.title}</p>
          <p className="text-lg font-bold leading-tight">{cur.label}</p>

          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Side">
            {(["yes", "no"] as const).map((s) => {
              const p = s === "yes" ? yesP : 1 - yesP;
              const on = side === s;
              const tone = s === "yes" ? "border-rise bg-rise text-white" : "border-fall bg-fall text-white";
              return <button key={s} aria-pressed={on} onClick={() => { setSide(s); setMsg(null); if (mode === "sell") setAmount(String(Math.floor(s === "yes" ? cur.position.yes : cur.position.no))); }} disabled={settled}
                className={`press min-h-12 rounded-2xl border-2 px-3 text-sm font-extrabold ${on ? tone : "border-line bg-surface text-ink"}`}>{s === "yes" ? "YES" : "NO"} {cents(p)}</button>;
            })}
          </div>

          <label className="mt-4 block text-sm font-medium">
            {mode === "buy" ? "Points to spend" : `Contracts to sell (you hold ${held.toFixed(1)})`}
            <input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setMsg(null); }} disabled={settled}
              className="num mt-1 min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-right text-xl font-bold" aria-label={mode === "buy" ? "Points to spend" : "Contracts to sell"} />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(mode === "buy" ? [10, 25, 50, 100] : [0.25, 0.5, 1]).map((v) => (
              <button key={v} onClick={() => setAmount(mode === "buy" ? String(Math.min(v, Math.floor(feed.balance))) : String(Math.floor(held * v * 10) / 10))} disabled={settled}
                className="press min-h-9 rounded-full border border-line bg-surface px-3 text-xs font-semibold">{mode === "buy" ? `+${v}` : v === 1 ? "All" : `${v * 100}%`}</button>
            ))}
          </div>

          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <Row k="Chance" v={pct(sidePrice)} />
            <Row k={mode === "buy" ? "Average price" : "Average sale price"} v={q.shares > 0 ? cents(q.avg) : "–"} />
            <Row k={mode === "buy" ? "Contracts" : "Contracts sold"} v={q.shares > 0 ? q.shares.toFixed(1) : "–"} />
            {mode === "buy" ? (<>
              <Row k="Max payout" v={q.shares > 0 ? `${q.maxPayout.toFixed(1)} points` : "–"} strong />
              <Row k="Profit if right" v={q.shares > 0 ? `+${q.profit.toFixed(1)} points` : "–"} />
            </>) : <Row k="You receive" v={q.shares > 0 ? `${q.points.toFixed(1)} points` : "–"} strong />}
            <Row k="Price moves" v={q.shares > 0 ? `${cents(side === "yes" ? q.priceBefore : 1 - q.priceBefore)} → ${cents(side === "yes" ? q.priceAfter : 1 - q.priceAfter)}` : "–"} />
          </dl>
          <p className="mt-2 text-xs text-muted">Each contract pays 1 point if you are right and 0 if not. Points only, never money.</p>

          <div className="mt-3">
            <Btn onClick={place} disabled={!canPlace} className="w-full min-h-12 text-base">
              {settled ? "Market settled" : insufficient ? (mode === "buy" ? "Not enough points" : "Not enough contracts") : mode === "buy" ? `Buy ${side === "yes" ? "Yes" : "No"}` : `Sell ${side === "yes" ? "Yes" : "No"}`}
            </Btn>
          </div>
          {msg && <p role="status" className={`mt-2 rounded-xl p-2 text-sm ${msg.ok ? "bg-risesoft text-rise" : "bg-fallsoft text-fall"}`}>{msg.text}</p>}
        </Card>

        <Card tone={hasPos || cur.settled ? "accent" : undefined}>
          <h4 className="font-bold">Your position</h4>
          {!hasPos && !cur.settled && cur.executions.length === 0 && <p className="mt-1 text-sm text-muted">You have no contracts here yet. Buy Yes or No, or sell later to take profit.</p>}
          {cur.position.yes > 1e-6 && <p className="num mt-2 text-sm"><b>{cur.position.yes.toFixed(1)} Yes</b> at {cents(cur.position.avgYes ?? 0)} average</p>}
          {cur.position.no > 1e-6 && <p className="num mt-1 text-sm"><b>{cur.position.no.toFixed(1)} No</b> at {cents(cur.position.avgNo ?? 0)} average</p>}
          {hasPos && !settled && <p className="num mt-2 text-sm text-muted">Worth {cur.position.value.toFixed(1)} points now · {cur.position.unrealised >= 0 ? "+" : ""}{cur.position.unrealised.toFixed(1)} unrealised</p>}
          {cur.settled && <p className="num mt-2 text-sm font-bold">Result: {cur.settled.pnl >= 0 ? "+" : ""}{cur.settled.pnl.toFixed(1)} points ({cur.settled.payout.toFixed(1)} paid out)</p>}
          {cur.executions.length > 0 && (
            <details className="mt-2">
              <summary className="min-h-9 cursor-pointer py-1 text-sm font-semibold text-accent">Your orders ({cur.executions.length})</summary>
              <ul className="num mt-1 space-y-1 text-xs">
                {cur.executions.map((e) => <li key={e.orderId} className="rounded-lg bg-surface2 px-2 py-1">{clock(feed.clockStart + e.t * 1000)} · {e.action === "buy" ? "Bought" : "Sold"} {e.shares.toFixed(1)} {e.side === "yes" ? "Yes" : "No"} at {cents(e.avg)} ({e.points.toFixed(1)} points)</li>)}
              </ul>
            </details>
          )}
        </Card>
        <p className="num text-xs text-muted">Live prices update every few seconds as simulated forecasters trade. Last update {clock(feed.serverNow)}. Chart time now {clock(nowMs)}.</p>
      </aside>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className={`num text-right ${strong ? "text-lg font-extrabold" : "font-semibold"}`}>{v}</dd></div>;
}
