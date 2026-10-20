"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { STEPS, useJourney } from "@/components/Journey";
import { RunwayStrip } from "@/components/RunwayStrip";
import { Btn, Card, FUTURE_NAME, PageTitle, Skeleton, pct } from "@/components/ui";
import { stateJobs } from "@/lib/engine/geo";
import type { SectorId } from "@/lib/engine/data";

export default function Home() {
  const { view, state } = useApp();
  if (!view || !state) return <Skeleton lines={4} />;
  return state.profile ? <Dashboard /> : <Intro />;
}

const PROMISE = [
  "Your last job, skills and time. About two minutes.",
  "Which of your skills AI is likely to take over, and when.",
  "Three possible speeds of AI progress, and how likely each is.",
  "Jobs you can get ready for in the time you have.",
  "Where those jobs are in Malaysia, if you would move.",
  "Free courses, week by week. A counsellor approves it.",
];

function Intro() {
  const { act, busy, catalog } = useApp();
  const router = useRouter();
  const demo = async () => { if (await act("startPersona", { personaId: "hafiz" })) router.push("/skills"); };
  return (
    <div>
      <PageTitle title="Find a job that lasts, before your time runs out.">
        For office workers who have just been laid off. Six steps from your last job to a plan.
      </PageTitle>
      <div className="flex flex-wrap items-center gap-3">
        <Btn href="/start" className="min-h-12 px-6 text-base">Get started</Btn>
        <Btn variant="ghost" onClick={demo} disabled={busy || !catalog} className="min-h-12 px-6 text-base">Try it as Hafiz</Btn>
      </div>
      <p className="mt-3 text-sm text-muted">Hafiz is made up: 27, a bank operations executive in Kedah with five months to find work.</p>

      <ol className="mt-12 grid gap-3 xl:grid-cols-6" aria-label="The six steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.href} className="relative flex items-center gap-4 rounded-[22px] bg-surface p-4 xl:flex-col xl:items-start xl:gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised"><Icon size={20} strokeWidth={1.7} aria-hidden /></span>
              <div>
                <p className="font-medium"><span className="num text-muted">{i + 1}. </span>{s.label}</p>
                <p className="mt-1 text-sm text-muted">{PROMISE[i]}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-8 max-w-3xl text-sm text-muted">
        What makes it different: the forecast is not one fixed score. A crowd of forecasters bets points, never money, on the next official job figures, and the most accurate ones get the most say. Every number shows its source and date, and you stay in charge.
      </p>
    </div>
  );
}

function Dashboard() {
  const { view, state } = useApp();
  const { status } = useJourney();
  const v = view!, st = state!, p = st.profile!;
  const plan = v.plan;
  const weeks = plan?.deadlineWeeks ?? Math.floor(p.months * 4.345 - 2);
  const fading = v.profileSkills.filter((s) => !s.expiry.durable && s.expiry.expectedYear < 2031).length;
  const top = [...v.world.futures].sort((a, b) => b.weight - a.weight)[0];
  const next = plan?.steps.find((s) => !st.progress[s.id]) ?? null;
  const done = plan ? plan.steps.filter((s) => st.progress[s.id]).length : 0;
  const a = st.approval;
  const role = v.chosen ?? v.lasting ?? v.matches[0];
  const mapFact = (() => {
    if (!role) return "Where the jobs are";
    const r = [...stateJobs(role.sector as SectorId)].sort((x, y) => y.workers - x.workers);
    return `Most jobs: ${r[0].short}`;
  })();
  const fact = [
    `${p.months} months, ${p.hoursPerWeek} hours a week`,
    fading ? `${fading} of ${v.profileSkills.length} fade before 2031` : "None fades before 2031",
    `Most likely: ${FUTURE_NAME[top.id].toLowerCase()} AI, ${pct(top.weight)}`,
    v.lasting ? `Best: ${v.lasting.title}` : `${v.matches.length} jobs within reach`,
    mapFact,
    plan ? `${done} of ${plan.steps.length} steps · ${a.status === "approved" ? "approved" : a.status === "submitted" ? "waiting for review" : "not sent yet"}` : "Choose a job first",
  ];
  const nextStep = STEPS.findIndex((_, i) => status(i) !== "done");
  return (
    <div>
      <PageTitle title={`${p.name === "You" ? "You" : p.name}, you have ${weeks} weeks of runway.`}>
        {plan ? `Your plan for ${plan.title} takes ${plan.totalWeeks} of them.` : "Pick a job to plan for."}
      </PageTitle>

      <ol className="grid gap-2 xl:grid-cols-6 xl:gap-3" aria-label="Your steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const stt = status(i);
          const isNext = i === nextStep;
          return (
            <li key={s.href}>
              <Link href={s.href} className={`press flex h-full items-center gap-3 rounded-[22px] p-4 xl:flex-col xl:items-start ${isNext ? "bg-raised ring-1 ring-ink/15" : "bg-surface hover:bg-surface2"}`}>
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${stt === "done" ? "bg-accentsoft text-accent" : "bg-raised"}`}><Icon size={18} strokeWidth={1.8} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium"><span className="num text-muted">{i + 1}. </span>{s.label}</span>
                  <span className="mt-0.5 block text-sm text-muted">{fact[i]}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted xl:hidden" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>

      <Card className="mt-4">
        <h2 className="mb-3 text-base font-semibold">Your runway</h2>
        {plan ? <RunwayStrip plan={plan} progress={st.progress} /> : <p className="text-sm text-muted">Choose a job to see your plan on your runway.</p>}
        {next && (
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-raised p-4">
            <div className="min-w-0">
              <p className="text-sm text-muted">Next · {next.weekStart === next.weekEnd ? `week ${next.weekStart}` : `weeks ${next.weekStart}–${next.weekEnd}`}</p>
              <p className="mt-1 font-medium">{next.title}</p>
            </div>
            <Btn href="/plan">Open your plan</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
