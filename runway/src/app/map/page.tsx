"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, Chip, PageTitle, Skeleton, SourceChip } from "@/components/ui";
import { LEGEND_RAMP, colourFor, type MapValue } from "@/lib/map-scale";
import { STATES, compareMove, geo, kindOfWork, stateById, stateJobs, type StateJobs } from "@/lib/engine/geo";
import type { SectorId } from "@/lib/engine/data";

const JobMap = dynamic(() => import("@/components/JobMap"), { ssr: false, loading: () => <div className="h-[420px] rounded-2xl bg-surface2 sm:h-[540px]" aria-busy="true" /> });

type Measure = "jobs" | "unemployment" | "wage";
const rm = (x: number) => `RM ${Math.round(x).toLocaleString()}`;
// figures are in thousands; show whole people, rounded to the nearest hundred
const people = (thousands: number) => (Math.round(thousands * 10) * 100).toLocaleString();
const times = (x: number) => (x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`);
// quantile edges so each colour holds about the same number of states
const quantileBins = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return [0.2, 0.4, 0.6, 0.8, 1].map((q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]); };

// One question: if I moved, where would jobs like mine be?
export default function MapPage() {
  const { view, state, act, busy } = useApp();
  const [roleId, setRoleId] = useState<string | null>(null);
  const [measure, setMeasure] = useState<Measure>("jobs");
  const [move, setMove] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);

  const matches = view?.matches ?? [];
  const role = matches.find((m) => m.roleId === roleId) ?? view?.chosen ?? matches[0] ?? null;
  const sector = (role?.sector ?? "finance") as SectorId;
  const rows = useMemo(() => stateJobs(sector), [sector]);
  const home = state?.profile?.state ?? null;

  if (!view || !state) return <Skeleton lines={6} />;
  if (!state.profile || !role) {
    return <div><PageTitle title="Where are the jobs like yours?">Answer a few questions and choose a job first; the map then shows where jobs like it are in Malaysia.</PageTitle><Btn href={state.profile ? "/jobs" : "/start"}>{state.profile ? "Choose a job" : "Get started"}</Btn></div>;
  }

  const ranked = [...rows].sort((a, b) => b.workers - a.workers);
  const best = ranked.filter((r) => r.id !== home)[0];
  const sel = picked ?? (move ? best.id : home ?? best.id);
  const selRow = rows.find((r) => r.id === sel)!;
  const homeRow = home ? rows.find((r) => r.id === home)! : null;
  const cmp = compareMove(sector, home, sel);

  const metric = (r: StateJobs) => (measure === "jobs" ? r.workers : measure === "unemployment" ? r.uRate : r.medianWage);
  const label = (r: StateJobs) => (measure === "jobs" ? `about ${people(r.workers)} people in this kind of work` : measure === "unemployment" ? `unemployment ${r.uRate.toFixed(1)}%` : `median pay ${rm(r.medianWage)} a month`);
  const values: MapValue[] = rows.map((r) => ({ id: r.id, value: metric(r), label: label(r) }));
  const bins = quantileBins(values.map((v) => v.value));
  const legend = measure === "jobs" ? "People in this kind of work (estimate)" : measure === "unemployment" ? `Unemployment rate, ${STATES[0].lfs.quarter.replace("Q", " Q")}` : `Median monthly pay, ${STATES[0].wages.year}`;
  const fmtBin = (x: number) => (measure === "jobs" ? `${people(x)}` : measure === "unemployment" ? `${x.toFixed(1)}%` : rm(x));

  // other reachable jobs that are unusually common in the selected state
  const alsoHere = matches.filter((m) => m.roleId !== role.roleId).map((m) => ({ m, lq: stateJobs(m.sector as SectorId).find((x) => x.id === sel)!.lq }))
    .filter((x) => x.lq >= 1.15).sort((a, b) => b.lq - a.lq || b.m.score - a.m.score).slice(0, 5);

  const title = !move && homeRow
    ? `About ${people(homeRow.workers)} people in ${homeRow.short} do work like ${role.title.toLowerCase()}.`
    : move && homeRow && best && best.workers > homeRow.workers
    ? `${best.short} has ${times(best.workers / homeRow.workers)} as many jobs like ${role.title.toLowerCase()} as ${homeRow.short}.`
    : `${ranked[0].short} has the most jobs like ${role.title.toLowerCase()}: ${Math.round(ranked[0].share * 100)}% of Malaysia's.`;

  return (
    <div>
      <PageTitle title={title}>
        Jobs like this are mostly in {kindOfWork(sector)}. The map shows where people do that work today, with each state&apos;s unemployment and pay. Tap a state to compare it{homeRow ? ` with ${homeRow.short}` : ""}.
      </PageTitle>

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="text-muted">Job</span>
          <select value={role.roleId} onChange={(e) => { setRoleId(e.target.value); setPicked(null); }}
            className="mt-1 min-h-11 w-full rounded-2xl border border-control bg-raised px-3">
            {matches.slice(0, 15).map((m) => <option key={m.roleId} value={m.roleId}>{m.title}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted">Your state</span>
          <select value={home ?? ""} disabled={busy} onChange={(e) => { act("homeState", { state: e.target.value || null }); setPicked(null); }}
            className="mt-1 min-h-11 w-full rounded-2xl border border-control bg-raised px-3">
            <option value="">Not given</option>
            {STATES.map((s) => <option key={s.id} value={s.id}>{s.short}</option>)}
          </select>
        </label>
        <div className="text-sm">
          <span className="text-muted">Would you move for work?</span>
          <div role="radiogroup" aria-label="Would you move for work?" className="mt-1 grid grid-cols-2 gap-1 rounded-full bg-surface2 p-1">
            {([[true, "Yes, show all states"], [false, "No, my state only"]] as const).map(([v, l]) => (
              <button key={String(v)} role="radio" aria-checked={move === v} onClick={() => { setMove(v); setPicked(null); }} disabled={!v && !home}
                className={`press min-h-9 rounded-full px-2 text-xs sm:text-sm ${move === v ? "bg-raised font-medium" : "text-muted"} disabled:opacity-40`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <Card tone="raised" className="min-w-0 p-3 sm:p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
            <div role="tablist" aria-label="What the colours show" className="grid w-full grid-cols-3 gap-1 rounded-full bg-surface2 p-1 sm:inline-grid sm:w-auto">
              {([["jobs", "Jobs like this"], ["unemployment", "Unemployment"], ["wage", "Pay"]] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={measure === k} onClick={() => setMeasure(k)} className={`press min-h-9 rounded-full px-3 text-xs sm:text-sm ${measure === k ? "bg-raised font-medium" : "text-muted"}`}>{l}</button>
              ))}
            </div>
          </div>
          <JobMap values={values} bins={bins} selected={sel} home={home} dimOthers={!move} onSelect={(id) => setPicked(id)}
            ariaLabel={`Map of Malaysia's states shaded by ${legend.toLowerCase()}. The table below has the same figures.`} />
          <div className="mt-3 px-1 pb-1">
            <p className="text-xs text-muted">{legend}{measure === "unemployment" ? " (darker is higher)" : " (darker is more)"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {LEGEND_RAMP.map((c, i) => (
                <span key={c} className="num inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded" style={{ background: c }} />{i === 0 ? "up to " : ""}{fmtBin(bins[i])}</span>
              ))}
              {home && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded border-2 border-dashed border-ink/60" />your state</span>}
            </div>
          </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-medium">{selRow.name}</h2>
              {sel === home && <Chip>Your state</Chip>}
            </div>
            <dl className="num mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">People in this kind of work</dt><dd>≈ {people(selRow.workers)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Share of Malaysia&apos;s</dt><dd>{Math.round(selRow.share * 100)}%</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">How common here</dt><dd>{selRow.lq >= 1 ? `${times(selRow.lq)} the national rate` : `${Math.round(selRow.lq * 100)}% of the national rate`}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Unemployment</dt><dd>{selRow.uRate.toFixed(1)}% <span className="text-muted">({stateById[sel].lfs.uRateYearAgo.toFixed(1)}% a year before)</span></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Median monthly pay</dt><dd>{rm(selRow.medianWage)}</dd></div>
            </dl>
            {cmp.from && sel !== home && (
              <div className="mt-4 rounded-2xl bg-raised p-3 text-sm">
                <p className="font-medium">Compared with {cmp.from.short}</p>
                <ul className="mt-1 space-y-1">
                  <li>{cmp.times! >= 1 ? `${times(cmp.times!)} as many jobs like this` : `${Math.round(cmp.times! * 100)}% as many jobs like this`}</li>
                  <li>Median pay {cmp.wageGap! >= 0 ? `${rm(cmp.wageGap!)} higher` : `${rm(-cmp.wageGap!)} lower`} a month</li>
                  <li>Unemployment {Math.abs(cmp.uGap!) < 0.05 ? "about the same" : cmp.uGap! < 0 ? `${(-cmp.uGap!).toFixed(1)} points lower` : `${cmp.uGap!.toFixed(1)} points higher`}</li>
                </ul>
                <p className="mt-2 text-xs text-muted">Higher pay often comes with higher rent. Runway does not compare living costs.</p>
              </div>
            )}
            {!home && <p className="mt-4 text-sm text-muted">Tell us your state above to compare it with others.</p>}
          </Card>
          <Card>
            <h2 className="text-base font-semibold">Your other jobs that are common here</h2>
            {alsoHere.length ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {alsoHere.map(({ m, lq }) => (
                  <li key={m.roleId}>
                    <button onClick={() => { setRoleId(m.roleId); }} className="press flex w-full items-center justify-between gap-2 rounded-2xl bg-raised px-3 py-2 text-left hover:bg-surface2">
                      <span>{m.title}</span><span className="num shrink-0 text-muted">{times(lq)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-muted">None of your reachable jobs is more common here than across Malaysia.</p>}
            <p className="mt-2 text-xs text-muted">The number is how common that kind of work is here against the national rate.</p>
          </Card>
        </div>

      <Card className="mt-4">
        <h2 className="text-base font-semibold">Every state for {role.title.toLowerCase()}</h2>
        <div className="scroll-x mt-3">
          <table className="w-full text-sm">
            <caption className="sr-only">States ranked by the estimated number of people in this kind of work</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 pr-2 font-normal">State</th>
                <th className="py-2 pr-2 text-right font-normal">People in this work</th>
                <th className="hidden py-2 pr-2 text-right font-normal sm:table-cell">Share</th>
                <th className="py-2 pr-2 text-right font-normal">Unemployment</th>
                <th className="py-2 text-right font-normal">Median pay</th>
              </tr>
            </thead>
            <tbody>
              {(move ? ranked : ranked.filter((r) => r.id === home)).map((r) => (
                <tr key={r.id} onClick={() => setPicked(r.id)} className={`cursor-pointer border-t border-line hover:bg-surface2 ${r.id === sel ? "bg-accentsoft" : ""}`}>
                  <td className="py-2.5 pr-2">
                    <button onClick={() => setPicked(r.id)} className="inline-flex items-center gap-2 text-left">
                      <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: colourFor(metric(r), bins) }} aria-hidden />
                      {r.short}{r.id === home ? <span className="text-xs text-muted">(you)</span> : null}
                    </button>
                  </td>
                  <td className="num py-2.5 pr-2 text-right">≈ {people(r.workers)}</td>
                  <td className="num hidden py-2.5 pr-2 text-right sm:table-cell">{Math.round(r.share * 100)}%</td>
                  <td className="num py-2.5 pr-2 text-right">{r.uRate.toFixed(1)}%</td>
                  <td className="num py-2.5 text-right">{rm(r.medianWage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!move && <p className="mt-3 text-sm text-muted">Showing your state only. Choose “Yes, show all states” to compare.</p>}
      </Card>

      <Card className="mt-4">
        <h2 className="text-base font-semibold">How to read this</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Malaysia publishes no open data on job ads by state and occupation. So &quot;people in this kind of work&quot; counts workers in the industries this job belongs to ({kindOfWork(sector)}), from DOSM&apos;s {geo.industryYear} figures by state, scaled to each state&apos;s employment in {STATES[0].lfs.quarter.replace("Q", " Q")}. It is an estimate of where the work is, not a count of vacancies.</li>
          <li>Moving is a big decision: rent, family and travel matter as much as pay. Runway does not advise on where to live; talk it through with your counsellor.</li>
        </ul>
        <div className="mt-3 flex flex-col gap-1">{geo.sources.map((s) => <SourceChip key={s.id} name={s.name} date={`${s.latest}; ${s.licence}`} url={s.url} />)}</div>
      </Card>
      <p className="mt-6 text-sm"><Link href="/jobs" className="underline decoration-control underline-offset-2 hover:text-ink">Back to jobs</Link></p>
    </div>
  );
}
