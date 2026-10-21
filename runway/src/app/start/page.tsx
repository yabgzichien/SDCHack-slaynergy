"use client";
import "./start-journey.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Award, BookOpen, BriefcaseBusiness, Calculator, CalendarClock, Check, Clock, FileText, FlaskConical, GraduationCap, Hammer, HeartPulse,
  Laptop, Leaf, Library, Microscope, Presentation, Scale, ScrollText, Sparkles, Users, UserRound, Wrench, type LucideIcon,
} from "lucide-react";
import { useApp, type Catalog } from "@/components/AppProvider";
import { Btn, Skeleton } from "@/components/ui";
import { SAMPLE_RESUME } from "@/lib/sample-resume";
import { STATES } from "@/lib/engine/geo";

// Onboarding: seven short screens. The resume comes first because it fills in most of the rest.
// Nothing is saved until the last screen; the draft lives in this tab only.
type Draft = {
  name: string; age: string; state: string; occupationId: string; education: string; study: string; years: number; skills: string[];
  months: number; hours: number; interests: string[];
  resume: null | { score: number; band: string; occupation: string | null; found: number; fixes: string[]; sample?: boolean };
  touched: { education?: boolean; study?: boolean; skills?: boolean };
};
const KEY = "runway-onboarding-v2";
const STEPS = ["resume", "job", "education", "skills", "time", "interests", "about"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, string> = { resume: "Resume", job: "Last job", education: "Qualification", skills: "Skills", time: "Time", interests: "Interests", about: "About you" };
const STEP_ICON: Record<Step, LucideIcon> = { resume: FileText, job: BriefcaseBusiness, education: GraduationCap, skills: Sparkles, time: CalendarClock, interests: HeartPulse, about: UserRound };

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
  name: "", age: "", state: "", occupationId: "", education: cat.education.find((e) => e.id === "diploma")?.id ?? cat.education[0]?.id ?? "", study: "", years: 2, skills: [], months: 6, hours: 10, interests: [], resume: null, touched: {},
});

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
  const [saved] = useState<{ d: Draft; i: number } | null>(() => {
    if (state?.profile && !state.profile.personaId) return null;
    try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as { d: Draft; i: number }) : null; } catch { return null; }
  });
  // Someone who already answered comes back to change an answer: open on the last screen with every question reachable.
  const answered = !!state?.profile && !state.profile.personaId;
  const [i, setI] = useState(() => answered ? STEPS.length - 1 : Math.min(saved?.i ?? 0, STEPS.length - 1));
  const [walking, setWalking] = useState(false);
  const [walkingBack, setWalkingBack] = useState(false);
  const walkTimer = useRef<number | null>(null);
  const [seen, setSeen] = useState(() => answered ? STEPS.length - 1 : Math.min(saved?.i ?? 0, STEPS.length - 1));
  const [d, setD] = useState<Draft>(() => {
    if (saved) return { ...blank(cat), ...saved.d };
    const p = state?.profile;
    if (p && !p.personaId) return { ...blank(cat), name: p.name === "You" ? "" : p.name, age: p.age ? String(p.age) : "", state: p.state ?? "", occupationId: p.occupationId, education: p.education, study: p.study ?? "", years: p.years, skills: p.skills, months: p.months, hours: p.hoursPerWeek, interests: p.interests, touched: { education: true, study: !!p.study, skills: true } };
    return blank(cat);
  });
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ d, i })); } catch { /* ignore */ } }, [d, i]);

  const step: Step = STEPS[i];
  const occ = cat.occupations.find((o) => o.id === d.occupationId);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const pickJob = (id: string) => {
    const o = cat.occupations.find((x) => x.id === id)!;
    setD((x) => ({ ...x, occupationId: id, education: x.touched.education ? x.education : o.education, study: x.touched.study ? x.study : o.sector, skills: x.touched.skills ? x.skills : [...new Set([...o.skills, ...(x.resume ? x.skills : [])])] }));
  };
  const hasField = HAS_FIELD.includes(d.education);
  const study = hasField ? d.study || occ?.sector || "" : null;
  const canGo: Record<Step, boolean> = { resume: true, job: !!occ, education: !!d.education && (!hasField || !!study), skills: d.skills.length > 0, time: true, interests: true, about: !!occ && d.skills.length > 0 };
  const go = (n: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, n));
    if (k !== i) {
      if (walkTimer.current !== null) window.clearTimeout(walkTimer.current);
      setWalkingBack(k < i);
      setWalking(true);
      walkTimer.current = window.setTimeout(() => { setWalking(false); walkTimer.current = null; }, 1050);
    }
    setI(k);
    setSeen((x) => Math.max(x, k));
    window.scrollTo({ top: 0 });
  };
  useEffect(() => () => { if (walkTimer.current !== null) window.clearTimeout(walkTimer.current); }, []);
  const next = () => { if (canGo[step]) go(i + 1); };
  const finish = async () => {
    const r = await act("setProfile", { profile: { name: d.name.trim() || "You", age: d.age ? Number(d.age) : null, state: d.state || null, occupationId: d.occupationId, education: d.education, study, years: d.years, skills: d.skills, interests: d.interests, months: d.months, hoursPerWeek: d.hours, budget: "free", synthetic: !!d.resume?.sample || (answered && !!state?.profile?.synthetic) } });
    if (r) { try { sessionStorage.removeItem(KEY); sessionStorage.setItem("jobbery-results-arrival", "1"); } catch { /* ignore */ } router.push("/skills"); }
  };

  // Enter continues from anywhere on the question, not only from inside a text field.
  const enter = useRef<() => void>(() => {});
  useEffect(() => { enter.current = () => { if (step === "about") { if (canGo.about && !busy) finish(); } else if (step !== "resume") next(); }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && !e.isComposing && (t === document.body || t.tagName === "H1")) { e.preventDefault(); enter.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="onboarding-journey mb-10">
        <div className="journey-track" aria-hidden="true"><span className="journey-track-fill" style={{ width: `${(i / (STEPS.length - 1)) * 100}%` }} /></div>
        <div className={`journey-bird${walking ? " is-walking" : ""}${walkingBack ? " is-returning" : ""}`} style={{ left: `${((i + 0.5) / STEPS.length) * 100}%` }} aria-hidden="true">
          <Image className="journey-bird-frame journey-bird-frame-a" src="/cockatiel-walk-step-a.png" alt="" width={1254} height={1254} priority />
          <Image className="journey-bird-frame journey-bird-frame-b" src="/cockatiel-walk-step-b.png" alt="" width={1254} height={1254} priority />
          <span className="journey-bird-shadow" />
        </div>
        <ol className="journey-points" aria-label="Questions">
          {STEPS.map((s, k) => {
            const Icon = STEP_ICON[s];
            const on = k === i, done = k < i || (k <= seen && k !== i);
            const reachable = k <= seen && STEPS.slice(0, k).every((x) => canGo[x]);
            return (
              <li key={s}>
                <button type="button" onClick={() => reachable && go(k)} disabled={!reachable} aria-current={on ? "step" : undefined} aria-label={`${STEP_LABEL[s]}${on ? ", current question" : done ? ", answered" : ""}`}
                  className="journey-checkpoint group" data-state={on ? "current" : done ? "done" : "upcoming"}>
                  <span className="journey-marker">{done ? <Check size={10} strokeWidth={2.3} aria-hidden /> : null}</span>
                  <Icon size={16} strokeWidth={1.8} aria-hidden className={on ? "text-ink" : done ? "text-accent" : "text-muted/60"} />
                  <span className={`hidden text-[11px] sm:block ${on ? "font-medium text-ink" : "text-muted"}`}>{STEP_LABEL[s]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (step === "about") finish(); else next(); }}>
        {step === "resume" && <ResumeStep d={d} setD={setD} cat={cat} onDone={() => go(i + 1)} />}
        {step === "job" && (
          <Q title="What was your last job?" help={d.resume?.occupation ? "We read this from your resume. Change it if it is wrong." : "Pick the closest one. It tells us which skills you probably have."}>
            <JobPicker cat={cat} value={d.occupationId} onPick={pickJob} />
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
              <p className="text-base">Years of work, all jobs</p>
              <Stepper value={d.years} min={0} max={40} onChange={(v) => set({ years: v })} unit={d.years === 1 ? "year" : "years"} />
            </div>
          </Q>
        )}
        {step === "education" && (
          <Q title="What is your highest qualification?">
            <Options value={d.education} onPick={(v) => set({ education: v, touched: { ...d.touched, education: true } })} cols={2}
              options={cat.education.map((e) => ({ id: e.id, label: e.label, sub: EDU_SUB[e.id], icon: EDU_ICON[e.id] }))} />
            {hasField && (
              <div className="mt-8">
                <h2 className="text-lg font-medium">What did you study?</h2>
                <p className="mb-3 mt-1 text-sm text-muted">{occ && !d.touched.study ? `We guessed from your last job as ${occ.title.toLowerCase()}. ` : ""}Engineering, science, health and accounting jobs need a degree in that field.</p>
                <Options value={study ?? ""} onPick={(v) => set({ study: v, touched: { ...d.touched, study: true } })} cols={2}
                  options={[...cat.sectors.map((x) => ({ id: x.id, label: x.label })), { id: "other", label: "Something else" }]} />
              </div>
            )}
            <p className="mt-4 text-sm text-muted">Done a bootcamp or a professional certificate such as ACCA? Add its skills on the next screen.</p>
          </Q>
        )}
        {step === "skills" && (
          <Q title="Which of these skills do you have?" help={`Filled in from ${d.resume ? "your resume and " : ""}your last job${occ ? ` as ${occ.title.toLowerCase()}` : ""}. Untick any you do not have.`}>
            <SkillPicker cat={cat} value={d.skills} suggested={occ?.skills ?? []} onChange={(v) => set({ skills: v, touched: { ...d.touched, skills: true } })} />
          </Q>
        )}
        {step === "time" && (
          <Q title="How much time do you have?" help="Jobbery only suggests jobs you can get ready for in this time.">
            <Group icon={CalendarClock} label="Months to find a new job" note="Job-seeker support usually lasts 3 to 6 months.">
              <Options value={String(d.months)} onPick={(v) => set({ months: Number(v) })} cols={3}
                options={[1, 2, 3, 4, 5, 6].map((m) => ({ id: String(m), label: `${m} ${m === 1 ? "month" : "months"}` }))} />
            </Group>
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
        {step === "about" && (
          <Q title={state?.profile && !state.profile.personaId ? "Your answers are saved." : "Last one: about you"} help={state?.profile && !state.profile.personaId ? "Tap any question in the bar above to change it. Name and state are optional and never used to rank jobs." : "Both optional. Neither is used to choose or rank jobs."}>
            <label className="block">
              <span className="mb-2 block text-sm text-muted">First name</span>
              <TextInput value={d.name} onChange={(v) => set({ name: v })} placeholder="For example, Aina" maxLength={40} label="First name" autoComplete="given-name" />
            </label>
            <label className="mt-6 block">
              <span className="mb-2 block text-sm text-muted">State you live in, for the job map</span>
              <select value={d.state} onChange={(e) => set({ state: e.target.value })} className="min-h-14 w-full rounded-2xl border border-control bg-raised px-4 text-base">
                <option value="">Prefer not to say</option>
                {STATES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-negative">{error}</p>}
          </Q>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          {i > 0 ? <Btn variant="quiet" onClick={() => go(i - 1)}>Back</Btn> : <Link href="/" className="text-sm underline decoration-control underline-offset-2">Cancel</Link>}
          <div className="flex items-center gap-2">
            {step === "about"
              ? <Btn type="submit" disabled={busy || !canGo.about} className="min-h-12 px-6 text-base">{state?.profile && !state.profile.personaId ? "Save and see results" : "Show my results"}</Btn>
              : step !== "resume" && <Btn type="submit" disabled={!canGo[step]} className="min-h-12 px-6 text-base">Continue</Btn>}
          </div>
        </div>
      </form>
    </div>
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
      <div className="mt-8">{children}</div>
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

function Stepper({ value, min, max, onChange, unit }: { value: number; min: number; max: number; onChange: (v: number) => void; unit: string }) {
  const b = "press flex h-14 w-14 items-center justify-center rounded-full bg-surface text-2xl hover:bg-surface2 disabled:opacity-40";
  return (
    <div className="flex items-center gap-5">
      <button type="button" className={b} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="One year less">−</button>
      <p className="num min-w-28 text-center" aria-live="polite"><span className="text-5xl">{value}</span> <span className="text-muted">{unit}</span></p>
      <button type="button" className={b} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="One year more">+</button>
    </div>
  );
}

function JobPicker({ cat, value, onPick }: { cat: Catalog; value: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => cat.occupations.filter((o) => o.title.toLowerCase().includes(q.trim().toLowerCase())), [cat, q]);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, for example clerk or engineer" aria-label="Search jobs" autoFocus={!value}
        className="mb-3 min-h-12 w-full rounded-2xl border border-control bg-raised px-4" />
      <div role="radiogroup" aria-label="Last job" className="max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
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

function ResumeStep({ d, setD, cat, onDone }: { d: Draft; setD: (f: (x: Draft) => Draft) => void; cat: Catalog; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const scan = async (init: RequestInit, sample = false) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/resume", init);
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "We could not read that. Try pasting the text."); return; }
      const a = j.analysis as Analysis;
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
    } catch { setErr("Network problem. Please try again."); }
    finally { setBusy(false); }
  };
  const upload = (f: File) => { const fd = new FormData(); fd.append("file", f); scan({ method: "POST", body: fd }); };
  const pasteScan = (t: string, sample = false) => scan({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) }, sample);

  if (d.resume) {
    return (
      <Q title={`Your resume scored ${d.resume.score} out of 100.`} help="We filled in your last job, experience and skills from it. You will check each one next.">
        <dl className="divide-y divide-line rounded-[22px] bg-surface px-5">
          <div className="flex min-h-14 items-center justify-between gap-3"><dt className="text-sm text-muted">Last job found</dt><dd className="text-sm">{d.resume.occupation ?? "Not sure; you will pick it"}</dd></div>
          <div className="flex min-h-14 items-center justify-between gap-3"><dt className="text-sm text-muted">Skills found</dt><dd className="num text-sm">{d.resume.found}</dd></div>
          {d.resume.fixes.length > 0 && <div className="py-3"><dt className="text-sm text-muted">Fix first</dt><dd className="mt-1 text-sm"><ul className="list-disc pl-5">{d.resume.fixes.map((f) => <li key={f}>{f}</li>)}</ul></dd></div>}
        </dl>
        <p className="mt-3 text-sm text-muted">The full report, with before-and-after examples, is on <Link href="/resume" className="underline decoration-control underline-offset-2">Resume report</Link>. Your resume text was not saved.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Btn onClick={onDone} autoFocus className="min-h-12 px-6 text-base">Continue</Btn>
          <Btn variant="ghost" onClick={() => setD((x) => ({ ...x, resume: null }))}>Scan a different one</Btn>
        </div>
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
          <button type="button" onClick={() => pasteScan(SAMPLE_RESUME, true)} disabled={busy} className="press flex min-h-14 items-center rounded-2xl bg-surface px-5 text-left hover:bg-surface2">Use a made-up sample resume</button>
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
