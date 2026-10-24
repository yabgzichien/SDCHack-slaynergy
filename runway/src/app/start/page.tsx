"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Award, BookOpen, BriefcaseBusiness, Calculator, CalendarClock, Clock, Eye, FileText, FlaskConical, GraduationCap, Hammer, HeartPulse,
  Laptop, Leaf, Library, MapPin, Microscope, Presentation, Scale, ScrollText, Sparkles, Users, UserRound, Wrench, X, type LucideIcon,
} from "lucide-react";
import { useApp, type Catalog } from "@/components/AppProvider";
import { StepBar } from "@/components/Journey";
import { Btn, Skeleton } from "@/components/ui";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import { ResumePaper } from "@/components/ResumePaper";
import { STATES, regionOf, type Reach } from "@/lib/engine/geo";
import { occupationById, personas } from "@/lib/engine/data";

// Onboarding: eight short screens. After the name, the resume comes first because it fills in most of the rest.
// Nothing is saved until the last screen; the draft lives in this tab only.
type Draft = {
  name: string; status: "" | "working" | "studying"; age: string; state: string; move: Reach | ""; moveTo: string[]; occupationId: string; education: string; study: string; years: number; skills: string[];
  months: number; hours: number; interests: string[];
  resume: null | { score: number; band: string; occupation: string | null; found: number; fixes: string[]; sample?: boolean };
  touched: { education?: boolean; study?: boolean; skills?: boolean };
};
const KEY = "runway-onboarding-v4";
const STEPS = ["name", "resume", "job", "education", "skills", "time", "interests", "where"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, string> = { name: "You", resume: "Resume", job: "Last job", education: "Qualification", skills: "Skills", time: "Time", interests: "Interests", where: "Where" };
const STEP_ICON: Record<Step, LucideIcon> = { name: UserRound, resume: FileText, job: BriefcaseBusiness, education: GraduationCap, skills: Sparkles, time: CalendarClock, interests: HeartPulse, where: MapPin };

const EDU_ICON: Record<string, LucideIcon> = { spm: BookOpen, skm: Wrench, stpm: Library, diploma: ScrollText, degree: GraduationCap, master: Award, phd: Microscope };
const EDU_SUB: Record<string, string> = {
  spm: "Sijil Pelajaran Malaysia", skm: "Sijil Kemahiran Malaysia, levels 1 to 3", stpm: "Or A-Levels, Asasi", diploma: "Including advanced diplomas",
  degree: "Bachelor's or professional degree", master: "Including MBA", phd: "Doctorate",
};
// Levels that have a field of study. Below these (SPM, SKM, STPM) the study question is not asked.
const HAS_FIELD = ["diploma", "degree", "master", "phd"];
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

export default function StartPage() {
  const { catalog, state } = useApp();
  if (!catalog || !state) return <Skeleton lines={3} />;
  return <Wizard cat={catalog} />;
}

function Wizard({ cat }: { cat: Catalog }) {
  const { act, busy, error, state } = useApp();
  const router = useRouter();
  // The wizard mounts only in the browser (after the catalog loads), so the saved draft can be read synchronously.
  // A half-finished draft only matters before the first save; once there is a profile, the profile wins.
  const [sample] = useState(() => wantsSample());
  // A real saved profile. The made-up sample worker (synthetic) does not count: "Start now" begins blank, and the sample
  // always opens on its first question with every answer filled in.
  const own = !!state?.profile && !state.profile.personaId && !state.profile.synthetic;
  // A draft saved while trying the sample belongs to the sample: "Start now" must begin blank, not on Hafiz's answers.
  const [saved] = useState<{ d: Draft; i: number } | null>(() => {
    if (sample) return null;
    if (own) return null;
    try {
      const raw = sessionStorage.getItem(KEY);
      const r = raw ? (JSON.parse(raw) as { d: Draft; i: number; sample?: boolean }) : null;
      return r && !r.sample ? r : null;
    } catch { return null; }
  });
  // Someone who already answered comes back to change an answer: open on the last screen with every question reachable.
  const answered = own && !sample;
  const [i, setI] = useState(() => answered ? STEPS.length - 1 : Math.min(saved?.i ?? 0, STEPS.length - 1));
  const [seen, setSeen] = useState(() => answered ? STEPS.length - 1 : Math.min(saved?.i ?? 0, STEPS.length - 1));
  const [d, setD] = useState<Draft>(() => {
    if (sample) { const s = sampleDraft(cat); if (s) return s; }
    if (saved) return { ...blank(cat), ...saved.d };
    const p = state?.profile;
    if (own && p) return { ...blank(cat), name: p.name === "You" ? "" : p.name, status: p.status ?? "working", moveTo: p.moveTo ?? [], age: p.age ? String(p.age) : "", state: p.state ?? "", move: p.move ?? "", occupationId: p.occupationId, education: p.education, study: p.study ?? "", years: p.years, skills: p.skills, months: p.months, hours: p.hoursPerWeek, interests: p.interests, touched: { education: true, study: !!p.study, skills: true } };
    return blank(cat);
  });
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ d, i, sample })); } catch { /* ignore */ } }, [d, i, sample]);

  const step: Step = STEPS[i];
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
  const canGo: Record<Step, boolean> = { name: !!d.status, resume: true, job: studying || !!occ, education: !!d.education && (!hasField || !!study), skills: d.skills.length > 0, time: true, interests: true, where: ready && (!d.state || (!!d.move && (d.move !== "pick" || d.moveTo.length > 0))) };
  const go = (n: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, n));
    setI(k);
    setSeen((x) => Math.max(x, k));
    window.scrollTo({ top: 0 });
  };
  const next = () => { if (canGo[step]) go(i + 1); };
  const finish = async () => {
    const r = await act("setProfile", { profile: { name: d.name.trim() || "You", age: d.age ? Number(d.age) : null, status: d.status || "working", state: d.state || null, move: d.state && d.move ? d.move : null, moveTo: d.move === "pick" ? d.moveTo : [], occupationId: occ ? d.occupationId : "", education: d.education, study, years: occ ? d.years : 0, skills: d.skills, interests: d.interests, months: d.months, hoursPerWeek: d.hours, budget: "free", synthetic: sample || !!d.resume?.sample || (answered && !!state?.profile?.synthetic) } });
    if (r) { try { sessionStorage.removeItem(KEY); sessionStorage.setItem("jobbery-results-arrival", "1"); } catch { /* ignore */ } router.push("/skills"); }
  };

  // Enter continues from anywhere on the question, not only from inside a text field.
  const enter = useRef<() => void>(() => {});
  useEffect(() => { enter.current = () => { if (step === "where") { if (canGo.where && !busy) finish(); } else if (step !== "resume") next(); }; });
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
    <div className="mx-auto max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); if (step === "where") finish(); else next(); }}>
        {step === "name" && (
          <Q title="First, a little about you" help="Your name is optional. We use it to greet you and on your plan, never to choose or rank jobs.">
            <label className="block">
              <span className="mb-2 block text-sm text-muted">First name</span>
              <TextInput value={d.name} onChange={(v) => set({ name: v })} placeholder="For example, Aina" maxLength={40} label="First name" autoComplete="given-name" />
            </label>
            <div className="mt-8">
              <h2 className="text-lg font-medium">What are you doing now?</h2>
              <p className="mb-3 mt-1 text-sm text-muted">Students plan towards graduation; everyone else towards a job deadline.</p>
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
          </Q>
        )}
        {step === "resume" && <ResumeStep d={d} setD={setD} cat={cat} onDone={() => go(i + 1)} autoSample={sample} />}
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
            <SkillPicker cat={cat} value={d.skills} suggested={occ?.skills ?? fieldSkills} onChange={(v) => set({ skills: v, touched: { ...d.touched, skills: true } })} />
          </Q>
        )}
        {step === "time" && (
          <Q title="How much time do you have?" help={studying ? "Jobbery only suggests jobs you can get ready for by the time you graduate." : "Jobbery only suggests jobs you can get ready for in this time."}>
            {studying ? (
              <Group icon={CalendarClock} label="Months until you graduate" note="Pick the closest. More than two years away? Choose 24 and come back later.">
                <Options value={String(d.months)} onPick={(v) => set({ months: Number(v) })} cols={3}
                  options={[3, 6, 9, 12, 18, 24].map((m) => ({ id: String(m), label: `${m} months` }))} />
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
          </Q>
        )}
        {step === "where" && (
          <Q title={state?.profile && !state.profile.personaId ? "Your answers are saved." : "Last one: where do you live now?"}
            help={state?.profile && !state.profile.personaId ? "Tap any question in the bar above to change it." : "Then tell us if you would move. Jobs that are scarce where you can work move down a little. None are hidden."}>
            <label className="block">
              <span className="mb-2 block text-sm text-muted">State you live in</span>
              <select value={d.state} onChange={(e) => set({ state: e.target.value, move: e.target.value ? d.move : "", moveTo: d.moveTo.filter((x) => x !== e.target.value) })} className="min-h-14 w-full rounded-2xl border border-control bg-raised px-4 text-base">
                <option value="">Prefer not to say</option>
                {STATES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            {d.state ? (
              <div className="mt-8">
                <h2 className="text-lg font-medium">Would you relocate for a job?</h2>
                <p className="mb-3 mt-1 text-sm text-muted">Counted with DOSM figures on how many people work in each kind of job, state by state.</p>
                <Options value={d.move} onPick={(v) => set({ move: v as Reach })}
                  options={[
                    { id: "stay", label: "No, only in my state", sub: STATES.find((s) => s.id === d.state)?.name },
                    { id: "region", label: "Yes, to nearby states", sub: (() => { const r = regionOf(d.state); return r ? `Anywhere in ${r.name}` : undefined; })() },
                    { id: "pick", label: "Yes, to states I choose" },
                    { id: "anywhere", label: "Yes, anywhere in Malaysia" },
                  ]} />
                {d.move === "pick" && (
                  <fieldset className="mt-4">
                    <legend className="mb-2 text-sm text-muted">Which states? Pick as many as you like.</legend>
                    <div className="flex flex-wrap gap-2">
                      {STATES.filter((s) => s.id !== d.state).map((s) => {
                        const on = d.moveTo.includes(s.id);
                        return (
                          <button type="button" key={s.id} aria-pressed={on} onClick={() => set({ moveTo: on ? d.moveTo.filter((x) => x !== s.id) : [...d.moveTo, s.id] })}
                            className={`press min-h-10 rounded-full px-4 text-sm ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>{s.name}</button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-sm text-muted">{d.moveTo.length ? `${d.moveTo.length} picked` : "Pick at least one."}</p>
                  </fieldset>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Without a state, every job is ranked as if you could work anywhere in Malaysia.</p>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-negative">{error}</p>}
          </Q>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          {i > 0 ? <Btn variant="quiet" onClick={() => go(i - 1)}>Back</Btn> : <Link href="/" className="text-sm underline decoration-control underline-offset-2">Cancel</Link>}
          <div className="flex items-center gap-2">
            {step === "where"
              ? <Btn type="submit" disabled={busy || !canGo.where} className="min-h-12 px-6 text-base">{state?.profile && !state.profile.personaId ? "Save and see results" : "Show my results"}</Btn>
              : step !== "resume" && <Btn type="submit" disabled={!canGo[step]} className="min-h-12 px-6 text-base">Continue</Btn>}
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
      <div className="flex items-center justify-between gap-4">
        <h1 ref={ref} tabIndex={-1} className="greeting text-[1.75rem] outline-none sm:text-[2.6rem]">{title}</h1>
        <Image src="/cockatiel-thinking.png" alt="" width={88} height={88} className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20" />
      </div>
      {help && <p className="mt-3 text-base text-muted">{help}</p>}
      <div className="about-you-information-frame mt-8">{children}</div>
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

type Analysis = { score: number; band: string; occupation: { id: string; title: string } | null; years: number | null; education: string | null; skills: { id: string }[]; findings: { severity: string; title: string }[] };
type ResumePreviewData = { label: string; name: string; text: string; fileUrl?: string; isPdf?: boolean };

function ResumePreview({ resume, onClose }: { resume: ResumePreviewData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#14291f]/60 p-3 sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="resume-preview-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-raised shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="resume-preview-title" className="font-semibold">Resume preview</h2>
            <p className="truncate text-sm text-muted">{resume.name}</p>
          </div>
          <button type="button" onClick={onClose} autoFocus aria-label="Close resume preview" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface hover:bg-surface2">
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[#e7eee7] p-3 sm:p-6">
          {resume.isPdf && resume.fileUrl ? (
            <iframe title={`${resume.name} preview`} src={resume.fileUrl} className="mx-auto h-[72vh] w-full rounded-xl bg-white shadow-lg" />
          ) : (
            <article className="mx-auto min-h-[70vh] max-w-[760px] bg-white px-6 py-8 text-sm leading-relaxed text-[#2b3a31] shadow-lg sm:px-12 sm:py-10">
              <pre className="whitespace-pre-wrap break-words font-sans">{resume.text}</pre>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}

function ResumeStep({ d, setD, cat, onDone, autoSample }: { d: Draft; setD: (f: (x: Draft) => Draft) => void; cat: Catalog; onDone: () => void; autoSample?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ResumePreviewData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fileUrl = preview?.fileUrl;
    return () => { if (fileUrl) URL.revokeObjectURL(fileUrl); };
  }, [preview?.fileUrl]);
  const scan = async (init: RequestInit, sample = false, source?: Omit<ResumePreviewData, "text">) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/resume", init);
      const j = await r.json();
      if (!r.ok) {
        if (source?.fileUrl) URL.revokeObjectURL(source.fileUrl);
        setErr(j.error ?? "We could not read that. Try pasting the text.");
        return;
      }
      const a = j.analysis as Analysis;
      setPreview({ label: source?.label ?? (sample ? "Demo resume" : "Pasted resume"), name: source?.name ?? (sample ? "Demo resume" : "Pasted resume"), text: String(j.previewText ?? ""), fileUrl: source?.fileUrl, isPdf: source?.isPdf });
      setD((x) => {
        const occ = a.occupation && cat.occupations.find((o) => o.id === a.occupation!.id);
        return {
          ...x,
          occupationId: occ ? occ.id : x.occupationId,
          education: a.education ?? (occ ? occ.education : x.education),
          years: a.years !== null ? Math.round(a.years) : x.years,
          skills: [...new Set([...a.skills.map((s) => s.id), ...(occ ? occ.skills : [])])],
          resume: { score: a.score, band: a.band, occupation: occ ? occ.title : null, found: a.skills.length, fixes: a.findings.filter((f) => f.severity === "fix").slice(0, 2).map((f) => f.title), sample },
          touched: { ...x.touched, education: a.education ? true : x.touched.education },
        };
      });
    } catch {
      if (source?.fileUrl) URL.revokeObjectURL(source.fileUrl);
      setErr("Network problem. Please try again.");
    }
    finally { setBusy(false); }
  };
  const upload = (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    const fileUrl = URL.createObjectURL(f);
    scan({ method: "POST", body: fd }, false, { label: "Uploaded resume", name: f.name, fileUrl, isPdf: f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") });
  };
  const pasteScan = (t: string, sample = false) => scan({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) }, sample);

  // Arriving from a demo link: scan the made-up resume once, without asking.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoSample && !d.resume && !autoTried.current) { autoTried.current = true; pasteScan(SAMPLE_RESUME, true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSample]);

  if (d.resume) {
    return (
      <Q title={`Your resume scored ${d.resume.score} out of 100.`} help="We filled in your last job, experience and skills from it. You will check each one next.">
        {preview && (
          <section className="mb-4 flex items-center gap-4 rounded-[22px] border border-line bg-raised p-3 shadow-[0_5px_18px_rgb(32_59_43/0.08)]" aria-label={`${preview.label} preview`}>
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-line bg-white px-2 py-2 shadow-sm" aria-hidden>
              <div className="mb-2 h-1.5 w-7 rounded-full bg-ink/75" />
              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-line" /><div className="h-1 w-10/12 rounded-full bg-line" /><div className="h-1 w-full rounded-full bg-line" />
                <div className="mt-2 h-1 w-7 rounded-full bg-accent" /><div className="h-1 w-full rounded-full bg-line" /><div className="h-1 w-9/12 rounded-full bg-line" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[.08em] text-muted">{preview.label}</p>
              <p className="mt-1 truncate font-medium">{preview.name}</p>
              <p className="text-sm text-muted">Ready to preview</p>
            </div>
            <button type="button" onClick={() => setPreviewOpen(true)} aria-label={`View ${preview.name}`} className="press flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-4 font-medium text-primaryink shadow-sm hover:bg-[#f5bb62]">
              <Eye size={19} aria-hidden />
              <span className="hidden sm:inline">View</span>
            </button>
          </section>
        )}
        <dl className="divide-y divide-line rounded-[22px] bg-surface px-5">
          <div className="flex min-h-14 items-center justify-between gap-3"><dt className="text-sm text-muted">Last job found</dt><dd className="text-sm">{d.resume.occupation ?? "Not sure; you will pick it"}</dd></div>
          <div className="flex min-h-14 items-center justify-between gap-3"><dt className="text-sm text-muted">Skills found</dt><dd className="num text-sm">{d.resume.found}</dd></div>
          {d.resume.fixes.length > 0 && <div className="py-3"><dt className="text-sm text-muted">Fix first</dt><dd className="mt-1 text-sm"><ul className="list-disc pl-5">{d.resume.fixes.map((f) => <li key={f}>{f}</li>)}</ul></dd></div>}
        </dl>
        {d.resume.sample && !preview && (
          <section className="mt-3 rounded-[22px] bg-surface px-5 py-4" aria-labelledby="demo-resume-title">
            <h2 id="demo-resume-title" className="text-sm font-medium">The demo resume we scanned</h2>
            <div className="mt-3 max-h-[34rem] overflow-y-auto rounded-2xl bg-surface2 p-3 sm:p-5"><ResumePaper text={SAMPLE_RESUME} /></div>
          </section>
        )}
        <p className="mt-3 text-sm text-muted">The full report, with before-and-after examples, is on <Link href="/resume" className="underline decoration-control underline-offset-2">Resume report</Link>. Your resume text was not saved.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Btn onClick={onDone} autoFocus className="min-h-12 px-6 text-base">Continue</Btn>
          <Btn variant="ghost" onClick={() => { setPreview(null); setPreviewOpen(false); setD((x) => ({ ...x, resume: null })); }}>Scan a different one</Btn>
        </div>
        {previewOpen && preview && <ResumePreview resume={preview} onClose={() => setPreviewOpen(false)} />}
      </Q>
    );
  }
  return (
    <Q title="Do you have a resume to scan?" help="It saves typing: we read your last job, years and skills from it, and score it out of 100. It is read in memory and never saved.">
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
      {err && <p role="alert" className="mt-3 text-sm text-negative">{err}</p>}
    </Q>
  );
}
