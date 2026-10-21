"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { RunwayStrip } from "@/components/RunwayStrip";
import { Btn, Card, Chip, H, More, PageTitle, SdgTag, Skeleton, SourceChip } from "@/components/ui";
import { activityHref, BadgePanel, Portfolio } from "@/components/Pathway";
import type { PlanStep } from "@/lib/engine/plan";

const STRAND: Record<PlanStep["strand"], string> = { job: "Job skills", ai: "AI at work", people: "People skills" };


// One question: what do I do next?
export default function PlanPage() {
  const { view, state, act, busy } = useApp();
  if (!view || !state) return <Skeleton lines={6} />;
  const plan = view.plan;
  if (!state.profile || !plan) return <div><PageTitle title="Your plan">Choose a job first, and Jobbery lays out the weeks.</PageTitle><Btn href={state.profile ? "/jobs" : "/start"}>{state.profile ? "Choose a job" : "Get started"}</Btn></div>;
  const prog = view.pathway.done;
  const next = plan.steps.find((s) => !prog[s.id]) ?? null;
  const done = plan.steps.filter((s) => prog[s.id]).length;
  const a = state.approval;

  return (
    <div>
      <PageTitle title={next ? `Next: ${next.title}` : "Every step is done. Well done."}>
        {next ? `${next.weekStart === next.weekEnd ? `Week ${next.weekStart}` : `Weeks ${next.weekStart}–${next.weekEnd}`} of your plan for ${plan.title}, about ${Math.round(next.hours)} hours.` : `You finished the plan for ${plan.title}. Tell your counsellor.`}
      </PageTitle>

      {plan.kind === "bridge" && plan.stayIn && <p className="-mt-2 mb-4 text-sm text-muted">You keep working as {plan.stayIn.toLowerCase()} for income while you train. <Link href="/jobs" className="underline decoration-control underline-offset-2 hover:text-ink">Change</Link></p>}
      {plan.kind === "reshape" && <p className="-mt-2 mb-4 text-sm text-muted">You stay in your job and add the skills that are growing in it. <Link href="/jobs" className="underline decoration-control underline-offset-2 hover:text-ink">Change</Link></p>}
      {next && (
        <Card tone="raised">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <p className="text-sm text-muted">{STRAND[next.strand]} · {next.provider ? `${next.provider} · ${next.cost}` : next.kind === "apply" ? "Applications" : next.kind === "adapt" ? "At work" : next.activity ? "In Jobbery" : "Practice"}</p>
              <h2 className="mt-1 text-xl font-medium">{next.url ? <a href={next.url} target="_blank" rel="noreferrer" className="underline decoration-control underline-offset-4 hover:decoration-ink">{next.title}</a> : next.title}</h2>
              {next.skills.length > 0 && <p className="mt-2 text-sm">Builds {next.skills.map((k) => k.name.toLowerCase()).join(", ")}.</p>}
              {next.shortLivedNote && <p className="mt-2 text-sm text-fall">{next.shortLivedNote}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip tone={next.funding.startsWith("Free") ? "rise" : "accent"}>{next.funding}</Chip>
                {[...new Map(next.skills.map((k) => [k.sdgTarget, k])).values()].map((k) => <SdgTag key={k.sdgTarget} target={k.sdgTarget} why={k.sdgWhy} />)}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {next.activity === "resume" ? (
              <>
                <Btn href="/resume" className="min-h-12 px-6 text-base">{view.resume ? "Open your resume fixes" : "Scan your resume"}</Btn>
                <Btn variant="ghost" className="min-h-12" disabled={busy || !view.resume} onClick={() => act("pathwaySave", { work: { resumeApplied: true } })}>I have applied the fixes</Btn>
              </>
            ) : next.activity ? (
              <Btn href={activityHref(next)!} className="min-h-12 px-6 text-base">{next.activity === "task" ? "Take the quiz" : "Start"}</Btn>
            ) : (
              <>
                <Btn onClick={() => act("progress", { stepId: next.id, done: true })} disabled={busy} className="min-h-12 px-6 text-base">Mark as done</Btn>
                {next.url && <Btn href={next.url} variant="ghost" className="min-h-12">Open the course</Btn>}
              </>
            )}
          </div>
          {next.activity === "resume" && !view.resume && <p className="mt-3 text-xs text-muted">Scan your resume first. Add the courses you finish and your portfolio piece as you go.</p>}
          {next.activity && next.activity !== "resume" && <p className="mt-3 text-xs text-muted">This step is done when you save the work in Jobbery.</p>}
          {next.checked && <p className="mt-3 text-xs text-muted">Link checked {next.checked}. Hours are estimates.</p>}
        </Card>
      )}

      <Card className="mt-4">
        <H sub={`${done} of ${plan.steps.length} steps done · ${plan.totalWeeks} weeks at ${state.profile.hoursPerWeek} hours a week · three strands: job skills, AI at work, people skills`}>Your runway</H>
        <RunwayStrip plan={plan} progress={prog} />
        <ol className="mt-5 space-y-1.5">
          {plan.steps.map((s) => (
            <li key={s.id}>
              {s.activity ? (
                <Link href={activityHref(s)!} className={`press flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-2 ${prog[s.id] ? "bg-surface2 text-muted" : "bg-raised hover:bg-surface2"}`}>
                  <input type="checkbox" tabIndex={-1} readOnly aria-label={prog[s.id] ? "Done" : "Not done yet"} className="pointer-events-none h-5 w-5 shrink-0 accent-[var(--accent)]" checked={!!prog[s.id]} />
                  <span className="num w-24 shrink-0 text-sm text-muted">{s.weekStart === s.weekEnd ? `Week ${s.weekStart}` : `Weeks ${s.weekStart}–${s.weekEnd}`}</span>
                  <span className={`min-w-0 flex-1 text-sm ${prog[s.id] ? "line-through" : ""}`}>{s.title}</span>
                  <Chip tone={s.strand === "ai" ? "accent" : "neutral"}>{STRAND[s.strand]}</Chip>
                </Link>
              ) : (
                <label className={`flex min-h-12 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-2 ${prog[s.id] ? "bg-surface2 text-muted" : "bg-raised"}`}>
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--accent)]" checked={!!prog[s.id]} onChange={(e) => act("progress", { stepId: s.id, done: e.target.checked })} />
                  <span className="num w-24 shrink-0 text-sm text-muted">{s.weekStart === s.weekEnd ? `Week ${s.weekStart}` : `Weeks ${s.weekStart}–${s.weekEnd}`}</span>
                  <span className={`min-w-0 flex-1 text-sm ${prog[s.id] ? "line-through" : ""}`}>{s.title}</span>
                  {s.shortLived && <Chip tone="fall">Short-lived skill</Chip>}
                  {s.strand !== "job" && <Chip tone={s.strand === "ai" ? "accent" : "neutral"}>{STRAND[s.strand]}</Chip>}
                </label>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">{plan.note}</p>
      </Card>

      <Portfolio />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7" tone={a.status === "approved" ? "rise" : undefined}>
          <H>Counsellor review</H>
          {a.status === "draft" && (<><p className="text-sm">Send the plan to a counsellor, such as an employment officer. They review it, add a note and approve it.</p><p className="mt-1 text-xs text-muted">No partnership with any agency is implied.</p><div className="mt-3"><Btn onClick={() => act("submit")} disabled={busy}>Send to my counsellor</Btn></div></>)}
          {a.status === "submitted" && (<><p className="text-sm">Waiting for your counsellor. For the demo, open the counsellor view and review it as them.</p><div className="mt-3"><Btn href="/counsellor" variant="ghost">Open the counsellor view</Btn></div></>)}
          {a.status === "approved" && (<><p className="text-sm font-medium">Approved by your counsellor.</p>{a.note && <p className="mt-2 rounded-2xl bg-raised p-3 text-sm">&ldquo;{a.note}&rdquo;</p>}</>)}
          <BadgePanel />
        </Card>
        <Card className="lg:col-span-5" tone="accent">
          <H>How this plan helps the UN goals</H>
          <p className="text-sm">{plan.kind === "reshape" ? "Keeping your skills up to date in your job supports:" : "Retraining for a lasting job supports:"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{[...new Map(plan.summary.layer1.map((t) => [t.split(".")[0], t])).values()].map((t) => <SdgTag key={t} target={t} />)}</div>
          <More summary="What the goals say"><p>UN targets {plan.summary.layer1.join(", ")}.</p><p>{plan.summary.layer2}</p></More>
          <div className="mt-2"><SourceChip name="UN SDG targets" date="official text" url="https://sdgs.un.org/goals" /></div>
        </Card>
      </div>

      <p className="mt-6 text-sm text-muted">
        {view.resume ? <>Your resume shows {view.resumeTips ? Math.round(view.resumeTips.match * 100) : 0}% of this job&apos;s key skills. </> : null}
        <Link href="/resume" className="underline decoration-control underline-offset-2 hover:text-ink">{view.resume ? "Tailor your resume for this job" : "Scan your resume"}</Link>
      </p>
    </div>
  );
}
