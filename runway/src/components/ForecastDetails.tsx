"use client";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, Chip, Estimate, FUTURE_COLOR, FUTURE_NAME, FUTURE_PLAIN, FutureBar, More, pct } from "@/components/ui";

// How the three AI speeds get their chances, and a way to set your own. Shown on the market page.
export function ForecastDetails() {
  const { view, state, act, busy } = useApp();
  const [custom, setCustom] = useState<{ slow: number; medium: number; fast: number } | null>(null);
  if (!view || !state) return null;
  const w = view.world;
  const sl = custom ?? { slow: w.weights.slow, medium: w.weights.medium, fast: w.weights.fast };
  const r = w.replay;

  return (
    <div>
      <h2 id="how" className="mb-3 mt-10 text-xl font-medium">What all these guesses are for</h2>
      <p className="mb-3 text-sm text-muted">Nobody knows how fast AI will change jobs. Runway keeps three possible speeds in mind and uses the guesses and the real numbers to decide which is most likely. That decides the dates you see for your skills and jobs.</p>

      <Card tone="raised">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">How fast is AI changing jobs? Our best guess</h2>
          {w.usingOverride ? <Chip tone="fall">You set these yourself</Chip> : <span className="text-sm text-muted">{w.release ? "Updated with the Apr to Jun 2026 numbers" : "Using numbers up to Mar 2026"}</span>}
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
        <More summary="Where do these numbers come from?">
          <ol className="list-decimal space-y-2 pl-5">
          <li>Each speed (slow, medium, fast) predicts what the next official numbers will be: Malaysian job ads and AI test scores.</li>
          <li>When the real numbers come out, the speed that predicted best becomes more likely.</li>
          <li>Before then, players guess on the questions above. Players who were right before count more.</li>
        </ol>
        <More summary="For experts: exact settings and accuracy">
          <ul className="list-disc space-y-1 pl-5">
            {w.futures.map((f) => <li key={f.id}><span className="text-ink">{f.name}:</span> {f.blurb}</li>)}
          </ul>
          <p>The sources are DOSM Job Market Insights (job ads) and Epoch AI benchmark results (AI test scores). Replaying {r.questions} past releases set today&apos;s starting chances. Until the next release, the market&apos;s prices tilt them a little.</p>
          <p>In this demo the other players are made by the computer, and most of them read the three futures themselves, so their prices mostly echo them. The new information comes from the real releases and from your own trades.</p>
          <p className="text-ink">How accurate was it on the {r.questions} replayed questions? (error score: 0 is perfect, lower is better)</p>
          <dl className="num max-w-md space-y-1.5">
            {[
              ["Players, with better players counting more", r.brierWeighted, true],
              ["The Yes % on each question", r.brierLmsr, false],
              ["All players counting the same", r.brierUnweighted, false],
              ["Always saying 50%", r.brierCoin, false],
              ["Always guessing what usually happened before", r.brierBaseRate, false],
            ].map(([k, v, best]) => (
              <div key={k as string} className="flex justify-between gap-3"><dt className={best ? "font-medium text-ink" : ""}>{k as string}</dt><dd className={best ? "font-medium text-ink" : ""}>{(v as number).toFixed(3)}</dd></div>
            ))}
          </dl>
          <p>It only beats a coin flip by a little, because these questions are hard. Letting better players count more helps most.</p>
        </More>
        </More>
      </Card>

      <details className="mt-4 rounded-[22px] bg-surface p-5 sm:p-6">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Disagree? Set the speeds yourself</summary>
        <p className="text-sm text-muted">Your choice changes every skill date, job score and your plan, and is marked as yours. The three always add up to 100%.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["slow", "medium", "fast"] as const).map((k) => (
            <label key={k} className="block text-sm">
              <span className="font-medium">{FUTURE_NAME[k]}: <span className="num">{Math.round(sl[k] * 100)}%</span></span>
              <input type="range" min={0} max={1} step={0.01} value={sl[k]} onChange={(e) => setCustom({ ...sl, [k]: +e.target.value })} className="mt-2" />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn onClick={() => act("override", { weights: sl })} disabled={busy}>Use my numbers</Btn>
          {w.usingOverride && <Btn variant="ghost" onClick={() => { setCustom(null); act("override", { weights: null }); }} disabled={busy}>Go back to Runway&apos;s numbers</Btn>}
        </div>
      </details>

    </div>
  );
}
