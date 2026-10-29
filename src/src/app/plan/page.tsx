"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { JobberyStrip } from "@/components/JobberyStrip";
import { Btn, Card, Chip, H, PageTitle, SdgTag, Skeleton, SourceChip, sdgName } from "@/components/ui";
import { SdgIcon } from "@/components/SdgIcon";
import { roleById, sdg as SDG_TARGETS } from "@/lib/engine/data";
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
  // The plan's goals plus the new job's own goal, so every goal the plan serves gets a tile.
  const jobTarget = roleById[plan.roleId]?.sdg.target;
  const targets = [...new Set([...(jobTarget ? [jobTarget] : []), ...plan.summary.layer1])];

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
          <H>How this plan helps the UN goals</H>
          <ul className="space-y-3">
            {[...new Set(targets.map((t) => t.split(".")[0]))].map((g) => (
              <li key={g} className="rounded-2xl bg-raised p-4">
                <div className="flex items-center gap-4">
                  <SdgIcon goal={Number(g)} size={76} />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-tight">UN goal {g}: {sdgName(`${g}.1`)}</p>
                    <details className="group mt-2">
                      <summary className="press inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full bg-cuesoft px-3 py-1 text-sm font-semibold text-cueink hover:bg-primary [&::-webkit-details-marker]:hidden">
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="transition-transform group-open:rotate-90"><path d="M5 3.5 8.5 7 5 10.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        See why
                      </summary>
                      <div className="mt-3 space-y-2 text-sm text-muted">
                        {targets.filter((t) => t.split(".")[0] === g).map((t) => <p key={t}><span className="num font-semibold text-ink">Target {t}.</span> {SDG_TARGETS[t]?.text}</p>)}
                      </div>
                    </details>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2"><SourceChip name="UN SDG targets" date="official text" url="https://sdgs.un.org/goals" /></div>
        </Card>
      </div>

    </div>
  );
}
