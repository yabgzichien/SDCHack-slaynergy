"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { RunwayStrip } from "@/components/RunwayStrip";
import { Btn, Card, Chip, FUTURE_NAME, H, PageTitle, Skeleton, Stat, pct } from "@/components/ui";

export default function Home() {
  const { view, state } = useApp();
  if (!view || !state) return <Skeleton lines={4} />;
  return state.profile ? <Dashboard /> : <Intro />;
}

function Intro() {
  const { act, busy, catalog } = useApp();
  const router = useRouter();
  const demo = async (id: string) => { if (await act("startPersona", { personaId: id })) router.push("/skills"); };
  return (
    <div>
      <PageTitle title="Find a job that lasts, before your time runs out.">
        For young office workers in their first week after a layoff. Runway shows which of your skills will last, matches you to jobs you can reach in time, and builds a week-by-week plan your counsellor approves.
      </PageTitle>
      <div className="flex flex-wrap items-center gap-3">
        <Btn href="/start" className="min-h-12 px-6 text-base">Get started</Btn>
        <Btn variant="ghost" onClick={() => demo("hafiz")} disabled={busy || !catalog} className="min-h-12 px-6 text-base">Try it as Hafiz</Btn>
      </div>
      <p className="mt-3 text-sm text-muted">
        Hafiz is made up: 27, a bank operations executive in Kedah with five months to find work.{" "}
        {catalog && <>Or try {catalog.personas.filter((p) => p.id !== "hafiz").map((p, i, a) => (
          <span key={p.id}><button onClick={() => demo(p.id)} disabled={busy} className="underline decoration-control underline-offset-2 hover:text-ink">{p.name}</button>{i < a.length - 2 ? ", " : i === a.length - 2 ? " or " : "."}</span>
        ))}</>}
      </p>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Your skills", "A shelf life for each skill you have, from public data with its source and date."],
          ["The forecast", "Three possible futures. A prediction market tested on real data releases says how likely each is."],
          ["Jobs", "Only jobs you can train for in the months you have, each with the reason for its score."],
          ["Your plan", "Free courses, week by week. Your counsellor reviews it and approves it."],
        ].map(([t, d]) => (
          <li key={t} className="min-h-32 rounded-[22px] bg-surface p-4">
            <p className="font-medium">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <H>Why these forecasts are different</H>
          <p className="text-sm">Most AI job-risk tools give one fixed score. Runway keeps three possible futures and lets a prediction market decide how likely each one is. Forecasters bet points, never money, on what the next real data release will show, and the most accurate ones gain the most influence.</p>
        </Card>
        <Card>
          <H>You stay in charge</H>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Your resume is read in memory and never saved.</li>
            <li>Your age is never used to match you. We test this.</li>
            <li>Every number shows its source and date. Nothing is invented.</li>
            <li>You choose. A counsellor reviews and approves.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Dashboard() {
  const { view, state } = useApp();
  const v = view!, st = state!, p = st.profile!;
  const plan = v.plan;
  const weeks = plan?.deadlineWeeks ?? Math.floor(p.months * 4.345 - 2);
  const lasting = v.profileSkills.filter((s) => s.expiry.durable || s.expiry.expectedYear >= 2034).length;
  const fading = v.profileSkills.filter((s) => !s.expiry.durable && s.expiry.expectedYear < 2031).length;
  const top = [...v.world.futures].sort((a, b) => b.weight - a.weight)[0];
  const next = plan?.steps.find((s) => !st.progress[s.id]) ?? null;
  const done = plan ? plan.steps.filter((s) => st.progress[s.id]).length : 0;
  const a = st.approval;
  return (
    <div>
      <PageTitle title={`${p.name === "You" ? "You" : p.name}, you have ${weeks} weeks of runway.`}>
        {plan ? `Your plan for ${plan.title} takes ${plan.totalWeeks} of them.` : "Pick a job to plan for."} {fading ? `${fading} of your ${v.profileSkills.length} skills fade before 2031.` : "None of your skills fades before 2031."}
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat href="/skills" label="Skills that last past 2034" value={`${lasting} of ${v.profileSkills.length}`} caption={fading ? `${fading} fade before 2031` : "None fades soon"} />
        <Stat href="/forecast" label="Most likely future" value={pct(top.weight)} caption={`${FUTURE_NAME[top.id]} AI progress`} />
        <Stat href="/jobs" label="Jobs you can reach" value={v.matches.length} caption={v.lasting ? `Best lasting: ${v.lasting.title}` : "None that lasts yet"} />
        <Stat href="/plan" label="Plan progress" value={plan ? `${done} of ${plan.steps.length}` : "–"} caption={plan ? `${plan.totalWeeks} weeks of steps` : "No plan yet"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-9">
          <H sub={plan ? `${plan.title} · ${plan.totalWeeks} weeks inside your ${plan.deadlineWeeks}` : undefined}>Your runway</H>
          {plan ? <RunwayStrip plan={plan} progress={st.progress} /> : <p className="text-sm text-muted">Choose a job to see your plan on your runway.</p>}
          {next && (
            <div className="mt-5 rounded-2xl bg-raised p-4">
              <p className="text-sm text-muted">Next step · {next.weekStart === next.weekEnd ? `week ${next.weekStart}` : `weeks ${next.weekStart}–${next.weekEnd}`}</p>
              <p className="mt-1 font-medium">{next.title}</p>
              <div className="mt-3"><Btn href="/plan">Open your plan</Btn></div>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-3">
          <H>Counsellor</H>
          <p className="text-sm">{a.status === "approved" ? "Your counsellor approved your plan." : a.status === "submitted" ? "Your plan is waiting for review." : "Not sent yet."}</p>
          <div className="mt-2"><Chip tone={a.status === "approved" ? "rise" : a.status === "submitted" ? "accent" : "neutral"}>{a.status === "approved" ? "Approved" : a.status === "submitted" ? "Waiting" : "Draft"}</Chip></div>
          <p className="mt-6 text-sm text-muted">Forecasting</p>
          <p className="num text-sm">{v.world.user.balance.toFixed(0)} points · influence {v.world.you.influence.toFixed(2)}×</p>
          <Link href="/market" className="mt-1 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">Make a forecast</Link>
        </Card>
      </div>
    </div>
  );
}
