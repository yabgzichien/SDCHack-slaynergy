"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, Chip, H } from "@/components/ui";
import type { PlanStep } from "@/lib/engine/plan";
import type { View } from "@/lib/engine/view";
import type { SessionState } from "@/lib/engine/state";

// Where each in-app activity lives.
export const activityHref = (s: PlanStep) =>
  s.activity === "task" ? "/plan/task" : s.activity === "resume" ? "/resume" : s.activity === "meeting" ? "/advisor" : null;

// The worker's optional portfolio piece after the AI quiz: the reusable prompt and the "how I do this task" sheet.
// The advisor view can pass a worker's data; the worker's own pages use their session.
export function Portfolio({ counsellor, data }: { counsellor?: boolean; data?: { view: View; state: SessionState } }) {
  const app = useApp();
  const { view, state } = data ?? app;
  const card = view?.pathway.card;
  const w = state?.pathway;
  if (!card || !w || (!w.template && !w.sheet && !w.quiz)) return null;
  return (
    <Card className="mt-4">
      <H sub={`After the AI quiz: ${card.title}`}>{counsellor ? "The worker's portfolio piece" : "Your portfolio piece"}</H>
      <div className="flex flex-wrap gap-1.5">
        {w.quiz && <Chip tone={w.quiz.passed ? "rise" : "neutral"}>{w.quiz.passed ? `Found all ${card.mistakes} AI mistakes` : `Check not passed yet`} · {w.quiz.attempts} {w.quiz.attempts === 1 ? "try" : "tries"}</Chip>}
        {w.template && <Chip>Reusable prompt saved</Chip>}
        {w.sheet && <Chip>How-I-do-it sheet saved</Chip>}
      </div>
      {w.template && (
        <div className="mt-4">
          <p className="text-sm font-medium">Reusable prompt</p>
          <p className="mt-1 whitespace-pre-wrap rounded-2xl bg-raised p-3 text-sm">{w.template}</p>
        </div>
      )}
      {w.sheet && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {card.sheetHeadings.map((h) => (
            <div key={h.id} className="rounded-2xl bg-raised p-3">
              <dt className="text-sm font-medium">{h.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">{w.sheet?.[h.id] || <span className="text-muted">Not written yet</span>}</dd>
            </div>
          ))}
        </dl>
      )}
      {!counsellor && <p className="mt-3 text-sm text-muted">Add this to your resume and talk about it in interviews: it shows you can work with AI and catch its mistakes. <Link href="/plan/task" className="underline decoration-control underline-offset-2 hover:text-ink">Edit</Link></p>}
    </Card>
  );
}

// Progress and skill badges, earned as steps are finished. Locked ones stay visible so the next goal is clear.
export function BadgeShelf() {
  const { view } = useApp();
  const list = view?.pathway.achievements ?? [];
  if (!list.length) return null;
  const earned = list.filter((a) => a.earned).length;
  const mark = { skill: "◆", ai: "✦", people: "●", milestone: "★" } as const;
  return (
    <Card className="mt-4">
      <H sub={`${earned} of ${list.length} earned · self-reported progress; the pathway badge below is the one to share`}>Your skill badges</H>
      <div className="h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={earned} aria-label="Badges earned">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${(earned / list.length) * 100}%` }} />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <li key={a.id} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${a.earned ? "bg-accentsoft" : "bg-raised opacity-60"}`}>
            <span aria-hidden className={`mt-0.5 text-lg ${a.earned ? "text-accent" : "text-muted"}`}>{mark[a.kind]}</span>
            <span className="min-w-0 text-sm"><span className="block font-medium">{a.title}<span className="sr-only">{a.earned ? " (earned)" : " (not earned yet)"}</span></span><span className="block text-xs text-muted">{a.earned ? a.detail : "Not earned yet"}</span></span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Finishing: once every step is done (the advisor meeting included), the worker claims the badge and shares it.
export function BadgePanel() {
  const { view, state, act, busy } = useApp();
  if (!view || !state) return null;
  const c = state.completion;
  const gate = view.pathway.gate;
  const w = state.pathway;
  return (
    <div className="mt-5 border-t border-ink/10 pt-4">
      <p className="text-sm font-medium">Your pathway badge</p>
      {c.status === "confirmed" && c.badgeId ? (
        <>
          <p className="mt-1 text-sm">{c.by ? `You finished the pathway, including a session with ${c.by.name}. Your badge is ready to share.` : "You finished the pathway. Your badge is ready to share."}</p>
          <div className="mt-3"><Btn href={`/badge/${c.badgeId}`}>See and share your badge</Btn></div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">When every step is done, including your meeting with an advisor, you get a badge to add to LinkedIn. It says you completed the pathway; it is not a qualification.</p>
          {!gate.ok && <ul className="mt-2 list-disc pl-5 text-sm text-muted">{gate.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
          <fieldset className="mt-3 space-y-2 text-sm">
            <legend className="sr-only">What the public badge page shows</legend>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!!w.showName} onChange={(e) => act("pathwaySave", { work: { showName: e.target.checked } })} />Show my name on the public badge page</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!!w.publishPortfolio} onChange={(e) => act("pathwaySave", { work: { publishPortfolio: e.target.checked } })} />Show my portfolio piece on it</label>
          </fieldset>
          <div className="mt-3"><Btn onClick={() => act("claimBadge")} disabled={busy || !gate.ok}>Get your badge</Btn></div>
        </>
      )}
    </div>
  );
}
