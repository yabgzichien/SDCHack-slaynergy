"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { JobberyStrip } from "@/components/JobberyStrip";
import { Btn, Card, Chip, FUTURE_COLOR, FUTURE_NAME, H, PageTitle, SdgTag, Skeleton, SourceChip, sdgName } from "@/components/ui";
import { useSpeed } from "@/components/useSpeed";
import { useSelectJob } from "@/components/useSelectJob";
import type { View } from "@/lib/engine/view";
import type { Plan } from "@/lib/engine/plan";
import { SdgIcon } from "@/components/SdgIcon";
import { sdg as SDG_TARGETS } from "@/lib/engine/data";
import { activityHref, BadgePanel, BadgeShelf, Portfolio } from "@/components/Pathway";
import { AdvisorCard } from "@/components/Meetings";
import { STRAND_STYLE } from "@/components/strands";
import { Check } from "lucide-react";


// One question: what do I do next?
export default function PlanPage() {
  const { view, state, act, busy } = useApp();
  if (!view || !state) return <Skeleton lines={6} />;
  const plan = view.plan;
  if (!state.profile || !plan) return <div><PageTitle title="Your plan">Choose a job first, and Jobbery lays out the weeks.</PageTitle><Btn href={state.profile ? "/jobs" : "/start"}>{state.profile ? "Choose a job" : "Get started"}</Btn></div>;
  const prog = view.pathway.done;
  const next = plan.steps.find((s) => !prog[s.id]) ?? null;
  const done = plan.steps.filter((s) => prog[s.id]).length;

  return (
    <div className="plan-page">
      <PageTitle title={next ? (
        <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2">
          <span className="text-[0.48em] font-semibold tracking-normal text-muted">Next:</span>
          <span className="min-w-0 max-w-full rounded-[0.18em] bg-cuesoft px-[0.18em] py-[0.05em] text-cueink [box-decoration-break:clone] [overflow-wrap:anywhere]">{next.title}</span>
        </span>
      ) : "Every step is done. Well done."}>
        {next ? `${next.weekStart === next.weekEnd ? `Week ${next.weekStart}` : `Weeks ${next.weekStart}–${next.weekEnd}`} of your plan for ${plan.title}, about ${Math.round(next.hours)} hours.` : `You finished the plan for ${plan.title}. Get your badge below.`}
      </PageTitle>

      {plan.kind === "bridge" && plan.stayIn && <p className="-mt-2 mb-4 text-sm text-muted">You keep working as {plan.stayIn.toLowerCase()} for income while you train. <Link href="/jobs" className="underline decoration-control underline-offset-2 hover:text-ink">Change</Link></p>}
      {plan.kind === "reshape" && <p className="-mt-2 mb-4 text-sm text-muted">You stay in your job and add the skills that are growing in it. <Link href="/jobs" className="underline decoration-control underline-offset-2 hover:text-ink">Change</Link></p>}
      {next && (() => {
        const st = STRAND_STYLE[next.strand];
        const Icon = st.icon;
        return (
          <Card tone="raised" className="ring-2 ring-cue">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cue px-2.5 py-0.5 text-xs font-semibold text-white">Next step</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.soft} ${st.ink}`}><Icon size={13} aria-hidden />{st.label}</span>
                  <span className="text-xs text-muted">{next.provider ? `${next.provider} · ${next.cost}` : next.kind === "apply" ? "Applications" : next.kind === "adapt" ? "At work" : next.activity ? "In Jobbery" : "Practice"}</span>
                </div>
                <h2 className="mt-2 text-xl font-medium">{next.url ? <a href={next.url} target="_blank" rel="noreferrer" className="underline decoration-control underline-offset-4 hover:decoration-ink">{next.title}</a> : next.title}</h2>
                {next.skills.length > 0 && <p className="mt-2 text-sm">Builds {next.skills.map((k) => k.name.toLowerCase()).join(", ")}.</p>}
                {next.shortLivedNote && <p className="mt-2 text-sm text-fall">{next.shortLivedNote}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Chip tone={next.funding.startsWith("Free") ? "rise" : "accent"}>{next.funding}</Chip>
                  {[...new Map(next.skills.map((k) => [k.sdgTarget, k])).values()].map((k) => <SdgTag key={k.sdgTarget} target={k.sdgTarget} why={k.sdgWhy} />)}
                </div>
                {next.activity === "resume" && <p className="mt-3 text-xs text-muted">Your resume is rebuilt with the skills from your finished courses. No new upload needed.</p>}
                {next.activity === "task" && <p className="mt-3 text-xs text-muted">This step is done when you pass the quiz.</p>}
                {next.activity === "meeting" && <p className="mt-3 text-xs text-muted">Pick any topic: a mock interview, your resume, courses, or something else. This step is ticked as soon as you book.</p>}
                {next.checked && <p className="mt-3 text-xs text-muted">Link checked {next.checked}. Hours are estimates.</p>}
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                {next.activity ? (
                  <Btn href={activityHref(next)!} className="min-h-12 px-6 text-base">{next.activity === "task" ? "Take the quiz" : next.activity === "meeting" ? "Book a meeting" : "Open your updated resume"}</Btn>
                ) : (
                  <>
                    <Btn onClick={() => act("progress", { stepId: next.id, done: true })} disabled={busy} className="min-h-12 px-6 text-base">Mark as done</Btn>
                    {next.url && <Btn href={next.url} variant="ghost" className="min-h-12">Open the course</Btn>}
                    {next.skillKey && !!next.alternatives && <Btn href={`/courses?skill=${next.skillKey.split("+")[0]}`} variant="quiet" className="min-h-12">Choose a different course</Btn>}
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })()}

      <SpeedPlans view={view} planRoleId={plan.roleId} planTitle={plan.title} />

      <Card className="mt-4">
        <H sub={`${done} of ${plan.steps.length} steps done · ${plan.totalWeeks} weeks at ${state.profile.hoursPerWeek} hours a week`}>Your learning</H>
        <div className="mb-4 flex flex-wrap gap-2">
          {(["job", "ai", "people"] as const).map((k) => {
            const st = STRAND_STYLE[k]; const Icon = st.icon;
            const of = plan.steps.filter((x) => x.strand === k), d = of.filter((x) => prog[x.id]).length;
            return of.length ? <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${st.soft} ${st.ink}`}><Icon size={15} aria-hidden />{st.label} <span className="num">{d}/{of.length}</span></span> : null;
          })}
        </div>
        <JobberyStrip plan={plan} progress={prog} />
        <ol className="mt-5 space-y-1.5">
          {plan.steps.map((s) => (
            <li key={s.id}>
              {s.activity ? (
                <Link href={activityHref(s)!} className={`press flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-l-4 px-4 py-2 ${STRAND_STYLE[s.strand].bar} ${prog[s.id] ? "bg-surface2 text-muted" : next?.id === s.id ? "bg-cuesoft ring-1 ring-cue" : "bg-raised hover:bg-surface2"}`}>
                  <span aria-label={prog[s.id] ? "Done" : "Not done yet"} className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${prog[s.id] ? "border-rise bg-rise text-white" : "border-control bg-raised"}`}>{prog[s.id] && <Check size={13} strokeWidth={3} aria-hidden />}</span>
                  <span className="num w-24 shrink-0 text-sm text-muted">{s.weekStart === s.weekEnd ? `Week ${s.weekStart}` : `Weeks ${s.weekStart}–${s.weekEnd}`}</span>
                  <span className={`min-w-0 flex-1 text-sm ${prog[s.id] ? "line-through" : ""}`}>{s.title}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STRAND_STYLE[s.strand].soft} ${STRAND_STYLE[s.strand].ink}`}>{STRAND_STYLE[s.strand].label}</span>
                </Link>
              ) : (
                <label className={`flex min-h-12 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-l-4 px-4 py-2 ${STRAND_STYLE[s.strand].bar} ${prog[s.id] ? "bg-surface2 text-muted" : next?.id === s.id ? "bg-cuesoft ring-1 ring-cue" : "bg-raised"}`}>
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--rise)]" checked={!!prog[s.id]} onChange={(e) => act("progress", { stepId: s.id, done: e.target.checked })} />
                  <span className="num w-24 shrink-0 text-sm text-muted">{s.weekStart === s.weekEnd ? `Week ${s.weekStart}` : `Weeks ${s.weekStart}–${s.weekEnd}`}</span>
                  <span className={`min-w-0 flex-1 text-sm ${prog[s.id] ? "line-through" : ""}`}>{s.title}</span>
                  {s.swapped && <Chip tone="accent">Your choice</Chip>}
                  {s.shortLived && <Chip tone="fall">Short-lived skill</Chip>}
                  {s.skillKey && !!s.alternatives && <Link href={`/courses?skill=${s.skillKey.split("+")[0]}`} className="text-xs text-muted underline decoration-control underline-offset-2 hover:text-ink">Other courses</Link>}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STRAND_STYLE[s.strand].soft} ${STRAND_STYLE[s.strand].ink}`}>{STRAND_STYLE[s.strand].label}</span>
                </label>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">{plan.note} Every course comes from the <Link href="/courses" className="underline decoration-control underline-offset-2 hover:text-ink">course list</Link>, where you can swap one for another that teaches the same skills.</p>
      </Card>

      <BadgeShelf />

      <Portfolio />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <AdvisorCard />
          <BadgePanel />
        </Card>
        <Card className="lg:col-span-4" tone="accent">
          <div id="sdg-path" className="scroll-mt-24"><SdgPath plan={plan} /></div>
        </Card>
      </div>

    </div>
  );
}

// The plan's hours added up by the UN target of each skill it teaches, plus the target the new job serves
// (docs/adr/0003). Every number here adds up to the plan's total hours.
function SdgPath({ plan }: { plan: Plan }) {
  const p = plan.summary.path;
  const goals = [...new Set([...(p.jobTarget ? [p.jobTarget] : []), ...p.byTarget.map((x) => x.target)].map((t) => t.split(".")[0]))];
  const goalHours = (g: string) => p.byTarget.filter((x) => x.target.split(".")[0] === g).reduce((a, x) => a + x.hours, 0);
  goals.sort((a, b) => goalHours(b) - goalHours(a));
  const free = p.courseHours ? Math.round((p.freeCourseHours / p.courseHours) * 100) : null;
  const learnGoal = p.learningTarget.split(".")[0];
  return (
    <>
      <H sub={`${p.total} hours in your plan, counted by the UN target each skill serves.`}>How this plan helps the UN goals</H>
      {free !== null && <p className="num mb-3 text-sm font-medium">{free}% of the course hours are free ({Math.round(p.freeCourseHours)} of {Math.round(p.courseHours)} hours).</p>}
      <ul className="space-y-3">
        {p.learningHours > 0 && !goals.includes(learnGoal) && (
          <li className="rounded-2xl bg-raised p-4">
            <div className="flex items-center gap-4">
              <SdgIcon goal={Number(learnGoal)} size={76} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold leading-tight">UN goal {learnGoal}: {sdgName(p.learningTarget)}</p>
                <p className="num mt-1 text-sm">{p.learningHours} hours of learning count toward target {p.learningTarget}, skills for work.</p>
                <p className="mt-1 text-xs text-muted">Counted separately: these are the same hours as below, seen as learning.</p>
              </div>
            </div>
          </li>
        )}
        {goals.map((g) => {
          const ts = p.byTarget.filter((x) => x.target.split(".")[0] === g);
          const job = p.jobTarget?.split(".")[0] === g ? p.jobTarget : null;
          return (
            <li key={g} className="rounded-2xl bg-raised p-4">
              <div className="flex items-center gap-4">
                <SdgIcon goal={Number(g)} size={76} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold leading-tight">UN goal {g}: {sdgName(`${g}.1`)}</p>
                  <p className="num mt-1 text-sm">{goalHours(g) ? `${goalHours(g)} hours of your plan` : "Served by your new job"}{goalHours(g) && job ? " · and your new job" : ""}</p>
                  {g === learnGoal && p.learningHours > 0 && <p className="num mt-1 text-sm">{p.learningHours} hours of learning count toward target {p.learningTarget}, skills for work.</p>}
                  <details className="group mt-2">
                    <summary className="press inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full bg-cuesoft px-3 py-1 text-sm font-semibold text-cueink hover:bg-primary [&::-webkit-details-marker]:hidden">
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="transition-transform group-open:rotate-90"><path d="M5 3.5 8.5 7 5 10.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      See why
                    </summary>
                    <div className="mt-3 space-y-2 text-sm text-muted">
                      {ts.map((x) => <p key={x.target}><span className="num font-semibold text-ink">Target {x.target}, {x.hours} hours.</span> {SDG_TARGETS[x.target]?.text}</p>)}
                      {job && !ts.some((x) => x.target === job) && <p><span className="num font-semibold text-ink">Target {job}, your new job.</span> {SDG_TARGETS[job]?.text}</p>}
                    </div>
                  </details>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {p.untagged > 0 && <p className="num mt-3 text-sm text-muted">{p.untagged} hours of work on the job are not tied to one target.</p>}
      <p className="mt-2 text-xs text-muted">A step that teaches several skills splits its hours evenly between them.</p>
      <div className="mt-2"><SourceChip name="UN SDG targets" date="official text" url="https://sdgs.un.org/goals" /></div>
    </>
  );
}

// The job Jobbery would suggest if one AI speed were certain (docs/adr/0002). The plan never follows a preview: the
// person can switch to that job themselves.
function SpeedPlans({ view, planRoleId, planTitle }: { view: View; planRoleId: string; planTitle: string }) {
  const { speed, previewing } = useSpeed();
  const { busy } = useApp();
  const selectJob = useSelectJob();
  if (!view.scenarios?.length) return null;
  return (
    <Card className="mt-4">
      <H sub={`Your plan stays on ${planTitle} unless you choose. These are estimates.`}>If AI moves faster or slower</H>
      <ul className="space-y-1.5">
        {view.scenarios.map((sc) => {
          const same = sc.best?.roleId === planRoleId;
          return (
            <li key={sc.id} className={`flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-2 ${previewing && speed === sc.id ? "bg-cuesoft ring-1 ring-cue" : "bg-raised"}`}>
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FUTURE_COLOR[sc.id] }} />
              <span className="min-w-0 flex-1 text-sm">
                {sc.best ? `Under ${FUTURE_NAME[sc.id]} AI, your best job would be ${sc.best.title} (about ${sc.best.weeks} weeks).` : `Under ${FUTURE_NAME[sc.id]} AI, no job is reachable in your time.`}
              </span>
              {sc.best && (same
                ? <Chip tone="rise">Same as your plan</Chip>
                : <Btn variant="ghost" disabled={busy} onClick={() => selectJob(sc.best!.roleId, null)}>Plan for {sc.best.title} instead</Btn>)}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
