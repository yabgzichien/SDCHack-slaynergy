"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { BriefcaseBusiness, Coins, MapPin, Users } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { JobPicker, type PickKind } from "@/components/JobPicker";
import { useSelectJob } from "@/components/useSelectJob";
import { STAY_ID } from "@/lib/engine/state";
import { currentJob, suggestedJobs } from "@/lib/suggested";
import { MalaysiaMap, MapLegend } from "@/components/MalaysiaMap";
import { Btn, Card, Chip, More, NextRow, PageTitle, Select, Skeleton, SourceChip } from "@/components/ui";
import { colourFor, type Measure } from "@/lib/map-scale";
import { leftText, mapFigures, metricOf, people, rm, rmAbout, times } from "@/lib/map-figures";
import { SPENDING, STATES, compareMove, geo, kindOfWork, occupationOf } from "@/lib/engine/geo";
import { roleById, type GroupKey, type SectorId } from "@/lib/engine/data";

const MEASURES: { id: Measure; label: string; icon: typeof Users }[] = [
  { id: "jobs", label: "Jobs", icon: Users },
  { id: "wage", label: "Pay", icon: Coins },
  { id: "unemployment", label: "Unemployment", icon: BriefcaseBusiness },
];

// One question: if I moved, where would jobs like mine be?
export default function MapPage() {
  const { view, state, act, busy } = useApp();
  const selectJob = useSelectJob();
  // A job not in reach yet can only be previewed; every other pick is the saved selection (state.chosenRoleId).
  const [preview, setPreview] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState<Measure>("jobs");
  const [picked, setPicked] = useState<string | null>(null);

  const matches = view?.matches ?? [];
  const unreachable = view?.unreachable ?? [];
  const suggested = view ? suggestedJobs(view) : [];
  const current = currentJob(state?.profile?.status === "studying" ? undefined : state?.profile?.occupationId);
  const chosenId = state?.chosenRoleId ?? null;
  const later = preview ? unreachable.find((m) => m.roleId === preview) ?? null : null;
  // What the map shows: a previewed out-of-reach job, else the selection, else the best suggested job.
  const shown: { kind: PickKind; id: string; title: string; sector: SectorId; group?: GroupKey } | null =
    later ? { kind: "later", id: later.roleId, title: later.title, sector: later.sector, group: roleById[later.roleId]?.group }
    : chosenId === STAY_ID && current ? { kind: "current", ...current }
    : (() => {
      const m = (chosenId && matches.find((x) => x.roleId === chosenId)) || suggested[0];
      return m ? { kind: suggested.some((x) => x.roleId === m.roleId) ? "suggested" as const : "other" as const, id: m.roleId, title: m.title, sector: m.sector, group: roleById[m.roleId]?.group } : null;
    })();
  const role = shown;
  const locked = later;
  const sector = (shown?.sector ?? "finance") as SectorId;
  const group = shown?.group;
  const pick = async (kind: PickKind, id: string, scroll = false) => {
    if (kind === "later") setPreview(id);
    else { setPreview(null); if (!(await selectJob(kind === "current" ? STAY_ID : id, null))) return; }
    setPicked(null); setFlash((n) => n + 1);
    if (scroll) pickerRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  const fig = mapFigures(sector, measure, group);
  const home = state?.profile?.state ?? null;

  if (!view || !state) return <Skeleton lines={6} />;
  if (!state.profile || !role) {
    return <div><PageTitle title="Where in Malaysia are the jobs?">Answer a few questions and choose a job first; the map then shows where jobs like it are.</PageTitle><Btn href={state.profile ? "/jobs" : "/start"}>{state.profile ? "Choose a job" : "Get started"}</Btn></div>;
  }

  const rows = fig.rows;
  const ranked = [...rows].sort((a, b) => b.workers - a.workers);
  const best = ranked.filter((r) => r.id !== home)[0];
  const sel = picked ?? best.id;
  const selRow = rows.find((r) => r.id === sel)!;
  const homeRow = home ? rows.find((r) => r.id === home)! : null;
  const cmp = compareMove(sector, home, sel, group);
  // Keep the catalogue's sentence case so acronyms such as CAD, QA/QC and IT remain correct.
  const job = role.title;
  const kindLabel = { suggested: "Suggested", current: "Your current job", other: "Not suggested", later: "Preview only" }[role.kind];


  const title = homeRow && best.workers > homeRow.workers
    ? `${best.short} has ${times(best.workers / homeRow.workers)} as many jobs like ${job} as ${homeRow.short}.`
    : `${ranked[0].short} has the most jobs like ${job}: ${Math.round(ranked[0].share * 100)}% of Malaysia's.`;

  return (
    <div>
      <PageTitle compact wide title={title} titleStyle={{ fontSize: "clamp(1.5rem, 3.2vw, 1.75rem)", textWrap: "wrap" }}>Tap a state to compare it with {homeRow ? homeRow.short : "your state"}.</PageTitle>

      <Card tone="raised" className="min-w-0 p-3 sm:p-5">
        <div ref={pickerRef} className="scroll-mt-24 border-b border-line pb-3">
          <JobPicker
            suggested={suggested.map((m) => ({ id: m.roleId, title: m.title, icon: m.why.icon }))}
            current={current}
            others={[...matches.filter((m) => !suggested.some((x) => x.roleId === m.roleId)).map((m) => ({ id: m.roleId, title: m.title, icon: m.why.icon, sector: m.sector, later: false })),
              ...unreachable.map((m) => ({ id: m.roleId, title: m.title, icon: roleById[m.roleId]?.icon, sector: m.sector, later: true }))]}
            shown={{ kind: role.kind, id: role.id, title: role.title }} busy={busy} onPick={(k, id) => pick(k, id)} />
          <p key={`${role.id}-${flash}`} role="status" className={`mt-2 rounded-xl px-2 py-1 text-xs text-muted ${flash ? "cue-flash" : ""}`}>
            <span className="font-medium text-cueink">Showing {role.title}</span><span aria-hidden> · </span><span>{kindLabel}</span>
            {role.kind !== "later" && <><span aria-hidden> · </span><span>Selected</span></>}<span aria-hidden className={locked ? "" : "hidden sm:inline"}> · </span>
            <span className={locked ? "block sm:inline" : "hidden sm:inline"}>{locked ? (locked.reason === "time" ? `Not in reach yet: it needs ${locked.need.replace("≈ ", "about ")} of training, more than the time you have.` : `Not in reach yet: ${locked.need.charAt(0).toLowerCase()}${locked.need.slice(1)}.`) : group ? `Shows ${occupationOf(group).toLowerCase()} in ${kindOfWork(sector)}.` : `Shows people in ${kindOfWork(sector)}.`}</span>
            {locked && <span> Your selection has not changed.</span>}
          </p>
        </div>
        <div className="mb-4 mt-3 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="What the colours show" className={`grid grid-cols-3 gap-1 rounded-full p-1 sm:inline-grid ${measure === "wage" ? "bg-[#dbeafe]" : "bg-surface2"}`}>
          {MEASURES.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={measure === id} onClick={() => setMeasure(id)}
              className={`press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-1.5 text-xs sm:px-3 sm:text-sm ${measure === id ? id === "wage" ? "bg-[#f8fbff] font-medium text-[#174b7a] shadow-[0_1px_3px_rgb(30_64_175/0.16)]" : "bg-raised font-medium shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted"}`}>
              <Icon size={15} aria-hidden className="hidden sm:block" />{label}
            </button>
          ))}
        </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-muted"><MapPin size={15} aria-hidden />You live in</span>
              <Select small label="You live in" value={home ?? ""} disabled={busy} onChange={(v) => { act("homeState", { state: v || null }); setPicked(null); }}>
                <option value="">Choose your state</option>
                {STATES.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
              </Select>
            </label>
          </div>
        </div>
        <MalaysiaMap values={fig.values} bins={fig.bins} ramp={fig.ramp} selected={sel} home={home} dimOthers={false} onSelect={setPicked}
          ariaLabel={`Map of Malaysia's states shaded by ${fig.legend.toLowerCase()}. The table further down has the same figures.`} />
        <div className="mt-4"><MapLegend title={fig.legend} bins={fig.bins} ramp={fig.ramp} fmt={fig.fmt} home={!!home} /></div>
      </Card>

      <div className="mt-4">
        <Card>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-medium">{selRow.name}</h2>
            {sel === home && <Chip>Your state</Chip>}
          </div>
          <dl className="num mt-3 grid grid-cols-3 gap-2">
            {[["Jobs like this", `≈ ${people(selRow.workers)}`], ["Median pay", rm(selRow.medianWage)], ["Unemployment", `${selRow.uRate.toFixed(1)}%`]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-raised p-3"><dt className="text-xs text-muted">{k}</dt><dd className="mt-1 text-base sm:text-lg">{v}</dd></div>
            ))}
          </dl>
          {selRow.leftAfter !== null && selRow.spending !== null ? (
            <div className="mt-2 rounded-2xl bg-raised p-3">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="text-xs text-muted">Left after typical spending (estimate)</p>
                  <p className="num mt-1 text-base font-medium sm:text-lg">{leftText(selRow.leftAfter)}</p>
                </div>
                <p className="num text-xs text-muted">{`${rm(selRow.medianWage)} median pay − ${rm(selRow.spending)} spending per person`}</p>
              </div>
              <p className="mt-2 border-t border-line pt-2 text-xs text-muted">{`Spending per person includes children, so one adult living alone usually spends more. Pay: ${STATES[0].wages.year}, all jobs. Spending: ${SPENDING!.year}.`}</p>
            </div>
          ) : <p className="mt-2 rounded-2xl bg-raised p-3 text-sm text-muted">Living costs are not included yet.</p>}
          {cmp.from && sel !== home ? (
            <div className="mt-4 text-sm">
              <p className="font-medium">If you moved here from {cmp.from.short}</p>
              <ul className="mt-1.5 space-y-1">
                <li>{cmp.times! >= 1 ? `${times(cmp.times!)} as many jobs like this` : `${Math.round(cmp.times! * 100)}% as many jobs like this`}</li>
                <li>Pay {cmp.wageGap! >= 0 ? `${rm(cmp.wageGap!)} higher` : `${rm(-cmp.wageGap!)} lower`} a month</li>
                {cmp.leftGap !== null && <li>{Math.abs(cmp.leftGap) < 10 ? "About the same left a month after typical spending" : `About ${rmAbout(Math.abs(cmp.leftGap))} ${cmp.leftGap > 0 ? "more" : "less"} left a month after typical spending`}</li>}
                <li>Unemployment {Math.abs(cmp.uGap!) < 0.05 ? "about the same" : cmp.uGap! < 0 ? `${(-cmp.uGap!).toFixed(1)} points lower` : `${cmp.uGap!.toFixed(1)} points higher`}</li>
              </ul>
              <p className="mt-2 text-xs text-muted">Higher pay often comes with higher rent. Talk a move through with an <Link href="/advisor" className="underline decoration-control underline-offset-2 hover:text-ink">advisor</Link>; Jobbery does not advise on where to live.</p>
            </div>
          ) : !home ? <p className="mt-4 text-sm text-muted">Choose your state above to compare it with others.</p> : null}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-2 text-base font-semibold">All 16 states</h2>
          <div className="scroll-x">
            <table className="w-full text-sm text-ink">
              <caption className="sr-only">States ranked by the estimated number of people in this kind of work</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="sticky left-0 z-10 bg-surface py-2 pr-2 font-normal">State</th>
                  <th className="py-2 pr-2 text-right font-normal">Jobs like this</th>
                  <th className="py-2 pr-2 text-right font-normal">Unemployment</th>
                  <th className="py-2 pr-2 text-right font-normal">Median pay</th>
                  <th className="py-2 text-right font-normal">Spending per person</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.id} className={`border-t border-line ${r.id === sel ? "bg-accentsoft" : ""}`}>
                    <td className={`sticky left-0 z-10 py-2 pr-2 ${r.id === sel ? "bg-accentsoft" : "bg-surface"}`}>
                      <button onClick={() => setPicked(r.id)} className="inline-flex min-h-9 items-center gap-2 text-left">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: colourFor(metricOf(r, measure), fig.bins, fig.ramp) }} aria-hidden />
                        {r.short}{r.id === home ? <span className="text-xs text-muted">(you)</span> : null}
                      </button>
                    </td>
                    <td className="num whitespace-nowrap py-2 pr-2 text-right">≈ {people(r.workers)}</td>
                    <td className="num whitespace-nowrap py-2 pr-2 text-right">{r.uRate.toFixed(1)}%</td>
                    <td className="num whitespace-nowrap py-2 pr-2 text-right">{rm(r.medianWage)}</td>
                    <td className="num whitespace-nowrap py-2 text-right">{r.spending === null ? "–" : rm(r.spending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        <More summary="Where these figures come from">
          <p>Malaysia publishes no state figures for single jobs. So &quot;jobs like this&quot; is an estimate: the people working in the industries this job belongs to ({kindOfWork(sector)}){group ? <>, times the share of each state&apos;s workers who are {occupationOf(group).toLowerCase()}</> : null}. Both come from DOSM&apos;s Labour Force Survey {geo.industryYear} tables by state, scaled to each state&apos;s employment in {STATES[0].lfs.quarter.replace("Q", " Q")}. It shows where the work is, not a count of open vacancies.</p>
          <p>Sabah, Sarawak and Labuan are drawn closer to the peninsula than they really are, so every state fits at a readable size. State boundaries: geoBoundaries (OpenStreetMap contributors, ODbL).</p>
          {SPENDING ? <p>{`"Spending per person" is DOSM's median monthly household spending per person in ${SPENDING.year}: what a household spends on goods and services, shared across everyone in it, children included. It comes from DOSM's own spreadsheet, not OpenDOSM, so it does not update by itself; it stays at the ${SPENDING.year} edition until the next survey is added. "Left after typical spending" is median pay for all jobs in the state minus that figure. It is a rough guide, not a budget for this job.`}</p> : <p>Living costs are not included yet.</p>}
          <div className="flex flex-col gap-1">{[...geo.sources, ...(SPENDING ? [SPENDING.source] : [])].map((s) => <SourceChip key={s.id} name={s.name} date={`${s.latest}; ${s.licence}`} url={s.url} />)}</div>
        </More>
      </Card>
      <NextRow back="/jobs" next="/plan" nextLabel="Next: your plan" />
    </div>
  );
}
