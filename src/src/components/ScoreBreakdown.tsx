"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Raiser, ScoreLine } from "@/lib/engine/matching";
import { FORECAST, type Speed } from "@/lib/speed";
import { FUTURE_NAME, H, More } from "@/components/ui";

type Breakdown = { lines: ScoreLine[]; total: number; raisers: Raiser[] };
const EASE = [0.22, 1, 0.36, 1] as const;
// The points a change would add, drawn faintly after the bar: striped, so it never reads as points already earned.
const GHOST = "repeating-linear-gradient(135deg, var(--rise) 0 3px, transparent 3px 6px)";
// Most points each part can give (its weight); the adjustments have no bar.
const MAX: Record<string, number> = { overlap: 25, outlook: 30, demand: 20, reach: 15, interest: 10 };

// Why this score, as points that add up exactly to the score shown, and what would raise it (docs/adr/0003). It follows
// the AI speed picker. Pointing at (or tapping) a raiser shows, faintly on the bars, the points it would add.
export function ScoreBreakdown({ roleId, speed, version }: { roleId: string; speed: Speed; version: string }) {
  const [all, setAll] = useState<Record<string, Breakdown> | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    let live = true;
    fetch(`/api/raise?role=${encodeURIComponent(roleId)}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setAll(d); }).catch(() => {});
    return () => { live = false; };
  }, [roleId, version]);
  const b = all?.[speed] ?? null;
  if (!b) return <div className="h-64 animate-pulse rounded-2xl bg-surface2" aria-label="Working out the score" />;
  const key = (r: Raiser) => r.skillId ?? r.kind;
  const on = b.raisers.find((r) => key(r) === active) ?? null;
  const [top, ...rest] = b.raisers;
  const assumes = speed === FORECAST ? "Worked out with Our forecast." : `Worked out as if AI is ${FUTURE_NAME[speed]} (a preview).`;
  return (
    <>
      <H sub="Points out of 100. Each part can give up to the number shown.">Why this score</H>
      <ul className="space-y-3">
        {b.lines.map((l, i) => {
          const max = MAX[l.key];
          const extra = on?.parts[l.key] ?? 0;
          return (
            <li key={l.key}>
              <div className="flex justify-between gap-3 text-sm">
                <span>{l.label}</span>
                <span className="num shrink-0">
                  {max ? `${l.points} of ${max}` : l.points > 0 ? `plus ${l.points}` : `minus ${-l.points}`}
                  {extra > 0 && <motion.span initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="ml-1.5 font-semibold text-rise">+{extra}</motion.span>}
                </span>
              </div>
              {max && (
                <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-surface2" role="img" aria-label={`${l.label}: ${l.points} of ${max} points`}>
                  <motion.div className="absolute inset-y-0 left-0 rounded-full bg-accent"
                    initial={reduce ? false : { width: 0 }} animate={{ width: `${(l.points / max) * 100}%` }} transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE, delay: i * 0.06 }} />
                  <motion.div aria-hidden className="absolute inset-y-0 rounded-r-full" style={{ left: `${(l.points / max) * 100}%`, backgroundImage: GHOST, backgroundColor: "var(--rise-soft)" }}
                    initial={false} animate={{ width: `${(Math.min(extra, max - l.points) / max) * 100}%`, opacity: extra > 0 ? 1 : 0 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.35, ease: EASE }} />
                </div>
              )}
            </li>
          );
        })}
        <li className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <span className="text-sm font-semibold">Score</span>
          <span className="num text-xl font-semibold" aria-live="polite">
            {b.total}
            {on && <motion.span initial={reduce ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="ml-2 text-base text-rise">→ {b.total + on.points}</motion.span>}
          </span>
        </li>
      </ul>

      <div className="mt-5">
        <p className="text-sm font-semibold">What would raise it</p>
        {top ? (
          <>
            <RaiserRow r={top} active={active === key(top)} onActive={(v) => setActive(v ? key(top) : null)} />
            {rest.length > 0 && (
              <More summary={`More ways to raise it (${rest.length})`}>
                <ul className="space-y-1.5">{rest.map((r) => <li key={key(r)}><RaiserRow r={r} active={active === key(r)} onActive={(v) => setActive(v ? key(r) : null)} /></li>)}</ul>
              </More>
            )}
          </>
        ) : <p className="mt-1 text-sm text-muted">You already have every skill this job lists, and more hours would not make it ready sooner.</p>}
        <p className="mt-2 text-xs text-muted">{assumes} Each change is worked out on its own, so two changes together may add a different amount.</p>
      </div>
    </>
  );
}

function RaiserRow({ r, active, onActive }: { r: Raiser; active: boolean; onActive: (v: boolean) => void }) {
  return (
    <div className={`mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl px-4 py-2.5 text-sm transition-colors ${active ? "bg-risesoft" : "bg-raised"}`}
      onMouseEnter={() => onActive(true)} onMouseLeave={() => onActive(false)}>
      <button type="button" className="min-h-9 min-w-0 flex-1 text-left" aria-pressed={active} onFocus={() => onActive(true)} onBlur={() => onActive(false)} onClick={() => onActive(true)}>
        <span className="font-medium">{r.kind === "skill" ? `Learn ${r.name.toLowerCase()}` : `Study ${r.hoursPerWeek} hours a week`}</span>
        <span className="num ml-2 font-semibold text-rise">+{r.points} points</span>
      </button>
      {r.course ? (
        <a href={r.course.url} target="_blank" rel="noreferrer" className="text-xs text-muted underline decoration-control underline-offset-2 hover:text-ink">{r.course.provider}, {r.course.hours} hours</a>
      ) : r.kind === "hours" ? <span className="text-xs text-muted">Ready sooner</span> : null}
    </div>
  );
}
