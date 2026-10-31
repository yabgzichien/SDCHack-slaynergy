"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { EventView } from "@/lib/engine/world";
import { Chip } from "./ui";
import { positionRows, type PositionRow } from "@/lib/positions";

const signed = (n: number) => `${n >= 0.5 ? "+" : Math.round(n) < 0 ? "−" : ""}${Math.abs(Math.round(n))} points`;

function Figure({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return <div><dt className="text-xs text-muted">{k}</dt><dd className={`num font-medium ${tone ?? ""}`}>{v}</dd></div>;
}

function Row({ r }: { r: PositionRow }) {
  const tone = r.gain >= 0.5 ? "text-rise" : r.gain <= -0.5 ? "text-fall" : "";
  return (
    <li>
      <Link href={`/market/${encodeURIComponent(r.eventId)}`} className="press flex items-center gap-3 rounded-2xl bg-surface2/60 px-4 py-3 hover:bg-surface2">
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
          <div className="min-w-0">
            <p className="font-medium leading-snug">{r.title}</p>
            <p className="mt-0.5 text-sm text-muted">{r.label}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              {r.sides.map((s) => <Chip key={s} tone={s === "yes" ? "rise" : "fall"}>{s === "yes" ? "Yes" : "No"}</Chip>)}
              {r.outcome === null ? <span className="num text-xs text-muted">Now {Math.round(r.yesNow * 100)}% think Yes</span> : <span className="text-xs text-muted">The answer was {r.outcome ? "Yes" : "No"}</span>}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm md:flex md:gap-6">
            {r.outcome === null ? <>
              <Figure k="Put in" v={`${r.put.toFixed(0)} points`} />
              <Figure k="Back if right" v={`${r.back.toFixed(0)} points`} />
              <Figure k="Worth now" v={`${r.worth.toFixed(0)} points`} />
            </> : <Figure k="Result" v={signed(r.gain)} tone={tone} />}
          </dl>
        </div>
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

// Everything you have predicted, on one card, so you do not have to open each question to find it.
export function YourPredictions({ events, settled }: { events: EventView[]; settled: EventView[] }) {
  const rows = positionRows(events, settled);
  const open = rows.filter((r) => r.outcome === null), done = rows.filter((r) => r.outcome !== null);
  const put = open.reduce((a, r) => a + r.put, 0), worth = open.reduce((a, r) => a + r.worth, 0);
  return (
    <section id="your-predictions" className="forecast-section mb-6" aria-labelledby="your-predictions-title">
      <div className="forecast-section-heading">
        <h2 id="your-predictions-title">Your predictions</h2>
        {open.length > 0 && <p className="num text-sm text-muted">{put.toFixed(0)} points in play, worth {worth.toFixed(0)} now</p>}
      </div>
      <div className="rounded-[22px] bg-raised p-4 shadow-[0_1px_3px_rgb(0_0_0/0.06)] sm:p-5">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">You have not made a prediction yet. <a href="#open-questions" className="underline decoration-control underline-offset-2 hover:text-ink">Choose an open question</a> to start.</p>
        ) : (
          <div className="space-y-4">
            {open.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Still open</h3><ul className="space-y-2">{open.map((r) => <Row key={r.key} r={r} />)}</ul></div>}
            {done.length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Answered</h3><ul className="space-y-2">{done.map((r) => <Row key={r.key} r={r} />)}</ul></div>}
          </div>
        )}
      </div>
    </section>
  );
}
