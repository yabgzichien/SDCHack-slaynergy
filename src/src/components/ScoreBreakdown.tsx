"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Raiser, ScoreLine, SkillPoints } from "@/lib/engine/matching";
import { FORECAST, type Speed } from "@/lib/speed";
import { FUTURE_NAME, H, More } from "@/components/ui";

type Breakdown = { lines: ScoreLine[]; total: number; skills: SkillPoints[]; raisers: Raiser[] };
const EASE = [0.22, 1, 0.36, 1] as const;
// The points a change would add, drawn faintly after the bar: striped, so it never reads as points already earned.
const GHOST = "repeating-linear-gradient(135deg, var(--rise) 0 3px, transparent 3px 6px)";
// Most points each part can give (its weight); the adjustments have no bar.
const MAX: Record<string, number> = { overlap: 25, outlook: 30, demand: 20, reach: 15, interest: 10 };

// Why this score, as points that add up exactly to the score shown, and what would raise it (docs/adr/0003). It follows
// the AI speed picker. Pointing at (or tapping) a raiser shows, faintly on the bars, the points it would add.
// onBreakdown hands the lines and total to the page, which shows the equation in its own dropdown.
export function ScoreBreakdown({ roleId, speed, version, onBreakdown }: { roleId: string; speed: Speed; version: string; onBreakdown?: (b: { lines: ScoreLine[]; total: number } | null) => void }) {
  const [all, setAll] = useState<Record<string, Breakdown> | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    let live = true;
    fetch(`/api/raise?role=${encodeURIComponent(roleId)}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setAll(d); }).catch(() => {});
    return () => { live = false; };
  }, [roleId, version]);
  const b = all?.[speed] ?? null;
  useEffect(() => { onBreakdown?.(b ? { lines: b.lines, total: b.total } : null); }, [b, onBreakdown]);
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

      <SkillMarks skills={b.skills} raisers={b.raisers} total={b.total} />

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

// What each of the job's skills adds, biggest first. The two columns add up to the skill overlap and future outlook lines above.
function SkillMarks({ skills, raisers, total }: { skills: SkillPoints[]; raisers: Raiser[]; total: number }) {
  const sum = skills.reduce((a, s) => a + s.points, 0);
  return (
    <div className="mt-6">
      <H sub="A skill you have earns its share of the skill overlap points. Every skill the job lists also earns future outlook points, fewer if AI will take it over sooner.">What each skill adds</H>
      <ul className="space-y-1.5">
        {skills.map((s) => {
          const gain = s.have ? null : raisers.find((r) => r.skillId === s.skillId);
          return (
            <li key={s.skillId} className="rounded-2xl bg-raised px-4 py-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{s.name}</span>
                <span className="num shrink-0 font-semibold">{`+${s.points}`}</span>
              </div>
              <p className="num mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{s.have ? `You have it: ${s.overlap}` : `Not yet yours: ${s.overlap}`}</span>
                <span>{`Future outlook: ${s.outlook}`}</span>
                <span className="inline-flex items-center gap-1"><span className={`size-2 rounded-full ${s.durable ? "bg-rise" : "bg-fall"}`} aria-hidden />{s.durable ? "Stays yours" : "AI will handle"}</span>
                {gain && <span className="font-semibold text-rise">{`Learn it: +${gain.points}`}</span>}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="num mt-2 text-xs text-muted">{`Skills give ${sum} of your ${total} points. The rest is job demand, time to get ready, your interests and any adjustments.`}</p>
    </div>
  );
}

const SYMBOL: Record<string, string> = { overlap: "S", outlook: "F", demand: "D", reach: "R", interest: "I" };
const f2 = (x: number) => x.toFixed(2);

// The same score as an equation. Each part is its value (0 to 1) times its weight; the adjustments are added or taken off.
// Values are the unrounded ones, so the points shown above are these products rounded to add up to the whole score.
// Shown inside the job page's "How we worked this out" dropdown, which already names it.
export function ScoreEquation({ lines, total }: { lines: ScoreLine[]; total: number }) {
  const parts = lines.filter((l) => MAX[l.key]);
  const adj = lines.filter((l) => !MAX[l.key]);
  const sum = lines.reduce((a, l) => a + l.raw, 0);
  const sign = (x: number) => (x < 0 ? "−" : "+");
  return (
    <div className="text-ink">
      <p className="mb-2 text-sm text-muted">Each part is a value from 0 to 1, times its weight. Then the adjustments are added or taken off.</p>
      <div className="overflow-x-auto rounded-2xl bg-surface p-4 sm:p-5">
        <p className="font-serif text-base italic leading-loose sm:text-lg" style={{ fontFamily: "'Times New Roman', Cambria, serif" }}>
          Score <span className="px-1 not-italic">=</span> 100 <span className="not-italic">×</span> (
          {parts.map((l, i) => (
            <span key={l.key}>{i > 0 && <span className="px-1 not-italic">+</span>}<span className="not-italic">{f2(MAX[l.key] / 100)}</span><span className="px-0.5 not-italic">·</span>{SYMBOL[l.key]}</span>
          ))}
          )
          {adj.map((l) => <span key={l.key}><span className="px-1 not-italic">{l.key === "sdg" ? "+" : "−"}</span>{l.key === "risk" ? "P" : l.key === "local" ? "L" : "G"}</span>)}
        </p>
        <table className="mt-4 w-full min-w-[22rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted"><th className="pb-1.5 pr-2 font-normal">Symbol and part</th><th className="pb-1.5 pr-2 text-right font-normal">Value</th><th className="pb-1.5 pr-2 text-right font-normal">Weight</th><th className="pb-1.5 text-right font-normal">Points</th></tr>
          </thead>
          <tbody>
            {parts.map((l) => (
              <tr key={l.key} className="border-t border-line">
                <td className="py-1.5 pr-2"><i className="mr-2 inline-block w-4 font-serif" style={{ fontFamily: "'Times New Roman', serif" }}>{SYMBOL[l.key]}</i>{l.label}</td>
                <td className="num py-1.5 pr-2 text-right">{f2(l.raw / MAX[l.key])}</td>
                <td className="num py-1.5 pr-2 text-right">× {f2(MAX[l.key] / 100)}</td>
                <td className="num py-1.5 text-right">{f2(l.raw / 100)}</td>
              </tr>
            ))}
            {adj.map((l) => (
              <tr key={l.key} className="border-t border-line">
                <td className="py-1.5 pr-2"><i className="mr-2 inline-block w-4 font-serif" style={{ fontFamily: "'Times New Roman', serif" }}>{l.key === "risk" ? "P" : l.key === "local" ? "L" : "G"}</i>{l.label}</td>
                <td className="py-1.5 pr-2" /><td className="py-1.5 pr-2" />
                <td className="num py-1.5 text-right">{sign(l.raw)} {f2(Math.abs(l.raw) / 100)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink/30 font-semibold">
              <td className="py-2 pr-2" colSpan={2}>Total, × 100</td>
              <td className="num whitespace-nowrap py-2 text-right" colSpan={2}>{f2(sum / 100)} × 100 ≈ {total}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">The risk adjustment P grows from 0 to 0.08 as the future outlook falls from 0.70 to 0.40. L grows from 0 to 0.06 when few such jobs are near where you can work. G adds 0.12 when the job serves a goal you picked.</p>
      </div>
    </div>
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
