"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventView } from "@/lib/engine/world";
import { MAX_PER_ANSWER, PERSON_MOVE, quoteBuy, quoteSell } from "@/lib/market-math";
import { useApp } from "./AppProvider";
import { Btn, Card, DemoLabel, FUTURE_COLOR, FUTURE_NAME, SourceChip, pct as fpct } from "./ui";
import { AnsweredBadge, AnswerStamp, OpenBadge, STRIKE_COLORS } from "./MarketCards";
import { Check, Lock } from "lucide-react";

type Execution = { orderId: string; t: number; side: "yes" | "no"; action: "buy" | "sell"; shares: number; points: number; avg: number; priceBefore: number; priceAfter: number };
type Strike = {
  id: string; label: string; series: [number, number, number][]; price: number; close: number; change1h: number; volume: number; trades: number;
  position: { yes: number; no: number; avgYes: number | null; avgNo: number | null; value: number; unrealised: number; realised: number };
  executions: Execution[]; settled: null | { outcome: boolean; payout: number; pnl: number };
};
type Feed = { event: string; settled: boolean; nowT: number; clockStart: number; serverNow: number; strikes: Strike[]; balance: number };

// One decimal on this page: a person moves the Yes % by 0.1, which a whole number would hide.
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;
const RANGES = [{ id: "15m", label: "15 min", s: 900 }, { id: "1h", label: "1 hour", s: 3600 }, { id: "all", label: "All", s: 21600 + 3600 }] as const;
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function MarketBoard({ event }: { event: EventView }) {
  const { act, busy, refresh, view } = useApp();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [sel, setSel] = useState(1);
  const [more, setMore] = useState(false);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("25");
  const [range, setRange] = useState<"15m" | "1h" | "all">("1h");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [placed, setPlaced] = useState<Execution & { market: string } | null>(null);
  const [nudge, setNudge] = useState<{ key: string; market: string; move: number } | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  const maxOrder = view?.world.you.maxOrder ?? 500;

  useEffect(() => {
    let on = true;
    const controller = new AbortController();
    let timer: number | undefined;
    const pull = async () => {
      try {
        if (document.visibilityState === "visible") {
          const r = await fetch(`/api/market?event=${encodeURIComponent(event.id)}`, { cache: "no-store", signal: controller.signal });
          if (r.ok) { const d = await r.json(); if (on) setFeed(d); }
        }
      } catch { /* keep the last picture */ }
      finally { if (on && !event.settled) timer = window.setTimeout(pull, 3000); }
    };
    pull();
    return () => { on = false; window.clearTimeout(timer); controller.abort(); };
  }, [event.id, event.settled, tick]);

  useEffect(() => {
    if (!nudge) return;
    const id = window.setTimeout(() => setNudge(null), 6000);
    return () => window.clearTimeout(id);
  }, [nudge]);

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

  if (!feed || !cur || !chart) return <Card><p className="text-sm text-muted">Loading the question…</p></Card>;

  const price = cur.price;
  const yesP = settled ? (cur.settled?.outcome ? 1 : 0) : price;
  const held = side === "yes" ? cur.position.yes : cur.position.no;
  const amt = Math.max(0, Number(amount) || 0);
  const q = mode === "buy" ? quoteBuy(price, side, amt, cur.executions) : quoteSell(price, side, Math.min(amt, held), held, cur.executions);
  const usedHere = cur.executions.filter((x) => x.action === "buy").reduce((a, x) => a + x.points, 0);
  const leftHere = Math.max(0, MAX_PER_ANSWER - usedHere);
  const tooBig = mode === "buy" && (amt > maxOrder || amt > leftHere + 1e-6);
  const insufficient = mode === "buy" ? amt > feed.balance + 1e-6 : amt > held + 1e-6;
  const canPlace = !settled && !busy && amt > 0 && !insufficient && !tooBig && q.shares > 0.0001;
  const hasPos = cur.position.yes > 1e-6 || cur.position.no > 1e-6;
  const dChange = Math.round(cur.change1h * 100);

  const place = async () => {
    setMsg(null); setPlaced(null);
    const r = await act("order", { market: cur.id, side, action: mode, amount: amt });
    if (!r) { setMsg({ ok: false, text: "Your prediction could not be placed. Please try again." }); return; }
    // What the server actually executed, so the confirmation can never disagree with the market.
    const fresh: Feed | null = await fetch(`/api/market?event=${encodeURIComponent(event.id)}`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    const done = fresh?.strikes.find((s) => s.id === cur.id)?.executions.at(-1);
    if (fresh) setFeed(fresh);
    if (done) {
      setPlaced({ ...done, market: cur.id });
      if (Math.abs(done.priceAfter - done.priceBefore) > 1e-9) setNudge({ key: done.orderId, market: cur.id, move: done.priceAfter - done.priceBefore });
    }
    reload(); await refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <Card tone="raised" className={settled ? "!bg-[#eef1f5] border-[#cfd6df]" : ""}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="flex items-center gap-2 text-sm text-muted"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: settled ? "#7b8696" : STRIKE_COLORS[sel] }} aria-hidden />{cur.label}{sel === 1 ? " · main question" : ""}</p>
            {settled ? <AnsweredBadge /> : <OpenBadge event={event} />}
          </div>
          {settled ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <AnswerStamp yes={!!cur.settled?.outcome} big />
              <p className="text-sm text-[#5b6575]">The crowd&apos;s last prediction was <span className="num font-medium">{pct(cur.close)}</span> Yes.</p>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="num text-[2.5rem] leading-none" aria-live="polite">{pct(yesP)}</p>
              {nudge?.market === cur.id && <p key={nudge.key} className={`market-nudge num mb-1 rounded-full px-2.5 py-1 text-sm font-semibold ${nudge.move > 0 ? "bg-risesoft text-rise" : "bg-fallsoft text-fall"}`}>{signed(nudge.move)} from you</p>}
              <p className="pb-1 text-sm text-muted">of players think Yes (mostly computer-made)</p>
              <p className={`num pb-1 text-sm font-medium ${dChange > 0 ? "text-rise" : dChange < 0 ? "text-fall" : "text-muted"}`} title="Change over the last hour">{dChange === 0 ? "no change" : `${dChange > 0 ? "up" : "down"} ${Math.abs(dChange)}%`} in the last hour</p>
              <div className="w-full"><DemoLabel /></div>
            </div>
          )}
          <div className="mt-3 h-56" role="img" aria-label={`How the Yes % changed over time, now ${pct(yesP)}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ left: -8, right: 4, top: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis type="number" dataKey="x" domain={[chart.from, chart.to]} tickFormatter={clock} tick={{ fontSize: 11, fill: "var(--muted)" }} tickCount={4} allowDataOverflow axisLine={false} tickLine={false} />
                <YAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "var(--muted)" }} orientation="right" width={40} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(0)}%`, "Think Yes"]} labelFormatter={(x) => clock(Number(x))} contentStyle={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 12 }} />
                {chart.others.map((o) => <Line key={o.i} data={o.d} dataKey="p" type="stepAfter" stroke={settled ? "#9aa3b0" : STRIKE_COLORS[o.i]} strokeOpacity={0.35} strokeWidth={1.5} dot={false} isAnimationActive={false} />)}
                <Line data={chart.sel} dataKey="p" type="stepAfter" stroke={settled ? "#7b8696" : STRIKE_COLORS[sel]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                {cur.executions.map((e) => <ReferenceDot key={e.orderId} x={feed.clockStart + e.t * 1000} y={e.priceAfter * 100} r={5} fill="var(--ink)" stroke="var(--raised)" />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="num text-xs text-muted">{settled ? `How the Yes % moved before the answer came out. ${cur.trades.toLocaleString()} predictions in all.` : `The line shows how the Yes % changed. ${cur.trades.toLocaleString()} predictions so far, nearly all by computer-made players. Black dots are your predictions.`}</p>
            <div role="tablist" aria-label="Chart range" className="flex gap-1">
              {RANGES.map((r) => <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)} className={`press min-h-9 rounded-full px-3 text-xs ${range === r.id ? "bg-surface2 font-medium" : "text-muted hover:bg-surface"}`}>{r.label}</button>)}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-base font-semibold">{settled ? "How each version was answered" : "Choose what to predict"}</h2>
          <p className="mb-3 text-sm text-muted">{settled ? "The same question asked three ways, from easier to harder." : more ? "The same question asked three ways, from easier to harder. The % is how many think Yes." : "The main question counts for your score. The % is how many think Yes."}</p>
          <ul className="space-y-1.5">
            {strikes.map((s, i) => {
              if (!more && i !== 1 && i !== sel) return null;
              const yes = s.settled ? (s.settled.outcome ? 1 : 0) : s.price;
              const active = i === sel;
              const pos = s.position.yes > 1e-6 || s.position.no > 1e-6;
              return (
                <li key={s.id} className={`rounded-2xl px-4 py-3 ${active ? "bg-raised ring-1 ring-ink/15" : "bg-surface2/60"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => setSel(i)} className="press min-w-0 flex-1 text-left" aria-pressed={active}>
                      <p className="flex items-center gap-2 font-medium leading-snug"><span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STRIKE_COLORS[i] }} aria-hidden />{s.label}</p>
                      <p className="text-xs text-muted">{pos ? `You predicted ${s.position.yes > 1e-6 ? "Yes" : ""}${s.position.yes > 1e-6 && s.position.no > 1e-6 ? " and " : ""}${s.position.no > 1e-6 ? "No" : ""}` : i === 1 ? "Main question: this one counts for your score" : "Extra question"}</p>
                    </button>
                    {!s.settled && <div className="text-right">
                      <p className="num text-xl leading-none">{pct(yes)}</p>
                    </div>}
                  </div>
                  {s.settled ? (
                    <div className="mt-2"><AnswerStamp yes={s.settled.outcome} /></div>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button onClick={() => { setSel(i); setSide("yes"); setMode("buy"); }} className="press min-h-10 rounded-full bg-risesoft px-3 text-sm font-medium text-rise">Predict Yes</button>
                      <button onClick={() => { setSel(i); setSide("no"); setMode("buy"); }} className="press min-h-10 rounded-full bg-fallsoft px-3 text-sm font-medium text-fall">Predict No</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {strikes.length > 1 && <button onClick={() => setMore(!more)} aria-expanded={more} className="press mt-2 min-h-9 rounded-full px-3 text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">{more ? "Show only the main question" : `Show ${strikes.length - 1} easier and harder versions`}</button>}
          <p className="mt-4 text-sm text-muted">{event.reason}</p>
          <div className="mt-2"><SourceChip name={event.source.name} date={`answered by ${event.settles}`} url={event.source.url} /></div>
        </Card>

        {!settled && event.whatIf && <WhatIf event={event} you={view?.whatIfYou?.[event.id] ?? null} />}
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
        {settled ? (
          <Card className="border border-[#cfd6df] !bg-[#eef1f5]">
            <p className="flex items-center gap-2 text-base font-semibold text-[#3c4655]"><Lock size={18} aria-hidden />Closed: no more predictions</p>
            <p className="mt-1 text-sm text-[#5b6575]">The official numbers answered this question. Open questions are still waiting for your prediction.</p>
            <div className="mt-3"><AnswerStamp yes={!!cur.settled?.outcome} /></div>
            <div className="mt-4"><Btn href="/market#open-questions" className="w-full">Go to open questions</Btn></div>
          </Card>
        ) : (
        <Card tone="raised" className="ring-2 ring-cue">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-cueink"><span className="grid size-6 place-items-center rounded-full bg-cue text-xs text-white">✓</span>Your prediction</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Order type" className="inline-flex rounded-full bg-surface2 p-1">
              {(["buy", "sell"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setMsg(null); setPlaced(null); setAmount(m === "sell" ? String(Math.floor(held)) : "25"); }}
                  className={`press min-h-9 whitespace-nowrap rounded-full px-4 text-sm ${mode === m ? "bg-raised font-medium" : "text-muted"}`}>{m === "buy" ? "Predict" : "Take back"}</button>
              ))}
            </div>
            <p className="num whitespace-nowrap text-sm text-muted">You have {feed.balance.toFixed(0)} points</p>
          </div>
          <p className="mt-4 font-medium leading-snug">{cur.label}</p>

          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Side">
            {(["yes", "no"] as const).map((s) => {
              const on = side === s;
              return <button key={s} aria-pressed={on} disabled={settled}
                onClick={() => { setSide(s); setMsg(null); setPlaced(null); if (mode === "sell") setAmount(String(Math.floor(s === "yes" ? cur.position.yes : cur.position.no))); }}
                className={`press min-h-12 rounded-full text-sm font-medium ${on ? (s === "yes" ? "bg-rise text-white" : "bg-fall text-white") : "bg-surface2"}`}>{s === "yes" ? "Yes" : "No"}</button>;
            })}
          </div>

          <label className="mt-4 block text-sm">
            {mode === "buy" ? `How many points to put on it? (up to ${Math.min(maxOrder, Math.floor(leftHere))})` : `How much to take back? (you have ${held.toFixed(1)} shares)`}
            <input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setMsg(null); setPlaced(null); }} disabled={settled}
              className="num mt-1 min-h-12 w-full rounded-2xl border border-control bg-raised px-4 text-right text-xl" />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(mode === "buy" ? [5, 10, 25, 50] : [0.25, 0.5, 1]).map((v) => (
              <button key={v} disabled={settled} onClick={() => setAmount(mode === "buy" ? String(Math.min(v, Math.floor(feed.balance))) : String(Math.floor(held * v * 10) / 10))}
                className="press min-h-9 rounded-full bg-surface2 px-3 text-xs">{mode === "buy" ? `${v}` : v === 1 ? "All" : `${v * 100}%`}</button>
            ))}
          </div>

          <dl className="num mt-4 space-y-1.5 text-sm">
            {mode === "buy" ? <>
              <Row k="You put in" v={q.shares > 0 ? `${q.points.toFixed(0)} points` : "–"} />
              <div className="-mx-2 rounded-xl bg-risesoft px-2 py-1.5"><Row k="You get back if right" v={q.shares > 0 ? `${q.maxPayout.toFixed(0)} points` : "–"} strong /></div>
              <Row k="You win" v={q.shares > 0 ? `${(q.maxPayout - q.points).toFixed(0)} points` : "–"} />
            </> : <Row k="You get back now" v={q.shares > 0 ? `${q.points.toFixed(0)} points` : "–"} strong />}
            <Row k={`"${side === "yes" ? "Yes" : "No"}" % after your prediction`} v={q.shares > 0 ? `${pct(side === "yes" ? q.priceBefore : 1 - q.priceBefore)} → ${pct(side === "yes" ? q.priceAfter : 1 - q.priceAfter)}` : "–"} />
          </dl>
          <div className="mt-4">
            <Btn onClick={place} disabled={!canPlace} className="min-h-12 w-full text-base">
              {settled ? "This question is answered" : tooBig ? (amt > leftHere + 1e-6 ? `Only ${leftHere.toFixed(0)} points left for this answer` : `Up to ${maxOrder} points at a time`) : insufficient ? (mode === "buy" ? "Not enough points" : "You do not have that much to take back") : mode === "buy" ? `Predict ${side === "yes" ? "Yes" : "No"}` : "Take back"}
            </Btn>
          </div>
          {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-rise" : "text-negative"}`}>{msg.text}</p>}
          {placed?.market === cur.id && <Placed e={placed} />}
          <p className="mt-3 text-xs text-muted">The less likely an answer looks, the more you win if it is right. Wrong predictions lose the points you put in. To keep it fair, one person moves the Yes % of an answer by at most {(PERSON_MOVE * 100).toFixed(1)}%, however many points they put in, and can put at most {MAX_PER_ANSWER} points into each answer. Points only, never money.</p>
        </Card>
        )}

        <Card>
          <h2 className="text-base font-semibold">Your predictions</h2>
          {!hasPos && !cur.settled && cur.executions.length === 0 && <p className="mt-1 text-sm text-muted">You have not made a prediction on this yet.</p>}
          {cur.position.yes > 1e-6 && <p className="num mt-2 text-sm">Yes: {cur.position.yes.toFixed(0)} points back if right</p>}
          {cur.position.no > 1e-6 && <p className="num mt-1 text-sm">No: {cur.position.no.toFixed(0)} points back if right</p>}
          {hasPos && !settled && <p className="num mt-2 text-sm text-muted">If you took it back now you would get {cur.position.value.toFixed(0)} points ({cur.position.unrealised >= 0 ? "up" : "down"} {Math.abs(cur.position.unrealised).toFixed(0)} on what you put in)</p>}
          {cur.settled && (cur.executions.length > 0
            ? <p className="num mt-2 text-sm font-medium">Result: you {cur.settled.pnl >= 0 ? "won" : "lost"} {Math.abs(cur.settled.pnl).toFixed(0)} points</p>
            : <p className="mt-1 text-sm text-muted">You did not make a prediction on this one.</p>)}
          {cur.executions.length > 0 && (
            <ul className="num mt-3 space-y-1 text-xs text-muted">
              {cur.executions.map((e) => <li key={e.orderId}>{clock(feed.clockStart + e.t * 1000)}: {e.action === "buy" ? "predicted" : "took back"} {e.side === "yes" ? "Yes" : "No"} ({(e.shares * e.avg).toFixed(0)} points)</li>)}
            </ul>
          )}
          {!settled && <p className="num mt-3 text-xs text-muted">The % updates every few seconds. Last update {clock(feed.serverNow)}.</p>}
        </Card>
      </aside>
    </div>
  );
}

const signed = (move: number) => `${move > 0 ? "+" : "−"}${(Math.abs(move) * 100).toFixed(1)}%`;

// The confirmation after a prediction: what was placed and what it did to the market.
function Placed({ e }: { e: Execution }) {
  const move = e.priceAfter - e.priceBefore, moved = Math.abs(move) > 1e-9;
  const name = e.side === "yes" ? "Yes" : "No";
  return (
    <div role="status" className="mt-3 rounded-2xl bg-risesoft px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-rise"><Check size={16} strokeWidth={3} aria-hidden />{e.action === "buy" ? "Prediction placed" : "Prediction taken back"}</p>
      <p className="num mt-1">{e.action === "buy" ? `You put ${e.points.toFixed(0)} points on ${name}. If you are right you get ${e.shares.toFixed(0)} points back.` : `You got ${e.points.toFixed(0)} points back.`}</p>
      <p className="num mt-1">{moved ? `The market moved ${signed(move)} because of you: Yes went from ${pct(e.priceBefore)} to ${pct(e.priceAfter)}.` : e.action === "buy" ? `The market stays at ${pct(e.priceAfter)} Yes: you have already moved this answer as far as one person can.` : `The market stays at ${pct(e.priceAfter)} Yes.`}</p>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className={`text-right ${strong ? "text-lg" : ""}`}>{v}</dd></div>;
}

// Why this question matters to you: what the main answer would do to the three AI speeds and to your own dates.
function WhatIf({ event, you }: { event: EventView; you: { skill: string; now: string; yes: string; no: string } | null }) {
  const w = event.whatIf!;
  const ids = ["slow", "medium", "fast"] as const;
  const col = (label: string, x: typeof w.yes, date: string | undefined) => (
    <div className="rounded-2xl bg-surface2/60 px-4 py-3">
      <p className="text-sm font-medium">{label}</p>
      <dl className="num mt-2 space-y-1 text-sm">
        {ids.map((id) => {
          const d = Math.round((x[id] - w.now[id]) * 100);
          return (
            <div key={id} className="flex justify-between gap-3">
              <dt className="inline-flex items-center gap-2 whitespace-nowrap text-muted"><span className="inline-block h-2 w-2 rounded-full" style={{ background: FUTURE_COLOR[id] }} aria-hidden />{FUTURE_NAME[id]} AI</dt>
              <dd className="whitespace-nowrap">{fpct(x[id])} <span className={d === 0 ? "text-muted" : d > 0 ? "text-rise" : "text-fall"}>({d > 0 ? "+" : d < 0 ? "−" : "±"}{Math.abs(d)})</span></dd>
            </div>
          );
        })}
      </dl>
      {date && <p className="mt-2 text-sm">Your skill fades around <span className="num font-medium">{date}</span></p>}
    </div>
  );
  return (
    <Card>
      <h2 className="mb-1 text-base font-semibold">What the answer would change</h2>
      <p className="mb-3 text-sm text-muted">When the real numbers settle the main question, the AI speed that predicted it better becomes more likely. Today: slow {fpct(w.now.slow)}, medium {fpct(w.now.medium)}, fast {fpct(w.now.fast)}.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {col("If the answer is Yes", w.yes, you?.yes)}
        {col("If the answer is No", w.no, you?.no)}
      </div>
      {you && <p className="mt-3 text-sm text-muted">Your skill most at risk is <span className="text-ink">{you.skill}</span>, now expected to fade around <span className="num text-ink">{you.now}</span>. Your plan and job list move with it.</p>}
      <p className="mt-2 text-xs text-muted">Your prediction does not decide this; only the real release does. Estimates, not certainties.</p>
    </Card>
  );
}
