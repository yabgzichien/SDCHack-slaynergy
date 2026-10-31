"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventView } from "@/lib/engine/world";
import { MAX_PER_ANSWER, quoteBuy } from "@/lib/market-math";
import { useApp } from "./AppProvider";
import { Btn, Card, FUTURE_COLOR, FUTURE_NAME, SourceChip, pct as fpct } from "./ui";
import { AnswerStamp, STRIKE_COLORS, answerDay } from "./MarketCards";
import { MarketOddsBar } from "./MarketOddsBar";
import { ArrowDownRight, ArrowUpRight, Check, Info, Lock, Users } from "lucide-react";
import "./MarketBoard.css";

type Execution = { orderId: string; t: number; side: "yes" | "no"; action: "buy" | "sell"; shares: number; points: number; avg: number; priceBefore: number; priceAfter: number };
type Strike = {
  id: string; label: string; series: [number, number, number][]; price: number; close: number; change1h: number; volume: number; trades: number;
  position: { yes: number; no: number; avgYes: number | null; avgNo: number | null; value: number; unrealised: number; realised: number };
  executions: Execution[]; settled: null | { outcome: boolean; payout: number; pnl: number };
};
type Feed = { event: string; settled: boolean; nowT: number; clockStart: number; serverNow: number; strikes: Strike[]; balance: number };

const cents = (p: number) => `${Math.round(p * 100)}%`;
const pct = (p: number) => `${Math.round(p * 100)}%`;
const MAX_PREDICTION_POINTS = 50;
const RANGES = [{ id: "15m", label: "15 min", s: 900 }, { id: "1h", label: "1 hour", s: 3600 }, { id: "all", label: "All", s: 21600 + 3600 }] as const;
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00+08:00`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

// A short name and a one-line rule for each version, so nobody has to decode the engine's label.
function plainStrike(label: string): { title: string; rule: string } {
  const n = label.match(/[\d.]+/)?.[0];
  if (label === "Drops at all") return { title: "Any drop", rule: "Yes if office admin jobs fall at all, even by a little." };
  if (label.startsWith("Drops by")) return { title: "A big drop", rule: `Yes if office admin jobs fall by more than ${n} in every 100 job ads.` };
  if (label.startsWith("Does not rise")) return { title: "No big rise", rule: `Yes if office admin jobs fall, stay the same or rise by less than ${n} in every 100 job ads.` };
  if (label === "Goes up at all") return { title: label, rule: "Yes if the best result goes up at all compared with the previous quarter." };
  if (label === "Grows at all") return { title: label, rule: "Yes if the longest task grows at all compared with the previous quarter." };
  if (label.startsWith("Grows")) return { title: label, rule: `Yes if the longest task grows by more than ${n}% compared with the previous quarter.` };
  return { title: label, rule: `Yes if the best result goes up by more than ${n} points compared with the previous quarter.` };
}

export function MarketBoard({ event }: { event: EventView }) {
  const { act, busy, refresh, view } = useApp();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [sel, setSel] = useState(1);
  const [predictionSelected, setPredictionSelected] = useState(false);
  const [side, setSide] = useState<"yes" | "no" | null>(null);
  const [amount, setAmount] = useState("25");
  const [range, setRange] = useState<"15m" | "1h" | "all">("1h");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
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

  const strikes = useMemo(() => feed?.strikes ?? [], [feed]);
  const cur = strikes[sel];
  const settled = !!feed?.settled;
  const expectedAnswerDay = answerDay(event);

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
  const quoteSide = side ?? "yes";
  const amt = Math.max(0, Number(amount) || 0);
  const q = quoteBuy(price, quoteSide, amt, cur.executions);
  const usedHere = cur.executions.filter((x) => x.action === "buy").reduce((a, x) => a + x.points, 0);
  const leftHere = Math.max(0, MAX_PER_ANSWER - usedHere);
  const stakeLimit = Math.min(MAX_PREDICTION_POINTS, maxOrder, Math.floor(leftHere));
  const overStakeLimit = amt > MAX_PREDICTION_POINTS;
  const tooBig = amt > stakeLimit + 1e-6;
  const insufficient = amt > feed.balance + 1e-6;
  const canPlace = side !== null && !settled && !busy && amt > 0 && !insufficient && !tooBig && q.shares > 0.0001;
  const hasPos = cur.position.yes > 1e-6 || cur.position.no > 1e-6;
  const predictionStage = settled ? 3 : cur.executions.length > 0 || hasPos ? 2 : side ? 1 : 0;
  const predictionStatus = settled ? "Complete" : cur.executions.length > 0 || hasPos ? "Active" : side ? "In progress" : "Not started";
  const dChange = Math.round(cur.change1h * 100);
  const leadingSide: "yes" | "no" = yesP >= 0.5 ? "yes" : "no";
  const leadingP = leadingSide === "yes" ? yesP : 1 - yesP;
  const leadingChange = leadingSide === "yes" ? dChange : -dChange;
  const leadingLabel = leadingSide === "yes" ? "Yes" : "No";
  const questionTitle = cur.label === "Drops at all" ? "Will it drop at all?" : cur.label;
  const leadingChart = chart.sel.map((point) => ({ ...point, p: leadingSide === "yes" ? point.p : 100 - point.p }));
  const comparisonLines = chart.others.map((line) => ({
    ...line,
    d: line.d.map((point) => ({ ...point, p: leadingSide === "yes" ? point.p : 100 - point.p })),
  }));
  const chartLegend = strikes.map((strike, i) => {
    const yes = strike.settled ? (strike.settled.outcome ? 1 : 0) : strike.price;
    return {
      label: plainStrike(strike.label).title,
      fullLabel: strike.label,
      value: leadingSide === "yes" ? yes : 1 - yes,
      color: settled ? "#7b8696" : STRIKE_COLORS[i],
    };
  });
  const selectedLineColor = settled ? "#7b8696" : STRIKE_COLORS[sel];
  const strikeRow = (s: Strike, i: number) => {
    const yes = s.settled ? (s.settled.outcome ? 1 : 0) : s.price;
    const active = i === sel;
    const pos = s.position.yes > 1e-6 || s.position.no > 1e-6;
    return (
      <li key={s.id} className={`market-variant${active ? " is-active" : ""}`}>
        <div className="market-variant-heading">
          <button onClick={() => { setSel(i); setPredictionSelected(true); setSide(null); setMsg(null); }} className="press min-w-0 flex-1 text-left" aria-pressed={active}>
            <p className="market-variant-label"><span style={{ background: STRIKE_COLORS[i] }} aria-hidden />{s.label}</p>
            <p className="market-variant-note">{pos ? `You predicted ${s.position.yes > 1e-6 ? "Yes" : ""}${s.position.yes > 1e-6 && s.position.no > 1e-6 ? " and " : ""}${s.position.no > 1e-6 ? "No" : ""}` : i === 1 ? "Main question: this one counts for your score" : "Extra question"}</p>
          </button>
          {!s.settled && <p className="market-variant-percent num">{pct(yes)}</p>}
        </div>
        {s.settled ? (
          <div className="mt-2"><AnswerStamp yes={s.settled.outcome} /></div>
        ) : (
          <div className="mt-2">
            <MarketOddsBar yes={yes} compact />
            <div className="market-variant-actions">
              <button onClick={() => { setSel(i); setPredictionSelected(true); setSide("yes"); setMsg(null); }} aria-pressed={active && side === "yes"} className="market-variant-button market-variant-button--yes press">Predict Yes</button>
              <button onClick={() => { setSel(i); setPredictionSelected(true); setSide("no"); setMsg(null); }} aria-pressed={active && side === "no"} className="market-variant-button market-variant-button--no press">Predict No</button>
            </div>
          </div>
        )}
      </li>
    );
  };

  const place = async () => {
    setMsg(null);
    if (!side) return;
    if (overStakeLimit) { setMsg({ ok: false, text: `You can put in a maximum of ${MAX_PREDICTION_POINTS} points.` }); return; }
    const r = await act("order", { market: cur.id, side, action: "buy", amount: amt });
    if (!r) { setMsg({ ok: false, text: "Your prediction could not be placed. Please try again." }); return; }
    setMsg({ ok: true, text: `Done. You put ${q.points.toFixed(0)} points on ${side === "yes" ? "Yes" : "No"}. If you are right you get ${q.maxPayout.toFixed(0)} points back.` });
    reload(); await refresh();
  };

  return (
    <div className="market-board space-y-4">
        <section className={`market-hero market-hero--${settled ? "settled" : leadingSide}`} aria-labelledby="market-question-title">
          <div className="market-hero-heading">
            <h2 id="market-question-title">{questionTitle}</h2>
            <div className="market-range-tabs" role="tablist" aria-label="Chart range">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={range === r.id}
                  onClick={() => setRange(r.id)}
                  className="market-range-tab press"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {settled ? (
            <div className="market-settled-summary">
              <AnswerStamp yes={!!cur.settled?.outcome} big />
              <p className="text-sm text-[#5b6575]">The crowd&apos;s last prediction was <span className="num font-medium">{pct(cur.close)}</span> Yes.</p>
            </div>
          ) : (
            <div className="market-hero-content">
              <div className="market-confidence" aria-live="polite" aria-label={`${pct(leadingP)} ${leadingLabel}`}>
                <svg className="market-confidence-ring" viewBox="0 0 120 120" aria-hidden>
                  <circle className="market-confidence-track" cx="60" cy="60" r="50" pathLength="100" />
                  <circle className="market-confidence-progress" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${Math.round(leadingP * 100)} 100`} />
                </svg>
                <div className="market-confidence-value">
                  <strong className="num">{pct(leadingP)}</strong>
                  <span>{leadingLabel}</span>
                </div>
              </div>
              <div className="market-leaning-copy">
                <p className={`market-trend ${leadingChange > 0 ? "is-up" : leadingChange < 0 ? "is-down" : "is-flat"}`} title={`Change in ${leadingLabel} probability over the last hour`}>
                  {leadingChange > 0 ? <ArrowUpRight size={17} aria-hidden /> : leadingChange < 0 ? <ArrowDownRight size={17} aria-hidden /> : null}
                  <span className="num">{leadingChange === 0 ? "No change this hour" : `${leadingChange > 0 ? "+" : "−"}${Math.abs(leadingChange)}% this hour`}</span>
                </p>
                <p>The crowd is<br />leaning <strong>{leadingLabel}</strong></p>
              </div>
              <div className="market-chart-wrap">
                <div className="market-chart-legend" aria-label={`${leadingLabel} probability for all three question versions`}>
                  {chartLegend.map((item) => (
                    <span key={item.label} title={item.fullLabel}>
                      <i style={{ background: item.color }} aria-hidden />
                      {item.label} <b className="num">{pct(item.value)}</b>
                    </span>
                  ))}
                </div>
                <div className="market-chart" role="img" aria-label={`How the ${leadingLabel} probability changed for all three question versions, with ${questionTitle} now ${pct(leadingP)}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={leadingChart} margin={{ left: 0, right: 2, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`market-fill-${leadingSide}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={selectedLineColor} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={selectedLineColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="3 5" />
                    <XAxis type="number" dataKey="x" domain={[chart.from, chart.to]} tickFormatter={clock} tick={{ fontSize: 11, fill: "var(--muted)" }} tickCount={3} allowDataOverflow axisLine={false} tickLine={false} />
                    <YAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "var(--muted)" }} orientation="right" width={42} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(0)}%`, `Think ${leadingLabel}`]} labelFormatter={(x) => clock(Number(x))} contentStyle={{ background: "rgba(255,255,255,.94)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "0 12px 30px rgb(29 49 42 / .12)" }} />
                    {comparisonLines.map((line) => <Line key={line.i} data={line.d} dataKey="p" type="stepAfter" stroke={settled ? "#9aa3b0" : STRIKE_COLORS[line.i]} strokeOpacity={0.72} strokeWidth={1.8} dot={false} isAnimationActive={false} />)}
                    <Area dataKey="p" type="stepAfter" stroke={selectedLineColor} fill={`url(#market-fill-${leadingSide})`} strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 3, stroke: "white" }} isAnimationActive animationDuration={350} />
                    {cur.executions.map((e) => <ReferenceDot key={e.orderId} x={feed.clockStart + e.t * 1000} y={(leadingSide === "yes" ? e.priceAfter : 1 - e.priceAfter) * 100} r={4} fill="var(--ink)" stroke="white" strokeWidth={2} />)}
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
          <div className="market-hero-footer">
            <Users size={18} aria-hidden />
            <p className="num">{cur.trades.toLocaleString()} predictions {settled ? "in all" : "so far"}{cur.executions.length > 0 ? ". Black dots are yours." : "."}</p>
          </div>
        </section>

        <Card className="market-decision-card">
          <h2 className="market-decision-title">{settled ? "How each version was answered" : "Choose a prediction"}</h2>
          {settled ? (
            <ul className="mt-3 space-y-1.5">{strikes.map((s, i) => i === 1 ? strikeRow(s, i) : null)}</ul>
          ) : (
            <>
            <p className="market-prediction-intro">All three ask about the same number, compared with the previous 3 months. Only the main question counts for your score.</p>
            <div className="market-prediction-types" role="radiogroup" aria-label="Prediction type">
              {strikes.map((strike, i) => {
                const selected = predictionSelected && sel === i;
                const plain = plainStrike(strike.label);
                return (
                  <button
                    key={strike.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => { setSel(i); setPredictionSelected(true); setSide(null); setMsg(null); }}
                    className={`market-prediction-type press${selected ? " is-selected" : ""}`}
                  >
                    <span className="market-prediction-type-dot" style={{ background: STRIKE_COLORS[i] }} aria-hidden />
                    <span>{plain.title}</span>
                    <span className="market-prediction-type-rule">{plain.rule}</span>
                    <strong className="num">{pct(strike.price)} Yes</strong>
                    <span className={`market-prediction-type-tag${i === 1 ? " is-main" : ""}`}>{selected ? <><Check size={13} aria-hidden /> Selected</> : i === 1 ? "Main question" : "Extra question"}</span>
                  </button>
                );
              })}
            </div>

            {predictionSelected && <>
            <h3 className="market-selected-prediction">Your prediction: <strong>{plainStrike(cur.label).title}{side ? ` · ${side === "yes" ? "Yes" : "No"}` : ""}</strong></h3>
            <p className="market-side-prompt">Will this happen?</p>
            <div className="market-choices">
              {(["yes", "no"] as const).map((choice) => {
                const value = choice === "yes" ? yesP : 1 - yesP;
                const selected = side === choice;
                return (
                  <article key={choice} className={`market-choice market-choice--${choice}${selected ? " is-selected" : ""}`}>
                    <div className="market-choice-summary">
                      <div>
                        <p className="market-choice-label">{choice.toUpperCase()}</p>
                        <p className="market-choice-percent num">{pct(value)}</p>
                      </div>
                      <span className="market-choice-bars" aria-hidden>{[3, 5, 7, 10, 7, 5].map((h, i) => <i key={i} style={{ height: `${h * 2}px` }} />)}</span>
                    </div>
                    <button onClick={() => { setSide(choice); setMsg(null); }} aria-pressed={selected} className="market-choice-button press">Choose {choice === "yes" ? "Yes" : "No"}</button>
                  </article>
                );
              })}
            </div>
            </>}
            </>
          )}

          {!settled && side && (
          <div className={`market-points-panel market-points-panel--${side}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="market-section-heading">Add your points</p>
            <p className="market-points-balance num whitespace-nowrap text-sm">You have {feed.balance.toFixed(0)} points</p>
          </div>

          <label className="market-points-label mt-4 block text-sm">
            How many points do you want to put in? (max {stakeLimit})
            <input inputMode="decimal" max={MAX_PREDICTION_POINTS} aria-invalid={overStakeLimit} aria-describedby={overStakeLimit ? "prediction-points-error" : undefined} value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setMsg(null); }} disabled={settled}
              className="market-points-input num mt-1 min-h-12 w-full rounded-2xl px-4 text-right text-xl" />
          </label>
          {overStakeLimit && <p id="prediction-points-error" role="alert" className="market-stake-error">You can put in a maximum of {MAX_PREDICTION_POINTS} points.</p>}
          <div className="market-points-presets mt-2 flex flex-wrap gap-1.5">
            {[5, 10, 25, 50].map((v) => (
              <button key={v} disabled={settled || v > stakeLimit} onClick={() => { setAmount(String(Math.min(v, stakeLimit, Math.floor(feed.balance)))); setMsg(null); }}
                className="market-points-preset press min-h-9 rounded-full px-3 text-xs disabled:opacity-40">{v}</button>
            ))}
          </div>

          <details className="market-payout-details">
            <summary><Info size={16} aria-hidden /> Points, payout and percentage impact</summary>
            <dl className="num mt-3 space-y-1.5 text-sm">
              <Row k="You put in" v={q.shares > 0 ? `${q.points.toFixed(0)} points` : "–"} />
              <div className="-mx-2 rounded-xl bg-risesoft px-2 py-1.5"><Row k="You get back if right" v={q.shares > 0 ? `${q.maxPayout.toFixed(0)} points` : "–"} strong /></div>
              <Row k="You win" v={q.shares > 0 ? `${(q.maxPayout - q.points).toFixed(0)} points` : "–"} />
              <Row k={`"${side === "yes" ? "Yes" : "No"}" after your prediction`} v={q.shares > 0 ? `${cents(side === "yes" ? q.priceBefore : 1 - q.priceBefore)} → ${cents(side === "yes" ? q.priceAfter : 1 - q.priceAfter)}` : "–"} />
            </dl>
          </details>
          <div className="mt-4">
            <Btn onClick={place} disabled={!canPlace} className="market-points-submit min-h-12 w-full text-base">
              {settled ? "This question is answered" : overStakeLimit ? `Maximum ${MAX_PREDICTION_POINTS} points` : tooBig ? `Up to ${stakeLimit} points here` : insufficient ? "Not enough points" : `Predict ${side === "yes" ? "Yes" : "No"}`}
            </Btn>
          </div>
          {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-rise" : "text-negative"}`}>{msg.text}</p>}
          <p className="mt-3 text-xs text-muted">If your prediction is wrong, you lose the points you put in. Points only—never money.</p>
          </div>
          )}

          <div className={`market-your-predictions market-your-predictions--stage-${predictionStage}`}>
            <div className="market-progress-heading">
              <div>
                <p className="market-progress-eyebrow">Your activity</p>
                <h3 className="market-section-heading">Prediction progress</h3>
              </div>
              <span className="market-progress-status">{predictionStatus}</span>
            </div>

            <ol className="market-progress-steps" aria-label={`Prediction progress: ${predictionStatus}`}>
              {["Choose answer", "Add points", "See result"].map((label, index) => (
                <li key={label} className={predictionStage > index ? "is-done" : predictionStage === index ? "is-active" : ""}>
                  <span aria-hidden>{predictionStage > index ? "✓" : index + 1}</span>
                  <p>{label}</p>
                </li>
              ))}
            </ol>

            <div className="market-progress-summary">
              {!settled && cur.executions.length === 0 && !hasPos && !side && <><strong>No prediction yet</strong><span>Choose Yes or No above to begin.</span></>}
              {!settled && cur.executions.length === 0 && !hasPos && side && <><strong>{side === "yes" ? "Yes" : "No"} selected</strong><span>Add your points above, then confirm.</span></>}
              {!settled && (cur.executions.length > 0 || hasPos) && <>
                <div className="market-progress-positions">
                  {cur.position.yes > 1e-6 && <p><span>Yes</span><strong className="num">{cur.position.yes.toFixed(0)} points back if right</strong></p>}
                  {cur.position.no > 1e-6 && <p><span>No</span><strong className="num">{cur.position.no.toFixed(0)} points back if right</strong></p>}
                  {!hasPos && <p><span>Position</span><strong>No active points</strong></p>}
                </div>
                {hasPos && <p className="market-progress-value num">Worth {cur.position.value.toFixed(0)} points now · {cur.position.unrealised >= 0 ? "up" : "down"} {Math.abs(cur.position.unrealised).toFixed(0)}</p>}
              </>}
              {cur.settled && (cur.executions.length > 0
                ? <><strong>Result recorded</strong><span className="num">You {cur.settled.pnl >= 0 ? "won" : "lost"} {Math.abs(cur.settled.pnl).toFixed(0)} points.</span></>
                : <><strong>No prediction submitted</strong><span>This question is now closed.</span></>)}
            </div>

            {!settled && (
              <details className="market-progress-info">
                <summary aria-label="Prediction update details">!</summary>
                <p>Odds update every few seconds. Last update {clock(feed.serverNow)}.</p>
              </details>
            )}
          </div>

        </Card>

        {settled && (
          <Card className="border border-[#cfd6df] !bg-[#eef1f5]">
            <p className="flex items-center gap-2 text-base font-semibold text-[#3c4655]"><Lock size={18} aria-hidden />Closed: no more predictions</p>
            <p className="mt-1 text-sm text-[#5b6575]">The official numbers answered this question.</p>
            <div className="mt-4"><Btn href="/market#open-questions">Go to open questions</Btn></div>
          </Card>
        )}

        {!settled && event.whatIf && <WhatIf event={event} you={view?.whatIfYou?.[event.id] ?? null} />}

        <footer className="px-1 pt-2 text-sm text-muted">
          {!settled && <p className="mb-2">{event.closesAt ? `Closes ${dateLabel(event.closesAt)}.` : expectedAnswerDay ? `Answer expected ${dateLabel(expectedAnswerDay)}.` : null}</p>}
          <SourceChip name={event.source.name} date={`answered by ${event.settles}`} url={event.source.url} />
        </footer>
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
      <p className="text-base font-semibold">{label}</p>
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
      <h2 className="market-section-heading mb-1">What the answer would change</h2>
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
