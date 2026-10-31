"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import type { RoleMatchView } from "@/lib/engine/view";
import { useSpeed } from "@/components/useSpeed";
import { useSelectJob } from "@/components/useSelectJob";
import { BriefWhy, Score, WhyThisJob } from "@/components/JobBits";
import { JobBadge } from "@/components/JobIcon";
import { GROUP_LABEL, GROUP_PAY, GROUP_PAY_SOURCE, roleById, sourceById } from "@/lib/engine/data";
import { stateJobs } from "@/lib/engine/geo";
import { areaName } from "@/lib/engine/geo";
import { Btn, Card, Chip, Estimate, FUTURE_NAME, H, More, PageTitle, SdgTag, Skeleton, SourceChip, sdgName, sdgReport } from "@/components/ui";
import { SdgIcon } from "@/components/SdgIcon";
import { SpeedBar } from "@/components/SpeedBar";
import { ScoreBreakdown, ScoreEquation } from "@/components/ScoreBreakdown";
import type { ScoreLine } from "@/lib/engine/matching";

// One question: why does this job score what it does, and what am I missing?
export default function JobDetailPage() {
  const { view, state, busy } = useApp();
  const { id } = useParams<{ id: string }>();
  const { speed, previewing } = useSpeed();
  const selectJob = useSelectJob();
  // The score card reports its lines and total, so the dropdown below can show them as an equation.
  const [formula, setFormula] = useState<{ lines: ScoreLine[]; total: number } | null>(null);
  if (!view || !state) return <Skeleton lines={6} />;
  const m = view.matches.find((x) => x.roleId === id);
  const blocked = view.unreachable.find((x) => x.roleId === id);
  if (!m) {
    return (
      <div>
        <Link href="/jobs/all" className="mb-4 inline-block text-sm text-muted underline decoration-control underline-offset-2">All jobs</Link>
        <PageTitle title={blocked ? `${blocked.title} is a longer-term path.` : "This job is not on your list."}>
          {blocked ? (blocked.reason === "qualification" ? `${blocked.need}. Ask an advisor about part-time study, recognition of prior learning, or funding.` : `It needs ${blocked.need.replace("≈ ", "about ")} of training, more than the time you have.`) : "Go back to your jobs."}
        </PageTitle>
      </div>
    );
  }
  const chosen = view.chosen?.roleId === m.roleId;
  const where = state.profile?.state && state.profile.move && state.profile.move !== "anywhere" ? areaName(state.profile.state, state.profile.move, state.profile.moveTo) : null;
  // Selecting moves on to the next step, the job map, which then shows this job.
  const choose = () => selectJob(m.roleId);
  const under = previewing ? view.scenarios?.find((s) => s.id === speed)?.roles[m.roleId] : undefined;
  return (
    <div>
      <Link href="/jobs" className="mb-4 inline-block text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">Jobs</Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <JobBadge name={m.why.icon} size="lg" />
          <div className="min-w-0">
            <h1 className="greeting text-[1.75rem] sm:text-[2.5rem]">{m.title}</h1>
            <div className="mt-3"><BriefWhy m={m} /></div>
          </div>
        </div>
        <Score value={m.score} />
      </header>
      <div className="mb-6 flex flex-wrap gap-2">
        <Btn onClick={choose} disabled={busy} className="min-h-12 px-6 text-base">{chosen ? "Selected: see it on the job map" : "Select job and see the job map"}</Btn>
      </div>

      <div className="mb-4">
        <SpeedBar view={view}>
          {under && (
            <p className="num mt-2 text-sm font-medium" aria-live="polite">
              {`If AI is ${FUTURE_NAME[speed]}: number ${under.rank} on your list (number ${m.rank} with Our forecast), score ${Math.round(under.score * 100)} (now ${Math.round(m.score * 100)}).${under.atRisk ? " AI may take over its skills soon." : ""}`}
            </p>
          )}
        </SpeedBar>
      </div>

      <Card tone="raised" className="mb-4">
        <H sub="What you care about, what you know, and what AI will and will not do in this job.">Why this job</H>
        <WhyThisJob m={m} speed={speed} />
      </Card>

      <JobGoal m={m} />

      <Pay roleId={m.roleId} home={state.profile?.state ?? null} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ScoreBreakdown roleId={m.roleId} speed={speed} version={`${Math.round(m.score * 1000)}:${state.profile?.hoursPerWeek}:${state.profile?.skills.length}`} onBreakdown={setFormula} />
          {m.localPenalty > 0.001 && where && <p className="num mt-3 text-sm">Few jobs like this nearby: they are {Math.round((1 - (m.localLq ?? 1)) * 100)}% less common in {where} than across Malaysia (an estimate from DOSM state figures). <Link href="/map" className="underline decoration-control underline-offset-2">See the job map</Link></p>}
          <p className="mt-3 text-sm">Job ads for work like this are {Math.abs(m.demand.trend) < 0.03 ? "steady" : m.demand.trend > 0 ? `up ${Math.abs(m.demand.trend * 100).toFixed(0)}%` : `down ${Math.abs(m.demand.trend * 100).toFixed(0)}%`} compared with earlier in the year.</p>
          <More>
            {formula ? <ScoreEquation lines={formula.lines} total={formula.total} /> : <div className="h-40 animate-pulse rounded-2xl bg-surface2" aria-label="Working out the score" />}
          </More>
          <div className="mt-1"><SourceChip name="DOSM Job Market Insights" date={`to ${view.world.asOfQuarter.replace("Q", " Q")}`} url={view.world.past?.url ?? sourceById.dosm.url} /></div>
        </Card>

        <Card>
          <H sub={m.gaps.length ? `${m.gaps.length} to learn, ${m.have.length} you already have` : "You already have every skill this job lists."}>What you are missing</H>
          <ul className="space-y-2">
            {m.gaps.map((g) => (
              <li key={g.skillId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-3 text-sm">
                <span>{g.name}</span>
                <span className="flex items-center gap-2"><SdgTag target={g.sdgTarget} /><span className={`num ${g.expiry.byFutureYear[speed] === null ? "text-rise" : "text-fall"}`}>{g.expiry.byFutureYear[speed] === null ? "safe past 2040" : `AI could do it by ${g.expiry.byFuture[speed]}`}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5"><SdgTag target={m.sdgTarget} why={m.sdgWhy} /><Chip>About {m.weeks} weeks to get ready</Chip>{m.atRisk && <Chip tone="fall">AI may take over some skills soon</Chip>}{m.fewNearby && <Chip tone="fall">Few jobs like this near you</Chip>}</div>
          {m.tradeoff && <p className="mt-2 text-sm text-muted">{m.tradeoff}</p>}
        </Card>
      </div>
      <div className="mt-4"><Estimate /></div>
    </div>
  );
}

// Why this job counts towards its UN target, in the UN's words and then the job's, and where to read the world's progress.
// One person's job will not move a global goal much, so the link gives the bigger picture rather than claiming an impact.
function JobGoal({ m }: { m: RoleMatchView }) {
  const report = sdgReport(m.sdgTarget);
  return (
    <Card className="mb-4">
      <H sub={m.sdgMatch ? "You picked this goal." : undefined}>{`Why this job serves UN goal ${m.sdgTarget}`}</H>
      <div className="flex items-start gap-4">
        <SdgIcon goal={Number(m.sdgTarget.split(".")[0])} />
        <div className="min-w-0">
          <p className="font-medium">{sdgName(m.sdgTarget)}</p>
          <p className="mt-1 text-sm">{m.sdgWhy}</p>
          {m.sdgText && <p className="mt-2 text-sm text-muted">{`The UN target: ${m.sdgText}`}</p>}
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <p className="font-semibold">Contribute and Make a Change.</p>
        <p className="mt-1 text-sm">Every little decision adds up. See the current global progress on this goal here:</p>
        <a href={report.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">{report.name}</a>
      </div>
    </Card>
  );
}

// Pay: the national figure for this job's occupation group (no per-job, per-state figure exists), then all-worker
// median pay by state for context, labelled as such, with the worker's own state marked.
function Pay({ roleId, home }: { roleId: string; home: string | null }) {
  const r = roleById[roleId];
  const pay = GROUP_PAY[r.group];
  const states = [...stateJobs(r.sector, r.group)].sort((a, b) => b.medianWage - a.medianWage);
  const rm = (x: number) => `RM${x.toLocaleString("en-MY")}`;
  const top = states.slice(0, 5);
  const mine = home ? states.find((x) => x.id === home) : null;
  const shown = mine && !top.includes(mine) ? [...top, mine] : top;
  return (
    <Card className="mb-4">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <H>Pay</H>
          <p className="num text-[2rem] leading-none">{rm(pay.rm)}<span className="ml-1 text-base text-muted">a month</span></p>
          <p className="mt-2 text-sm">{pay.kind === "median" ? "Median" : "Average"} pay for {GROUP_LABEL[r.group].toLowerCase()} across Malaysia.</p>
          <p className="mt-1 text-sm text-muted">{pay.kind === "average" ? "DOSM gives only the average for this group, which is usually higher than the median. " : ""}DOSM does not publish pay for each job in each state.</p>
          <div className="mt-2"><SourceChip name={GROUP_PAY_SOURCE.name} date={GROUP_PAY_SOURCE.date} url={GROUP_PAY_SOURCE.url} /></div>
        </div>
        <div>
          <p className="text-sm font-medium">Median pay for all workers, by state</p>
          <ul className="mt-2 space-y-1 text-sm">
            {shown.map((x) => (
              <li key={x.id} className={`flex justify-between gap-3 rounded-xl px-3 py-1.5 ${x.id === home ? "bg-accentsoft font-medium text-accentink" : ""}`}>
                <span>{x.name}{x.id === home ? " (you)" : ""}</span><span className="num">{rm(x.medianWage)}</span>
              </li>
            ))}
          </ul>
          <Link href="/map" className="mt-2 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">Compare every state on the job map</Link>
        </div>
      </div>
    </Card>
  );
}
