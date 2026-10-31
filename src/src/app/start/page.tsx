"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Award, BookOpen, BriefcaseBusiness, Calculator, CalendarClock, Clock, FlaskConical, GraduationCap, Hammer, HeartPulse,
  Laptop, Leaf, Library, LoaderCircle, Microscope, Presentation, Scale, ScrollText, SkipForward, Sparkles, Users, Wrench, type LucideIcon,
} from "lucide-react";
import { useApp, type Catalog } from "@/components/AppProvider";
import { StepBar } from "@/components/Journey";
import type { Profile } from "@/lib/engine/state";
import { AnswersSummary } from "./summary";
import { HAS_FIELD, STEPS, STEP_ICON, STEP_LABEL, type Step } from "./steps";
import { readStored, removeStored } from "@/lib/legacy";
import { Btn, PageTitle, Skeleton } from "@/components/ui";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import { ResumeGraphic } from "@/components/ResumeGraphic";
import type { ResumeSource } from "@/components/ResumeOriginal";
import { ResumeReport, type AiStatus } from "@/components/ResumeReport";
import type { ResumeAnalysis } from "@/lib/engine/resume";
import type { AiRead } from "@/lib/server/ai-resume";
import { type Reach } from "@/lib/engine/geo";
import { occupationById, personas } from "@/lib/engine/data";

// Onboarding: eight short screens. After the name, the resume comes first because it fills in most of the rest.
// Nothing is saved until the last screen; the draft lives in this tab only.
// Once there is a profile, this page opens on a summary of its answers instead. Each answer has an Edit that opens its
// question (every question reachable), and nothing changes until the edits are saved.
type Draft = {
  name: string; status: "" | "working" | "studying"; age: string; state: string; move: Reach | ""; moveTo: string[]; occupationId: string; education: string; study: string; years: number; skills: string[];
  months: number; hours: number; interests: string[];
  resume: null | { score: number; band: string; occupation: string | null; found: number; fixes: string[]; sample?: boolean; aiSkills?: string[] };
  touched: { education?: boolean; study?: boolean; skills?: boolean };
};
const KEY = "jobbery-onboarding-v4";

const EDU_ICON: Record<string, LucideIcon> = { spm: BookOpen, skm: Wrench, stpm: Library, diploma: ScrollText, degree: GraduationCap, master: Award, phd: Microscope };
const EDU_SUB: Record<string, string> = {
  spm: "Sijil Pelajaran Malaysia", skm: "Sijil Kemahiran Malaysia, levels 1 to 3", stpm: "Or A-Levels, Asasi", diploma: "Including advanced diplomas",
  degree: "Bachelor's or professional degree", master: "Including MBA", phd: "Doctorate",
};
const INTEREST_ICON: Record<string, LucideIcon> = {
  numbers: Calculator, people: Users, technology: Laptop, sustainability: Leaf, health: HeartPulse, justice: Scale, teaching: Presentation, building: Hammer, science: FlaskConical,
};

const blank = (cat: Catalog): Draft => ({
  name: "", status: "", age: "", state: "", move: "", moveTo: [], occupationId: "", education: cat.education.find((e) => e.id === "diploma")?.id ?? cat.education[0]?.id ?? "", study: "", years: 0, skills: [], months: 6, hours: 10, interests: [], resume: null, touched: {},
});

// The demo resume (and the ?sample=1 link) arrives here with every answer filled in from the made-up worker Hafiz, to check and change.
const wantsSample = () => { try { return new URLSearchParams(window.location.search).get("sample") === "1"; } catch { return false; } };
const sampleDraft = (cat: Catalog): Draft | null => {
  const p = personas.find((x) => x.id === "hafiz");
  const o = p && occupationById[p.occupation];
  if (!p || !o) return null;
  return { ...blank(cat), name: p.name, status: "working", age: String(p.age), state: p.state ?? "", move: p.state ? "region" : "", occupationId: o.id, education: p.education, study: o.sector, years: p.years, skills: o.skills, months: p.months, hours: p.hoursPerWeek, interests: p.interests, touched: { education: true, study: true, skills: true } };
};

// What a resume scan fills in on the draft: last job, education, years and every skill it found.
const applyScan = (x: Draft, a: ResumeAnalysis, cat: Catalog, aiSkills: string[], sample: boolean): Draft => {
  const occ = a.occupation && cat.occupations.find((o) => o.id === a.occupation!.id);
  return {
    ...x,
    occupationId: occ ? occ.id : x.occupationId,
    education: a.education ?? (occ ? occ.education : x.education),
    years: a.years !== null ? Math.round(a.years) : x.years,
    skills: [...new Set([...a.skills.map((s) => s.id), ...aiSkills, ...(occ ? occ.skills : [])])],
    resume: { score: a.score, band: a.band, occupation: occ ? occ.title : null, found: a.skills.length, fixes: a.findings.filter((f) => f.severity === "fix").slice(0, 2).map((f) => f.title), sample, aiSkills },
    touched: { ...x.touched, education: a.education ? true : x.touched.education },
  };
};

// The saved profile as a draft, to change one answer and save the lot again. Sessions saved before the relocation question
// have a state but no answer, which means anywhere in Malaysia (see Profile.move).
const draftFromProfile = (cat: Catalog, p: Profile): Draft => ({
  ...blank(cat), name: p.name === "You" ? "" : p.name, status: p.status ?? "working", moveTo: p.moveTo ?? [], age: p.age ? String(p.age) : "", state: p.state ?? "", move: p.move ?? (p.state ? "anywhere" : ""),
  occupationId: p.occupationId, education: p.education, study: p.study ?? "", years: p.years, skills: p.skills, months: p.months, hours: p.hoursPerWeek, interests: p.interests,
  touched: { education: true, study: !!p.study, skills: true },
});

export default function StartPage() {
  const { catalog, state } = useApp();
  if (!catalog || !state) return <Skeleton lines={3} />;
  return <Start cat={catalog} />;
}

// Which screen of step 1 is showing: the summary of saved answers, one of them open for editing, or the questions from the start.
type View = { kind: "summary"; saved?: boolean } | { kind: "edit"; at: number } | { kind: "new" };

function Start({ cat }: { cat: Catalog }) {
  const { state } = useApp();
  const router = useRouter();
  // The sample link always starts the questions again with Hafiz's answers filled in, whatever was saved.
  const [view, setView] = useState<View>(() => (!wantsSample() && state?.profile ? { kind: "summary" } : { kind: "new" }));
  const toSummary = (saved?: boolean) => { setView({ kind: "summary", saved }); window.scrollTo({ top: 0 }); };
  if (view.kind === "summary" && state?.profile) {
    return <AnswersSummary cat={cat} saved={!!view.saved}
      onEdit={(s) => { setView({ kind: "edit", at: STEPS.indexOf(s) }); window.scrollTo({ top: 0 }); }}
      // The saved answers stay until the new ones are finished; Cancel comes back here.
      onStartOver={() => { try { removeStored(sessionStorage, KEY); } catch { /* ignore */ } setView({ kind: "new" }); window.scrollTo({ top: 0 }); }}
      onContinue={() => router.push("/skills")} />;
  }
  return <Wizard key={view.kind === "edit" ? `edit-${view.at}` : "new"} cat={cat} edit={view.kind === "edit"} at={view.kind === "edit" ? view.at : 0} onExit={toSummary} />;
}

function Wizard({ cat, edit, at, onExit }: { cat: Catalog; edit: boolean; at: number; onExit: (saved?: boolean) => void }) {
  const { act, busy, error, state } = useApp();
  const router = useRouter();
  // The wizard mounts only in the browser (after the catalog loads), so the saved draft can be read synchronously.
  const [sample] = useState(() => wantsSample());
  const prof = state?.profile ?? null;
  // A half-finished draft of the questions from the start. Editing saved answers never uses one.
  const [saved] = useState<{ d: Draft; i: number } | null>(() => {
    if (sample || edit) return null;
    try {
      const raw = readStored(sessionStorage, KEY);
      const r = raw ? (JSON.parse(raw) as { d: Draft; i: number; sample?: boolean }) : null;
      return r && !r.sample ? r : null;
    } catch { return null; }
  });
  const first = edit ? Math.min(at, STEPS.length - 1) : Math.min(saved?.i ?? 0, STEPS.length - 1);
  const [i, setI] = useState(first);
  // Editing: every question is open, so the bar jumps to any of them.
  const [seen, setSeen] = useState(edit ? STEPS.length - 1 : first);
  const [d, setD] = useState<Draft>(() => {
    if (edit && prof) return draftFromProfile(cat, prof);
    if (sample) { const s = sampleDraft(cat); if (s) return s; }
    if (saved) return { ...blank(cat), ...saved.d };
    return blank(cat);
  });
  useEffect(() => { if (edit) return; try { sessionStorage.setItem(KEY, JSON.stringify({ d, i, sample })); } catch { /* ignore */ } }, [d, i, sample, edit]);

  // The full report holds resume lines, so it stays in memory: never in the draft, which is kept in sessionStorage.
  const [report, setReport] = useState<Report | null>(null);
  const reportFile = report?.preview?.fileUrl;
  useEffect(() => () => { if (reportFile) URL.revokeObjectURL(reportFile); }, [reportFile]);

  const step: Step = STEPS[i];
  const LAST = STEPS[STEPS.length - 1];
  const occ = cat.occupations.find((o) => o.id === d.occupationId);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const pickJob = (id: string) => {
    const o = cat.occupations.find((x) => x.id === id)!;
    setD((x) => ({ ...x, occupationId: id, education: x.touched.education ? x.education : o.education, study: x.touched.study ? x.study : o.sector, skills: x.touched.skills ? x.skills : [...new Set([...o.skills, ...(x.resume ? x.skills : [])])] }));
  };
  const studying = d.status === "studying";
  // A student with no job yet: suggest the skills that jobs in their field of study most often list.
  const fieldSkills = useMemo(() => {
    const n = new Map<string, number>();
    for (const o of cat.occupations) if (o.sector === (d.study || "business")) for (const k of o.skills) n.set(k, (n.get(k) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
  }, [cat, d.study]);
  const hasField = HAS_FIELD.includes(d.education);
  const study = hasField ? d.study || occ?.sector || "" : null;
  const ready = (studying || !!occ) && d.skills.length > 0;
  const canGo: Record<Step, boolean> = { name: !!d.status, resume: true, job: studying || !!occ, education: !!d.education && (!hasField || !!study), skills: d.skills.length > 0, time: true, interests: ready };
  const go = (n: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, n));
    setI(k);
    setSeen((x) => Math.max(x, k));
    window.scrollTo({ top: 0 });
  };
  const next = () => { if (canGo[step]) go(i + 1); };
  // Saving edits needs every question to still have a valid answer.
  const canSave = STEPS.every((x) => canGo[x]);
  // `dd` is the answers to save: the draft on screen, or the demo answers when the demo skip jumps past the questions.
  const finish = async (dd: Draft = d, demo = false) => {
    const o = cat.occupations.find((x) => x.id === dd.occupationId);
    const field = HAS_FIELD.includes(dd.education) ? dd.study || o?.sector || "" : null;
    const r = await act("setProfile", { profile: { name: dd.name.trim() || "You", age: dd.age ? Number(dd.age) : null, status: dd.status || "working", state: dd.state || null, move: dd.state && dd.move ? dd.move : null, moveTo: dd.move === "pick" ? dd.moveTo : [], occupationId: o ? dd.occupationId : "", education: dd.education, study: field, years: o ? dd.years : 0, skills: dd.skills, interests: dd.interests, months: dd.months, hoursPerWeek: dd.hours, budget: "free", synthetic: edit ? !!prof?.synthetic : demo || sample || !!dd.resume?.sample, ...(edit && prof?.personaId ? { personaId: prof.personaId } : {}) } });
    if (!r) return;
    if (edit) { onExit(true); return; }
    try { removeStored(sessionStorage, KEY); sessionStorage.setItem("jobbery-results-arrival", "1"); } catch { /* ignore */ }
    router.push("/skills");
  };

  // Demo skip: Hafiz's answers plus a scan of the demo resume (no AI read, so it is quick and the same every time),
  // saved at once, then straight to the skill analysis.
  const [skipping, setSkipping] = useState(false);
  const demoSkip = async () => {
    const base = sampleDraft(cat);
    if (!base || busy || skipping) return;
    setSkipping(true);
    try {
      let dd = base;
      try {
        const r = await fetch("/api/resume", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: SAMPLE_RESUME, ai: false }) });
        if (r.ok) dd = applyScan(base, (await r.json()).analysis as ResumeAnalysis, cat, [], true);
      } catch { /* Hafiz's own answers are enough to carry on */ }
      await finish(dd, true);
    } finally { setSkipping(false); }
  };

  // Enter continues from anywhere on the question, not only from inside a text field.
  const enter = useRef<() => void>(() => {});
  useEffect(() => { enter.current = () => { if (edit) { if (canSave && !busy) finish(); } else if (step === LAST) { if (canGo[step] && !busy) finish(); } else if (step !== "resume") next(); }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && !e.isComposing && (t === document.body || t.tagName === "H1")) { e.preventDefault(); enter.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    <StepBar inline sub={{
      labels: STEPS.map((x) => STEP_LABEL[x]),
      icons: STEPS.map((x) => STEP_ICON[x]),
      index: i,
      state: (k) => (k === i ? "current" : k < i || k <= seen ? "done" : "upcoming"),
      reachable: (k) => k <= seen && STEPS.slice(0, k).every((x) => canGo[x]),
      onPick: go,
    }} />
    <div className={`mx-auto ${step === "resume" && report ? "max-w-5xl" : "max-w-2xl"}`}>
      <form onSubmit={(e) => { e.preventDefault(); if (edit) { if (canSave && !busy) finish(); } else if (step === LAST) finish(); else next(); }}>
        {step === "name" && (
          <Q title="First, a little about you" help="Your name is optional. We use it to greet you and on your plan, never to choose or rank jobs.">
            <label className="block">
              <span className="mb-2 block text-sm text-muted">First name</span>
              <TextInput value={d.name} onChange={(v) => set({ name: v })} placeholder="For example, Aina" maxLength={40} label="First name" autoComplete="given-name" />
            </label>
            <div className="mt-8">
              <h2 className="text-lg font-medium">What are you doing now?</h2>
              <Options value={d.status} cols={2} onPick={(v) => {
                const st = v as Draft["status"];
                set(st === "studying"
                  ? { status: st, education: HAS_FIELD.includes(d.education) ? d.education : "degree", months: Math.max(d.months, 6) }
                  : { status: st, months: Math.min(d.months, 6) });
              }}
                options={[
                  { id: "working", label: "Working, or looking for work", sub: "Including if you lost your job", icon: BriefcaseBusiness },
                  { id: "studying", label: "Studying", sub: "Diploma, degree, master's, PhD or postdoc", icon: GraduationCap },
                ]} />
            </div>
            {!edit && (
              <div className="mt-8">
                <button type="button" onClick={demoSkip} disabled={busy || skipping} aria-busy={skipping}
                  className="press flex min-h-16 w-full items-center gap-3 rounded-2xl bg-[#f8c982] px-5 text-left text-[#203b2b] shadow-[0_2px_8px_rgb(201_116_26/0.25)] ring-2 ring-cue hover:bg-[#f5bb62] disabled:opacity-50">
                  {skipping ? <LoaderCircle size={20} className="shrink-0 animate-spin" aria-hidden /> : <SkipForward size={20} aria-hidden className="shrink-0" />}
                  <span><span className="block text-base font-semibold">{skipping ? "Loading the demo…" : "Demo skip"}</span><span className="block text-sm">Skip the name, questions and resume. Go straight to the skill analysis, using our demo resume.</span></span>
                </button>
                {error && <p role="alert" className="mt-3 text-sm text-negative">{error}</p>}
              </div>
            )}
          </Q>
        )}
        {step === "resume" && <ResumeStep d={d} setD={setD} cat={cat} report={report} setReport={setReport} onDone={() => go(i + 1)} autoSample={sample} />}
        {step === "job" && (
          <Q title={studying ? "Any part-time job or internship?" : "What was your last job?"}
            help={d.resume?.occupation ? "We read this from your resume. Change it if it is wrong." : studying ? "Pick the closest one, or choose none. It tells us which skills you probably have." : "Pick the closest one. It tells us which skills you probably have."}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4" aria-live="polite">
              <div className="min-w-0">
                <p className="text-sm text-muted">{studying ? "Your job or internship" : "Your last job"}</p>
                <p className="text-xl font-medium">{occ ? occ.title : studying ? "None yet" : "Not picked yet"}</p>
                {occ && <p className="text-sm text-muted">{cat.sectors.find((x) => x.id === occ.sector)?.label}</p>}
              </div>
              {occ && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm text-muted">Years of work, all jobs</span>
                  <Stepper compact value={d.years} min={0} max={40} onChange={(v) => set({ years: v })} unit={d.years === 1 ? "year" : "years"} />
                </div>
              )}
            </div>
            {studying && (
              <button type="button" aria-pressed={!occ} onClick={() => setD((x) => ({ ...x, occupationId: "", years: 0, skills: x.touched.skills ? x.skills : [] }))}
                className={`press mb-3 flex min-h-12 w-full items-center rounded-2xl px-4 text-left ${!occ ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>No job or internship yet</button>
            )}
            <JobPicker cat={cat} value={d.occupationId} onPick={pickJob} />
          </Q>
        )}
        {step === "education" && (
          <Q title={studying ? "What are you studying for?" : "What is your highest qualification?"} help={studying ? "We plan as if you will have it when you graduate. We only use this to check entry requirements." : undefined}>
            <Options value={d.education} onPick={(v) => set({ education: v, touched: { ...d.touched, education: true } })} cols={2}
              options={cat.education.filter((e) => !studying || HAS_FIELD.includes(e.id)).map((e) => ({ id: e.id, label: e.label, sub: studying && e.id === "phd" ? "Doctorate, or a postdoc" : EDU_SUB[e.id], icon: EDU_ICON[e.id] }))} />
            {hasField && (
              <div className="mt-8">
                <h2 className="text-lg font-medium">What did you study?</h2>
                <p className="mb-3 mt-1 text-sm text-muted">{occ && !d.touched.study && !studying ? `We guessed from your last job as ${occ.title.toLowerCase()}. ` : ""}Engineering, science, health and accounting jobs need a degree in that field.</p>
                <Options value={study ?? ""} onPick={(v) => set({ study: v, touched: { ...d.touched, study: true } })} cols={2}
                  options={[...cat.sectors.map((x) => ({ id: x.id, label: x.label })), { id: "other", label: "Something else" }]} />
              </div>
            )}
            <p className="mt-4 text-sm text-muted">Done a bootcamp or a professional certificate such as ACCA? Add its skills on the next screen.</p>
          </Q>
        )}
        {step === "skills" && (
          <Q title="Which of these skills do you have?" help={occ
            ? `Filled in from ${d.resume ? "your resume and " : ""}your ${studying ? "job" : "last job"} as ${occ.title.toLowerCase()}. Untick any you do not have.`
            : "These are common in jobs in your field of study. Tick the ones you have from your course, projects or work."}>
            {!!d.resume?.aiSkills?.length && <p className="mb-3 text-sm text-muted">The AI reader also suggested some skills from your resume. They are ticked too; untick any that are not true.</p>}
            <SkillPicker cat={cat} value={d.skills} suggested={[...(occ?.skills ?? fieldSkills), ...(d.resume?.aiSkills ?? [])]} onChange={(v) => set({ skills: v, touched: { ...d.touched, skills: true } })} />
          </Q>
        )}
        {step === "time" && (
          <Q title="How much time do you have?" help={studying ? "Jobbery only suggests jobs you can get ready for by the time you graduate." : "Jobbery only suggests jobs you can get ready for in this time."}>
            {studying ? (
              <Group icon={CalendarClock} label="Months until you graduate" note="Pick the closest. More than 18 months away? Choose that and come back later.">
                <Options value={String(d.months)} onPick={(v) => set({ months: Number(v) })} cols={3}
                  options={[3, 6, 9, 12, 18, 24].map((m) => ({ id: String(m), label: m === 24 ? "More than 18 months" : `${m} months` }))} />
              </Group>
            ) : (
              <Group icon={CalendarClock} label="Months to find a new job" note="Job-seeker support usually lasts 3 to 6 months.">
                <Options value={String(d.months)} onPick={(v) => set({ months: Number(v) })} cols={3}
                  options={[1, 2, 3, 4, 5, 6].map((m) => ({ id: String(m), label: `${m} ${m === 1 ? "month" : "months"}` }))} />
              </Group>
            )}
            <Group icon={Clock} label="Hours per week you’d like to spend learning a new skill" note="A plan you can keep beats a plan that looks fast.">
              <Options value={String(d.hours)} onPick={(v) => set({ hours: Number(v) })} cols={3}
                options={[5, 8, 10, 15, 20, 30].map((h) => ({ id: String(h), label: `${h} hours` }))} />
            </Group>
          </Q>
        )}
        {step === "interests" && (
          <Q title="What kind of work do you enjoy?" help="Pick up to three, or skip. They nudge the order a little and never hide a job.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cat.interests.map((x) => {
                const on = d.interests.includes(x.id);
                const Icon = INTEREST_ICON[x.id] ?? Sparkles;
                return (
                  <button type="button" key={x.id} aria-pressed={on} onClick={() => set({ interests: on ? d.interests.filter((y) => y !== x.id) : d.interests.length < 3 ? [...d.interests, x.id] : d.interests })}
                    className={`press flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl p-4 text-left text-sm ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
                    <Icon size={22} strokeWidth={1.7} aria-hidden />
                    <span>{x.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-muted">{d.interests.length} of 3 picked</p>
            {error && <p role="alert" className="mt-3 text-sm text-negative">{error}</p>}
          </Q>
        )}

        <div className="mt-10">
          {edit && (
            <div className="mb-4 space-y-1 text-sm text-muted">
              <p>Nothing changes until you save. Use the bar above to jump to another question.</p>
              {state?.chosenRoleId && <p>Saving clears the job you chose and the plan steps you ticked, because they were based on your old answers.</p>}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            {edit || (prof && i === 0) ? <Btn variant="quiet" onClick={() => onExit()}>Cancel</Btn>
              : i > 0 ? <Btn variant="quiet" onClick={() => go(i - 1)}>Back</Btn> : <Link href="/" className="text-sm underline decoration-control underline-offset-2">Cancel</Link>}
            <div className="flex items-center gap-2">
              {edit
                ? <Btn type="submit" disabled={busy || !canSave} className="min-h-12 px-6 text-base">Save changes</Btn>
                : step === LAST
                  ? <Btn type="submit" disabled={busy || !canGo[step]} className="min-h-12 px-6 text-base">Show my results</Btn>
                  : step !== "resume" && <Btn type="submit" disabled={!canGo[step]} className="min-h-12 px-6 text-base">Continue</Btn>}
            </div>
          </div>
        </div>
      </form>
    </div>
    </>
  );
}

function Group({ icon: Icon, label, note, children }: { icon: LucideIcon; label: string; note: string; children: ReactNode }) {
  return (
    <fieldset className="mb-8 last:mb-0">
      <legend className="mb-3 flex items-center gap-2 text-base font-medium"><Icon size={18} strokeWidth={1.8} aria-hidden />{label}</legend>
      {children}
      <p className="mt-2 text-sm text-muted">{note}</p>
    </fieldset>
  );
}

function Q({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLElement>(null);
  // Move focus to the new question for screen readers, unless its own field already took it (autoFocus).
  useEffect(() => { if (!box.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true }); }, [title]);
  return (
    <section ref={box}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 pt-1">
          <h1 ref={ref} tabIndex={-1} className="greeting text-[1.75rem] outline-none sm:text-[2.6rem]">{title}</h1>
          {help && <p className="mt-1 text-base text-muted">{help}</p>}
        </div>
        <Image src="/cockatiel-thinking.png" alt="" width={88} height={88} className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20" />
      </div>
      <div className="about-you-information-frame mt-6">{children}</div>
    </section>
  );
}

function TextInput({ value, onChange, placeholder, label, maxLength, inputMode, autoComplete }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; maxLength?: number; inputMode?: "numeric" | "text"; autoComplete?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} maxLength={maxLength} inputMode={inputMode} autoComplete={autoComplete} autoFocus
      className="min-h-14 w-full rounded-2xl border border-control bg-raised px-4 text-xl placeholder:text-muted/70" />
  );
}

function Options({ value, onPick, options, cols = 1 }: { value: string; onPick: (v: string) => void; options: { id: string; label: string; sub?: string; icon?: LucideIcon }[]; cols?: 1 | 2 | 3 }) {
  return (
    <div role="radiogroup" className={`grid gap-2 ${cols === 3 ? "grid-cols-2 sm:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : ""}`}>
      {options.map((o) => {
        const on = value === o.id;
        const Icon = o.icon;
        return (
          <button type="button" role="radio" aria-checked={on} key={o.id} onClick={() => onPick(o.id)}
            className={`press flex min-h-14 items-center gap-4 rounded-2xl px-5 py-3 text-left text-base ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
            {Icon && <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-primaryink/15" : "bg-raised"}`}><Icon size={20} strokeWidth={1.7} aria-hidden /></span>}
            <span className="min-w-0 flex-1">{o.label}{o.sub && <span className="block text-sm opacity-70">{o.sub}</span>}</span>
            {on && <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ value, min, max, onChange, unit, compact }: { value: number; min: number; max: number; onChange: (v: number) => void; unit: string; compact?: boolean }) {
  const b = compact
    ? "press flex h-10 w-10 items-center justify-center rounded-full bg-raised text-xl hover:bg-surface2 disabled:opacity-40"
    : "press flex h-14 w-14 items-center justify-center rounded-full bg-surface text-2xl hover:bg-surface2 disabled:opacity-40";
  return (
    <div className={`flex items-center ${compact ? "gap-3" : "gap-5"}`}>
      <button type="button" className={b} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="One year less">−</button>
      <p className={`num text-center ${compact ? "min-w-20" : "min-w-28"}`} aria-live="polite"><span className={compact ? "text-2xl" : "text-5xl"}>{value}</span> <span className="text-muted">{unit}</span></p>
      <button type="button" className={b} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="One year more">+</button>
    </div>
  );
}

function JobPicker({ cat, value, onPick }: { cat: Catalog; value: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => cat.occupations.filter((o) => o.title.toLowerCase().includes(q.trim().toLowerCase())), [cat, q]);
  const box = useRef<HTMLDivElement>(null);
  // Coming back to this question, scroll the list (not the page) so the picked job is visible.
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (box.current && el) box.current.scrollTop = el.offsetTop - 8;
  }, []);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, for example clerk or engineer" aria-label="Search jobs" autoFocus={!value}
        className="mb-3 min-h-12 w-full rounded-2xl border border-control bg-raised px-4" />
      <div ref={box} role="radiogroup" aria-label="Last job" className="relative max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
        {list.map((o) => {
          const on = value === o.id;
          return (
            <button type="button" role="radio" aria-checked={on} key={o.id} onClick={() => onPick(o.id)}
              className={`press flex min-h-12 w-full items-center justify-between rounded-2xl px-4 text-left ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
              <span>{o.title}</span>
              <span className={`text-sm ${on ? "opacity-80" : "text-muted"}`}>{cat.sectors.find((s) => s.id === o.sector)?.label}</span>
            </button>
          );
        })}
        {list.length === 0 && <p className="text-sm text-muted">No job matches “{q}”. Try a shorter word.</p>}
      </div>
    </div>
  );
}

function SkillPicker({ cat, value, suggested, onChange }: { cat: Catalog; value: string[]; suggested: string[]; onChange: (v: string[]) => void }) {
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");
  const first = [...new Set([...suggested, ...value])];
  const others = cat.skills.filter((s) => !first.includes(s.id) && s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const row = (id: string, name: string) => (
    <label key={id} className={`press flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 ${value.includes(id) ? "bg-accentsoft" : "bg-surface hover:bg-surface2"}`}>
      <input type="checkbox" checked={value.includes(id)} onChange={() => toggle(id)} className="h-5 w-5 accent-[var(--accent)]" /> {name}
    </label>
  );
  return (
    <div>
      <div className="grid gap-1.5 sm:grid-cols-2">{first.map((id) => row(id, cat.skills.find((s) => s.id === id)!.name))}</div>
      <p className="mt-3 text-sm text-muted">{value.length} picked</p>
      {!more ? (
        <button type="button" onClick={() => setMore(true)} className="mt-2 min-h-11 text-sm underline decoration-control underline-offset-2">Add other skills you have</button>
      ) : (
        <div className="mt-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills" aria-label="Search skills" autoFocus className="mb-2 min-h-12 w-full rounded-2xl border border-control bg-raised px-4" />
          <div className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2">{others.map((s) => row(s.id, s.name))}</div>
        </div>
      )}
    </div>
  );
}

type Report = { analysis: ResumeAnalysis; ai: AiRead | null; aiStatus: AiStatus; fileName: string; preview: ResumeSource | null };
function ResumeStep({ d, setD, cat, report, setReport, onDone, autoSample }: { d: Draft; setD: (f: (x: Draft) => Draft) => void; cat: Catalog; report: Report | null; setReport: (r: Report | null) => void; onDone: () => void; autoSample?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const [useAi, setUseAi] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const scan = async (init: RequestInit, sample = false, source?: Omit<ResumeSource, "text" | "html">) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/resume", init);
      const j = await r.json();
      if (!r.ok) {
        if (source?.fileUrl) URL.revokeObjectURL(source.fileUrl);
        setErr(j.error ?? "We could not read that. Try pasting the text.");
        return;
      }
      const a = j.analysis as ResumeAnalysis;
      const name = source?.name ?? (sample ? "Demo resume" : "Pasted resume");
      setReport({ analysis: a, ai: j.ai ?? null, aiStatus: j.aiStatus ?? "off", fileName: name, preview: sample ? null : { name, text: String(j.previewText ?? ""), html: j.previewHtml, fileUrl: source?.fileUrl, isPdf: source?.isPdf } });
      const aiSkills = ((j.ai as AiRead | null)?.skills ?? []).map((s) => s.id);
      setD((x) => applyScan(x, a, cat, aiSkills, sample));
    } catch {
      if (source?.fileUrl) URL.revokeObjectURL(source.fileUrl);
      setErr("Network problem. Please try again.");
    }
    finally { setBusy(false); }
  };
  const upload = (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("ai", useAi ? "1" : "0");
    const fileUrl = URL.createObjectURL(f);
    scan({ method: "POST", body: fd }, false, { name: f.name, fileUrl, isPdf: f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") });
  };
  const pasteScan = (t: string, sample = false) => scan({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t, ai: useAi }) }, sample);

  // Arriving from a demo link: scan the made-up resume once, without asking.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoSample && !d.resume && !autoTried.current) { autoTried.current = true; pasteScan(SAMPLE_RESUME, true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSample]);

  const again = () => { setReport(null); setD((x) => ({ ...x, resume: null })); };
  if (report) {
    return (
      <section>
        <PageTitle title="Here is what we found">Your score and your resume. Open Suggested fixes to see what to change.</PageTitle>
        <ResumeReport analysis={report.analysis} ai={report.ai} aiStatus={report.aiStatus} fileName={report.fileName} source={report.preview} onAgain={again} onContinue={onDone} />
      </section>
    );
  }
  // Back after a reload: the report is gone with the page, because the resume text is never saved.
  if (d.resume) {
    return (
      <Q title={`Your resume scored ${d.resume.score} out of 100.`} help="We filled in your last job, experience and skills from it. You will check each one next.">
        <dl className="divide-y divide-line rounded-[22px] bg-surface px-5">
          <div className="flex min-h-14 items-center justify-between gap-3"><dt className="text-sm text-muted">Last job found</dt><dd className="text-sm">{d.resume.occupation ?? "Not sure; you will pick it"}</dd></div>
          <div className="flex min-h-14 items-center justify-between gap-3"><dt className="text-sm text-muted">Skills found</dt><dd className="num text-sm">{d.resume.found}</dd></div>
          {d.resume.fixes.length > 0 && <div className="py-3"><dt className="text-sm text-muted">Fix first</dt><dd className="mt-1 text-sm"><ul className="list-disc pl-5">{d.resume.fixes.map((f) => <li key={f}>{f}</li>)}</ul></dd></div>}
        </dl>
        {d.resume.sample && (
          <section className="mt-3 rounded-[22px] bg-surface px-5 py-4" aria-labelledby="demo-resume-title">
            <h2 id="demo-resume-title" className="text-sm font-medium">The demo resume we scanned</h2>
            <div className="mt-3 max-h-[34rem] overflow-y-auto rounded-2xl bg-surface2 p-3 sm:p-5"><ResumeGraphic lines={SAMPLE_RESUME.split("\n")} /></div>
          </section>
        )}
        <p className="mt-3 text-sm text-muted">Your resume text was not saved, so scan it again to see the full report.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Btn onClick={onDone} autoFocus className="min-h-12 px-6 text-base">Continue</Btn>
          <Btn variant="ghost" onClick={again}>Scan a different one</Btn>
        </div>
      </Q>
    );
  }
  return (
    <Q title="Do you have a resume to scan?" help="It saves typing: we read your last job, years and skills from it, and score it out of 100. It is read in memory and never saved.">
      <div className="relative" aria-busy={busy}>
        {busy && (
          <div className="absolute inset-0 z-10 grid place-items-center" role="status" aria-live="polite">
            <span className="flex items-center gap-3 rounded-full bg-raised/95 px-5 py-3 font-medium text-ink shadow-lg ring-1 ring-line">
              <LoaderCircle size={22} className="animate-spin text-accentink" aria-hidden />
              {useAi ? "Reading and evaluating your resume…" : "Reading your resume…"}
            </span>
          </div>
        )}
        <fieldset disabled={busy} className={`min-w-0 border-0 p-0 transition-opacity duration-200 ${busy ? "opacity-40" : "opacity-100"}`}>
        {!paste ? (
          <div className="grid gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
            className="press flex min-h-24 flex-col items-start justify-center rounded-2xl bg-surface px-5 text-left hover:bg-surface2 disabled:opacity-50">
            <span className="text-base font-medium">{busy ? "Reading your resume…" : "Upload a file"}</span>
            <span className="text-sm text-muted">PDF, Word (.docx) or text, up to 3 MB. You can also drop it here.</span>
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <button type="button" onClick={() => setPaste(true)} className="press flex min-h-14 items-center rounded-2xl bg-surface px-5 text-left hover:bg-surface2">Paste the text instead</button>
          <button type="button" onClick={() => pasteScan(SAMPLE_RESUME, true)} disabled={busy}
            className="press flex min-h-16 items-center gap-3 rounded-2xl bg-[#f8c982] px-5 text-left text-[#203b2b] shadow-[0_2px_8px_rgb(201_116_26/0.25)] ring-2 ring-cue hover:bg-[#f5bb62] disabled:opacity-50">
            <Sparkles size={20} aria-hidden className="shrink-0" />
            <span><span className="block text-base font-semibold">Use a demo resume</span><span className="block text-sm">New here? One click fills in every answer for you.</span></span>
          </button>
          <button type="button" onClick={onDone} className="press flex min-h-14 items-center rounded-2xl px-5 text-left underline decoration-control underline-offset-2">No resume, I will answer questions</button>
          </div>
        ) : (
          <div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} autoFocus aria-label="Resume text" placeholder="Paste your resume text here"
            className="w-full rounded-2xl border border-control bg-raised p-4 text-sm" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn onClick={() => pasteScan(text)} disabled={busy || text.trim().split(/\s+/).length < 40}>{busy ? "Reading…" : "Scan this text"}</Btn>
            <Btn variant="ghost" onClick={() => setPaste(false)}>Back to upload</Btn>
          </div>
          <p className="mt-2 text-sm text-muted">At least about 40 words.</p>
          </div>
        )}
        <label className="flex cursor-pointer items-start gap-3 mt-3 rounded-2xl px-5 py-3 text-sm">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span><b>Also let AI read it.</b> An AI model suggests extra skills and better wording. Nothing is changed for you; you choose what to use. If you allow AI, the text is sent once to an AI model (DeepSeek through our LLM gateway, or Qwen on RunPod or Groq as backups) to read it.</span>
        </label>
        {err && <p role="alert" className="mt-3 text-sm text-negative">{err}</p>}
        </fieldset>
      </div>
    </Q>
  );
}
