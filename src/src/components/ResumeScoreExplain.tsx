"use client";
import { useRef } from "react";
import { X } from "lucide-react";
import type { ResumeSummary } from "@/lib/engine/resume";

// How the resume score is worked out (engine/resume.ts, analyseResume). Formulas are MathML, which browsers render natively.
const M = ({ children }: { children: React.ReactNode }) => (
  <div data-no-translate className="my-2 overflow-x-auto rounded-xl bg-raised px-3 py-2 text-[1.05rem]">
    <math display="block">{children}</math>
  </div>
);
const n = (x: string | number) => <mn>{x}</mn>;
const v = (x: string) => <mi>{x}</mi>;
const o = (x: string) => <mo>{x}</mo>;
const t = (x: string) => <mtext>{x}</mtext>;
const frac = (a: React.ReactNode, b: React.ReactNode) => <mfrac><mrow>{a}</mrow><mrow>{b}</mrow></mfrac>;
const min1 = (inner: React.ReactNode) => <>{v("min")}<mrow>{o("(")}{n(1)}{o(",")}{inner}{o(")")}</mrow></>;

const PARTS: { key: string; label: string; of: number; formula: React.ReactNode; text: string }[] = [
  { key: "structure", label: "Clear sections", of: 15,
    formula: <mrow>{v("S")}{o("=")}{n(6)}{v("e")}{o("+")}{n(3)}{v("d")}{o("+")}{n(3)}{v("k")}{o("+")}{n(3)}{v("u")}</mrow>,
    text: "e, d, k and u are 1 if the resume has a Work experience, Education, Skills or Summary section, otherwise 0." },
  { key: "contact", label: "Contact details", of: 8,
    formula: <mrow>{v("C")}{o("=")}{n(4)}{v("m")}{o("+")}{n(4)}{v("p")}</mrow>,
    text: "m is 1 if an email address is found, p is 1 if a phone number is found." },
  { key: "impact", label: "Results with numbers", of: 22,
    formula: <mrow>{v("I")}{o("=")}{n(22)}{o("×")}{min1(frac(<>{v("q")}{o("/")}{v("b")}</>, n("0.5")))}</mrow>,
    text: "b is the number of bullet points and q the number that contain a number (an amount, a count, a percentage). Half the bullets with numbers earns full marks." },
  { key: "verbs", label: "Strong action words", of: 15,
    formula: <mrow>{v("V")}{o("=")}{v("max")}<mrow>{o("(")}{n(0)}{o(",")}{n(15)}{o("×")}{min1(frac(<>{v("a")}{o("/")}{v("b")}</>, n("0.6")))}{o("−")}{n("1.5")}{v("w")}{o(")")}</mrow></mrow>,
    text: "a is the number of bullets that start with an action word (Processed, Reduced, Trained…), w the number that start with a weak phrase such as \"responsible for\". 60% strong bullets earns full marks." },
  { key: "concise", label: "Length and clarity", of: 10,
    formula: <mrow>{v("L")}{o("=")}{v("ℓ")}{o("+")}{n(4)}{o("×")}{frac(v("s"), v("b"))}</mrow>,
    text: "ℓ is 6 for 250 to 700 words, 3 for 150 to 900 words, otherwise 0. s is the number of bullets under 28 words." },
  { key: "skills", label: "Skills a recruiter can find", of: 12,
    formula: <mrow>{v("K")}{o("=")}{n(8)}{o("×")}{min1(frac(v("n"), n(6)))}{o("+")}{n(4)}{v("k")}</mrow>,
    text: "n is the number of skills from Jobbery's list of 80 found in the text (6 or more earns full marks); k is 1 if there is a Skills section." },
  { key: "future", label: "Ready for AI-era jobs", of: 18,
    formula: <mrow>{v("F")}{o("=")}{n(18)}{o("×")}<mrow>{o("(")}{n("0.6")}{o("×")}{min1(frac(<>{v("r")}{o("/")}{v("n")}</>, n("0.4")))}{o("+")}{n("0.4")}{v("g")}{o(")")}</mrow></mrow>,
    text: "r is the number of found skills expected to last (AI is unlikely to take them over soon), so 40% lasting skills earns full marks on that half; g is 1 if the resume shows work with AI tools." },
];

const LINK = "mt-1 block text-sm underline decoration-control underline-offset-2 hover:text-ink";

// What to compare a resume score with. The bands are the ones analyseResume uses (engine/resume.ts).
export function ResumeBaseline({ className = "" }: { className?: string }) {
  return <p className={`text-sm text-muted ${className}`}>Aim for 75 out of 100 or more. We count 55 as good and 75 as strong. These marks are our own rules, not a hiring standard.</p>;
}

// className restyles the button that opens the explainer; by default it is a small link.
export function ResumeScoreExplain({ resume, className = LINK }: { resume: Pick<ResumeSummary, "score" | "parts">; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const got = (key: string) => resume.parts?.find((p) => p.key === key)?.got;
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()}
        className={className}>
        Learn how it&apos;s scored
      </button>
      <dialog ref={ref} aria-labelledby="resume-score-title" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto rounded-[22px] bg-surface p-5 text-ink backdrop:bg-black/40 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="resume-score-title" className="text-xl font-bold">How your resume score is worked out</h2>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised"><X size={18} aria-hidden /></button>
        </div>
        <p className="mt-2 text-sm text-muted">The score comes from fixed rules applied to your resume&apos;s text, not from an AI model. Seven parts each earn points, and the score is their total, rounded:</p>
        <M><mrow>{t("Score")}{o("=")}{v("round")}<mrow>{o("(")}{v("S")}{o("+")}{v("C")}{o("+")}{v("I")}{o("+")}{v("V")}{o("+")}{v("L")}{o("+")}{v("K")}{o("+")}{v("F")}{o(")")}</mrow></mrow></M>
        <p className="text-sm text-muted">The parts can add up to at most 15 + 8 + 22 + 15 + 10 + 12 + 18 = 100. Your score: {resume.score} out of 100 (75 or more is strong, 55 or more is good).</p>
        <ol className="mt-4 space-y-4">
          {PARTS.map((p) => {
            const g = got(p.key);
            return (
              <li key={p.key} className="rounded-2xl bg-raised/60 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{p.label}</h3>
                  <span className="num text-sm text-muted">{g !== undefined ? `You: ${g} of ${p.of} points` : `Up to ${p.of} points`}</span>
                </div>
                <M>{p.formula}</M>
                <p className="text-sm">{p.text}</p>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-sm text-muted">Personal details such as ID numbers, age or religion never earn or lose points. Jobbery only flags them so you can remove them. The resume text itself isn&apos;t stored, only these points.</p>
      </dialog>
    </>
  );
}
