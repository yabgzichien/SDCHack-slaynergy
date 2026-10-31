"use client";
import { ResumeBaseline, ResumeScoreExplain } from "@/components/ResumeScoreExplain";
import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { Check, Pencil } from "lucide-react";
import { useApp, type Catalog } from "@/components/AppProvider";
import { StepBar } from "@/components/Journey";
import { useT } from "@/components/I18nProvider";
import { Btn } from "@/components/ui";
import { HAS_FIELD, STEPS, STEP_ICON, STEP_LABEL, type Step } from "./steps";

// A fact with no label sits under a heading that already says what it is.
type Fact = { label?: string; value: ReactNode; wide?: boolean };
type Block = { step: Step; title: string; facts: Fact[] };


function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <>{empty}</>;
  return <ul className="flex flex-wrap gap-1.5">{items.map((x) => <li key={x} className="rounded-full bg-raised px-3 py-1.5 text-sm">{x}</li>)}</ul>;
}

// Step 1 once it has been answered: every answer in one place, each with its own Edit.
// Nothing here is changed until the person edits a question and saves it.
export function AnswersSummary({ cat, saved, onEdit, onStartOver, onContinue }: {
  cat: Catalog; saved: boolean; onEdit: (step: Step) => void; onStartOver: () => void; onContinue: () => void;
}) {
  const { state } = useApp();
  const { t } = useT();
  const title = useRef<HTMLHeadingElement>(null);
  // Tell screen readers the view changed, as the questions do.
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  const p = state?.profile;
  if (!p) return null;

  const studying = p.status === "studying";
  const occ = cat.occupations.find((o) => o.id === p.occupationId);
  const sector = (id: string | null | undefined) => (id ? cat.sectors.find((s) => s.id === id)?.label ?? (id === "other" ? "Something else" : id) : "");
  const resume = state?.resume;
  // Plain English with the number in it: the page translator matches these against the "{#n} months" style rows.
  const count = (k: number, unit: string) => `${k} ${unit}${k === 1 ? "" : "s"}`;
  const none = "None picked";

  const blocks: Block[] = [
    { step: "name", title: STEP_LABEL.name, facts: [
      { label: "Name", value: p.name && p.name !== "You" ? p.name : "Not given" },
      { label: "Doing now", value: studying ? "Studying" : "Working, or looking for work" },
    ] },
    { step: "resume", title: STEP_LABEL.resume, facts: [
      { label: "Resume score", value: resume ? <>{`${resume.score} out of 100`}<ResumeBaseline className="mt-0.5" /><ResumeScoreExplain resume={resume} /></> : "Not scanned" },
    ] },
    { step: "job", title: studying ? "Job or internship" : STEP_LABEL.job, facts: [
      { label: "Job", value: occ ? <>{occ.title}<span className="block text-sm text-muted">{sector(occ.sector)}</span></> : studying ? "None yet" : "Not picked yet" },
      ...(occ ? [{ label: "Years of work, all jobs", value: count(p.years, "year") }] : []),
    ] },
    { step: "education", title: STEP_LABEL.education, facts: [
      { label: studying ? "Studying for" : "Highest level", value: cat.education.find((e) => e.id === p.education)?.label ?? p.education },
      ...(HAS_FIELD.includes(p.education) && p.study ? [{ label: "Field of study", value: sector(p.study) }] : []),
    ] },
    { step: "skills", title: STEP_LABEL.skills, facts: [
      { wide: true, value: <Chips items={p.skills.map((id) => cat.skills.find((s) => s.id === id)?.name ?? id)} empty={none} /> },
    ] },
    { step: "time", title: STEP_LABEL.time, facts: [
      { label: studying ? "Months until you graduate" : "Months to find a new job", value: count(p.months, "month") },
      { label: "Hours a week to learn", value: count(p.hoursPerWeek, "hour") },
    ] },
    { step: "interests", title: STEP_LABEL.interests, facts: [
      { wide: true, value: <Chips items={p.interests.map((id) => cat.interests.find((x) => x.id === id)?.label ?? id)} empty={none} /> },
    ] },
  ];

  return (
    <>
      <StepBar inline />
      <div className="mx-auto max-w-2xl">
        <section aria-labelledby="answers-title">
          <div className="flex items-center justify-between gap-4">
            <h1 id="answers-title" ref={title} tabIndex={-1} className="greeting text-[1.75rem] outline-none sm:text-[2.6rem]">About you</h1>
            <Image src="/cockatiel-thinking.png" alt="" width={88} height={88} className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20" />
          </div>
          <p className="mt-3 text-base text-muted">Tap Edit on anything to change it.</p>

          {saved && (
            <p role="status" className="mt-5 flex items-center gap-2.5 rounded-2xl bg-accentsoft px-4 py-3 text-sm">
              <Check size={16} strokeWidth={2.6} aria-hidden className="shrink-0" />Saved. Your skills and jobs now use these answers.
            </p>
          )}

          <div className="mt-8 space-y-2.5">
            {blocks.map((b) => {
              const Icon = STEP_ICON[b.step];
              const id = `answers-${b.step}`;
              return (
                <section key={b.step} aria-labelledby={id} className="rounded-[22px] bg-surface px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 id={id} className="flex items-center gap-2.5 text-base font-medium"><Icon size={18} strokeWidth={1.8} aria-hidden className="shrink-0 text-muted" />{b.title}</h2>
                    <button type="button" onClick={() => onEdit(b.step)} aria-label={t("Edit {x}", { x: t(b.title) })}
                      className="press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-raised px-4 text-sm font-medium hover:bg-surface2">
                      <Pencil size={14} strokeWidth={2} aria-hidden />Edit
                    </button>
                  </div>
                  <dl className="mt-1 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {b.facts.map((f) => (
                      <div key={f.label ?? b.step} className={f.wide ? "sm:col-span-2" : undefined}>
                        {f.label && <dt className="text-sm text-muted">{f.label}</dt>}
                        <dd className={`text-base ${f.label ? "mt-0.5" : ""}`}>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            {p.synthetic ? <span /> : <Btn variant="quiet" onClick={onStartOver}>Answer the questions again</Btn>}
            <Btn onClick={onContinue} className="min-h-12 px-6 text-base">Show my results</Btn>
          </div>
        </section>
      </div>
    </>
  );
}

export const stepIndex = (s: Step) => STEPS.indexOf(s);
