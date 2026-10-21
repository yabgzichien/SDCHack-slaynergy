"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, Chip, H, More, PageTitle, Skeleton, SourceChip } from "@/components/ui";

const rm = (n: number) => `RM${n.toLocaleString("en-MY")}`;
const area = "mt-1 w-full rounded-2xl border border-control bg-raised p-3 text-sm";

// The short AI quiz after the AI courses: spot the mistakes in an AI answer about a task from your field.
// Teaching comes from the existing courses; Runway only adds this check and an optional portfolio piece.
export default function AiQuizPage() {
  const { view, state, act, busy, error } = useApp();
  const [flagged, setFlagged] = useState<string[]>([]);
  const [template, setTemplate] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Record<string, string> | null>(null);
  if (!view || !state) return <Skeleton lines={8} />;
  const card = view.pathway.card;
  if (!card) return <div><PageTitle title="Short AI quiz">Your plan does not have a quiz for this field yet. Quizzes for more fields come in a later version.</PageTitle><Btn href="/plan">Back to your plan</Btn></div>;
  const w = state.pathway;
  const t = template ?? w.template ?? "";
  const aiCourses = (view.plan?.steps ?? []).filter((x) => x.strand === "ai" && x.kind === "course");
  const sh = sheet ?? w.sheet ?? {};
  const quiz = w.quiz;
  const passed = !!quiz?.passed;
  const savedPrompt = !!w.template?.trim();
  const covers = new Set(view.pathway.promptCovers);
  const totals = card.rows.reduce((a, r) => ({ budget: a.budget + r.budget, actual: a.actual + r.actual }), { budget: 0, actual: 0 });
  const csv = "data:text/csv;charset=utf-8," + encodeURIComponent(["Line,Budget (RM),Actual (RM),Note", ...card.rows.map((r) => `${r.line},${r.budget},${r.actual},"${r.note}"`)].join("\n"));
  const toggle = (id: string) => setFlagged((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  return (
    <div>
      <PageTitle title={`Short quiz: ${card.title}`}>You learned to work with AI in the courses. Now check an AI answer about a real task from your field. AI can draft this report in seconds, and it can also get numbers and reasons wrong.</PageTitle>
      <div className="-mt-2 mb-4 flex flex-wrap gap-2">
        <Chip tone="accent">AI at work</Chip>
        <SourceChip name={`O*NET ${card.onet.code}: ${card.onet.occupation}`} date={`checked ${card.onet.checked}`} url={card.onet.url} />
      </div>
      <p className="mb-4 text-sm text-muted">Based on a real task from O*NET: &ldquo;{card.onet.task}&rdquo;</p>
      {error && <p role="alert" className="mb-4 rounded-2xl bg-raised p-3 text-sm text-fall">{error}</p>}

      {aiCourses.length > 0 && (
        <p className="mb-4 text-sm text-muted">From your plan: {aiCourses.map((c, i) => <span key={c.id}>{i ? " and " : ""}<a href={c.url} target="_blank" rel="noreferrer" className="underline decoration-control underline-offset-2 hover:text-ink">{c.title}</a> ({c.provider})</span>)}. Take them first if you have not.</p>
      )}
      <Card>
        <H level={2} sub="The numbers the AI was given.">1. The data</H>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{card.dataTitle}</p>
          <a href={csv} download="variance-practice.csv" className="text-sm underline decoration-control underline-offset-2 hover:text-ink">Download as CSV</a>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="num w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-3 font-normal">Line</th><th className="py-1 pr-3 text-right font-normal">Budget</th><th className="py-1 pr-3 text-right font-normal">Actual</th><th className="py-1 font-normal">Note</th></tr></thead>
            <tbody>
              {card.rows.map((r) => <tr key={r.line} className="border-t border-ink/10"><td className="py-1 pr-3">{r.line}</td><td className="py-1 pr-3 text-right">{rm(r.budget)}</td><td className="py-1 pr-3 text-right">{rm(r.actual)}</td><td className="py-1 text-muted">{r.note}</td></tr>)}
              <tr className="border-t border-ink/20 font-medium"><td className="py-1 pr-3">Total</td><td className="py-1 pr-3 text-right">{rm(totals.budget)}</td><td className="py-1 pr-3 text-right">{rm(totals.actual)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4" tone={passed ? "rise" : undefined}>
        <H level={2} sub={`Tap every sentence you think is wrong. There are ${card.mistakes} mistakes. Check them against the table.`}>2. The quiz</H>
        {(
          <>
            <div className="rounded-2xl border border-dashed border-control bg-raised p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Sample AI answer, written by Runway for practice</p>
              <ol className="space-y-1.5">
                {card.sampleAnswer.map((a) => {
                  const on = flagged.includes(a.id);
                  return (
                    <li key={a.id}>
                      <button type="button" onClick={() => !passed && toggle(a.id)} aria-pressed={on} disabled={passed}
                        className={`press w-full rounded-xl px-3 py-2 text-left text-sm ${a.reveal ? "bg-fall/10 ring-1 ring-fall/40" : on ? "bg-ink/10 ring-1 ring-ink/30" : "hover:bg-surface2"}`}>
                        {a.text}
                        {a.reveal && <span className="mt-1 block text-xs text-fall"><b>{a.reveal.kind}.</b> {a.reveal.why}</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
            {quiz && !passed && (
              <p className="mt-3 text-sm" role="status">You found {quiz.found.length} of {card.mistakes}{quiz.wrong.length ? `, and flagged ${quiz.wrong.length} correct sentence${quiz.wrong.length === 1 ? "" : "s"}` : ""}. Check the table again and try once more.</p>
            )}
            {passed ? (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium" role="status"><Check size={16} aria-hidden /> You found every mistake. This is the skill employers need most: AI drafts, you check.</p>
            ) : (
              <div className="mt-3"><Btn onClick={async () => { const d = await act("quizSubmit", { flagged }); if (d && !d.state.pathway.quiz?.passed) setFlagged(d.state.pathway.quiz?.found ?? []); }} disabled={busy || flagged.length === 0}>Check my answers</Btn></div>
            )}
          </>
        )}
      </Card>

      <Card className="mt-4">
        <H level={2} sub="Optional. Write the prompt you would use for this task every month, and how you check it. It makes a good portfolio piece and interview story.">3. Add to your portfolio (optional)</H>
        {!passed ? <p className="text-sm text-muted">Pass the quiz first.</p> : (
          <>
            <p className="text-sm font-medium">A good prompt</p>
        <ul className="mt-1 space-y-1 text-sm">
          {card.promptGuide.map((g) => (
            <li key={g.id} className="flex items-start gap-2">
              <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${covers.has(g.id) ? "bg-accent text-surface" : "bg-surface2"}`} aria-hidden>{covers.has(g.id) && <Check size={11} strokeWidth={3} />}</span>
              <span>{g.text}{savedPrompt && <span className="sr-only">{covers.has(g.id) ? " (your prompt covers this)" : " (not covered yet)"}</span>}</span>
            </li>
          ))}
        </ul>
            <label className="mt-4 block text-sm font-medium">Reusable prompt
              <textarea value={t} onChange={(e) => setTemplate(e.target.value)} rows={5} maxLength={2000} className={area} placeholder="Act as a budget analyst. Here is last month's budget and actual spending. Only use reasons in the data, and show your sums." />
            </label>
            <p className="mt-4 text-sm font-medium">How I do this task</p>
            <div className="mt-1 grid gap-3 sm:grid-cols-2">
              {card.sheetHeadings.map((h) => (
                <label key={h.id} className="block text-sm">{h.label}
                  <span className="block text-xs text-muted">{h.hint}</span>
                  <textarea value={sh[h.id] ?? ""} onChange={(e) => setSheet({ ...sh, [h.id]: e.target.value })} rows={3} maxLength={2000} className={area} />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Btn onClick={() => act("pathwaySave", { work: { template: t, prompt: t, sheet: sh } })} disabled={busy || !t.trim()}>Save to my portfolio</Btn>
              {savedPrompt && <span className="text-sm text-muted">Saved. Your prompt covers {covers.size} of {card.promptGuide.length} tips (checked by keywords, not by AI).</span>}
            </div>
            <More summary="Going further (optional)">
              <p>Your &ldquo;how I do this task&rdquo; sheet is, in plain words, what AI agents call a skill: instructions an agent can follow again and again. A later version of Runway points you to courses on turning it into a real agent skill, and on checking who made a skill and what it can access before you install one.</p>
            </More>
          </>
        )}
      </Card>
      <div className="mt-6"><Btn href="/plan" variant="ghost">Back to your plan</Btn></div>
    </div>
  );
}
