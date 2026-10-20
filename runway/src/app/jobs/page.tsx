"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { StepNav } from "@/components/StepNav";
import { Bar, Btn, Card, Chip, Estimate, H, PageTitle, SdgTag, Skeleton, SourceChip } from "@/components/ui";

export default function JobsPage() {
  const { view, state, catalog, act, busy } = useApp();
  const router = useRouter();
  const [sector, setSector] = useState<string>("all");
  if (!view || !state || !catalog) return <Skeleton lines={6} />;
  if (!state.profile) return <Card><p>Make a profile first so Runway can match you to jobs.</p><div className="mt-3"><Btn href="/profile">Start with your profile</Btn></div></Card>;
  const goals = state.goals;
  const toggleGoal = (t: string) => act("goals", { goals: goals.includes(t) ? goals.filter((g) => g !== t) : [...goals, t] });
  const choose = async (id: string) => { const r = await act("chooseRole", { roleId: id }); if (r) router.push("/plan"); };
  const top = view.matches[0];
  const filtered = view.matches.filter((m) => sector === "all" || m.sector === sector);
  const sectorLabel = (id: string) => view.sectors.find((x) => x.id === id)?.label ?? id;

  return (
    <div>
      <PageTitle step="Step 3 of 4 · Get matched" title={`Jobs you can reach in ${state.profile.months} months`}>
        Only jobs you can train for in time are ranked. Each score shows its parts. Scores use how long each skill lasts and how many jobs are advertised. New data can re-rank the list.
      </PageTitle>

      <Card className="mb-5" tone="accent">
        <H sub="Pick the goals you care about. The ranking changes, and each job shows the trade-off (for example, extra weeks of training).">Which goals matter to you?</H>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sustainable Development Goals">
          {catalog.goals.map((g) => (
            <button key={g.target} onClick={() => toggleGoal(g.target)} aria-pressed={goals.includes(g.target)} disabled={busy} title={g.text}
              className={`min-h-11 rounded-full border px-4 text-sm ${goals.includes(g.target) ? "border-accent bg-accent font-semibold text-accentink" : "border-line bg-surface"}`}>
              <span className="font-bold">SDG {g.target}</span> · {g.label}
            </button>
          ))}
        </div>
        {goals.length > 0 && <button className="mt-2 min-h-10 text-sm font-semibold text-accent underline" onClick={() => act("goals", { goals: [] })}>Clear goals</button>}
      </Card>

      <section aria-labelledby="sec" className="mb-5">
        <h2 id="sec" className="mb-2 text-lg font-bold">Browse by sector</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <button onClick={() => setSector("all")} aria-pressed={sector === "all"} className={`press rounded-2xl border p-3 text-left ${sector === "all" ? "border-ink bg-ink text-bg" : "border-line bg-surface"}`}>
            <p className="font-semibold leading-tight">All sectors</p>
            <p className="num text-xs opacity-70">{view.matches.length} jobs you can reach</p>
          </button>
          {view.sectors.map((sec) => (
            <button key={sec.id} onClick={() => setSector(sec.id)} aria-pressed={sector === sec.id}
              className={`press rounded-2xl border p-3 text-left ${sector === sec.id ? "border-ink bg-ink text-bg" : "border-line bg-surface"} ${sec.reachable === 0 ? "opacity-60" : ""}`}>
              <p className="font-semibold leading-tight">{sec.label}</p>
              <p className="num text-xs opacity-70">{sec.reachable} of {sec.total} reachable</p>
              {sec.bestTitle && <p className="mt-1 truncate text-xs opacity-80">Best: {sec.bestTitle}</p>}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Some jobs need a diploma or degree. You said your highest qualification is {catalog.education.find((e) => e.id === state.profile!.education)?.label.toLowerCase()}. Jobs that need more are listed at the bottom.</p>
      </section>

      <div className="mb-3"><Estimate /></div>
      <ol className="space-y-3">
        {filtered.map((m) => (
          <motion.li layout key={m.roleId} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
            <Card tone={m.rank === 1 ? "accent" : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted">#{m.rank}{m.baseRank !== m.rank && goals.length > 0 ? ` (was #${m.baseRank} without goals)` : ""}</p>
                  <h3 className="text-lg font-bold leading-tight">{m.title}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Chip tone="neutral">{sectorLabel(m.sector)}</Chip>
                    <SdgTag target={m.sdgTarget} why={m.sdgWhy} />
                    <Chip>≈ {m.weeks} weeks to ready</Chip>
                    {m.atRisk && <Chip tone="fall" title="Most of this job's skills are expected to be automated soon, so its score is reduced by 8 points">Skills at risk (−8)</Chip>}
                    {m.sdgMatch && <Chip tone="rise">Matches your goals</Chip>}
                    {m.resumeFit !== null && <Chip tone={m.resumeFit >= 0.6 ? "rise" : "neutral"} title="Share of this job's key skills your resume already shows">Resume fit {Math.round(m.resumeFit * 100)}%</Chip>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="num text-3xl font-extrabold">{Math.round(m.score * 100)}</p>
                  <p className="text-xs text-muted">match score</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-muted">{whyFits(m)}</p>

              {m.tradeoff && <p className="mt-2 rounded-lg bg-risesoft p-2 text-sm text-rise">{m.tradeoff}</p>}

              <details className="mt-3">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent">Why this score, and what you are missing</summary>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold">Score breakdown</p>
                    <ul className="space-y-2">
                      {m.parts.map((p) => (
                        <li key={p.key}>
                          <div className="flex justify-between text-sm"><span>{p.label} <span className="text-xs text-muted">(weight {Math.round(p.weight * 100)}%)</span></span><span className="num font-medium">{Math.round(p.value * 100)}</span></div>
                          <Bar value={p.value} label={`${p.label} ${Math.round(p.value * 100)} out of 100`} />
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted">Job demand: {m.demand.label} were {m.demand.recent.toFixed(1)}% of online ads over {m.demand.period}, {m.demand.trend >= 0 ? "up" : "down"} {Math.abs(m.demand.trend * 100).toFixed(0)}% on the year before.</p>
                    <div className="mt-1"><SourceChip name="DOSM Job Market Insights" date={`to ${view.world.asOfQuarter.replace("Q", " Q")}`} url="https://www.dosm.gov.my/portal-main/release-content/big-data-analytics-job-market-insights-q22026" /></div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Skills gap ({m.gaps.length === 0 ? "none" : m.gaps.length})</p>
                    {m.gaps.length === 0 ? <p className="text-sm text-muted">You already have every skill this job lists.</p> : (
                      <ul className="space-y-1.5">
                        {m.gaps.map((g) => (
                          <li key={g.skillId} className="flex flex-wrap items-center justify-between gap-1 text-sm">
                            <span>{g.name} <SdgTag target={g.sdgTarget} /></span>
                            <span className={g.expiry.durable ? "text-rise" : "text-fall"}>{g.expiry.durable ? "lasts past 2040" : `expires ≈ ${g.expiry.expected}`}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-muted">Role ID: O*NET-SOC {m.onet}{m.closest ? " (closest match to this job title)" : ""}, from the Anthropic Economic Index release.</p>
                  </div>
                </div>
              </details>
              <div className="mt-2"><Btn onClick={() => choose(m.roleId)} disabled={busy} variant={m.rank === 1 ? "primary" : "ghost"}>Plan my path to this job →</Btn></div>
            </Card>
          </motion.li>
        ))}
      </ol>
      {filtered.length === 0 && view.matches.length > 0 && <Card><p>No reachable jobs in this sector yet. Pick another sector, or see what it would take below.</p></Card>}
      {view.matches.length === 0 && <Card tone="fall"><p>No job is reachable in {state.profile.months} months with {state.profile.hoursPerWeek} hours a week. Try more months or more weekly hours, or talk to your counsellor.</p></Card>}
      {(() => {
        const list = view.unreachable.filter((u) => sector === "all" || u.sector === sector);
        const qual = list.filter((u) => u.reason === "qualification"), time = list.filter((u) => u.reason === "time");
        if (!list.length) return null;
        const row = (u: (typeof list)[number]) => <li key={u.roleId} className="flex justify-between gap-2 rounded-xl bg-surface px-3 py-2"><span>{u.title} <span className="text-xs text-muted">· {sectorLabel(u.sector)}</span></span><span className="num text-muted">{u.need}</span></li>;
        return (
          <div className="mt-6 space-y-3">
            {time.length > 0 && <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent">{time.length} jobs need more time than you have</summary><ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{time.map(row)}</ul></details>}
            {qual.length > 0 && <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent">{qual.length} jobs need a higher qualification (longer-term paths)</summary><ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{qual.map(row)}</ul><p className="mt-1 text-xs text-muted">Ask your counsellor about part-time study, recognition of prior learning, or funding.</p></details>}
          </div>
        );
      })()}
      <StepNav back="/skills" next="/plan" nextLabel={top ? "See my plan" : "Next"} disabled={!top} />
    </div>
  );
}

function whyFits(m: { overlap: number; outlook: number; demand: { score: number; trend: number }; weeks: number; gaps: unknown[]; atRisk: boolean }) {
  const bits: string[] = [];
  bits.push(m.overlap >= 0.6 ? "You already have most of the skills" : m.overlap >= 0.35 ? "You have a good part of the skills" : "You would learn most of the skills");
  bits.push(m.outlook >= 0.75 ? "they should last" : m.atRisk ? "but its skills may fade sooner" : "and its skills should hold up");
  bits.push(m.demand.trend > 0.05 ? "job ads are growing" : m.demand.trend < -0.05 ? "job ads are shrinking" : "job ads are steady");
  return `${bits[0]}, ${bits[1]}, and ${bits[2]}. About ${m.weeks} weeks to get ready.`;
}
