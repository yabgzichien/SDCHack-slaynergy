"use client";
import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { ExpiryLegend, ExpiryTrack } from "@/components/ExpiryTrack";
import { MarketBoard } from "@/components/MarketBoard";
import { Segmented } from "@/components/Segmented";
import { StepNav } from "@/components/StepNav";
import { Btn, Card, Chip, DemoLabel, Estimate, FUTURE_COLOR, FutureBar, H, PageTitle, Skeleton, SourceChip, pct } from "@/components/ui";

export default function FuturesPage() {
  const { view, state, act, busy, refresh } = useApp();
  const [tab, setTab] = useState<"open" | "settled">("open");
  const [evIdx, setEvIdx] = useState(0);
  const [custom, setCustom] = useState<{ slow: number; medium: number; fast: number } | null>(null);
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000); return () => window.clearInterval(id); }, [refresh]);
  if (!view || !state) return <Skeleton lines={6} />;
  const w = view.world;
  const released = w.release === 1;
  const sl = custom ?? { slow: w.weights.slow, medium: w.weights.medium, fast: w.weights.fast };
  const history = w.clericalHistory.map((d) => ({ q: d.q.replace("Q", " Q"), share: d.share }));
  const kindData = w.kindSummary.map((k) => ({ name: k.kind.replace("AI ", ""), influence: +k.influence.toFixed(2) }));

  return (
    <div>
      <PageTitle step="Forecasts · how we know" title="How sure are we? Three futures, tested against real data">
        Nobody knows how fast AI will change office work. So Runway keeps three futures and lets a prediction market decide how likely each one is. The market bets on what the next real data release will show.
      </PageTitle>

      <Card className="mb-5">
        <H sub={`Starting weights were earned by replaying ${w.replay.questions} past releases, then adjusted by the crowd's view of the open questions below.`}>How likely is each future?</H>
        <FutureBar futures={w.futures} height={22} />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {w.futures.map((f) => (
            <div key={f.id} className="rounded-xl border border-line p-3">
              <div className="flex items-baseline justify-between">
                <p className="font-bold" style={{ color: FUTURE_COLOR[f.id] }}>{f.name}</p>
                <p className="num text-2xl font-extrabold">{pct(f.weight)}</p>
              </div>
              <p className="mt-1 text-sm text-muted">{f.blurb}</p>
              <p className="num mt-2 text-xs text-muted">Earned from settled outcomes: {pct(f.earned)} · crowd tilt: {f.tilt >= 0 ? "+" : ""}{(f.tilt * 100).toFixed(1)} points</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          A future gains weight when its predictions match what the best forecasters expect, and again when they match what the data release actually showed. No future can fall below 5%.
        </p>
        <div className="mt-3"><Estimate /></div>
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent">Set your own weights {w.usingOverride && <Chip tone="fall">your weights are in use</Chip>}</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {(["slow", "medium", "fast"] as const).map((k) => (
              <label key={k} className="block text-sm">
                <span style={{ color: FUTURE_COLOR[k] }} className="font-semibold">{k[0].toUpperCase() + k.slice(1)}: {Math.round(sl[k] * 100)}%</span>
                <input type="range" min={0} max={1} step={0.01} value={sl[k]} onChange={(e) => setCustom({ ...sl, [k]: +e.target.value })} />
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn onClick={() => act("override", { weights: sl })} disabled={busy}>Use my weights</Btn>
            <Btn variant="ghost" onClick={() => { setCustom(null); act("override", { weights: null }); }} disabled={busy}>Back to the market&apos;s weights</Btn>
          </div>
          <p className="mt-1 text-xs text-muted">Your weights are normalised to add up to 100%. They change expiry dates, job scores and your plan, and are labelled as yours.</p>
        </details>
      </Card>

      {view.profileSkills.length > 0 && (
        <Card className="mb-5">
          <H sub="When AI is expected to do most of the work behind each skill you have. Weighted by the futures above.">Your skills&apos; expiry dates</H>
          <ExpiryLegend />
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {view.profileSkills.map((s) => (
              <li key={s.skillId}>
                <div className="flex justify-between gap-2"><p className="font-medium">{s.name}</p><p className="num text-sm font-bold text-fall">{s.expiry.durable ? "after 2040" : `≈ ${s.expiry.expected}`}</p></div>
                <ExpiryTrack byFuture={s.expiry.byFuture} expected={s.expiry.expected} durable={s.expiry.durable} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="mkt" className="mb-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="mkt" className="text-xl font-bold">Prediction market: trade on the next real release</h2>
          <DemoLabel />
        </div>
        <Card tone="demo" className="mb-4 text-sm">
          <p>Each question has several <b>strikes</b> (like &quot;rises by more than 3 points&quot;). Buy <b>Yes</b> if you think it will happen, <b>No</b> if you think it will not, and sell any time to lock in a gain or cut a loss. A contract pays <b>1 point</b> if you are right. About 200 <b>simulated forecasters</b> (made up, never real people) trade alongside you, so prices move live.</p>
          <p className="num mt-2"><b>Your points:</b> {w.user.balance.toFixed(0)} · <b>open positions worth:</b> {w.user.positionValue.toFixed(0)} · <b>orders:</b> {w.user.orders}{w.user.rank ? ` · rank ${w.user.rank} of ${w.user.of} on this release` : ""}</p>
          {!released && <p className="mt-1">When you are ready, press <b>New data released</b> at the top to settle every market with the real figures.</p>}
        </Card>
        {released && <div className="mb-3 flex justify-center"><Segmented label="Markets" value={tab} onChange={(v) => { setTab(v); setEvIdx(0); }} options={[{ id: "open", label: "Open now" }, { id: "settled", label: "Settled by the 2026 Q2 release" }]} /></div>}
        {(() => {
          const list = released && tab === "settled" ? w.settledEvents : w.events;
          const ev = list[Math.min(evIdx, list.length - 1)];
          return (
            <>
              <div className="scroll-x mb-3 flex gap-2 pb-1" role="tablist" aria-label="Questions">
                {list.map((e, i) => (
                  <button key={e.id} role="tab" aria-selected={i === evIdx} onClick={() => setEvIdx(i)}
                    className={`press min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${i === evIdx ? "border-ink bg-ink text-bg" : "border-line bg-surface"}`}>{e.short}</button>
                ))}
              </div>
              {ev && <MarketBoard key={`${ev.id}-${ev.settled}`} event={ev} />}
            </>
          );
        })()}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <H sub={`Real DOSM figures. ${released ? "Includes the 2026 Q2 release." : "The 2026 Q2 release is held back."}`}>Clerical support&apos;s share of online job ads (%)</H>
          <div className="h-56" role="img" aria-label="Line chart of the clerical support share of online job ads by quarter">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="q" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={3} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} domain={["auto", "auto"]} />
                <Tooltip />
                {!released && <ReferenceLine x="2026 Q1" stroke="var(--fast)" strokeDasharray="4 4" label={{ value: "next release", fill: "var(--fast)", fontSize: 11, position: "top" }} />}
                <Line type="monotone" dataKey="share" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted">DOSM changed what its job-ad series covers around 2025 Q3 and gave no reason. The share is steadier than the raw count, so questions use the share.</p>
          <div className="mt-2"><SourceChip name="DOSM Job Market Insights" date="2026 Q2 release, 18 Aug 2026" url="https://www.dosm.gov.my/portal-main/release-content/big-data-analytics-job-market-insights-q22026" /></div>
        </Card>

        <Card>
          <H sub={<>Who holds the influence now. <DemoLabel /></>}>Forecasters</H>
          <div className="h-40" role="img" aria-label="Average influence of each type of simulated forecaster">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kindData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip />
                <RBar dataKey="influence" fill="var(--medium)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted">Average influence per type (1.0 = equal). Everyone starts equal; influence follows accuracy, not job title.</p>
          <div className="scroll-x mt-2">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <caption className="sr-only">Ten most influential simulated forecasters</caption>
              <thead><tr className="text-xs text-muted"><th className="py-1">Forecaster</th><th>Influence</th><th>Brier score (lower is better)</th></tr></thead>
              <tbody>
                {w.forecasters.map((f) => (
                  <tr key={f.id} className="border-t border-line"><td className="py-1.5">{f.name}</td><td className="num">{f.influence.toFixed(2)}×</td><td className="num">{f.brier?.toFixed(3) ?? "–"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="num mt-3 rounded-lg bg-surface2 p-2 text-sm">
            <b>Track record (replay of {w.replay.questions} past questions):</b> Brier score of the market price {w.replay.brierLmsr.toFixed(4)} · accuracy-weighted average {w.replay.brierWeighted.toFixed(4)} · unweighted average {w.replay.brierUnweighted.toFixed(4)}. Lower is better. The edge is small because these questions are hard.
          </p>
        </Card>
      </div>
      <StepNav back="/skills" next="/jobs" nextLabel="Match me to jobs" disabled={!state.profile} />
    </div>
  );
}
