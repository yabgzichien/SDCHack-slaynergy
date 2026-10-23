"use client";
import { useApp } from "@/components/AppProvider";
import { Card, Estimate, FUTURE_COLOR, FUTURE_PLAIN, FutureBar, More, pct } from "@/components/ui";

// How the three AI speeds get their chances. Shown on the market page.
export function ForecastDetails() {
  const { view } = useApp();
  if (!view) return null;
  const w = view.world;
  const r = w.replay;

  return (
    <section id="how" className="forecast-section forecast-results" aria-labelledby="forecast-purpose-title">
      <div className="forecast-section-heading"><h2 id="forecast-purpose-title">Why forecasts matter</h2></div>
      <p className="mb-3 text-sm text-muted">Nobody knows how fast AI will change jobs. Jobbery keeps three possible speeds in mind and uses the predictions and the real numbers to decide which is most likely. That decides the dates you see for your skills and jobs.</p>

      <Card tone="raised">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">The AI outlook</h3>
          <span className="text-sm text-muted">{w.release ? "Updated with the Apr to Jun 2026 numbers" : "Using numbers up to Mar 2026"}</span>
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
        <More summary="How we calculate this">
          <ol className="list-decimal space-y-2 pl-5">
          <li>Each speed (slow, medium, fast) predicts what the next official numbers will be: Malaysian job ads and AI test scores.</li>
          <li>When the real numbers come out, the speed that predicted best becomes more likely.</li>
          <li>Before then, players make predictions on the questions above. Players who were right before count more.</li>
        </ol>
        <More summary="Methods and accuracy">
          <ul className="list-disc space-y-1 pl-5">
            {w.futures.map((f) => <li key={f.id}><span className="text-ink">{f.name}:</span> {f.blurb}</li>)}
          </ul>
          <p>The sources are DOSM Job Market Insights (job ads) and Epoch AI benchmark results (AI test scores). Replaying {r.questions} past releases set today&apos;s starting chances. Until the next release, the market&apos;s prices tilt them a little.</p>
          <p>In this demo the other players are made by the computer, and most of them read the three futures themselves, so their prices mostly echo them. The new information comes from the real releases. Your predictions are scored the same way, but one player can only move the Yes % a little.</p>
          <p className="text-ink">How accurate was it on the {r.questions} replayed questions? (error score: 0 is perfect, lower is better)</p>
          <dl className="num max-w-md space-y-1.5">
            {[
              ["Players, with better players counting more", r.brierWeighted],
              ["The Yes % on each question", r.brierLmsr],
              ["All players counting the same", r.brierUnweighted],
              [`${r.bestFuture} on its own`, r.brierBestFuture],
              ["Always saying 50%", r.brierCoin],
              ["Always predicting what usually happened before", r.brierBaseRate],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3"><dt>{k as string}</dt><dd>{(v as number).toFixed(3)}</dd></div>
            ))}
          </dl>
          <p>Honestly: nothing here beats a coin flip by much, because one quarter&apos;s change is hard to call, and the gaps between the top rows are too small to matter. We also tried other public signals (seasonal patterns, the overall hiring cycle, other AI tests moving together); none did better. So the predictions do not make the app smarter than its own model. Its job is to keep score in public: every question settles on an official release, so the three AI speeds are judged on real numbers, not on opinion.</p>
        </More>
        </More>
      </Card>

      <div className="mt-4 rounded-[22px] bg-surface p-5 text-sm sm:p-6">
        <p className="font-medium">Think we&apos;re wrong?</p>
        <p className="mt-1 text-muted">Make your own prediction on an open question. It is scored when the official numbers come out, and good predictors move these numbers more.</p>
        <a href="#open-questions" className="mt-2 inline-block underline decoration-control underline-offset-2 hover:text-ink">Go to the open questions</a>
      </div>

    </section>
  );
}
