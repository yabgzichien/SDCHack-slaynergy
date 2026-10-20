"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { ExpiryLegend, ExpiryTrack } from "@/components/ExpiryTrack";
import { StepNav } from "@/components/StepNav";
import { Btn, Card, Chip, Estimate, H, PageTitle, SdgTag, Skeleton, SourceChip } from "@/components/ui";

export default function SkillsPage() {
  const { view, state } = useApp();
  if (!view || !state) return <Skeleton lines={6} />;
  const r = view.radar;
  const mine = view.profileSkills;
  const fading = mine.filter((s) => !s.expiry.durable && s.expiry.expectedYear < 2031);
  const lasting = mine.filter((s) => s.expiry.durable || s.expiry.expectedYear >= 2034);
  const shelf = (s: (typeof mine)[number]) => (s.expiry.durable || s.expiry.expectedYear >= 2034 ? { t: "Lasting", tone: "rise" as const } : s.expiry.expectedYear < 2031 ? { t: "Fading soon", tone: "fall" as const } : { t: "Medium", tone: "neutral" as const });

  return (
    <div>
      <PageTitle step="Step 2 of 4 · Skills" title={state.profile ? "Which of your skills will last?" : "Which skills will last?"}>
        Each skill has a shelf life: the date AI is expected to do most of that work. It comes from three public sources and moves when new data is released.
      </PageTitle>

      {state.profile ? (
        <>
          <Card className="mb-5" tone={fading.length ? "fall" : "rise"}>
            <p className="text-lg font-bold">
              {fading.length ? `${fading.length} of your ${mine.length} skills are expected to fade within about 5 years.` : `None of your ${mine.length} skills is expected to fade within about 5 years.`}
            </p>
            <p className="mt-1 text-sm text-muted">
              {lasting.length ? `Your strongest: ${lasting.slice(0, 2).map((s) => s.name).join(" and ")}. ` : ""}That is not a reason to worry. It is a reason to plan, and the next two steps do exactly that.
            </p>
          </Card>

          <ExpiryLegend />
          <ul className="mt-3 space-y-3">
            {mine.map((s) => {
              const sh = shelf(s);
              return (
                <li key={s.skillId}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{s.name}</p>
                      <div className="flex items-center gap-2">
                        <Chip tone={sh.tone}>{sh.t}</Chip>
                        <span className="num text-sm font-bold">{s.expiry.durable ? "after 2040" : `≈ ${s.expiry.expected}`}</span>
                      </div>
                    </div>
                    <details className="mt-1">
                      <summary className="min-h-10 cursor-pointer py-1.5 text-sm font-semibold text-accent">Show the three futures</summary>
                      <ExpiryTrack byFuture={s.expiry.byFuture} expected={s.expiry.expected} durable={s.expiry.durable} />
                      <p className="mt-1 text-xs text-muted">AI exposure of the work: {s.expiry.exposure.toFixed(2)} · share of its tasks seen in AI use: {Math.round(s.expiry.coverage * 100)}%</p>
                    </details>
                  </Card>
                </li>
              );
            })}
          </ul>
          <div className="mt-3"><Estimate /></div>
        </>
      ) : (
        <Card className="mb-5"><p>Add your profile to see the shelf life of <b>your</b> skills.</p><div className="mt-3 flex gap-2"><Btn href="/resume">Scan my resume</Btn><Btn href="/profile" variant="ghost">Answer questions</Btn></div></Card>
      )}

      {view.resume && (
        <Card className="mt-5" tone="accent">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-bold">Your resume scored {view.resume.score} out of 100</p><p className="text-sm text-muted">{view.resume.findings.filter((f) => f.severity === "fix").length} items to fix first. Raise your score while you train.</p></div>
            <Btn href="/resume" variant="ghost">Review resume fixes</Btn>
          </div>
        </Card>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <H sub="Roles with the best mix of lasting skills and growing job ads (DOSM).">Jobs on the rise</H>
          <ul className="divide-y divide-line">
            {r.risingJobs.slice(0, 6).map((j) => (
              <li key={j.roleId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div><p className="font-medium">{j.title}</p><p className="text-xs text-muted">{j.group}: {j.share.toFixed(1)}% of online ads, {j.trend >= 0 ? "+" : ""}{(j.trend * 100).toFixed(0)}% vs the year before</p></div>
                <SdgTag target={j.sdgTarget} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <H sub="Back-office jobs whose tasks are most exposed to generative AI (ILO 2025).">Jobs under pressure</H>
          <ul className="divide-y divide-line">
            {r.decliningJobs.map((j) => (
              <li key={j.occupationId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div><p className="font-medium">{j.title}</p><p className="text-xs text-muted">Exposure {j.exposure.toFixed(2)}{j.gradient ? ` · ${j.gradient.replace("Exposed: ", "")}` : ""}</p></div>
                <p className="text-sm text-fall">first skill fades ≈ {j.earliest}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <details className="mt-5 rounded-3xl border border-line bg-surface p-5">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">All fading and lasting skills in the market</summary>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <div><h3 className="mb-2 font-bold text-fall">▼ Fading</h3><ul className="space-y-2 text-sm">{r.declining.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><span className="num text-fall">≈ {s.expected}</span></li>)}</ul></div>
          <div><h3 className="mb-2 font-bold text-rise">▲ Lasting and wanted</h3><ul className="space-y-2 text-sm">{r.rising.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><SdgTag target={s.sdgTarget} /></li>)}</ul></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{r.sources.map((s) => <SourceChip key={s.name} name={s.name} date={s.date} url={s.url} />)}</div>
      </details>

      <Card className="mt-5" tone="demo">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-bold text-demo">How sure are we?</p><p className="text-sm">Three possible futures, weighted by a prediction market that settles on real data releases.</p></div>
          <Link href="/futures" className="press inline-flex min-h-11 items-center rounded-2xl bg-demo px-5 text-sm font-semibold text-white">See the forecasts</Link>
        </div>
      </Card>
      <StepNav back="/start" next="/jobs" nextLabel="Match me to jobs" disabled={!state.profile} />
    </div>
  );
}
