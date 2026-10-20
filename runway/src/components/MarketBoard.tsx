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
const RANGES = [{ id: "15m", label: "15 min", s: 900 }, { id: "1h", label: "1 hour", s: 3600 }, { id: "all", label: "All", s: 21600 + 3600 }] as const;
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function MarketBoard({ event }: { event: EventView }) {
  const { act, busy, refresh, view } = useApp();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [sel, setSel] = useState(1);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("25");
  const [range, setRange] = useState<"15m" | "1h" | "all">("1h");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  const maxOrder = view?.world.you.maxOrder ?? 500;

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

  const chart = useMemo(() => {
    if (!feed || !cur) return null;
    const win = RANGES.find((r) => r.id === range)!.s;
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
  const held = side === "yes" ? cur.position.yes : cur.position.no;
  const amt = Math.max(0, Number(amount) || 0);
  const q = mode === "buy" ? quoteBuy(price, side, amt) : quoteSell(price, side, Math.min(amt, held));
  const tooBig = mode === "buy" && amt > maxOrder;
  const insufficient = mode === "buy" ? amt > feed.balance + 1e-6 : amt > held + 1e-6;
  const canPlace = !settled && !busy && amt > 0 && !insufficient && !tooBig && q.shares > 0.0001;
  const hasPos = cur.position.yes > 1e-6 || cur.position.no > 1e-6;
  const dChange = Math.round(cur.change1h * 100);

  const place = async () => {
    setMsg(null);
    const r = await act("order", { market: cur.id, side, action: mode, amount: amt });
    if (!r) { setMsg({ ok: false, text: "That order could not be placed." }); return; }
    setMsg({ ok: true, text: mode === "buy" ? `Bought ${q.shares.toFixed(1)} ${side === "yes" ? "Yes" : "No"} for ${q.points.toFixed(1)} points, ${cents(q.avg)} each on average.` : `Sold ${q.shares.toFixed(1)} ${side === "yes" ? "Yes" : "No"} for ${q.points.toFixed(1)} points.` });
    reload(); await refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <Card tone="raised">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm text-muted">{cur.label}{cur.label === strikes[1]?.label ? " · headline line" : ""}</p>
            {settled ? <Chip tone={cur.settled?.outcome ? "rise" : "fall"}>Settled: {cur.settled?.outcome ? "Yes" : "No"}</Chip> : <DemoLabel />}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="num text-[2.5rem] leading-none" aria-live="polite">{pct(yesP)}</p>
            <p className="pb-1 text-sm text-muted">chance of Yes</p>
            {!settled && <p className={`num pb-1 text-sm ${dChange >= 0 ? "text-rise" : "text-fall"}`} title="Change over the last hour">{dChange >= 0 ? "+" : "−"}{Math.abs(dChange)} in the last hour</p>}
          </div>
          <div className="mt-3 h-56" role="img" aria-label={`Price history of ${cur.label}, now ${pct(yesP)}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ left: -8, right: 4, top: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis type="number" dataKey="x" domain={[chart.from, chart.to]} tickFormatter={clock} tick={{ fontSize: 11, fill: "var(--muted)" }} tickCount={4} allowDataOverflow axisLine={false} tickLine={false} />
                <YAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "var(--muted)" }} orientation="right" width={40} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Chance"]} labelFormatter={(x) => clock(Number(x))} contentStyle={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 12 }} />
                {chart.others.map((o) => <Line key={o.i} data={o.d} dataKey="p" type="stepAfter" stroke="var(--control)" strokeWidth={1.25} dot={false} isAnimationActive={false} />)}
                <Line data={chart.sel} dataKey="p" type="stepAfter" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                {cur.executions.map((e) => <ReferenceDot key={e.orderId} x={feed.clockStart + e.t * 1000} y={e.priceAfter * 100} r={5} fill="var(--ink)" stroke="var(--raised)" />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="num text-xs text-muted">{Math.round(cur.volume).toLocaleString()} points traded in {cur.trades.toLocaleString()} trades. Black dots are your orders.</p>
            <div role="tablist" aria-label="Chart range" className="flex gap-1">
              {RANGES.map((r) => <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)} className={`press min-h-9 rounded-full px-3 text-xs ${range === r.id ? "bg-surface2 font-medium" : "text-muted hover:bg-surface"}`}>{r.label}</button>)}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold">Pick a line to trade</h2>
          <ul className="space-y-1.5">
            {strikes.map((s, i) => {
              const yes = s.settled ? (s.settled.outcome ? 1 : 0) : s.price;
              const active = i === sel;
              const pos = s.position.yes > 1e-6 || s.position.no > 1e-6;
              return (
                <li key={s.id} className={`rounded-2xl px-4 py-3 ${active ? "bg-raised ring-1 ring-ink/15" : "bg-surface2/60"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => setSel(i)} className="press min-w-0 flex-1 text-left" aria-pressed={active}>
                      <p className="font-medium leading-snug">{s.label}</p>
                      <p className="text-xs text-muted">{pos ? `You hold ${s.position.yes > 1e-6 ? `${s.position.yes.toFixed(0)} Yes` : ""}${s.position.yes > 1e-6 && s.position.no > 1e-6 ? ", " : ""}${s.position.no > 1e-6 ? `${s.position.no.toFixed(0)} No` : ""}` : i === 1 ? "Headline line: scores your accuracy" : "Extra line"}</p>
                    </button>
                    <p className="num text-xl">{pct(yes)}</p>
                  </div>
                  {s.settled ? (
                    <div className="mt-2"><Chip tone={s.settled.outcome ? "rise" : "fall"}>{s.settled.outcome ? "Yes won" : "No won"}</Chip></div>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button onClick={() => { setSel(i); setSide("yes"); setMode("buy"); }} className="press min-h-10 rounded-full bg-risesoft px-3 text-sm font-medium text-rise">Yes {cents(s.price)}</button>
                      <button onClick={() => { setSel(i); setSide("no"); setMode("buy"); }} className="press min-h-10 rounded-full bg-fallsoft px-3 text-sm font-medium text-fall">No {cents(1 - s.price)}</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-muted">{event.reason}</p>
          <div className="mt-2"><SourceChip name={event.source.name} date={`settles on ${event.settles}`} url={event.source.url} /></div>
        </Card>
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card tone="raised">
          <div className="flex items-center justify-between gap-2">
            <div role="tablist" aria-label="Order type" className="inline-flex rounded-full bg-surface2 p-1">
              {(["buy", "sell"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setMsg(null); setAmount(m === "sell" ? String(Math.floor(held)) : "25"); }}
                  className={`press min-h-9 rounded-full px-4 text-sm ${mode === m ? "bg-raised font-medium" : "text-muted"}`}>{m === "buy" ? "Buy" : "Sell"}</button>
              ))}
            </div>
            <p className="num text-sm text-muted">{feed.balance.toFixed(0)} points</p>
          </div>
          <p className="mt-4 font-medium leading-snug">{cur.label}</p>

          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Side">
            {(["yes", "no"] as const).map((s) => {
              const p = s === "yes" ? yesP : 1 - yesP;
              const on = side === s;
              return <button key={s} aria-pressed={on} disabled={settled}
                onClick={() => { setSide(s); setMsg(null); if (mode === "sell") setAmount(String(Math.floor(s === "yes" ? cur.position.yes : cur.position.no))); }}
                className={`press min-h-12 rounded-full text-sm font-medium ${on ? (s === "yes" ? "bg-rise text-white" : "bg-fall text-white") : "bg-surface2"}`}>{s === "yes" ? "Yes" : "No"} {cents(p)}</button>;
            })}
          </div>

          <label className="mt-4 block text-sm">
            {mode === "buy" ? `Points to spend (up to ${maxOrder})` : `Contracts to sell (you hold ${held.toFixed(1)})`}
            <input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setMsg(null); }} disabled={settled}
              className="num mt-1 min-h-12 w-full rounded-2xl border border-control bg-raised px-4 text-right text-xl" />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(mode === "buy" ? [10, 25, 50, 100] : [0.25, 0.5, 1]).map((v) => (
              <button key={v} disabled={settled} onClick={() => setAmount(mode === "buy" ? String(Math.min(v, Math.floor(feed.balance))) : String(Math.floor(held * v * 10) / 10))}
                className="press min-h-9 rounded-full bg-surface2 px-3 text-xs">{mode === "buy" ? `${v}` : v === 1 ? "All" : `${v * 100}%`}</button>
            ))}
          </div>

          <dl className="num mt-4 space-y-1.5 text-sm">
            <Row k={mode === "buy" ? "Average price" : "Average sale price"} v={q.shares > 0 ? cents(q.avg) : "–"} />
            <Row k="Contracts" v={q.shares > 0 ? q.shares.toFixed(1) : "–"} />
            {mode === "buy" ? <Row k="Paid out if right" v={q.shares > 0 ? `${q.maxPayout.toFixed(1)} points` : "–"} strong /> : <Row k="You receive" v={q.shares > 0 ? `${q.points.toFixed(1)} points` : "–"} strong />}
            <Row k="Price moves" v={q.shares > 0 ? `${cents(side === "yes" ? q.priceBefore : 1 - q.priceBefore)} to ${cents(side === "yes" ? q.priceAfter : 1 - q.priceAfter)}` : "–"} />
          </dl>
          <div className="mt-4">
            <Btn onClick={place} disabled={!canPlace} className="min-h-12 w-full text-base">
              {settled ? "Market settled" : tooBig ? `Up to ${maxOrder} points per order` : insufficient ? (mode === "buy" ? "Not enough points" : "Not enough contracts") : `${mode === "buy" ? "Buy" : "Sell"} ${side === "yes" ? "Yes" : "No"}`}
            </Btn>
          </div>
          {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-rise" : "text-negative"}`}>{msg.text}</p>}
          <p className="mt-3 text-xs text-muted">A contract pays 1 point if you are right and nothing if not. Points only, never money.</p>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Your position</h2>
          {!hasPos && !cur.settled && cur.executions.length === 0 && <p className="mt-1 text-sm text-muted">None on this line yet.</p>}
          {cur.position.yes > 1e-6 && <p className="num mt-2 text-sm">{cur.position.yes.toFixed(1)} Yes at {cents(cur.position.avgYes ?? 0)} on average</p>}
          {cur.position.no > 1e-6 && <p className="num mt-1 text-sm">{cur.position.no.toFixed(1)} No at {cents(cur.position.avgNo ?? 0)} on average</p>}
          {hasPos && !settled && <p className="num mt-2 text-sm text-muted">Worth {cur.position.value.toFixed(1)} points now ({cur.position.unrealised >= 0 ? "+" : "−"}{Math.abs(cur.position.unrealised).toFixed(1)} on what you paid)</p>}
          {cur.settled && <p className="num mt-2 text-sm font-medium">Result: {cur.settled.pnl >= 0 ? "+" : "−"}{Math.abs(cur.settled.pnl).toFixed(1)} points ({cur.settled.payout.toFixed(1)} paid out)</p>}
          {cur.executions.length > 0 && (
            <ul className="num mt-3 space-y-1 text-xs text-muted">
              {cur.executions.map((e) => <li key={e.orderId}>{clock(feed.clockStart + e.t * 1000)}: {e.action === "buy" ? "bought" : "sold"} {e.shares.toFixed(1)} {e.side === "yes" ? "Yes" : "No"} at {cents(e.avg)}</li>)}
            </ul>
          )}
          <p className="num mt-3 text-xs text-muted">Prices update every few seconds. Last update {clock(feed.serverNow)}.</p>
        </Card>
      </aside>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className={`text-right ${strong ? "text-lg" : ""}`}>{v}</dd></div>;
}
