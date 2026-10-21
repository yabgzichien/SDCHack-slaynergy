"use client";
import { useMemo, useState } from "react";
import { BriefcaseBusiness, Coins, MapPin, Plane, Users } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { MalaysiaMap, MapLegend } from "@/components/MalaysiaMap";
import { Btn, Card, Chip, More, NextRow, PageTitle, Skeleton, SourceChip } from "@/components/ui";
import { colourFor, type Measure } from "@/lib/map-scale";
import { mapFigures, metricOf, people, rm, times } from "@/lib/map-figures";
import { STATES, compareMove, geo, kindOfWork, occupationOf, stateJobs } from "@/lib/engine/geo";
import { SECTORS, roleById, type SectorId } from "@/lib/engine/data";

const MEASURES: { id: Measure; label: string; icon: typeof Users }[] = [
  { id: "jobs", label: "Jobs", icon: Users },
  { id: "wage", label: "Pay", icon: Coins },
  { id: "unemployment", label: "Unemployment", icon: BriefcaseBusiness },
];

// One question: if I moved, where would jobs like mine be?
export default function MapPage() {
  const { view, state, act, busy } = useApp();
  const [roleId, setRoleId] = useState<string | null>(null);
  const [measure, setMeasure] = useState<Measure>("jobs");
  const [move, setMove] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);

  const matches = view?.matches ?? [];
  const unreachable = view?.unreachable ?? [];
  const role = matches.find((m) => m.roleId === roleId) ?? unreachable.find((m) => m.roleId === roleId) ?? view?.chosen ?? matches[0] ?? null;
  const locked = unreachable.find((m) => m.roleId === role?.roleId) ?? null;
  // every job, grouped by kind of work (the map is the same for jobs of one kind), reachable ones first
  const groups = SECTORS.map((sec) => ({ ...sec, ok: matches.filter((m) => m.sector === sec.id), later: unreachable.filter((m) => m.sector === sec.id) }))
    .filter((g) => g.ok.length + g.later.length > 0);
  const sector = (role?.sector ?? "finance") as SectorId;
  const group = role ? roleById[role.roleId]?.group : undefined;
  const fig = useMemo(() => mapFigures(sector, measure, group), [sector, measure, group]);
  const home = state?.profile?.state ?? null;

  if (!view || !state) return <Skeleton lines={6} />;
  if (!state.profile || !role) {
    return <div><PageTitle title="Where in Malaysia are the jobs?">Answer a few questions and choose a job first; the map then shows where jobs like it are.</PageTitle><Btn href={state.profile ? "/jobs" : "/start"}>{state.profile ? "Choose a job" : "Get started"}</Btn></div>;
  }

  const rows = fig.rows;
  const ranked = [...rows].sort((a, b) => b.workers - a.workers);
  const best = ranked.filter((r) => r.id !== home)[0];
  const showMove = move || !home;
  const sel = picked ?? (showMove ? best.id : home!);
  const selRow = rows.find((r) => r.id === sel)!;
  const homeRow = home ? rows.find((r) => r.id === home)! : null;
  const cmp = compareMove(sector, home, sel, group);
  const job = role.title.toLowerCase();

  // other reachable jobs that are unusually common in the selected state
  const alsoHere = matches.filter((m) => m.roleId !== role.roleId).map((m) => ({ m, lq: stateJobs(m.sector as SectorId, roleById[m.roleId]?.group).find((x) => x.id === sel)!.lq }))
    .filter((x) => x.lq >= 1.15).sort((a, b) => b.lq - a.lq || b.m.score - a.m.score).slice(0, 4);

  const title = !showMove && homeRow
    ? `About ${people(homeRow.workers)} people in ${homeRow.short} do work like ${job}.`
    : homeRow && best.workers > homeRow.workers
    ? `${best.short} has ${times(best.workers / homeRow.workers)} as many jobs like ${job} as ${homeRow.short}.`
    : `${ranked[0].short} has the most jobs like ${job}: ${Math.round(ranked[0].share * 100)}% of Malaysia's.`;

  return (
    <div>
      <PageTitle title={title}>Where jobs like yours are in Malaysia, and how pay and unemployment compare. Tap a state to see it next to {homeRow ? homeRow.short : "your state"}.</PageTitle>

      <Card tone="raised" className="mb-4 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr]">
          <label className="block text-sm">
            <span className="flex items-center gap-1.5 text-muted"><BriefcaseBusiness size={15} aria-hidden />Job</span>
            <select value={role.roleId} onChange={(e) => { setRoleId(e.target.value); setPicked(null); }} className="mt-1.5 min-h-12 w-full rounded-2xl border border-control bg-raised px-3">
              {groups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {g.ok.map((m) => <option key={m.roleId} value={m.roleId}>{m.title}</option>)}
                  {g.later.map((m) => <option key={m.roleId} value={m.roleId}>{m.title} (not in reach yet)</option>)}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">{locked ? `Not in reach yet: ${locked.need.charAt(0).toLowerCase()}${locked.need.slice(1)}.` : group ? `Shows ${occupationOf(group).toLowerCase()} in ${kindOfWork(sector)}.` : `Shows people in ${kindOfWork(sector)}.`}</p>
          </label>
          <label className="block text-sm">
            <span className="flex items-center gap-1.5 text-muted"><MapPin size={15} aria-hidden />You live in</span>
            <select value={home ?? ""} disabled={busy} onChange={(e) => { act("homeState", { state: e.target.value || null }); setPicked(null); }} className="mt-1.5 min-h-12 w-full rounded-2xl border border-control bg-raised px-3">
              <option value="">Choose your state</option>
              {STATES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="text-sm">
            <span className="flex items-center gap-1.5 text-muted"><Plane size={15} aria-hidden />Would you move for work?</span>
            <div role="radiogroup" aria-label="Would you move for work?" className="mt-1.5 grid min-h-12 grid-cols-2 gap-1 rounded-full bg-surface2 p-1">
              {([[true, "Yes, anywhere"], [false, "No, stay home"]] as const).map(([v, l]) => (
                <button key={String(v)} role="radio" aria-checked={showMove === v} onClick={() => { setMove(v); setPicked(null); }} disabled={!v && !home}
                  className={`press rounded-full px-2 text-sm ${showMove === v ? "bg-primary font-medium text-primaryink" : "text-muted"} disabled:opacity-40`}>{l}</button>
              ))}
            </div>
            {!home && <p className="mt-1 text-xs text-muted">Choose your state to compare.</p>}
          </div>
        </div>
      </Card>

      <Card tone="raised" className="min-w-0 p-3 sm:p-5">
        <div role="tablist" aria-label="What the colours show" className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-surface2 p-1 sm:inline-grid">
          {MEASURES.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={measure === id} onClick={() => setMeasure(id)}
              className={`press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-1.5 text-xs sm:px-3 sm:text-sm ${measure === id ? "bg-raised font-medium shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted"}`}>
              <Icon size={15} aria-hidden className="hidden sm:block" />{label}
            </button>
          ))}
        </div>
        <MalaysiaMap values={fig.values} bins={fig.bins} ramp={fig.ramp} selected={sel} home={home} dimOthers={!showMove} onSelect={setPicked}
          ariaLabel={`Map of Malaysia's states shaded by ${fig.legend.toLowerCase()}. The table further down has the same figures.`} />
        <div className="mt-4"><MapLegend title={fig.legend} bins={fig.bins} ramp={fig.ramp} fmt={fig.fmt} home={!!home} /></div>
        {!showMove && <p className="mt-3 text-sm text-muted">Showing your state only. Choose “Yes, anywhere” to compare all states.</p>}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-medium">{selRow.name}</h2>
            {sel === home && <Chip>Your state</Chip>}
          </div>
          <dl className="num mt-3 grid grid-cols-3 gap-2">
            {[["Jobs like this", `≈ ${people(selRow.workers)}`], ["Median pay", rm(selRow.medianWage)], ["Unemployment", `${selRow.uRate.toFixed(1)}%`]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-raised p-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-1 text-base sm:text-lg">{v}</dd></div>
            ))}
          </dl>
          {cmp.from && sel !== home ? (
            <div className="mt-4 text-sm">
              <p className="font-medium">If you moved here from {cmp.from.short}</p>
              <ul className="mt-1.5 space-y-1">
                <li>{cmp.times! >= 1 ? `${times(cmp.times!)} as many jobs like this` : `${Math.round(cmp.times! * 100)}% as many jobs like this`}</li>
                <li>Pay {cmp.wageGap! >= 0 ? `${rm(cmp.wageGap!)} higher` : `${rm(-cmp.wageGap!)} lower`} a month</li>
                <li>Unemployment {Math.abs(cmp.uGap!) < 0.05 ? "about the same" : cmp.uGap! < 0 ? `${(-cmp.uGap!).toFixed(1)} points lower` : `${cmp.uGap!.toFixed(1)} points higher`}</li>
              </ul>
              <p className="mt-2 text-xs text-muted">Higher pay often comes with higher rent. Talk a move through with your counsellor; Jobbery does not advise on where to live.</p>
            </div>
          ) : !home ? <p className="mt-4 text-sm text-muted">Choose your state above to compare it with others.</p> : null}
        </Card>
        <Card className="lg:col-span-5">
          <h2 className="text-base font-semibold">Your other jobs that are common here</h2>
          {alsoHere.length ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {alsoHere.map(({ m, lq }) => (
                <li key={m.roleId}>
                  <button onClick={() => setRoleId(m.roleId)} className="press flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-raised px-3 py-2 text-left hover:bg-surface2">
                    <span>{m.title}</span><span className="num shrink-0 text-muted">{times(lq)} the usual</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm text-muted">None of your jobs is more common here than across Malaysia.</p>}
        </Card>
      </div>

      <Card className="mt-4">
        <More summary="All 16 states as a table">
          <div className="scroll-x">
            <table className="w-full text-sm text-ink">
              <caption className="sr-only">States ranked by the estimated number of people in this kind of work</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2 pr-2 font-normal">State</th>
                  <th className="py-2 pr-2 text-right font-normal">Jobs like this</th>
                  <th className="py-2 pr-2 text-right font-normal">Unemployment</th>
                  <th className="py-2 text-right font-normal">Median pay</th>
                </tr>
              </thead>
              <tbody>
                {(showMove ? ranked : ranked.filter((r) => r.id === home)).map((r) => (
                  <tr key={r.id} className={`border-t border-line ${r.id === sel ? "bg-accentsoft" : ""}`}>
                    <td className="py-2 pr-2">
                      <button onClick={() => setPicked(r.id)} className="inline-flex min-h-9 items-center gap-2 text-left">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: colourFor(metricOf(r, measure), fig.bins, fig.ramp) }} aria-hidden />
                        {r.short}{r.id === home ? <span className="text-xs text-muted">(you)</span> : null}
                      </button>
                    </td>
                    <td className="num py-2 pr-2 text-right">≈ {people(r.workers)}</td>
                    <td className="num py-2 pr-2 text-right">{r.uRate.toFixed(1)}%</td>
                    <td className="num py-2 text-right">{rm(r.medianWage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </More>
        <More summary="Where these figures come from">
          <p>Malaysia publishes no state figures for single jobs. So &quot;jobs like this&quot; is an estimate: the people working in the industries this job belongs to ({kindOfWork(sector)}){group ? <>, times the share of each state&apos;s workers who are {occupationOf(group).toLowerCase()}</> : null}. Both come from DOSM&apos;s Labour Force Survey {geo.industryYear} tables by state, scaled to each state&apos;s employment in {STATES[0].lfs.quarter.replace("Q", " Q")}. It shows where the work is, not a count of open vacancies.</p>
          <p>Sabah, Sarawak and Labuan are drawn closer to the peninsula than they really are, so every state fits at a readable size. State boundaries: geoBoundaries (OpenStreetMap contributors, ODbL).</p>
          <div className="flex flex-col gap-1">{geo.sources.map((s) => <SourceChip key={s.id} name={s.name} date={`${s.latest}; ${s.licence}`} url={s.url} />)}</div>
        </More>
      </Card>
      <NextRow back="/jobs" next="/plan" nextLabel="Next: your plan" />
    </div>
  );
}
