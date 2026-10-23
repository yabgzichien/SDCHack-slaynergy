"use client";
import { ViewTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, ChevronRight } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { LandingIntro } from "@/components/LandingIntro";
import { STEPS, useJourney } from "@/components/Journey";
import { RunwayStrip } from "@/components/RunwayStrip";
import { Btn, Card, PageTitle, Skeleton } from "@/components/ui";
import { stateJobs } from "@/lib/engine/geo";
import { roleById, type SectorId } from "@/lib/engine/data";

export default function Home() {
  const { view, state } = useApp();
  if (!view || !state) return <Skeleton lines={4} />;
  return state.profile ? <Dashboard /> : <LandingIntro />;
}

function Dashboard() {
  const { view, state } = useApp();
  const { status } = useJourney();
  const v = view!, st = state!, p = st.profile!;
  const plan = v.plan;
  const weeks = plan?.deadlineWeeks ?? Math.floor(p.months * 4.345 - 2);
  const fading = v.profileSkills.filter((s) => !s.expiry.durable && s.expiry.expectedYear < 2031).length;
  const next = plan?.steps.find((s) => !v.pathway.done[s.id]) ?? null;
  const done = plan ? plan.steps.filter((s) => v.pathway.done[s.id]).length : 0;
  const role = v.chosen ?? v.lasting ?? v.matches[0];
  const mapFact = (() => {
    if (!role) return "Where the jobs are";
    const r = [...stateJobs(role.sector as SectorId, roleById[role.roleId]?.group)].sort((x, y) => y.workers - x.workers);
    return `Most jobs: ${r[0].short}`;
  })();
  const fact = [
    `${p.months} months, ${p.hoursPerWeek} hours a week`,
    fading ? `AI could take over ${fading} of ${v.profileSkills.length} skills by 2031` : "Your skills look safe until 2031",
    v.lasting ? `Best: ${v.lasting.title}` : `${v.matches.length} jobs within reach`,
    mapFact,
    plan ? `${done} of ${plan.steps.length} steps done` : "Choose a job first",
  ];
  const nextStep = STEPS.findIndex((_, i) => status(i) !== "done");
  return (
    <div>
      <PageTitle title={`${p.name === "You" ? "You" : p.name}, you have ${weeks} weeks to learn.`} aside={<Image src="/cockatiel-mascot.png" alt="" width={112} height={112} className="hidden h-28 w-28 object-contain sm:block" />}>
        {plan ? `Your plan for ${plan.title} takes ${plan.totalWeeks} of them.` : "Pick a job to plan for."}
      </PageTitle>

      {/* The dashboard's only step display: five cards on a track, done steps ticked, the next one raised. */}
      <div className="relative">
        <div className="pointer-events-none absolute left-[10%] right-[10%] top-9 hidden h-[3px] rounded-full bg-line xl:block" aria-hidden>
          <span className="block h-full rounded-full bg-accent" style={{ width: `${(Math.max(0, nextStep < 0 ? STEPS.length - 1 : nextStep) / (STEPS.length - 1)) * 100}%` }} />
        </div>
        <ol className="relative grid gap-2 xl:grid-cols-5 xl:gap-3" aria-label="Your steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const stt = status(i);
            const isNext = i === nextStep;
            return (
              <li key={s.href}>
                <ViewTransition name={`jstep-${i}`} share="morph" default="none">
                <Link href={s.href} aria-current={isNext ? "step" : undefined}
                  className={`press flex h-full items-center gap-3 rounded-[22px] p-4 xl:flex-col xl:items-start ${isNext ? "bg-raised ring-1 ring-ink/15" : "bg-surface hover:bg-surface2"}`}>
                  <span className="flex w-full items-center gap-2 max-xl:w-auto">
                    <span className={`num inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${stt === "done" ? "bg-accent text-white" : isNext ? "bg-primary text-primaryink" : "bg-raised text-muted ring-1 ring-line"}`} aria-hidden>
                      {stt === "done" ? <Check size={18} strokeWidth={2.6} /> : i + 1}
                    </span>
                    {isNext && <span className="ml-auto hidden rounded-full bg-accentsoft px-2 py-0.5 text-xs font-medium text-accentink xl:inline">Next</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium"><Icon size={14} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />{s.label}{stt === "done" && <span className="sr-only">done</span>}</span>
                    <span className="mt-0.5 block text-sm text-muted">{fact[i]}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted xl:hidden" aria-hidden />
                </Link>
                </ViewTransition>
              </li>
            );
          })}
        </ol>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-base font-semibold">Your learning</h2>
        {plan ? <RunwayStrip plan={plan} progress={v.pathway.done} /> : <p className="text-sm text-muted">Choose a job to see your learning plan.</p>}
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
