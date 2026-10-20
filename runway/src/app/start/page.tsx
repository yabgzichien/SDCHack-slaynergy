"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, type Catalog } from "@/components/AppProvider";
import { Btn, Skeleton } from "@/components/ui";
import { SAMPLE_RESUME } from "@/lib/sample-resume";

// Onboarding: one question per screen. Nothing is saved until the last screen; the draft lives in this tab only.
type Draft = {
  name: string; age: string; occupationId: string; education: string; years: number; skills: string[];
  months: number; hours: number; interests: string[];
  resume: null | { score: number; band: string; occupation: string | null; found: number; fixes: string[] };
  touched: { education?: boolean; skills?: boolean };
};
const KEY = "runway-onboarding-v1";
const STEPS = ["name", "age", "resume", "job", "education", "years", "skills", "months", "hours", "interests", "review"] as const;
type Step = (typeof STEPS)[number];

const blank = (cat: Catalog): Draft => ({
  name: "", age: "", occupationId: "", education: "", years: 2, skills: [], months: 6, hours: 10, interests: [], resume: null, touched: {},
  ...(cat ? {} : {}),
});

export default function StartPage() {
  const { catalog, state } = useApp();
  if (!catalog || !state) return <Skeleton lines={3} />;
  return <Wizard cat={catalog} />;
}

function Wizard({ cat }: { cat: Catalog }) {
  const { act, busy, error, state } = useApp();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [d, setD] = useState<Draft>(() => {
    const p = state?.profile;
    if (p && !p.synthetic) return { ...blank(cat), name: p.name === "You" ? "" : p.name, age: p.age ? String(p.age) : "", occupationId: p.occupationId, education: p.education, years: p.years, skills: p.skills, months: p.months, hours: p.hoursPerWeek, interests: p.interests, touched: { education: true, skills: true } };
    return blank(cat);
  });
  // restore an unfinished draft from this tab
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) { const x = JSON.parse(raw) as { d: Draft; i: number }; setD(x.d); setI(Math.min(x.i, STEPS.length - 1)); }
    } catch { /* storage may be blocked; start fresh */ }
  }, []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ d, i })); } catch { /* ignore */ } }, [d, i]);

  const step: Step = STEPS[i];
  const occ = cat.occupations.find((o) => o.id === d.occupationId);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const pickJob = (id: string) => {
    const o = cat.occupations.find((x) => x.id === id)!;
    setD((x) => ({ ...x, occupationId: id, education: x.touched.education ? x.education : o.education, skills: x.touched.skills ? x.skills : [...new Set([...o.skills, ...(x.resume ? x.skills : [])])] }));
  };
  const canGo: Record<Step, boolean> = {
    name: true, age: d.age === "" || (Number(d.age) >= 16 && Number(d.age) <= 80), resume: true, job: !!occ, education: !!d.education, years: true,
    skills: d.skills.length > 0, months: true, hours: true, interests: true, review: !!occ && d.skills.length > 0,
  };
  const go = (n: number) => setI(Math.max(0, Math.min(STEPS.length - 1, n)));
  const next = () => { if (canGo[step]) go(i + 1); };
  const finish = async () => {
    const r = await act("setProfile", { profile: { name: d.name.trim() || "You", age: d.age ? Number(d.age) : null, occupationId: d.occupationId, education: d.education, years: d.years, skills: d.skills, interests: d.interests, months: d.months, hoursPerWeek: d.hours, budget: "free", synthetic: false } });
    if (r) { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } router.push("/skills"); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-10">
        <div className="h-1.5 rounded-full bg-surface2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1} aria-label="Onboarding progress">
          <div className="bar-fill h-full rounded-full bg-accent" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        </div>
        <p className="num mt-2 text-sm text-muted">Question {i + 1} of {STEPS.length}</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (step === "review") finish(); else next(); }}>
        {step === "name" && (
          <Q title="What should we call you?" help="Your first name is enough. You can skip this.">
            <TextInput value={d.name} onChange={(v) => set({ name: v })} placeholder="For example, Aina" maxLength={40} label="First name" autoComplete="given-name" />
          </Q>
        )}
        {step === "age" && (
          <Q title={`How old are you${d.name ? `, ${d.name}` : ""}?`} help="Optional. Only your counsellor sees it. Your age is never used to choose or rank jobs, and an automatic test checks this.">
            <TextInput value={d.age} onChange={(v) => set({ age: v.replace(/[^0-9]/g, "").slice(0, 2) })} placeholder="For example, 27" label="Age in years" inputMode="numeric" />
            {!canGo.age && <p className="mt-2 text-sm text-negative">Enter an age between 16 and 80, or leave it empty.</p>}
          </Q>
        )}
        {step === "resume" && <ResumeStep d={d} setD={setD} cat={cat} onDone={() => go(i + 1)} />}
        {step === "job" && (
          <Q title="What was your last job?" help={d.resume?.occupation ? "We picked this from your resume. Change it if it is wrong." : "Pick the closest one. It tells us which skills you probably have."}>
            <JobPicker cat={cat} value={d.occupationId} onPick={pickJob} />
          </Q>
        )}
        {step === "education" && (
          <Q title="What is your highest qualification?" help="Some jobs need a diploma or a degree. We use this only to check a job's entry requirement.">
            <Options value={d.education} onPick={(v) => set({ education: v, touched: { ...d.touched, education: true } })}
              options={cat.education.map((e) => ({ id: e.id, label: e.label }))} />
          </Q>
        )}
        {step === "years" && (
          <Q title="How many years did you work?" help="All your working years, not only the last job.">
            <Stepper value={d.years} min={0} max={40} onChange={(v) => set({ years: v })} unit={d.years === 1 ? "year" : "years"} />
          </Q>
        )}
        {step === "skills" && (
          <Q title="Which of these skills do you have?" help={`We filled these in from ${d.resume ? "your resume and " : ""}your last job${occ ? ` as ${occ.title.toLowerCase()}` : ""}. Untick any you do not have.`}>
            <SkillPicker cat={cat} value={d.skills} suggested={occ?.skills ?? []} onChange={(v) => set({ skills: v, touched: { ...d.touched, skills: true } })} />
          </Q>
        )}
        {step === "months" && (
          <Q title="How many months do you have to find a new job?" help="Support for job seekers usually lasts 3 to 6 months. Runway only ranks jobs you can reach in this time.">
            <Options value={String(d.months)} onPick={(v) => set({ months: Number(v) })} cols={3}
              options={[1, 2, 3, 4, 5, 6].map((m) => ({ id: String(m), label: `${m} ${m === 1 ? "month" : "months"}` }))} />
          </Q>
        )}
        {step === "hours" && (
          <Q title="How many hours a week can you study?" help="Be honest; a plan you can keep beats a plan that looks fast.">
            <Options value={String(d.hours)} onPick={(v) => set({ hours: Number(v) })} cols={3}
              options={[5, 8, 10, 15, 20, 30].map((h) => ({ id: String(h), label: `${h} hours` }))} />
          </Q>
        )}
        {step === "interests" && (
          <Q title="What kind of work interests you?" help="Pick up to three, or skip. They nudge the ranking a little and never hide a job.">
            <div className="flex flex-wrap gap-2">
              {cat.interests.map((x) => {
                const on = d.interests.includes(x.id);
                return (
                  <button type="button" key={x.id} aria-pressed={on} onClick={() => set({ interests: on ? d.interests.filter((y) => y !== x.id) : d.interests.length < 3 ? [...d.interests, x.id] : d.interests })}
                    className={`press min-h-12 rounded-full px-5 text-base ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>{x.label}</button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-muted">{d.interests.length} of 3 picked</p>
          </Q>
        )}
        {step === "review" && (
          <Q title="Is this right?" help="Change anything, then see your results.">
            <dl className="divide-y divide-line rounded-[22px] bg-surface px-5">
              {[
                ["Name", d.name || "Not given", 0],
                ["Age", d.age || "Not given", 1],
                ["Resume", d.resume ? `Scanned, ${d.resume.score} out of 100` : "Not scanned", 2],
                ["Last job", occ?.title ?? "Not chosen", 3],
                ["Qualification", cat.education.find((e) => e.id === d.education)?.label ?? "Not chosen", 4],
                ["Experience", `${d.years} ${d.years === 1 ? "year" : "years"}`, 5],
                ["Skills", `${d.skills.length} skills`, 6],
                ["Time to find a job", `${d.months} months`, 7],
                ["Study time", `${d.hours} hours a week`, 8],
                ["Interests", d.interests.length ? d.interests.map((x) => cat.interests.find((y) => y.id === x)?.label).join(", ") : "None picked", 9],
              ].map(([k, v, n]) => (
                <div key={k as string} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="flex items-center gap-3 text-right text-sm">{v}<button type="button" onClick={() => go(n as number)} className="underline decoration-control underline-offset-2 hover:text-ink">Change</button></dd>
                </div>
              ))}
            </dl>
            {error && <p role="alert" className="mt-3 text-sm text-negative">{error}</p>}
          </Q>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          {i > 0 ? <Btn variant="quiet" onClick={() => go(i - 1)}>Back</Btn> : <Link href="/" className="text-sm underline decoration-control underline-offset-2">Cancel</Link>}
          <div className="flex items-center gap-2">
            {(step === "name" || step === "age" || step === "interests") && <Btn variant="quiet" onClick={() => { if (step === "age") set({ age: "" }); if (step === "name") set({ name: "" }); go(i + 1); }}>Skip</Btn>}
            {step === "review"
              ? <Btn type="submit" disabled={busy || !canGo.review} className="min-h-12 px-6 text-base">Show my results</Btn>
              : step !== "resume" && <Btn type="submit" disabled={!canGo[step]} className="min-h-12 px-6 text-base">Continue</Btn>}
          </div>
        </div>
      </form>
    </div>
  );
}

function Q({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, [title]);
  return (
    <section>
      <h1 ref={ref} tabIndex={-1} className="greeting text-[2rem] outline-none sm:text-[2.6rem]">{title}</h1>
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

function Options({ value, onPick, options, cols = 1 }: { value: string; onPick: (v: string) => void; options: { id: string; label: string; sub?: string }[]; cols?: 1 | 3 }) {
  return (
    <div role="radiogroup" className={`grid gap-2 ${cols === 3 ? "grid-cols-2 sm:grid-cols-3" : ""}`}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button type="button" role="radio" aria-checked={on} key={o.id} onClick={() => onPick(o.id)}
            className={`press flex min-h-14 items-center justify-between rounded-2xl px-5 text-left text-base ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
            <span>{o.label}{o.sub && <span className="block text-sm opacity-70">{o.sub}</span>}</span>
            {on && <span aria-hidden>✓</span>}
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
  const scan = async (init: RequestInit) => {
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
          years: a.years ?? x.years,
          skills: [...new Set([...a.skills.map((s) => s.id), ...(occ ? occ.skills : [])])],
          resume: { score: a.score, band: a.band, occupation: occ ? occ.title : null, found: a.skills.length, fixes: a.findings.filter((f) => f.severity === "fix").slice(0, 2).map((f) => f.title) },
          touched: { ...x.touched, education: a.education ? true : x.touched.education },
        };
      });
    } catch { setErr("Network problem. Please try again."); }
    finally { setBusy(false); }
  };
  const upload = (f: File) => { const fd = new FormData(); fd.append("file", f); scan({ method: "POST", body: fd }); };
  const pasteScan = (t: string) => scan({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });

  if (d.resume) {
    return (
      <Q title={`Your resume scored ${d.resume.score} out of 100.`} help="We filled in your last job, experience and skills from it. You will check each one next.">
        <dl className="divide-y divide-line rounded-[22px] bg-surface px-5">
          <div className="flex min-h-14 items-center justify-between gap-3"><dt className="text-sm text-muted">Last job found</dt><dd className="text-sm">{d.resume.occupation ?? "Not sure; you will pick it"}</dd></div>
          <div className="flex min-h-14 items-center justify-between gap-3"><dt className="text-sm text-muted">Skills found</dt><dd className="num text-sm">{d.resume.found}</dd></div>
          {d.resume.fixes.length > 0 && <div className="py-3"><dt className="text-sm text-muted">Fix first</dt><dd className="mt-1 text-sm">{d.resume.fixes.join(". ")}.</dd></div>}
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
          <button type="button" onClick={() => pasteScan(SAMPLE_RESUME)} disabled={busy} className="press flex min-h-14 items-center rounded-2xl bg-surface px-5 text-left hover:bg-surface2">Use a made-up sample resume</button>
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
