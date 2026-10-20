"use client";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, Chip, Estimate, FUTURE_COLOR, FUTURE_NAME, FUTURE_PLAIN, FutureBar, More, NextRow, PageTitle, Skeleton, pct } from "@/components/ui";

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
        Nobody knows how fast AI will change office work, so Jobbery keeps three possible futures. Your skill dates and job scores lean towards the more likely ones.
      </PageTitle>

      <Card tone="raised">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">How likely is each future?</h2>
          {w.usingOverride ? <Chip tone="fall">You set these chances</Chip> : <span className="text-sm text-muted">{w.release ? "Updated with the April to June 2026 figures" : "Using figures up to March 2026"}</span>}
        </div>
        <div className="mt-4"><FutureBar futures={w.futures} height={16} /></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {w.futures.map((f) => (
            <div key={f.id}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="inline-flex items-center gap-2 font-medium"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FUTURE_COLOR[f.id] }} />{f.name}</p>
                <p className="num text-[1.75rem] leading-none">{pct(f.weight)}</p>
              </div>
              <p className="mt-2 text-sm text-muted">{FUTURE_PLAIN[f.id]}</p>
            </div>
          ))}
        </div>
        <div className="mt-4"><Estimate /></div>
        <More summary="Where do these chances come from?">
          <ol className="list-decimal space-y-2 pl-5">
          <li>Each future makes its own guess about the next official figures: Malaysian job ads and AI test scores.</li>
          <li>When the real figures come out, the futures that guessed well become more likely.</li>
          <li>In between, a crowd of forecasters bets points on the next figures. Those who were right before get more say.</li>
        </ol>
        <More summary="The detail: settings and accuracy">
          <ul className="list-disc space-y-1 pl-5">
            {w.futures.map((f) => <li key={f.id}><span className="text-ink">{f.name}:</span> {f.blurb}</li>)}
          </ul>
          <p>The sources are DOSM Job Market Insights (job ads) and Epoch AI benchmark results (AI test scores). Replaying {r.questions} past releases set today&apos;s starting chances. Until the next release, the market&apos;s prices tilt them a little.</p>
          <p>In this demo the forecasters are simulated, and most of them read the three futures themselves, so their prices mostly echo them. The new information comes from the real releases and from your own trades.</p>
          <p className="text-ink">How accurate was it on the {r.questions} replayed questions? (Brier score, lower is better)</p>
          <dl className="num max-w-md space-y-1.5">
            {[
              ["Accuracy-weighted forecasters", r.brierWeighted, true],
              ["The market price", r.brierLmsr, false],
              ["All forecasters, equal weight", r.brierUnweighted, false],
              ["Always saying 50%", r.brierCoin, false],
              ["Always saying the past share of yes", r.brierBaseRate, false],
            ].map(([k, v, best]) => (
              <div key={k as string} className="flex justify-between gap-3"><dt className={best ? "font-medium text-ink" : ""}>{k as string}</dt><dd className={best ? "font-medium text-ink" : ""}>{(v as number).toFixed(3)}</dd></div>
            ))}
          </dl>
          <p>The edge over a coin flip is small: these questions are hard. Weighting forecasters by their track record helps most.</p>
        </More>
        </More>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold">Think the crowd is wrong?</h2>
            <p className="mt-1 text-sm">Bet points, never money, on the next official figures. If you are right, you get more say in the forecast.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn href="/market">Make a forecast</Btn>
            <Btn href="/leaderboard" variant="ghost">See the leaderboard</Btn>
          </div>
        </div>
      </Card>

      <details className="mt-4 rounded-[22px] bg-surface p-5 sm:p-6">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Disagree? Set the chances yourself</summary>
        <p className="text-sm text-muted">Your own chances change every skill date, job score and your plan, and are marked as yours. They always add up to 100%.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["slow", "medium", "fast"] as const).map((k) => (
            <label key={k} className="block text-sm">
              <span className="font-medium">{FUTURE_NAME[k]}: <span className="num">{Math.round(sl[k] * 100)}%</span></span>
              <input type="range" min={0} max={1} step={0.01} value={sl[k]} onChange={(e) => setCustom({ ...sl, [k]: +e.target.value })} className="mt-2" />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn onClick={() => act("override", { weights: sl })} disabled={busy}>Use my chances</Btn>
          {w.usingOverride && <Btn variant="ghost" onClick={() => { setCustom(null); act("override", { weights: null }); }} disabled={busy}>Back to the crowd&apos;s chances</Btn>}
        </div>
      </details>

      <NextRow back="/skills" next={state.profile ? "/jobs" : "/start"} nextLabel={state.profile ? "Next: jobs you can reach" : "Get started"} />
    </div>
  );
}
