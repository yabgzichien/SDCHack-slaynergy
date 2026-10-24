"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ResumeSheet } from "@/components/ResumeSheet";
import { buildResume } from "@/lib/build-resume";
import { Btn, Card, H, PageTitle, Skeleton } from "@/components/ui";

// The plan's resume step, after the courses: the resume rebuilt with the new skills, beside the fixes from the scan
// the worker did at the start. No new upload. The step is done when the worker marks it updated.
export default function PlanResumePage() {
  const { view, state, act, busy } = useApp();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  if (!view || !state) return <Skeleton lines={6} />;
  const r = buildResume(state, view);
  if (!r || !view.plan) return <div><PageTitle title="Update your resume">Choose a job first.</PageTitle><Btn href="/jobs">Choose a job</Btn></div>;
  const updated = !!state.pathway?.resumeApplied;
  const newCount = r.skills.filter((s) => s.isNew).length;
  const allTicked = r.fixes.every((f) => ticked[f.id]);
  const finish = (all = false) => { if (all) setTicked(Object.fromEntries(r.fixes.map((f) => [f.id, true]))); return act("pathwaySave", { work: { resumeApplied: true } }); };

  return (
    <div>
      <Link href="/plan" className="mb-4 inline-block text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">Your plan</Link>
      <PageTitle title="Update your resume with your new skills">
        {newCount ? `Your resume now shows ${newCount} new skill${newCount === 1 ? "" : "s"} from your plan, marked New. ` : "Finish your courses first so your new skills show here. "}Copy it into your own resume, and fix the points the scan found.
      </PageTitle>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.35fr]">
        <Card className="lg:sticky lg:top-24">
          <H sub={r.fixes.length ? "From the resume you scanned at the start. Tick each one as you fix it." : "Your scan found nothing to fix."}>Fixes to make</H>
          <ul className="space-y-1.5">
            {r.fixes.map((f) => (
              <li key={f.id}>
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 ${ticked[f.id] || updated ? "bg-risesoft" : "bg-raised"}`}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--rise)]" checked={!!ticked[f.id] || updated} disabled={updated} onChange={(e) => setTicked({ ...ticked, [f.id]: e.target.checked })} />
                  <span className="text-sm"><span className="block font-medium">{f.title}</span><span className="block text-muted">{f.fix}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {updated
              ? <p className="flex items-center gap-2 text-sm font-medium text-rise" role="status"><Check size={16} aria-hidden />Done. Your resume is updated.</p>
              : <Btn onClick={() => finish()} disabled={busy || !allTicked}>Mark my resume as updated</Btn>}
            {updated && <Btn href="/plan" variant="ghost">Back to your plan</Btn>}
          </div>
          {!updated && (
            <button onClick={() => finish(true)} disabled={busy} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-cue px-3 text-xs font-medium text-cueink hover:bg-cuesoft">
              <Sparkles size={14} aria-hidden />Demo: apply every fix and finish
            </button>
          )}
        </Card>
        <div>
          <p className="mb-2 text-sm text-muted">Your updated resume, built from your profile and your plan. <span className="rounded-sm bg-[#c9741a] px-1 text-[10px] font-bold uppercase text-white">New</span> = learned on this plan.</p>
          <ResumeSheet r={r} />
        </div>
      </div>
    </div>
  );
}
