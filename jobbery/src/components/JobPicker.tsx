"use client";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, UserRound } from "lucide-react";
import { JobIcon } from "@/components/JobIcon";
import { SECTORS, type SectorId } from "@/lib/engine/data";

export type PickKind = "suggested" | "current" | "other" | "later";
type Job = { id: string; title: string; icon?: string };
type OtherJob = Job & { sector: SectorId; later: boolean };

// A compact row of job pills above the map: the suggested jobs, the worker's current job, and "Other jobs", which
// opens a searchable list marked "Not suggested" (or "Not in reach yet", preview only). The map stays the focus.
export function JobPicker({ suggested, current, others, shown, busy, onPick }: {
  suggested: Job[]; current: Job | null; others: OtherJob[]; shown: { kind: PickKind; id: string; title: string };
  busy: boolean; onPick: (kind: PickKind, id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    return SECTORS.map((sec) => ({ ...sec, jobs: others.filter((o) => o.sector === sec.id && (!t || o.title.toLowerCase().includes(t))) })).filter((g) => g.jobs.length);
  }, [others, q]);
  const offList = shown.kind === "other" || shown.kind === "later";
  const pill = (on: boolean) => `press inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-colors ${on ? "border-cue bg-cuesoft font-medium text-cueink" : "border-control bg-raised hover:bg-surface2"}`;

  return (
    <div>
      <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible" role="radiogroup" aria-label="Job shown on the map">
        {suggested.map((j) => {
          const on = shown.kind === "suggested" && shown.id === j.id;
          return (
            <li key={j.id}>
              <button role="radio" aria-checked={on} disabled={busy} onClick={() => onPick("suggested", j.id)} className={pill(on)}>
                {on ? <Check size={15} aria-hidden /> : <JobIcon name={j.icon} size={15} className="text-muted" />}{j.title}
              </button>
            </li>
          );
        })}
        {current && (
          <li>
            <button role="radio" aria-checked={shown.kind === "current"} disabled={busy} onClick={() => onPick("current", current.id)} className={pill(shown.kind === "current")}>
              {shown.kind === "current" ? <Check size={15} aria-hidden /> : <UserRound size={15} aria-hidden className="text-muted" />}<span className="text-muted">Your job:</span>{current.title}
            </button>
          </li>
        )}
        {offList && (
          <li>
            <button role="radio" aria-checked className={pill(true)}><Check size={15} aria-hidden />{shown.title}<span className="text-xs font-normal">· {shown.kind === "later" ? "Not in reach yet" : "Not suggested"}</span></button>
          </li>
        )}
        <li>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">
            Other jobs <ChevronDown size={15} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </li>
      </ul>
      {open && (
        <div className="mt-2 rounded-2xl border border-control bg-raised p-3">
          <p className="mb-2 text-xs text-muted">These are not suggested for you, but you can still look at them.</p>
          <label className="relative block">
            <span className="sr-only">Search other jobs</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs" className="min-h-10 w-full rounded-xl border border-control bg-bg pl-9 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cue" />
          </label>
          <div className="mt-2 max-h-60 space-y-3 overflow-y-auto pr-1">
            {groups.map((g) => (
              <div key={g.id}>
                <p className="px-1 text-xs font-medium text-muted">{g.label}</p>
                <ul className="mt-1 space-y-0.5">
                  {g.jobs.map((o) => {
                    const on = offList && shown.id === o.id;
                    return (
                      <li key={o.id}>
                        <button disabled={busy} onClick={() => { onPick(o.later ? "later" : "other", o.id); setOpen(false); }} className={`flex min-h-9 w-full items-center gap-2 rounded-xl px-2 py-1 text-left text-sm ${on ? "bg-cuesoft font-medium text-cueink" : "hover:bg-surface2"}`}>
                          <JobIcon name={o.icon} size={15} className="shrink-0 text-muted" />
                          <span className="min-w-0 flex-1">{o.title}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${o.later ? "bg-fallsoft text-fall" : "bg-surface2 text-muted"}`}>{o.later ? "Not in reach yet" : "Not suggested"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!groups.length && <p className="px-1 text-sm text-muted">No job matches “{q}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
