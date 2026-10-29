"use client";
import Link from "next/link";
import type { View } from "@/lib/engine/view";
import { FORECAST, type Speed } from "@/lib/speed";
import { useSpeed } from "./useSpeed";
import { useT } from "./I18nProvider";
import { FUTURE_COLOR, FUTURE_NAME, More } from "./ui";

// One AI speed picker for Skills, Jobs, a job's page and Plan (docs/adr/0002). "Our forecast" is the default; picking a
// speed previews the app as if that speed were certain. Kept in this browser; it never saves weights or changes the plan.
export function SpeedBar({ view, children }: { view: View; children?: React.ReactNode }) {
  const { speed, setSpeed } = useSpeed();
  // The pill labels are translated here: the page translator would read "Slow" and "45% likely" as one sentence.
  const { t } = useT();
  const futures = view.pace.futures;
  const mostly = [...futures].sort((a, b) => b.weight - a.weight)[0];
  const options: { id: Speed; label: string; sub: string; color?: string }[] = [
    { id: FORECAST, label: t("Our forecast"), sub: t("mostly {x}", { x: t(FUTURE_NAME[mostly.id]) }) },
    ...futures.map((f) => ({ id: f.id as Speed, label: t(FUTURE_NAME[f.id]), sub: t("{p}% likely", { p: Math.round(f.weight * 100) }), color: FUTURE_COLOR[f.id] })),
  ];
  return (
    <section aria-label="AI speed" className="rounded-[22px] bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold">AI speed</h2>
        <div role="radiogroup" aria-label="AI speed" className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = o.id === speed;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setSpeed(o.id)} data-no-translate
                className={`press inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm ${on ? "bg-primary text-primaryink" : "bg-raised hover:bg-surface2"}`}>
                {o.color && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />}
                <span className="font-medium">{o.label}</span>
                <span className={`num text-xs ${on ? "opacity-80" : "text-muted"}`}>{o.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        {speed === FORECAST
          ? <>Our forecast blends the three speeds, weighted by real releases and the prediction game. <Link href="/market" className="underline decoration-control underline-offset-2 hover:text-ink">How the forecast works</Link></>
          : <>Previewing {FUTURE_NAME[speed]} AI as if it were certain. This is an estimate, and nothing is saved: your plan stays the same unless you choose another job.</>}
      </p>
      {children}
      <More summary="What does a speed change?">
        <p>Each speed is a stated set of assumptions:</p>
        <ul className="list-disc pl-5">
          <li>How fast companies start using AI. This moves your skill dates and each job&apos;s future outlook.</li>
          <li>How fast office admin job ads shrink. A speed projects them {view.scenarios?.[0]?.clerical.quarters ?? 4} quarters ahead ({futures.map((f) => `${FUTURE_NAME[f.id].toLowerCase()}: ${Math.abs(f.clericalPerYear).toFixed(1)} fewer in every 100 ads a year`).join(", ")}). That is a projection, not a DOSM figure. Our forecast uses the real DOSM figures.</li>
          <li>How fast AI benchmarks improve. This is shown on the Skills page and settles the prediction game&apos;s questions, but it doesn&apos;t change the job ranking.</li>
        </ul>
      </More>
    </section>
  );
}
