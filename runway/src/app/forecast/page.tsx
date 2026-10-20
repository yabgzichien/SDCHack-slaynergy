"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, Chip, Estimate, FUTURE_COLOR, FUTURE_NAME, FutureBar, H, NextRow, PageTitle, Skeleton, pct } from "@/components/ui";

// One question: how fast will AI change this work, and how sure are we?
export default function ForecastPage() {
  const { view, state, act, busy } = useApp();
  const [custom, setCustom] = useState<{ slow: number; medium: number; fast: number } | null>(null);
  if (!view || !state) return <Skeleton lines={6} />;
  const w = view.world;
  const top = [...w.futures].sort((a, b) => b.weight - a.weight)[0];
  const sl = custom ?? { slow: w.weights.slow, medium: w.weights.medium, fast: w.weights.fast };
  const r = w.replay;

  return (
    <div>
      <PageTitle title={`Most likely: ${FUTURE_NAME[top.id].toLowerCase()} AI progress, ${pct(top.weight)}.`}>
        Nobody knows how fast AI will change office work, so Runway keeps three possible futures. Every date and job score you see is weighted by how likely each one is.
      </PageTitle>

      <Card tone="raised">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">How likely is each future?</h2>
          {w.usingOverride ? <Chip tone="fall">You set these weights</Chip> : <span className="text-sm text-muted">{w.release ? "After the 2026 Q2 release" : "Before the 2026 Q2 release"}</span>}
        </div>
        <div className="mt-4"><FutureBar futures={w.futures} height={16} /></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {w.futures.map((f) => (
            <div key={f.id}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="inline-flex items-center gap-2 font-medium"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FUTURE_COLOR[f.id] }} />{f.name}</p>
                <p className="num text-[1.75rem] leading-none">{pct(f.weight)}</p>
              </div>
              <p className="mt-2 text-sm text-muted">{f.blurb}</p>
            </div>
          ))}
        </div>
        <div className="mt-4"><Estimate /></div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <H>Where these numbers come from</H>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Each future predicts what the next real data releases will show: DOSM job ads and Epoch AI benchmark results.</li>
            <li>When a release comes out, futures that predicted it well gain weight. Replaying {r.questions} past releases set today&apos;s starting weights.</li>
            <li>Until the next release, the prediction market&apos;s prices tilt the weights a little. Forecasters who were right before have more influence on those prices.</li>
          </ol>
          <p className="mt-3 text-sm text-muted">In this demo the forecasters are simulated, and most of them read the three futures themselves, so their prices mostly echo them. The new information comes from the real releases and from your own trades.</p>
        </Card>
        <Card>
          <H sub="Brier score on the replayed questions. Lower is better.">How good is the forecast?</H>
          <dl className="num space-y-2 text-sm">
            {[
              ["Accuracy-weighted forecasters", r.brierWeighted, true],
              ["The market price", r.brierLmsr, false],
              ["All forecasters, equal weight", r.brierUnweighted, false],
              ["Always saying 50%", r.brierCoin, false],
              ["Always saying the past share of yes", r.brierBaseRate, false],
            ].map(([k, v, best]) => (
              <div key={k as string} className="flex justify-between gap-3"><dt className={best ? "font-medium" : "text-muted"}>{k as string}</dt><dd className={best ? "font-medium" : ""}>{(v as number).toFixed(3)}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-muted">The edge over a coin flip is small: these questions are hard. Weighting forecasters by their track record helps most.</p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold">Think the crowd is wrong?</h2>
            <p className="mt-1 text-sm">Trade on the next release with points, never money. If you are right, you gain influence over the forecast.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn href="/market">Make a forecast</Btn>
            <Btn href="/leaderboard" variant="ghost">See the leaderboard</Btn>
          </div>
        </div>
      </Card>

      <details className="mt-4 rounded-[22px] bg-surface p-5 sm:p-6">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Set your own weights instead</summary>
        <p className="text-sm text-muted">Your weights change every date, job score and your plan, and are labelled as yours. They are rescaled to add up to 100%.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["slow", "medium", "fast"] as const).map((k) => (
            <label key={k} className="block text-sm">
              <span className="font-medium">{FUTURE_NAME[k]}: <span className="num">{Math.round(sl[k] * 100)}%</span></span>
              <input type="range" min={0} max={1} step={0.01} value={sl[k]} onChange={(e) => setCustom({ ...sl, [k]: +e.target.value })} className="mt-2" />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn onClick={() => act("override", { weights: sl })} disabled={busy}>Use my weights</Btn>
          {w.usingOverride && <Btn variant="ghost" onClick={() => { setCustom(null); act("override", { weights: null }); }} disabled={busy}>Back to the market&apos;s weights</Btn>}
        </div>
      </details>

      <p className="mt-6 text-sm text-muted">Want the detail? <Link href="/trends" className="underline decoration-control underline-offset-2 hover:text-ink">Job market trends</Link> shows the real DOSM series behind the job-ad questions.</p>
      <NextRow back="/skills" next={state.profile ? "/jobs" : "/start"} nextLabel={state.profile ? "Next: jobs you can reach" : "Get started"} />
    </div>
  );
}
