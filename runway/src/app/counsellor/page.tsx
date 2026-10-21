"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useApp, type Catalog } from "@/components/AppProvider";
import { Portfolio } from "@/components/Pathway";
import { STATUS_CHIP } from "@/components/Meetings";
import { Bar, Btn, Card, Chip, DemoLabel, Estimate, FutureBar, H, PageTitle, SdgTag, Skeleton, pct, sdgName } from "@/components/ui";
import { dayLabel, MAX_NOTES, myDay, myTime, slotStart, topicLabel, upcoming, whenLabel, type Meeting } from "@/lib/engine/meetings";
import type { CaseStatus, CaseSummary } from "@/lib/engine/review";
import type { SessionState, Signer } from "@/lib/engine/state";
import type { View } from "@/lib/engine/view";

type Worker = { state: SessionState; view: View; catalog: Catalog };
type Payload =
  | { signedIn: false; demoPasscode: string | null }
  | {
    signedIn: true; counsellor: Signer; now: string; days: string[]; times: string[];
    meetings: { next: Meeting[]; past: Meeting[] }; myOpen: string[]; myBooked: string[];
    cases: CaseSummary[];
    selectedMeeting: (Worker & { meeting: Meeting }) | null;
    selectedCase: (Worker & { id: string }) | null;
  };
type SignedIn = Extract<Payload, { signedIn: true }>;
type Act = (type: string, body?: Record<string, unknown>) => Promise<void>;
type Tab = "meetings" | "confirm" | "times";

const CASE: Record<CaseStatus, { label: string; tone: "accent" | "rise" }> = {
  finished: { label: "Finished, confirm it", tone: "accent" },
  badge: { label: "Badge issued", tone: "rise" },
};

// The advisor signs in, then meets workers who booked a time, sets their own free times, and confirms finished pathways.
export default function AdvisorDesk() {
  const { refresh } = useApp();
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Tab>("meetings");
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New bookings arrive from other browsers, so the desk reloads every 15 seconds once signed in.
  const signedIn = !!data?.signedIn;
  const query = tab === "meetings" && meetingId ? `?meeting=${encodeURIComponent(meetingId)}` : tab === "confirm" && caseId ? `?case=${encodeURIComponent(caseId)}` : "";
  useEffect(() => {
    let live = true;
    const load = () => fetch(`/api/counsellor${query}`).then((r) => r.json())
      .then((d) => live && setData(d)).catch(() => live && setError("Could not load. Please refresh."));
    load();
    const t = signedIn ? window.setInterval(load, 15000) : undefined;
    return () => { live = false; clearInterval(t); };
  }, [query, signedIn]);

  const act: Act = useCallback(async (type, body = {}) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/counsellor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, meetingId, caseId, ...body }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Something went wrong."); return; }
      setData(d);
      if (d.selectedMeeting?.meeting.id) { setMeetingId(d.selectedMeeting.meeting.id); setTab("meetings"); }
      if (d.selectedCase?.id) { setCaseId(d.selectedCase.id); setTab("confirm"); }
      if (type === "signOut") { setMeetingId(null); setCaseId(null); }
      // The advisor may be handling their own browser's worker in a demo; keep the worker pages in step.
      refresh();
    } catch { setError("Network problem. Please try again."); } finally { setBusy(false); }
  }, [meetingId, caseId, refresh]);

  if (!data) return <Skeleton lines={5} />;
  if (!data.signedIn) return <SignIn demoPasscode={data.demoPasscode} act={act} busy={busy} error={error} />;

  const booked = data.meetings.next.filter((m) => m.status === "booked").length;
  const toConfirm = data.cases.filter((c) => c.waiting).length;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "meetings", label: "Meetings", count: booked },
    { id: "confirm", label: "Pathways to confirm", count: toConfirm },
    { id: "times", label: "My free times" },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Signed in as <b>{data.counsellor.name}</b> <span className="num text-muted">· advisor {data.counsellor.id}</span></p>
        <div className="flex flex-wrap gap-2">
          {tab === "meetings" && <Btn variant="ghost" onClick={() => act("demoMeeting")} disabled={busy}>Add a made-up meeting</Btn>}
          {tab === "confirm" && <Btn variant="ghost" onClick={() => act("demoCase")} disabled={busy}>Add a made-up finished pathway</Btn>}
          <Btn variant="quiet" onClick={() => act("signOut")} disabled={busy}>Sign out</Btn>
        </div>
      </div>

      <div role="tablist" aria-label="Advisor desk" className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`press min-h-10 rounded-full px-4 text-sm font-medium ${tab === t.id ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
            {t.label}{t.count ? <span className="num ml-1.5 rounded-full bg-accentsoft px-1.5 text-xs text-accent">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mb-4 rounded-2xl bg-fallsoft p-3 text-sm text-negative">{error}</p>}

      {tab === "meetings" && (
        <Split
          list={<>
            <MeetingList title={`Coming up (${data.meetings.next.length})`} items={data.meetings.next} selected={meetingId} pick={setMeetingId} empty="Nobody has booked yet. Open some free times, or add a made-up meeting." />
            <MeetingList title="Earlier" items={data.meetings.past} selected={meetingId} pick={setMeetingId} empty="None yet." />
          </>}
          main={data.selectedMeeting && data.selectedMeeting.meeting.id === meetingId
            ? <MeetingView key={meetingId} data={data.selectedMeeting} now={data.now} act={act} busy={busy} />
            : <Card><H>Pick a meeting</H><p className="text-sm">Workers book a half hour from your free times, or the demo advisor&apos;s. Open one to see what they asked, what Jobbery suggested to them and why, and to write your advice.</p></Card>}
        />
      )}

      {tab === "confirm" && (
        <Split
          list={<>
            <CaseList title={`Waiting for you (${toConfirm})`} cases={data.cases.filter((c) => c.waiting)} selected={caseId} pick={setCaseId} empty="No finished pathways are waiting." />
            <CaseList title="Confirmed" cases={data.cases.filter((c) => !c.waiting)} selected={caseId} pick={setCaseId} empty="None yet." />
          </>}
          main={data.selectedCase && data.selectedCase.id === caseId
            ? <CaseView key={caseId} data={data.selectedCase} act={act} busy={busy} />
            : <Card><H>Pick a pathway</H><p className="text-sm">When a worker finishes every step and passes the AI check, they ask an advisor to confirm. Only then is their LinkedIn badge issued.</p></Card>}
        />
      )}

      {tab === "times" && <FreeTimes data={data} act={act} busy={busy} />}
    </div>
  );
}

function Split({ list, main }: { list: ReactNode; main: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <nav className="lg:col-span-4 xl:col-span-3" aria-label="List">{list}</nav>
      <div className="min-w-0 lg:col-span-8 xl:col-span-9">{main}</div>
    </div>
  );
}

function SignIn({ demoPasscode, act, busy, error }: { demoPasscode: string | null; act: Act; busy: boolean; error: string | null }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="max-w-xl">
      <PageTitle title="Advisor sign-in">Advisors meet workers who book a time, give advice, and confirm finished pathways. Your name is shown to the worker, and recorded in the tamper-evident log with every piece of advice and every badge you confirm.</PageTitle>
      <Card tone="raised">
        <form onSubmit={(e) => { e.preventDefault(); act("signIn", { name, passcode: code }); }} className="space-y-3">
          <label className="block text-sm font-medium">Your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" required className="mt-1 block min-h-12 w-full rounded-2xl border border-control bg-raised px-3" placeholder="For example: Puan Aisyah, JobsMalaysia Shah Alam" />
          </label>
          <label className="block text-sm font-medium">Advisor passcode
            <input value={code} onChange={(e) => setCode(e.target.value)} type="password" autoComplete="current-password" required className="mt-1 block min-h-12 w-full rounded-2xl border border-control bg-raised px-3" />
          </label>
          {error && <p role="alert" className="text-sm text-negative">{error}</p>}
          <Btn type="submit" disabled={busy}>Sign in</Btn>
        </form>
        {demoPasscode && <p className="mt-4 text-sm text-muted">Demo: the passcode is <code className="num rounded bg-surface2 px-1.5 py-0.5 text-ink">{demoPasscode}</code>. A real deployment sets its own.</p>}
      </Card>
    </div>
  );
}

function MeetingList({ title, items, selected, pick, empty }: { title: string; items: Meeting[]; selected: string | null; pick: (id: string) => void; empty: string }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {!items.length ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="space-y-1.5">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => pick(m.id)} aria-current={selected === m.id ? "true" : undefined}
                className={`w-full rounded-2xl px-4 py-2.5 text-left ${selected === m.id ? "bg-accentsoft" : "bg-surface hover:bg-surface2"}`}>
                <span className="num block text-sm font-medium">{whenLabel(m.start)}</span>
                <span className="block text-sm">{m.worker.name} <span className="text-xs text-muted">· {topicLabel(m.topic)}</span></span>
                <span className="mt-1 flex flex-wrap gap-1">
                  <Chip tone={STATUS_CHIP[m.status].tone}>{STATUS_CHIP[m.status].label}</Chip>
                  {m.advisor.id === "c-demo" && <Chip tone="demo">Demo advisor</Chip>}
                  {m.worker.synthetic && <Chip tone="demo">Made-up</Chip>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CaseList({ title, cases, selected, pick, empty }: { title: string; cases: CaseSummary[]; selected: string | null; pick: (id: string) => void; empty: string }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {!cases.length ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="space-y-1.5">
          {cases.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => pick(c.id)} aria-current={selected === c.id ? "true" : undefined}
                className={`w-full rounded-2xl px-4 py-2.5 text-left ${selected === c.id ? "bg-accentsoft" : "bg-surface hover:bg-surface2"}`}>
                <span className="block font-medium">{c.name}{c.own && <span className="text-xs font-normal text-muted"> · this browser</span>}</span>
                <span className="block text-xs text-muted">{c.role}</span>
                <span className="mt-1 flex flex-wrap gap-1"><Chip tone={CASE[c.status].tone}>{CASE[c.status].label}</Chip>{c.synthetic && <Chip tone="demo">Made-up</Chip>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// One meeting: what the worker asked, the advisor's advice, and everything Jobbery showed the worker.
function MeetingView({ data, now, act, busy }: { data: Worker & { meeting: Meeting }; now: string; act: Act; busy: boolean }) {
  const m = data.meeting;
  const [notes, setNotes] = useState(m.notes ?? "");
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const live = upcoming(m, now);
  return (
    <div>
      <PageTitle title={`${m.worker.name} · ${whenLabel(m.start)}`}>
        You give advice; the worker decides. You see what Jobbery suggested and why, so you can question it. No hiring decision is automated.
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip tone={STATUS_CHIP[m.status].tone}>{STATUS_CHIP[m.status].label}</Chip>
        <Chip>{topicLabel(m.topic)}</Chip>
        <Chip>30 minutes · with {m.advisor.name}</Chip>
        {m.worker.synthetic && <Chip tone="demo">Made-up worker</Chip>}
      </div>

      <Card className="mb-4" tone="raised">
        <H>What they asked</H>
        <p className="text-sm">{m.question ? <>&ldquo;{m.question}&rdquo;</> : <span className="text-muted">No question written. Topic: {topicLabel(m.topic)}.</span>}</p>
        {m.status === "cancelled" ? (
          <p className="mt-3 text-sm text-fall">Cancelled {m.cancelledBy === "advisor" ? `by the advisor: “${m.reason}”` : "by the worker"}.</p>
        ) : (
          <>
            <label className="mt-4 block text-sm font-medium">Your advice for {m.worker.name}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={MAX_NOTES} rows={4} className="mt-1 w-full rounded-2xl border border-control bg-raised p-3" placeholder="For example: do the free Google course first, then the paid SQL one once HRD Corp funding is confirmed. I can introduce you to two local employers." />
            </label>
            <p className="mt-1 text-xs text-muted">Shown on the worker&apos;s Plan page as a suggestion. The log records that you gave advice, not what you wrote.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn onClick={() => act("advise", { notes })} disabled={busy || notes.trim().length < 10}>{m.notes ? "Update advice" : "Send advice"}</Btn>
              {live && !cancelling && <Btn variant="quiet" onClick={() => setCancelling(true)}>Cancel the meeting</Btn>}
            </div>
            {m.notesAt && <p className="mt-2 text-xs text-muted">Advice sent {new Date(m.notesAt).toLocaleString()}.</p>}
            {cancelling && (
              <div className="mt-4 rounded-2xl bg-fallsoft p-3">
                <label className="block text-sm font-medium">Why are you cancelling? The worker sees this.
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="mt-1 block min-h-11 w-full rounded-2xl border border-control bg-raised px-3" placeholder="For example: I am on leave that day. Please book Thursday instead." />
                </label>
                <div className="mt-2 flex gap-2"><Btn onClick={() => act("cancelMeeting", { reason })} disabled={busy || reason.trim().length < 3}>Cancel and tell them</Btn><Btn variant="quiet" onClick={() => setCancelling(false)}>Keep it</Btn></div>
              </div>
            )}
          </>
        )}
      </Card>
      <WorkerDetails data={data} />
    </div>
  );
}

// The finished-pathway sign-off: the advisor reads the work before a badge is issued.
function CaseView({ data, act, busy }: { data: Worker & { id: string }; act: Act; busy: boolean }) {
  const [note, setNote] = useState("");
  const c = data.state.completion, p = data.state.profile;
  if (!p) return <Card><p className="text-sm">This worker started over.</p></Card>;
  return (
    <div>
      <PageTitle title={c.status === "confirmed" ? `You confirmed ${p.name}'s pathway.` : `${p.name} finished their pathway.`}>
        The worker says every step is done and has passed the AI check. Read their work, then confirm. Only then is the badge issued.
      </PageTitle>
      <Card className="mb-4" tone={c.status === "confirmed" ? "rise" : "raised"}>
        <H>Your sign-off</H>
        {c.status === "confirmed" ? (
          <p className="text-sm"><b>Confirmed</b> {c.by ? `by ${c.by.name}` : ""} {c.confirmedAt ? `on ${new Date(c.confirmedAt).toLocaleString()}` : ""}. The badge is recorded in the tamper-evident log. {c.badgeId && <a className="underline decoration-control underline-offset-2" href={`/badge/${c.badgeId}`}>See the badge</a>}</p>
        ) : (
          <>
            <label className="block text-sm font-medium">Note to the worker (optional)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-2xl border border-control bg-raised p-3" placeholder="For example: we did the mock interview on Tuesday; strong answers." />
            </label>
            <div className="mt-3"><Btn onClick={() => act("confirm", { note })} disabled={busy}>Confirm completion and issue the badge</Btn></div>
          </>
        )}
      </Card>
      <Portfolio counsellor data={data} />
      <div className="mt-4"><WorkerDetails data={data} /></div>
    </div>
  );
}

// What Jobbery showed the worker: profile, the futures behind the advice, the top jobs and the plan.
function WorkerDetails({ data }: { data: Worker }) {
  const { state, view, catalog } = data;
  const p = state.profile, plan = view.plan;
  if (!p) return <Card><p className="text-sm">This worker has not told Jobbery about themselves yet.</p></Card>;
  const top3 = view.matches.slice(0, 3);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <H>The worker</H>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">Now</dt><dd>{p.status === "studying" ? "Studying" : "Working or looking for work"}</dd>
          <dt className="text-muted">{p.status === "studying" ? "Job or internship" : "Previous job"}</dt><dd>{catalog?.occupations.find((o) => o.id === p.occupationId)?.title ?? "None yet"}</dd>
          <dt className="text-muted">Age</dt><dd>{p.age ?? "Not given"}</dd>
          <dt className="text-muted">Experience</dt><dd>{p.years} years</dd>
          <dt className="text-muted">{p.status === "studying" ? "Time to graduation" : "Time to find work"}</dt><dd>{p.months} months</dd>
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

      {plan ? (
        <Card className="lg:col-span-2">
          <H sub={`${plan.totalWeeks} weeks inside ${plan.deadlineWeeks} available`}>Their plan for {plan.title}</H>
          <ol className="space-y-1.5 text-sm">
            {plan.steps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-raised px-4 py-2">
                <span><span className="num text-xs text-muted">Weeks {s.weekStart}{s.weekEnd > s.weekStart ? `–${s.weekEnd}` : ""}</span> {s.title}</span>
                <span className="text-xs text-muted">{view.pathway.done[s.id] ? "Done · " : ""}{s.strand === "ai" ? "AI at work" : s.strand === "people" ? "People skills" : s.funding}</span>
              </li>
            ))}
          </ol>
          {plan.steps.some((s) => s.kind === "programme") && <p className="mt-2 text-sm text-fall">Some skills have no vetted free course yet. A PERKESO-supported or other programme may cover them.</p>}
        </Card>
      ) : <Card className="lg:col-span-2"><p className="text-sm text-muted">They have not chosen a job to plan for yet.</p></Card>}
    </div>
  );
}

// The advisor's own calendar: click a half hour to open or close it. Booked times stay put.
function FreeTimes({ data, act, busy }: { data: SignedIn; act: Act; busy: boolean }) {
  const [week, setWeek] = useState(0);
  const days = data.days.slice(week * 7, week * 7 + 7);
  const open = new Set(data.myOpen), booked = new Set(data.myBooked);
  const t = Date.parse(data.now);
  return (
    <Card tone="raised">
      <H sub="Malaysia time. Click a half hour to open it for booking, or click again to close it. Workers see your open times beside the demo advisor's.">My free times</H>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[0, 1].map((w) => <button key={w} type="button" onClick={() => setWeek(w)} aria-pressed={week === w} className={`press min-h-9 rounded-full px-3 text-sm ${week === w ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>{dayLabel(data.days[w * 7], { day: "numeric", month: "short" })} – {dayLabel(data.days[w * 7 + 6], { day: "numeric", month: "short" })}</button>)}
        <span className="ml-auto flex flex-wrap gap-2 text-xs text-muted"><span className="rounded-full bg-accentsoft px-2 text-accent">Open</span><span className="rounded-full bg-primary px-2 text-primaryink">Booked</span><span className="rounded-full bg-surface px-2">Closed</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-center text-xs">
          <thead><tr><th className="w-14" />{days.map((d) => <th key={d} scope="col" className="font-medium">{dayLabel(d)}</th>)}</tr></thead>
          <tbody>
            {data.times.map((hh) => (
              <tr key={hh}>
                <th scope="row" className="num pr-1 text-right font-normal text-muted">{hh}</th>
                {days.map((d) => {
                  const start = slotStart(d, hh);
                  const past = Date.parse(start) <= t;
                  const isBooked = booked.has(start), isOpen = open.has(start);
                  const cls = isBooked ? "bg-primary text-primaryink" : isOpen ? "bg-accentsoft text-accent" : "bg-surface hover:bg-surface2";
                  return (
                    <td key={d}>
                      <button type="button" disabled={busy || past || isBooked} onClick={() => act("toggleSlot", { start })}
                        aria-label={`${dayLabel(myDay(start), { weekday: "long", day: "numeric", month: "long" })} ${myTime(start)}: ${isBooked ? "booked" : isOpen ? "open, click to close" : "closed, click to open"}`}
                        className={`h-8 w-full rounded-lg ${past ? "opacity-30" : ""} ${cls}`}>{isBooked ? "Booked" : isOpen ? "Open" : ""}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
