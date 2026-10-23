"use client";
import type { Plan } from "@/lib/engine/plan";

// Runway's own element: the weeks you have, as a runway, with the plan laid on it.
// Each plan step is a segment coloured by its kind (learning, AI task, applying); done steps turn green; the weeks left over after the plan stay open.
// The resume step is short and shares week 1 with the first course, so it sits on a thin lane below.
const thin = (s: Plan["steps"][number]) => s.activity === "resume";
export function RunwayStrip({ plan, progress, compact }: { plan: Plan; progress: Record<string, boolean>; compact?: boolean }) {
  const total = Math.max(plan.deadlineWeeks, plan.totalWeeks, 1);
  const x = (w: number) => `${(w / total) * 100}%`;
  const spare = plan.deadlineWeeks - plan.totalWeeks;
  const ps = plan.steps.filter(thin);
  const people = ps.map((s) => {
    const same = ps.filter((o) => o.weekStart === s.weekStart);
    return { s, i: same.indexOf(s), n: same.length };
  });
  return (
    <figure>
      <div className="relative h-11 rounded-2xl bg-surface2" role="img"
        aria-label={`${plan.totalWeeks} weeks of plan inside the ${plan.deadlineWeeks} weeks you have; ${plan.steps.filter((s) => progress[s.id]).length} of ${plan.steps.length} steps done`}>
        {plan.steps.filter((s) => !thin(s)).map((s) => (
          <div key={s.id} title={`Weeks ${s.weekStart}–${s.weekEnd}: ${s.title}`}
            className={`absolute top-1.5 bottom-1.5 rounded-lg border-2 border-surface2 ${progress[s.id] ? "bg-accent" : s.kind === "apply" ? "bg-laneapply" : s.strand === "ai" ? "bg-laneai" : "bg-lanelearn"}`}
            style={{ left: x(s.weekStart - 1), width: x(s.weekEnd - s.weekStart + 1) }} />
        ))}
        <div className="absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: `calc(${x(plan.deadlineWeeks)} - 1px)` }} aria-hidden />
      </div>
      {people.length > 0 && (
        <div className="relative mt-1 h-3" aria-hidden>
          {people.map(({ s, i, n }) => (
            <div key={s.id} title={`Week ${s.weekStart}: ${s.title}`}
              className={`absolute top-0 bottom-0 rounded-full border border-surface ${progress[s.id] ? "bg-accent" : "bg-laneresume"}`}
              style={{ left: `calc(${x(s.weekStart - 1)} + ${(i / n) * 100}% / ${total})`, width: `calc(${100 / n}% / ${total})` }} />
          ))}
        </div>
      )}
      {!compact && (
        <figcaption className="num mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted">
          <span>Week 1</span>
          <span>{spare >= 0 ? `${spare} weeks to spare` : `${-spare} weeks over`}</span>
          <span>Week {plan.deadlineWeeks}: your deadline</span>
        </figcaption>
      )}
      {!compact && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-lanelearn" />Learning</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-laneai" />AI task</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-laneapply" />Applying</span>
          {people.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-4 rounded-full bg-laneresume" />Resume rewrite (thin lane)</span>}
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-accent" />Done</span>
        </p>
      )}
    </figure>
  );
}
