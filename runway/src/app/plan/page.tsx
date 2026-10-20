"use client";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { StepNav } from "@/components/StepNav";
import { Bar, Btn, Card, Chip, H, PageTitle, SdgTag, Skeleton, SourceChip } from "@/components/ui";

export default function PlanPage() {
  const { view, state, act, busy } = useApp();
  if (!view || !state) return <Skeleton lines={6} />;
  const plan = view.plan;
  if (!state.profile || !plan) return <Card><p>Make a profile and choose a job first.</p><div className="mt-3"><Btn href="/profile">Start with your profile</Btn></div></Card>;
  const done = plan.steps.filter((s) => state.progress[s.id]).length;
  const hoursDone = plan.steps.filter((s) => state.progress[s.id]).reduce((a, s) => a + s.hours, 0);
  const a = state.approval;
  const lastWeek = Math.max(...plan.steps.filter((s) => state.progress[s.id]).map((s) => s.weekEnd), 0);
  return (
    <div>
      <PageTitle step="Step 4 of 4 · Follow a pathway" title={`Your plan: ${plan.title}`}>
        About {plan.totalWeeks} weeks at {state.profile.hoursPerWeek} hours a week, inside your {state.profile.months} months ({plan.deadlineWeeks} weeks). Long-lasting skills come first. {plan.note}
      </PageTitle>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card>
            <H sub={done === plan.steps.length ? "All steps done." : `Week ${Math.max(1, lastWeek)} of ${plan.totalWeeks}`}>Progress</H>
            <div className="flex items-center gap-3">
              <div className="flex-1"><Bar value={done / plan.steps.length} color="var(--rise)" label={`${done} of ${plan.steps.length} steps done`} height={12} /></div>
              <p className="num text-sm font-bold">{Math.round((done / plan.steps.length) * 100)}%</p>
            </div>
            <p className="num mt-1 text-xs text-muted">{done} of {plan.steps.length} steps · {hoursDone.toFixed(0)} hours done · saved for this session</p>
          </Card>

          <ol className="space-y-3">
            {plan.steps.map((s) => (
              <li key={s.id}>
                <Card className={state.progress[s.id] ? "opacity-70" : ""}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 h-6 w-6 shrink-0" checked={!!state.progress[s.id]} onChange={(e) => act("progress", { stepId: s.id, done: e.target.checked })} aria-label={`Mark step done: ${s.title}`} />
                    <div className="min-w-0 flex-1">
                      <p className="num text-xs font-semibold text-accent">{s.weekStart === s.weekEnd ? `Week ${s.weekStart}` : `Weeks ${s.weekStart}–${s.weekEnd}`} · about {Math.round(s.hours)} hours</p>
                      <h3 className="font-semibold leading-snug">{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-accent">{s.title}</a> : s.title}</h3>
                      {s.provider && <p className="text-sm text-muted">{s.provider} · {s.cost}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Chip tone={s.funding.startsWith("Free") ? "rise" : "accent"}>{s.funding}</Chip>
                        {s.shortLived && <Chip tone="fall">Short-lived skill</Chip>}
                        {[...new Map(s.skills.map((k) => [k.sdgTarget, k])).values()].map((k) => <SdgTag key={k.sdgTarget} target={k.sdgTarget} why={k.sdgWhy} />)}
                      </div>
                      {s.skills.length > 0 && <p className="mt-1 text-sm text-muted">Builds: {s.skills.map((k) => k.name).join("; ")}</p>}
                      {s.shortLivedNote && <p className="mt-1 text-sm text-fall">{s.shortLivedNote}</p>}
                      {s.checked && <p className="mt-1 text-xs text-muted">Link checked {s.checked}. Hours are estimates.</p>}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card tone="accent">
            <H>How this plan serves the SDGs</H>
            <p className="text-sm font-semibold">By reskilling, you advance</p>
            <p className="mb-2 mt-1 flex flex-wrap gap-1.5">{plan.summary.layer1.map((t) => <SdgTag key={t} target={t} />)}</p>
            <p className="text-sm font-semibold">Your new job</p>
            <p className="text-sm">{plan.summary.layer2}</p>
            <ul className="mt-3 space-y-1 text-xs text-muted">{view.sdgSummary.map((s) => <li key={s.target}><b>SDG {s.target}:</b> {s.text}</li>)}</ul>
            <div className="mt-2"><SourceChip name="UN SDG targets (official text)" date="sdgs.un.org" url="https://sdgs.un.org/goals" /></div>
          </Card>

          <ResumeTips />

          <Card tone={a.status === "approved" ? "rise" : undefined}>
            <H>Counsellor review</H>
            {a.status === "draft" && (<><p className="text-sm text-muted">Send the plan to a counsellor (for example an employment officer). They review it, add a note and approve it. No partnership with any agency is implied.</p><div className="mt-3"><Btn onClick={() => act("submit")} disabled={busy}>Send to counsellor</Btn></div></>)}
            {a.status === "submitted" && (<><p className="text-sm"><b>Waiting for your counsellor.</b> Switch to <b>Counsellor</b> at the top to review as them.</p><div className="mt-3"><Btn href="/counsellor" variant="ghost">Open counsellor view</Btn></div></>)}
            {a.status === "approved" && (<><p className="text-sm font-bold text-rise">Approved by your counsellor</p>{a.note && <p className="mt-1 rounded-lg bg-surface p-2 text-sm">&ldquo;{a.note}&rdquo;</p>}</>)}
          </Card>
        </aside>
      </div>
      <StepNav back="/jobs" next="/counsellor" nextLabel="Counsellor view" />
    </div>
  );
}

function CopyLine({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <li className="rounded-2xl bg-surface2 p-3 text-sm">
      <p>{text}</p>
      <button onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }} className="press mt-1 min-h-9 text-xs font-semibold text-accent underline">{ok ? "Copied" : "Copy line"}</button>
    </li>
  );
}

function ResumeTips() {
  const { view, state } = useApp();
  const plan = view?.plan;
  if (!view || !plan || !state) return null;
  const tips = view.resumeTips;
  if (!tips || !view.resume) {
    return (
      <Card>
        <H>Tailor your resume</H>
        <p className="text-sm text-muted">Scan your resume to see how well it fits {plan.title} and which lines to add as you learn.</p>
        <div className="mt-3"><Btn href="/resume" variant="ghost">Scan my resume</Btn></div>
      </Card>
    );
  }
  const missing = tips.rows.filter((r) => !r.onResume);
  const lines = plan.steps.filter((s) => s.kind === "course" && s.course).map((s) => `Completed ${s.title} (${s.provider}), about ${Math.round(s.hours)} hours: ${s.skills.map((k) => k.name.toLowerCase()).join(", ")}.`);
  const fixes = view.resume.findings.filter((f) => f.severity === "fix").slice(0, 2);
  return (
    <Card>
      <H sub={`Your resume shows ${Math.round(tips.match * 100)}% of this job's key skills.`}>Tailor your resume</H>
      {fixes.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-semibold">Fix first</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">{fixes.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        </div>
      )}
      {missing.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-semibold">Add these once you have learned them</p>
          <ul className="mt-1 space-y-1 text-sm">{missing.slice(0, 5).map((r) => <li key={r.id}><b>{r.name}</b> <span className="text-muted">· words employers search: {r.keywords.join(", ") || "n/a"}</span></li>)}</ul>
          <p className="mt-1 text-xs text-muted">Only add a skill you truly have.</p>
        </div>
      )}
      {lines.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Lines to add as you finish each step</p>
          <ul className="mt-1 space-y-2">{lines.slice(0, 3).map((l) => <CopyLine key={l} text={l} />)}</ul>
        </div>
      )}
      <div className="mt-3"><Btn href="/resume" variant="quiet">Rescan after editing</Btn></div>
    </Card>
  );
}
