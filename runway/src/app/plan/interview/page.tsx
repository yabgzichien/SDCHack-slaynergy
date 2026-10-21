"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, Chip, H, PageTitle, Skeleton, SourceChip } from "@/components/ui";

const area = "mt-1 w-full rounded-2xl border border-control bg-raised p-3 text-sm";
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// The people strand: your story, prepared answers, and rehearsal. Done when saved, checked by your counsellor.
export default function InterviewPage() {
  const { view, state, act, busy, error } = useApp();
  const [story, setStory] = useState<Record<string, string> | null>(null);
  const [star, setStar] = useState<Record<string, Record<string, string>> | null>(null);
  if (!view || !state) return <Skeleton lines={8} />;
  if (!view.plan) return <div><PageTitle title="Interview practice">Choose a job first.</PageTitle><Btn href="/jobs">Choose a job</Btn></div>;
  const iv = view.pathway.interview;
  const w = state.pathway;
  const done = view.pathway.done;
  const st = story ?? w.story ?? {};
  const sr = star ?? w.star ?? {};
  const storyWords = iv.story.fields.reduce((n, f) => n + words(st[f.id] ?? ""), 0);
  const reh = new Set(w.rehearsal ?? []);

  return (
    <div>
      <PageTitle title="Get ready for interviews">Confidence comes from having true stories ready and saying them out loud. Your counsellor reads what you write here.</PageTitle>
      <div className="-mt-2 mb-4 flex flex-wrap gap-2"><Chip>People skills</Chip></div>
      {error && <p role="alert" className="mb-4 rounded-2xl bg-raised p-3 text-sm text-fall">{error}</p>}

      <Card>
        <div id="story" className="scroll-mt-24" />
        <div className="flex items-start justify-between gap-2"><H level={2} sub="The hardest question after a layoff is often “Why did you leave?”. Answer it in three short parts.">Your story in 60 seconds</H><Done on={done.story} /></div>
        <div className="grid gap-3">
          {iv.story.fields.map((f) => (
            <label key={f.id} className="block text-sm font-medium">{f.label}
              <span className="block font-normal text-muted">{f.hint} Example: &ldquo;{f.example}&rdquo;</span>
              <textarea value={st[f.id] ?? ""} onChange={(e) => setStory({ ...st, [f.id]: e.target.value })} rows={2} maxLength={2000} className={area} />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Btn onClick={() => act("pathwaySave", { work: { story: st } })} disabled={busy}>Save my story</Btn>
          <span className={`num text-sm ${storyWords > iv.story.maxWords ? "text-fall" : "text-muted"}`}>{storyWords} of about {iv.story.maxWords} words (about 60 seconds)</span>
        </div>
      </Card>

      <Card className="mt-4">
        <div id="star" className="scroll-mt-24" />
        <div className="flex items-start justify-between gap-2"><H level={2} sub="STAR: Situation, Task, Action, Result. Keep each part short and true.">Three prepared answers</H><Done on={done.star} /></div>
        <div className="mb-3"><SourceChip name={iv.star.source.name} date={`checked ${iv.star.source.checked}`} url={iv.star.source.url} /></div>
        <div className="space-y-5">
          {iv.star.questions.map((q) => (
            <fieldset key={q.id} className="rounded-2xl bg-raised p-4">
              <legend className="sr-only">{q.text}</legend>
              <p className="text-sm font-medium">{q.text}</p>
              {q.hint && <p className="text-xs text-muted">{q.hint}</p>}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {iv.star.parts.map((pt) => (
                  <label key={pt.id} className="block text-sm">{pt.label}
                    <span className="block text-xs text-muted">{pt.hint}</span>
                    <textarea value={sr[q.id]?.[pt.id] ?? ""} onChange={(e) => setStar({ ...sr, [q.id]: { ...(sr[q.id] ?? {}), [pt.id]: e.target.value } })} rows={2} maxLength={2000} className="mt-1 w-full rounded-2xl border border-control bg-surface p-3 text-sm" />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-3"><Btn onClick={() => act("pathwaySave", { work: { star: sr } })} disabled={busy}>Save my answers</Btn></div>
      </Card>

      <Card className="mt-4">
        <div id="rehearse" className="scroll-mt-24" />
        <div className="flex items-start justify-between gap-2"><H level={2} sub="Record yourself on your phone answering one question and explaining your portfolio piece. Nothing is uploaded to Runway. Then tick what went well.">Rehearse out loud</H><Done on={done.rehearse} /></div>
        <ul className="space-y-1.5">
          {iv.rehearsal.map((r) => (
            <li key={r.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-raised px-4 py-2 text-sm">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--accent)]" checked={reh.has(r.id)} disabled={busy}
                  onChange={(e) => act("pathwaySave", { work: { rehearsal: e.target.checked ? [...reh, r.id] : [...reh].filter((x) => x !== r.id) } })} />
                {r.text}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Want more practice? <a href={iv.practiceTool.url} target="_blank" rel="noreferrer" className="underline decoration-control underline-offset-2 hover:text-ink">{iv.practiceTool.name}</a> by {iv.practiceTool.provider} ({iv.practiceTool.cost}) lets you answer practice questions out loud. Then book a mock interview with your counsellor: a person gives the final feedback.
        </p>
      </Card>
      <div className="mt-6"><Btn href="/plan" variant="ghost">Back to your plan</Btn></div>
    </div>
  );
}

const Done = ({ on }: { on?: boolean }) => (on ? <Chip tone="rise"><Check size={12} className="mr-1 inline" aria-hidden />Done</Chip> : null);
