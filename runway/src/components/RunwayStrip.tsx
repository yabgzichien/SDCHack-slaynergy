"use client";
import type { Plan } from "@/lib/engine/plan";

// Runway's own element: the weeks you have, as a runway, with the plan laid on it.
// Each plan step is a segment; done steps are filled in the data hue; the weeks left over after the plan stay open.
export function RunwayStrip({ plan, progress, compact }: { plan: Plan; progress: Record<string, boolean>; compact?: boolean }) {
  const total = Math.max(plan.deadlineWeeks, plan.totalWeeks, 1);
  const x = (w: number) => `${(w / total) * 100}%`;
  const spare = plan.deadlineWeeks - plan.totalWeeks;
  return (
    <figure>
      <div className="relative h-11 rounded-2xl bg-surface2" role="img"
        aria-label={`${plan.totalWeeks} weeks of plan inside ${plan.deadlineWeeks} weeks of runway; ${plan.steps.filter((s) => progress[s.id]).length} of ${plan.steps.length} steps done`}>
        {plan.steps.map((s) => (
          <div key={s.id} title={`Weeks ${s.weekStart}–${s.weekEnd}: ${s.title}`}
            className={`absolute top-1.5 bottom-1.5 rounded-lg border-2 border-surface2 ${progress[s.id] ? "bg-accent" : s.kind === "apply" ? "bg-ink/70" : "bg-ink/25"}`}
            style={{ left: x(s.weekStart - 1), width: x(s.weekEnd - s.weekStart + 1) }} />
        ))}
        <div className="absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: `calc(${x(plan.deadlineWeeks)} - 1px)` }} aria-hidden />
      </div>
      {!compact && (
        <figcaption className="num mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted">
          <span>Week 1</span>
          <span>{spare >= 0 ? `${spare} weeks to spare` : `${-spare} weeks over`}</span>
          <span>Week {plan.deadlineWeeks}: your runway ends</span>
        </figcaption>
      )}
      {!compact && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-ink/25" />Learning</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-ink/70" />Applying</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-accent" />Done</span>
        </p>
      )}
    </figure>
  );
}
