"use client";
import type { ReactNode } from "react";
import { Check, CircleCheck, Heart, ShieldCheck } from "lucide-react";
import { SECTORS } from "@/lib/engine/data";
import type { RoleMatchView } from "@/lib/engine/view";

export function whyFits(m: Pick<RoleMatchView, "overlap" | "outlook" | "demand" | "weeks" | "atRisk">) {
  const a = m.overlap >= 0.6 ? "You already have most of the skills" : m.overlap >= 0.35 ? "You have a good part of the skills" : "You would learn most of the skills";
  const b = m.outlook >= 0.75 ? "AI is unlikely to take them over" : m.atRisk ? "but AI may take some of them over soon" : "and they should stay useful for years";
  const c = m.demand.trend > 0.03 ? "its job ads are growing" : m.demand.trend < -0.03 ? "its job ads are shrinking" : "its job ads are steady";
  return `${a}, ${b}, and ${c}. About ${m.weeks} weeks to get ready.`;
}

export function Score({ value, label = "match score" }: { value: number; label?: string }) {
  return (
    <div className="text-right">
      <p className="num text-[2rem] leading-none">{Math.round(value * 100)}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

// Why this job, in three reasons read top to bottom (left to right on wide screens): what you care about, what you
// already know, and why AI is unlikely to take it over. Each reason leads with the dark words; the detail is muted.
export function WhyThisJob({ m, speed }: { m: RoleMatchView; speed: string }) {
  const w = m.why;
  const field = SECTORS.find((s) => s.id === m.sector)?.label;
  const toAdd = [...m.gaps].sort((a, b) => b.importance - a.importance).slice(0, 2);
  return (
    <div className="mt-5 grid gap-px overflow-hidden rounded-2xl bg-line lg:grid-cols-[1fr_1fr_1.5fr]">
      <Reason icon={<Heart size={16} aria-hidden />} label="Fits what you care about">
        {w.likes.length > 0 ? (
          <>
            <ul className="space-y-0.5">{w.likes.map((l) => <li key={l} className="font-medium">{l}</li>)}</ul>
            <p className="mt-1 text-sm text-muted">{w.likes.length > 1 ? "You picked these when you started." : "You picked this when you started."}</p>
          </>
        ) : !w.inField && <p className="text-sm text-muted">Not one of the interests you picked. It is here for your skills and its future.</p>}
        {w.inField && field && <p className={w.likes.length ? "mt-2 text-sm" : "font-medium"}>In your field: {field}</p>}
      </Reason>

      <Reason icon={<CircleCheck size={16} aria-hidden />} label="Builds on what you know">
        {w.have.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Skills you already have">
            {w.have.map((s) => <li key={s.skillId} className="inline-flex items-center gap-1 rounded-full bg-risesoft px-2.5 py-1 text-xs font-medium text-rise"><Check size={12} aria-hidden />{s.name}</li>)}
          </ul>
        ) : <p className="text-sm text-muted">You would learn its skills from the start.</p>}
        {toAdd.length > 0 ? (
          <div className="mt-3 text-sm">
            <p className="text-muted">To add</p>
            <ul className="mt-1 space-y-0.5">{toAdd.map((g) => <li key={g.skillId} className="font-medium">{g.name}</li>)}</ul>
          </div>
        ) : <p className="mt-3 text-sm text-muted">You have every skill it asks for.</p>}
        <p className="mt-2 text-sm text-muted">About {m.weeks} weeks to get ready.</p>
      </Reason>

      <Reason icon={<ShieldCheck size={16} aria-hidden />} label="Hard for AI to take over">
        <p className="font-medium">{w.humanEdge.text}</p>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full bg-fall" aria-hidden />AI will handle</p>
            {w.aiDoes.length > 0
              ? <ul className="mt-1 space-y-0.5">{w.aiDoes.slice(0, 3).map((s) => <li key={s.skillId} className="flex justify-between gap-3"><span>{s.name}</span><span className="num shrink-0 whitespace-nowrap text-muted">by {s.byFuture[speed]}</span></li>)}</ul>
              : <p className="mt-1">None of its skills before 2040.</p>}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full bg-rise" aria-hidden />Stays yours</p>
            {w.staysYours.length > 0
              ? <ul className="mt-1 space-y-0.5">{w.staysYours.map((s) => <li key={s.skillId} className="font-medium">{s.name}</li>)}</ul>
              : <p className="mt-1 font-medium">The human side described above.</p>}
          </div>
        </div>
        <a href={w.humanEdge.source} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-muted underline decoration-control underline-offset-2 hover:text-ink">Source: O*NET {m.onet}</a>
      </Reason>
    </div>
  );
}

function Reason({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <section className="bg-raised p-4 sm:p-5">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-accentink"><span className="grid size-7 place-items-center rounded-full bg-accentsoft">{icon}</span>{label}</h3>
      {children}
    </section>
  );
}


// The three reasons in brief, as chips: an interest it matches (or your field), how many of its skills you have, and
// the human core of the job. The full reasons are on the job page.
export function BriefWhy({ m, stack = false }: { m: RoleMatchView; stack?: boolean }) {
  const w = m.why;
  const total = m.have.length + m.gaps.length;
  const like = w.likes[0] ?? (w.inField ? "In your field" : null);
  const chip = "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
  return (
    <ul className={`flex gap-1.5 ${stack ? "flex-col items-start" : "flex-wrap"}`} aria-label="Why this job, in brief">
      {like && <li className={`${chip} bg-surface2 text-ink`}><Heart size={13} aria-hidden className="shrink-0 text-accentink" /><span className="truncate">{like}</span></li>}
      <li className={`${chip} bg-risesoft text-rise`}><Check size={13} aria-hidden className="shrink-0" />{m.have.length > 0 ? <span>You have {m.have.length} of {total} skills</span> : <span>New skills to learn</span>}</li>
      <li className={`${chip} bg-cuesoft text-cueink`}><ShieldCheck size={13} aria-hidden className="shrink-0" /><span className="truncate">{w.humanEdge.tag}</span></li>
    </ul>
  );
}
