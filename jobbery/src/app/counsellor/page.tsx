"use client";
import Image from "next/image";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Briefcase, CalendarClock, Check, CircleCheck, Clock3, FileText, Landmark, ListChecks, MessageCircle, Mic, Users, Wrench, type LucideIcon } from "lucide-react";
import { useApp, type Catalog } from "@/components/AppProvider";
import { ResumeSheet } from "@/components/ResumeSheet";
import { buildResume } from "@/lib/build-resume";
import { useSpeed } from "@/components/useSpeed";
import { Bar, Btn, Card, Chip, DemoLabel, Estimate, FutureBar, H, SdgTag, Skeleton, pct, sdgName } from "@/components/ui";
import { dayLabel, MAX_NOTES, myDay, myTime, slotStart, topicLabel, upcoming, whenLabel, type Meeting } from "@/lib/engine/meetings";
import type { SessionState, Signer } from "@/lib/engine/state";
import type { View } from "@/lib/engine/view";
import type { PlanStep } from "@/lib/engine/plan";

type Worker = { state: SessionState; view: View; catalog: Catalog };
type Payload =
  | { signedIn: false; demoPasscode: string | null }
  | {
    signedIn: true; counsellor: Signer; now: string; days: string[]; times: string[];
    meetings: { next: Meeting[]; past: Meeting[] }; myOpen: string[]; myBooked: string[];
    selectedMeeting: (Worker & { meeting: Meeting }) | null;
  };
type SignedIn = Extract<Payload, { signedIn: true }>;
type Act = (type: string, body?: Record<string, unknown>) => Promise<void>;
type Tab = "meetings" | "times";

// The advisor signs in, meets workers who booked a time, gives advice, and sets their own free times.
export default function AdvisorDesk() {
  const { refresh } = useApp();
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Tab>("meetings");
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New bookings arrive from other browsers, so the desk reloads every 15 seconds once signed in.
  const signedIn = !!data?.signedIn;
  const query = tab === "meetings" && meetingId ? `?meeting=${encodeURIComponent(meetingId)}` : "";
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
      const r = await fetch("/api/counsellor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, meetingId, ...body }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Something went wrong."); return; }
      setData(d);
      if (d.selectedMeeting?.meeting.id) { setMeetingId(d.selectedMeeting.meeting.id); setTab("meetings"); }
      if (type === "signOut") setMeetingId(null);
      // The advisor may be handling their own browser's worker in a demo; keep the worker pages in step.
      refresh();
    } catch { setError("Network problem. Please try again."); } finally { setBusy(false); }
  }, [meetingId, refresh]);

  if (!data) return <Skeleton lines={5} />;
  if (!data.signedIn) return <SignIn demoPasscode={data.demoPasscode} act={act} busy={busy} error={error} />;

  // A booked meeting with no advice yet waits on the advisor, whether its time is still ahead or has passed.
  const needAdvice = [...data.meetings.next, ...data.meetings.past].filter((m) => m.status === "booked");
  const booked = needAdvice.length;
  const tabs: { id: Tab; label: string; icon: LucideIcon; count?: number }[] = [
    { id: "meetings", label: "Meetings", icon: CalendarClock, count: booked },
    { id: "times", label: "My free times", icon: Clock3 },
  ];
  const openMeeting = (id: string) => { setTab("meetings"); setMeetingId(id); };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Signed in as <b>{data.counsellor.name}</b> <span className="num text-muted">· advisor {data.counsellor.id}</span></p>
        <div className="flex flex-wrap gap-2">
          {tab === "meetings" && <Btn variant="ghost" onClick={() => act("demoMeeting")} disabled={busy}>Add a made-up meeting</Btn>}
          <Btn variant="quiet" onClick={() => act("signOut")} disabled={busy}>Sign out</Btn>
        </div>
      </div>

      <NeedsYou meetings={needAdvice} hasTimes={data.myOpen.length > 0} openMeeting={openMeeting} openTimes={() => setTab("times")} />

      <div role="tablist" aria-label="Advisor desk" className="mb-6 flex flex-wrap gap-1.5 rounded-full bg-surface p-1.5 sm:w-fit">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium ${tab === t.id ? "bg-raised text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
              <Icon size={17} strokeWidth={1.9} aria-hidden />{t.label}
              {t.count ? <span className="num inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fall px-1.5 text-xs font-semibold text-white" aria-label={`${t.count} need you`}>{t.count}</span> : null}
            </button>
          );
        })}
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
            : <PickHint title="Pick a meeting on the left" steps={[
              { icon: CalendarClock, text: "Workers book a half hour from your free times, or the demo advisor's." },
              { icon: ListChecks, text: "Open one to read their question and what Jobbery suggested to them, and why." },
              { icon: FileText, text: "Write your advice. It shows on their Plan page as a suggestion." },
            ]} />}
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

const DEMO_ADVISORS = ["Puan Aisyah, JobsMalaysia Shah Alam", "Encik Ravi, PERKESO Penang"];

function SignIn({ demoPasscode, act, busy, error }: { demoPasscode: string | null; act: Act; busy: boolean; error: string | null }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="counsellor-signin">
      <header className="counsellor-hero">
        <h1 className="counsellor-hero-title"><span className="statistics-headline-highlight">Advisor sign-in</span></h1>
        <div className="counsellor-hero-banner">
          <span className="statistics-hero-icon" aria-hidden="true"><MessageCircle size={29} strokeWidth={2.6} /></span>
          <p>Every worker meets an advisor once as part of their plan: a mock interview, advice, or anything else they ask. Your name is shown to the worker, and recorded in the tamper-evident log with every piece of advice you give.</p>
        </div>
        <div className="counsellor-hero-art" aria-hidden="true">
          <Image src="/cockatiel-lecturer-professional.png" alt="" width={1254} height={1254} className="counsellor-hero-mascot" priority />
        </div>
      </header>

      <div className="counsellor-signin-options grid max-w-5xl items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {demoPasscode && (
          <Card className="counsellor-signin-option counsellor-demo-option">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Try it as a demo advisor</h2>
            <p className="mt-1 text-sm text-muted">One click signs you in. No name or passcode needed.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_ADVISORS.map((n) => <Btn key={n} onClick={() => act("signIn", { name: n, passcode: demoPasscode })} disabled={busy}>{n}</Btn>)}
            </div>
          </Card>
        )}
        {demoPasscode && <ArrowRight size={32} className="counsellor-signin-arrow mx-auto rotate-90 text-accent lg:rotate-0" aria-hidden />}
        <Card tone="raised" className={`${demoPasscode ? "counsellor-signin-option counsellor-manual-option" : "lg:col-span-3"}`}>
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
    </div>
  );
}

// The first thing on the desk: what is waiting on this advisor, each with a button that opens it.
function NeedsYou({ meetings, hasTimes, openMeeting, openTimes }: { meetings: Meeting[]; hasTimes: boolean; openMeeting: (id: string) => void; openTimes: () => void }) {
  const items = [
    ...meetings.map((m) => ({ key: m.id, text: <><b>{m.worker.name}</b> <span className="text-fall"><span aria-hidden>· </span><span>Needs your advice</span></span></>, sub: `${topicLabel(m.topic)} · ${whenLabel(m.start)}`, go: () => openMeeting(m.id) })),
  ];
  if (!items.length) {
    return (
      <section aria-label="What needs you" className="mb-5 flex flex-wrap items-center gap-3 rounded-[22px] bg-risesoft px-5 py-4">
        <CircleCheck size={22} className="text-rise" aria-hidden />
        <p className="flex-1 font-medium">You&apos;re all caught up.{!hasTimes && <span className="font-normal text-muted"> Open some free times so workers can book you.</span>}</p>
        {!hasTimes && <Btn variant="ghost" onClick={openTimes}>Open free times</Btn>}
      </section>
    );
  }
  return (
    <section aria-label="What needs you" className="mb-5 rounded-[22px] bg-fallsoft p-5">
      <p className="flex items-center gap-2 text-lg font-semibold"><span className="h-2.5 w-2.5 rounded-full bg-fall" aria-hidden />{items.length === 1 ? "1 thing needs you" : `${items.length} things need you`}</p>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {items.slice(0, 4).map((it) => (
          <li key={it.key}>
            <button type="button" onClick={it.go} className="press group flex w-full items-center gap-3 rounded-2xl bg-raised px-4 py-3 text-left hover:ring-1 hover:ring-fall/40">
              <span className="min-w-0 flex-1"><span className="block">{it.text}</span><span className="block truncate text-xs text-muted">{it.sub}</span></span>
              <ArrowRight size={18} className="shrink-0 text-fall transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PickHint({ title, steps }: { title: string; steps: { icon: LucideIcon; text: string }[] }) {
  return (
    <Card>
      <p className="text-lg font-semibold">{title}</p>
      <ul className="mt-4 space-y-3">
        {steps.map((st) => { const Icon = st.icon; return (
          <li key={st.text} className="flex items-start gap-3 text-sm"><span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-ink"><Icon size={17} aria-hidden /></span><span className="pt-2">{st.text}</span></li>
        ); })}
      </ul>
    </Card>
  );
}

// A list row: the person leads; the state is a coloured edge (orange waits on you, green is done); the time is small.
function Row({ name, sub, meta, state, selected, onClick, tags }: { name: string; sub: string; meta: string; state: "you" | "done" | "quiet"; selected: boolean; onClick: () => void; tags?: string }) {
  const edge = { you: "bg-fall", done: "bg-rise", quiet: "bg-control" }[state];
  return (
    <button type="button" onClick={onClick} aria-current={selected ? "true" : undefined}
      className={`press relative flex w-full items-start gap-3 overflow-hidden rounded-2xl py-3 pl-5 pr-3 text-left ${selected ? "bg-raised ring-1 ring-ink/15" : "bg-surface hover:bg-surface2"}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${edge}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate font-semibold">{name}</span>{state === "you" && <span className="shrink-0 rounded-full bg-fallsoft px-2 py-0.5 text-[11px] font-semibold text-fall">Needs you</span>}{state === "done" && <Check size={15} className="shrink-0 text-rise" aria-label="Done" />}</span>
        <span className="block truncate text-sm text-ink/80">{sub}</span>
        <span className="num mt-0.5 block text-xs text-muted">{meta}{tags ? ` · ${tags}` : ""}</span>
      </span>
    </button>
  );
}

function MeetingList({ title, items, selected, pick, empty }: { title: string; items: Meeting[]; selected: string | null; pick: (id: string) => void; empty: string }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-semibold text-muted">{title}</p>
      {!items.length ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="space-y-1.5">
          {items.map((m) => (
            <li key={m.id}>
              <Row name={m.worker.name} sub={topicLabel(m.topic)} meta={m.status === "cancelled" ? `Cancelled · ${whenLabel(m.start)}` : whenLabel(m.start)}
                state={m.status === "booked" ? "you" : m.status === "advised" ? "done" : "quiet"} selected={selected === m.id} onClick={() => pick(m.id)}
                tags={[m.advisor.id === "c-demo" && "demo advisor", m.worker.synthetic && "made-up"].filter(Boolean).join(", ")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The top of a meeting: who, what they are aiming for, and (small) when.
function Person({ name, goal, meta, badge }: { name: string; goal?: string; meta: string; badge: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-3">
      <span className="inline-flex h-12 w-12 shrink-0 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-accentsoft font-serif text-2xl text-accentink" aria-hidden>{name.charAt(0).toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{name}</h1>
        {goal && <p className="mt-1 text-base">Aiming for <b>{goal}</b></p>}
        <p className="num mt-1 text-sm text-muted">{meta}</p>
      </div>
      <div className="w-full sm:w-auto">{badge}</div>
    </header>
  );
}

function YourTurn({ done, children }: { done: boolean; children: ReactNode }) {
  return done
    ? <span className="inline-flex items-center gap-1.5 rounded-full bg-risesoft px-3 py-1 text-sm font-semibold text-rise"><Check size={15} aria-hidden />{children}</span>
    : <span className="inline-flex items-center gap-1.5 rounded-full bg-fall px-3 py-1 text-sm font-semibold text-white"><span className="h-2 w-2 rounded-full bg-white" aria-hidden />{children}</span>;
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
      <Person name={m.worker.name} goal={data.view.plan?.title ?? data.view.chosen?.title}
        meta={`${whenLabel(m.start)} · 30 min · ${topicLabel(m.topic)} · with ${m.advisor.name}${m.worker.synthetic ? " · made-up worker" : ""}`}
        badge={m.status === "cancelled" ? <Chip>Cancelled</Chip> : <YourTurn done={!!m.notes}>{m.notes ? "Advice sent" : "Your turn: write advice"}</YourTurn>} />

      <Card className="mb-4" tone="raised">
        <p className="text-xs font-semibold text-muted">They asked</p>
        <p className="mt-2 font-serif text-xl leading-snug sm:text-2xl">{m.question ? <>&ldquo;{m.question}&rdquo;</> : <span className="text-muted">{`No question written. They want help with: ${topicLabel(m.topic).toLowerCase()}.`}</span>}</p>
        {m.status === "cancelled" ? (
          <p className="mt-3 text-sm text-fall">Cancelled {m.cancelledBy === "advisor" ? `by the advisor: “${m.reason}”` : "by the worker"}.</p>
        ) : (
          <>
            <label className={`mt-5 block rounded-2xl p-4 text-sm font-medium ${m.notes ? "bg-surface" : "bg-fallsoft"}`}>{m.notes ? "Your advice" : <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-fall" aria-hidden />{`Your advice for ${m.worker.name}`}</span>}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={MAX_NOTES} rows={4} className="mt-2 w-full rounded-2xl border border-control bg-raised p-3 font-normal" placeholder="For example: do the free Google course first, then the paid SQL one once HRD Corp funding is confirmed. I can introduce you to two local employers." />
              <span className="mt-1 block text-xs font-normal text-muted">Shown on the worker&apos;s Plan page as a suggestion. The log records that you gave advice, not what you wrote. You give advice; the worker decides.</span>
            </label>
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
      <p className="mb-3 mt-8 text-lg font-semibold">Before you advise: what Jobbery showed them</p>
      <WorkerDetails data={data} />
    </div>
  );
}

// What Jobbery showed the worker: profile, the futures behind the advice, the top jobs and the plan.
function WorkerDetails({ data }: { data: Worker }) {
  const { state, view, catalog } = data;
  const { speed } = useSpeed(view);
  const p = state.profile, plan = view.plan;
  if (!p) return <Card><p className="text-sm">This worker has not told Jobbery about themselves yet.</p></Card>;
  const top3 = view.matches.slice(0, 3);
  const resume = buildResume(state, view);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {plan ? <PlanCard plan={plan} done={view.pathway.done} /> : <Card className="lg:col-span-2"><p className="text-sm text-muted">They have not chosen a job to plan for yet.</p></Card>}

      {resume && (
        <Card className="lg:col-span-2">
          <H sub={state.pathway?.resumeApplied ? "The worker marked their resume as updated. Built from their profile and finished plan steps; New marks skills learned on the plan." : "Not marked as updated yet. This is how it looks now, built from their profile and finished plan steps."}>Their resume</H>
          <div className="rounded-2xl bg-surface2 p-3 sm:p-6"><ResumeSheet r={resume} /></div>
          {resume.fixes.length > 0 && <p className="mt-3 text-sm text-muted">Fixes their resume scan found: {resume.fixes.map((f) => f.title).join("; ")}.</p>}
        </Card>
      )}

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
        <ul className="mt-1 space-y-1 text-sm">{view.profileSkills.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><span className={s.expiry.durable ? "text-rise" : "text-fall"}>{s.expiry.durable ? "lasts" : `≈ ${s.expiry.byFuture[speed]}`}</span></li>)}</ul>
      </Card>

      <Card>
        <H sub="Weights are estimates from the prediction market.">The futures behind this advice</H>
        <FutureBar futures={view.world.futures} />
        <ul className="mt-2 space-y-1 text-sm">{view.world.futures.map((f) => <li key={f.id} className="flex justify-between"><span>{f.name}</span><b className="num">{pct(f.weight)}</b></li>)}</ul>
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

    </div>
  );
}

// What each step is, at a glance: its kind sets the icon, its strand the colour.
function stepIcon(st: PlanStep): LucideIcon {
  if (st.activity === "resume") return FileText;
  if (st.activity === "task") return ListChecks;
  if (st.activity === "meeting") return Users;
  if (st.kind === "apply") return Briefcase;
  if (/interview/i.test(st.title)) return Mic;
  return { course: BookOpen, programme: Landmark, practice: Mic, apply: Briefcase, adapt: Wrench }[st.kind];
}
const STRAND: Record<PlanStep["strand"], { label: string; dot: string; tag: string }> = {
  job: { label: "Job skills", dot: "bg-[#e7f1e3] text-[#2f5d33]", tag: "bg-[#e7f1e3] text-[#2f5d33]" },
  ai: { label: "AI at work", dot: "bg-[#e3eef7] text-[#2b5878]", tag: "bg-[#e3eef7] text-[#2b5878]" },
  people: { label: "People skills", dot: "bg-[#f6e6ee] text-[#7a3d5e]", tag: "bg-[#f6e6ee] text-[#7a3d5e]" },
};

function PlanCard({ plan, done }: { plan: NonNullable<View["plan"]>; done: Record<string, boolean | undefined> }) {
  const finished = plan.steps.filter((st) => done[st.id]).length;
  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">Their plan</p>
          <p className="mt-1 font-serif text-2xl leading-tight">{plan.title}</p>
          <p className="mt-1 text-sm text-muted">{`${plan.totalWeeks} weeks of the ${plan.deadlineWeeks} they have · ${finished} of ${plan.steps.length} steps done`}</p>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Colour key">{(["job", "ai", "people"] as const).map((k) => <li key={k} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STRAND[k].tag}`}>{STRAND[k].label}</li>)}</ul>
      </div>
      <ol className="relative">
        {plan.steps.map((st, n) => {
          const Icon = stepIcon(st), isDone = !!done[st.id], last = n === plan.steps.length - 1;
          return (
            <li key={st.id} className="relative grid grid-cols-[2.6rem_2.5rem_1fr] items-start gap-x-2 pb-3 sm:grid-cols-[3.5rem_2.5rem_1fr] sm:gap-x-3">
              <span className="num pt-2.5 text-right text-xs text-muted">{st.weekEnd > st.weekStart ? `Wk ${st.weekStart}–${st.weekEnd}` : `Wk ${st.weekStart}`}</span>
              <span className="relative flex justify-center">
                {!last && <span className="absolute top-10 h-[calc(100%+0.25rem)] w-0.5 bg-line" aria-hidden />}
                <span className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full ${isDone ? "bg-rise text-white" : STRAND[st.strand].dot}`}>
                  {isDone ? <Check size={18} aria-label="Done" /> : <Icon size={18} strokeWidth={1.8} aria-hidden />}
                </span>
              </span>
              <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-raised px-4 py-2.5">
                <span className={`min-w-0 text-sm font-medium ${isDone ? "text-muted line-through decoration-control" : ""}`}>{st.title}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STRAND[st.strand].tag}`}>{STRAND[st.strand].label}</span>
                  <span className={`text-xs ${/free/i.test(st.funding) ? "font-semibold text-rise" : "text-muted"}`}>{st.funding}</span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {plan.steps.some((st) => st.kind === "programme") && <p className="mt-1 text-sm text-fall">Some skills have no vetted free course yet. A PERKESO-supported or other programme may cover them.</p>}
    </Card>
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
