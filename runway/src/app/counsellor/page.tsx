"use client";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Portfolio } from "@/components/Pathway";
import { Bar, Btn, Card, Chip, DemoLabel, Estimate, FutureBar, H, PageTitle, SdgTag, Skeleton, pct, sdgName } from "@/components/ui";

export default function CounsellorPage() {
  const { view, state, catalog, act, busy } = useApp();
  const [note, setNote] = useState("");
  const [doneNote, setDoneNote] = useState("");
  if (!view || !state) return <Skeleton lines={5} />;
  const p = state.profile, plan = view.plan, a = state.approval;
  if (!p || !plan) {
    return (
      <div>
        <PageTitle title="Counsellor view">There is no worker case yet. Open a made-up profile to see how a counsellor reviews a plan.</PageTitle>
        <Btn onClick={() => act("startPersona", { personaId: "hafiz" })} disabled={busy}>Open Hafiz&apos;s case</Btn>
      </div>
    );
  }
  const top3 = view.matches.slice(0, 3);
  return (
    <div>
      <PageTitle title={a.status === "approved" ? `You approved ${p.name}'s plan.` : a.status === "submitted" ? `${p.name} is waiting for your review.` : `${p.name} has not sent a plan yet.`}>
        Counsellor view. You see what Runway suggested and why. The worker chooses; you review, correct and approve. Runway never decides, and no hiring decision is automated.
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip tone={a.status === "approved" ? "rise" : a.status === "submitted" ? "accent" : "neutral"}>{a.status === "approved" ? "Approved" : a.status === "submitted" ? "Waiting for your review" : "Not yet sent by the worker"}</Chip>
        {p.synthetic && <Chip tone="demo">Made-up profile</Chip>}
      </div>
        <Card className="mb-4" tone={a.status === "approved" ? "rise" : "raised"}>
          <H>Your decision</H>
          {a.status === "approved" ? (
            <p className="text-sm"><b>Approved</b> {a.approvedAt ? `on ${new Date(a.approvedAt).toLocaleString()}` : ""}.{a.note ? ` Note: “${a.note}”` : ""} The approval is logged in the tamper-evident log and shown to the worker.</p>
          ) : a.status === "submitted" ? (
            <>
              <label className="block text-sm font-medium">Note to the worker (optional)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-2xl border border-control bg-raised p-3" placeholder="For example: check the SQL course first; I can introduce you to a local employer." />
              </label>
              <div className="mt-3"><Btn onClick={() => act("approve", { note })} disabled={busy}>Approve this plan</Btn></div>
            </>
          ) : (
            <p className="text-sm text-muted">The worker has not sent the plan yet. In the worker view, open <b>Plan</b> and choose <b>Send to counsellor</b>.</p>
          )}
        </Card>
      {state.completion.status !== "none" && <CompletionReview note={doneNote} setNote={setDoneNote} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <H>The worker</H>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">Previous job</dt><dd>{catalog?.occupations.find((o) => o.id === p.occupationId)?.title ?? ""}</dd>
            <dt className="text-muted">Age</dt><dd>{p.age ?? "Not given"}</dd>
            <dt className="text-muted">Experience</dt><dd>{p.years} years</dd>
            <dt className="text-muted">Time to find work</dt><dd>{p.months} months</dd>
            <dt className="text-muted">Study time</dt><dd>{p.hoursPerWeek} hours a week</dd>
            <dt className="text-muted">Goals picked</dt><dd>{state.goals.length ? state.goals.map((g) => `${sdgName(g)} (${g})`).join(", ") : "none"}</dd>
          </dl>
          <p className="mt-3 text-sm font-semibold">Skills (confirmed by the worker)</p>
          <ul className="mt-1 space-y-1 text-sm">{view.profileSkills.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><span className={s.expiry.durable ? "text-rise" : "text-fall"}>{s.expiry.durable ? "lasts" : `≈ ${s.expiry.expected}`}</span></li>)}</ul>
        </Card>

        <Card>
          <H sub="Weights are estimates from the prediction market.">The futures behind this advice</H>
          <FutureBar futures={view.world.futures} />
          <ul className="mt-2 space-y-1 text-sm">{view.world.futures.map((f) => <li key={f.id} className="flex justify-between"><span>{f.name}</span><b className="num">{pct(f.weight)}</b></li>)}</ul>
          {view.world.usingOverride && <p className="mt-2 text-sm text-fall">The worker set their own weights.</p>}
          <div className="mt-2"><DemoLabel /></div>
          <div className="mt-3"><Estimate /></div>
        </Card>

        <Card className="lg:col-span-2">
          <H sub="Ranked by the match score; the worker can pick any of them.">Top reachable jobs</H>
          <ol className="grid gap-3 md:grid-cols-3">
            {top3.map((m) => (
              <li key={m.roleId} className="rounded-2xl bg-raised p-4">
                <p className="num text-xs text-muted">Rank {m.rank}</p>
                <p className="font-semibold">{m.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5"><SdgTag target={m.sdgTarget} /><Chip>≈ {m.weeks} weeks</Chip>{m.atRisk && <Chip tone="fall">Skills at risk</Chip>}</div>
                <div className="mt-2"><Bar value={m.score} label={`Match score ${Math.round(m.score * 100)}`} /></div>
                <p className="num mt-1 text-sm">Score {Math.round(m.score * 100)} · overlap {Math.round(m.overlap * 100)} · outlook {Math.round(m.outlook * 100)}</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="lg:col-span-2">
          <H sub={`${plan.totalWeeks} weeks inside ${plan.deadlineWeeks} available`}>The plan for {plan.title}</H>
          <ol className="space-y-1.5 text-sm">
            {plan.steps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-raised px-4 py-2">
                <span><span className="num text-xs text-muted">Weeks {s.weekStart}{s.weekEnd > s.weekStart ? `–${s.weekEnd}` : ""}</span> {s.title}</span>
                <span className="text-xs text-muted">{view.pathway.done[s.id] ? "Done · " : ""}{s.strand === "ai" ? "AI at work" : s.strand === "people" ? "People skills" : s.funding}</span>
              </li>
            ))}
          </ol>
          {plan.steps.some((s) => s.kind === "programme") && <p className="mt-2 text-sm text-fall">Some skills have no vetted free course yet. Please identify a PERKESO-supported or other programme for them.</p>}
        </Card>

      </div>
    </div>
  );
}

// Second sign-off: the counsellor reads the finished work before a badge is issued.
function CompletionReview({ note, setNote }: { note: string; setNote: (s: string) => void }) {
  const { view, state, act, busy } = useApp();
  if (!view || !state) return null;
  const c = state.completion;
  return (
    <div className="mb-4">
      <Card tone={c.status === "confirmed" ? "rise" : "raised"}>
        <H sub="The worker says every step is done, including the courses and the mock interview with you. Check, then confirm. Only then is the badge issued.">Finished pathway</H>
        {c.status === "confirmed" ? (
          <p className="text-sm"><b>Confirmed</b> {c.confirmedAt ? `on ${new Date(c.confirmedAt).toLocaleString()}` : ""}. The badge is recorded in the tamper-evident log. {c.badgeId && <a className="underline decoration-control underline-offset-2" href={`/badge/${c.badgeId}`}>See the badge</a>}</p>
        ) : (
          <>
            <label className="block text-sm font-medium">Note to the worker (optional)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-2xl border border-control bg-raised p-3" placeholder="For example: we did the mock interview on Tuesday; strong answers." />
            </label>
            <div className="mt-3"><Btn onClick={() => act("confirmCompletion", { note })} disabled={busy}>Confirm completion and issue the badge</Btn></div>
          </>
        )}
      </Card>
      <Portfolio counsellor />
    </div>
  );
}
