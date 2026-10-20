"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Finding, ResumeAnalysis } from "@/lib/engine/resume";
import { useApp } from "@/components/AppProvider";
import { ScoreRing } from "@/components/ScoreRing";
import { Segmented } from "@/components/Segmented";
import { Btn, Card, Chip, H, PageTitle, Skeleton } from "@/components/ui";

type Tab = "fixes" | "resume" | "skills";

export default function ResumePage() {
  const { catalog, state } = useApp();
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const scan = useCallback(async (init: RequestInit, name: string) => {
    setScanning(true); setError(null); setFileName(name);
    try {
      const r = await fetch("/api/resume", init);
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Something went wrong."); setAnalysis(null); }
      else setAnalysis(d.analysis);
    } catch { setError("Network problem. Please try again."); }
    finally { setScanning(false); }
  }, []);

  if (!catalog || !state) return <Skeleton lines={5} />;
  return (
    <div>
      <PageTitle step="Step 1 of 4 · You" title={analysis ? "Here is what we found" : "Scan your resume"}>
        {analysis ? "Your score, what to fix first, and the skills we found. Check the details, then build your plan." : "We read it, show you what to improve, and fill in your skills so you do not have to type them."}
      </PageTitle>
      {!analysis ? <Intake scanning={scanning} error={error} onScan={scan} /> : <Result analysis={analysis} fileName={fileName} onAgain={() => { setAnalysis(null); setError(null); }} />}
    </div>
  );
}

function Intake({ scanning, error, onScan }: { scanning: boolean; error: string | null; onScan: (init: RequestInit, name: string) => void }) {
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [sample, setSample] = useState(false);
  const sendFile = (f: File) => { const fd = new FormData(); fd.append("file", f); onScan({ method: "POST", body: fd }, f.name); };
  const sendText = (t: string, name: string) => onScan({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) }, name);
  const loadSample = async () => { const m = await import("@/lib/sample-resume"); setSample(true); setText(m.SAMPLE_RESUME); };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) sendFile(f); }}
          className={`rounded-3xl border-2 border-dashed p-8 text-center transition-transform duration-200 ${drag ? "drop-active border-accent bg-accentsoft" : "border-line bg-surface"}`}>
          <p aria-hidden className="text-4xl">📄</p>
          <p className="mt-2 text-lg font-bold">Drop your resume here</p>
          <p className="mt-1 text-sm text-muted">PDF, Word (.docx) or text · up to 3 MB</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Btn onClick={() => input.current?.click()} disabled={scanning}>Choose a file</Btn>
            <Btn variant="ghost" onClick={loadSample} disabled={scanning}>Use a sample resume</Btn>
          </div>
          <input ref={input} type="file" accept=".pdf,.docx,.txt,.md,application/pdf" className="sr-only" aria-label="Choose a resume file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ""; }} />
        </div>

        <details open={sample} className="rounded-3xl border border-line bg-surface p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">Or paste the text</summary>
          <label className="block">
            <span className="sr-only">Resume text</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste your resume text here…" className="mt-2 w-full rounded-2xl border border-line bg-bg p-3 text-sm" />
          </label>
          {sample && <p className="mt-1 text-xs text-muted">A made-up resume for Hafiz (not a real person).</p>}
          <div className="mt-2"><Btn onClick={() => sendText(text, sample ? "Sample resume" : "Pasted text")} disabled={scanning || text.trim().split(/\s+/).length < 40}>Scan this text</Btn></div>
        </details>

        {scanning && <Card><p className="font-semibold">Reading your resume…</p><p className="text-sm text-muted">Finding sections, skills and wording. This takes a moment.</p></Card>}
        {error && <p role="alert" className="rounded-2xl bg-fallsoft p-4 text-sm text-fall">{error}</p>}
      </div>

      <div className="space-y-4">
        <Card tone="accent">
          <H>Your resume stays private</H>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>It is read in memory for this scan only. It is <b>never saved</b>.</li>
            <li>We keep only your score and the skills you confirm.</li>
            <li>No AI model reads it. The scan uses plain rules you can inspect.</li>
            <li>Age, gender and background are never used.</li>
          </ul>
        </Card>
        <Card>
          <H>What you will get</H>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>A score out of 100 and your top fixes, with before and after examples</li>
            <li>Your resume with problem lines highlighted</li>
            <li>The skills we found, each with a shelf life</li>
            <li>How well it fits each job we suggest</li>
          </ul>
        </Card>
        <p className="text-sm text-muted">No resume at hand? <a className="font-semibold text-accent underline" href="/profile">Answer a few questions instead</a>.</p>
      </div>
    </div>
  );
}

function Result({ analysis: a, fileName, onAgain }: { analysis: ResumeAnalysis; fileName: string | null; onAgain: () => void }) {
  const { catalog, act, busy, state } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("fixes");
  const cat = catalog!;
  const [occ, setOcc] = useState(a.occupation?.id ?? cat.occupations[0].id);
  const [years, setYears] = useState(Math.round(a.years ?? 2));
  const [edu, setEdu] = useState<string>(a.education ?? cat.occupations.find((o) => o.id === (a.occupation?.id ?? cat.occupations[0].id))?.education ?? "diploma");
  const [chosen, setChosen] = useState<string[]>(a.skills.map((s) => s.id));
  const [months, setMonths] = useState(state?.profile?.months ?? 5);
  const [hours, setHours] = useState(state?.profile?.hoursPerWeek ?? 10);
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const fixes = a.findings.filter((f) => f.severity === "fix");
  const potential = Math.min(100 - a.score, Math.round(fixes.slice(0, 3).reduce((x, f) => x + (f.points.of - f.points.got), 0)));
  const bandColor = a.band === "strong" ? "var(--rise)" : a.band === "good" ? "var(--accent)" : "var(--fall)";
  const inferredOnly = a.inferred.filter((i) => !a.skills.some((s) => s.id === i.id));

  const build = async () => {
    const r = await act("setProfile", { profile: { name: "You", occupationId: occ, education: edu, years, skills: chosen, interests: [], months, hoursPerWeek: hours, budget: "free", synthetic: fileName === "Sample resume" } });
    if (r) router.push("/skills");
  };

  return (
    <div className="space-y-5">
      <Card className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto"><ScoreRing value={a.score} label="resume score" color={bandColor} /></div>
        <div>
          <Chip tone={a.band === "strong" ? "rise" : a.band === "good" ? "accent" : "fall"}>{a.band === "needs work" ? "Needs work" : a.band === "good" ? "Good start" : "Strong"}</Chip>
          <h2 className="mt-2 text-2xl font-bold">{a.headline}</h2>
          {potential > 0 && <p className="mt-1 text-muted">Fixing the top {Math.min(3, fixes.length)} items could add up to <b className="num text-ink">{potential} points</b>.</p>}
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[["Skills found", String(a.skills.length)], ["Experience", a.years ? `${a.years} yrs` : "–"], ["Words", String(a.words)]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-surface2 p-3"><dd className="num text-xl font-bold">{v}</dd><dt className="text-xs text-muted">{k}</dt></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">Scanned: {fileName}. <button onClick={onAgain} className="font-semibold text-accent underline">Scan another</button></p>
        </div>
      </Card>

      <Card tone="accent">
        <H sub="Check what we found. Untick anything that is not true. Then we show which of your skills will last and which jobs you can reach.">Use this to plan your next job</H>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">Your last job
            <select value={occ} onChange={(e) => setOcc(e.target.value)} className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-surface px-3">
              {cat.occupations.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
            {a.occupation && !a.occupation.confident && <span className="text-xs text-muted">We were not sure; please check.</span>}
          </label>
          <label className="block text-sm font-medium">Highest qualification
            <select value={edu} onChange={(e) => setEdu(e.target.value)} className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-surface px-3">
              {cat.education.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <span className="text-xs text-muted">{a.education ? "Found on your resume. " : ""}Some jobs need a diploma or degree, so this decides which jobs we can suggest.</span>
          </label>
          <label className="block text-sm font-medium">Years of experience: <b className="num">{years}</b>
            <input type="range" min={0} max={20} value={years} onChange={(e) => setYears(+e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Months to find a job: <b className="num">{months}</b>
            <input type="range" min={1} max={6} value={months} onChange={(e) => setMonths(+e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Study hours a week: <b className="num">{hours}</b>
            <input type="range" min={2} max={30} value={hours} onChange={(e) => setHours(+e.target.value)} />
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Skills on your resume</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {a.skills.map((s) => (
              <button type="button" key={s.id} aria-pressed={chosen.includes(s.id)} onClick={() => toggle(s.id)}
                className={`press min-h-10 rounded-full border px-4 text-sm ${chosen.includes(s.id) ? "border-accent bg-accent font-semibold text-accentink" : "border-line bg-surface"}`}>{s.name}</button>
            ))}
          </div>
          {inferredOnly.length > 0 && (
            <>
              <p className="mt-3 text-sm font-semibold">Common for your job but not on your resume <span className="font-normal text-muted">(tick only if you have them)</span></p>
              <div className="mt-2 flex flex-wrap gap-2">
                {inferredOnly.map((s) => (
                  <button type="button" key={s.id} aria-pressed={chosen.includes(s.id)} onClick={() => toggle(s.id)}
                    className={`press min-h-10 rounded-full border border-dashed px-4 text-sm ${chosen.includes(s.id) ? "border-accent bg-accent font-semibold text-accentink" : "border-line bg-surface"}`}>{s.name}</button>
                ))}
              </div>
            </>
          )}
        </fieldset>
        <div className="mt-5"><Btn onClick={build} disabled={busy || chosen.length === 0} className="min-h-12 px-6 text-base">Show my skills&apos; shelf life →</Btn></div>
      </Card>

      <div className="flex justify-center"><Segmented label="Result details" value={tab} onChange={setTab} options={[{ id: "fixes", label: `Fixes (${a.findings.filter((f) => f.severity !== "good").length})` }, { id: "resume", label: "Your resume" }, { id: "skills", label: "Skills found" }]} /></div>
      {tab === "fixes" && <Fixes analysis={a} onJump={() => setTab("resume")} />}
      {tab === "resume" && <Annotated analysis={a} />}
      {tab === "skills" && <SkillsFound analysis={a} />}
    </div>
  );
}

const SEV: Record<string, { label: string; tone: "fall" | "accent" | "rise" }> = { fix: { label: "Fix first", tone: "fall" }, improve: { label: "Worth improving", tone: "accent" }, good: { label: "Looks good", tone: "rise" } };

function Fixes({ analysis: a, onJump }: { analysis: ResumeAnalysis; onJump: () => void }) {
  const groups: ("fix" | "improve" | "good")[] = ["fix", "improve", "good"];
  return (
    <div className="space-y-6">
      <Card>
        <H sub="Points for each area. A full bar is the most you can get.">Where your points come from</H>
        <ul className="space-y-2.5">
          {a.parts.map((p) => (
            <li key={p.key}>
              <div className="flex justify-between text-sm"><span>{p.label}</span><span className="num font-semibold">{p.got} / {p.of}</span></div>
              <div className="mt-1 h-2 rounded-full bg-surface2"><div className="bar-fill h-full rounded-full bg-accent" style={{ width: `${(p.got / p.of) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </Card>
      {groups.map((g) => {
        const list = a.findings.filter((f) => f.severity === g);
        if (!list.length) return null;
        return (
          <section key={g} aria-labelledby={`g-${g}`}>
            <h3 id={`g-${g}`} className="mb-2 flex items-center gap-2 text-lg font-bold"><Chip tone={SEV[g].tone}>{SEV[g].label}</Chip> <span className="num text-sm font-normal text-muted">{list.length}</span></h3>
            <ul className="space-y-3">{list.map((f) => <li key={f.id}><FindingCard f={f} onJump={onJump} /></li>)}</ul>
          </section>
        );
      })}
    </div>
  );
}

function FindingCard({ f, onJump }: { f: Finding; onJump: () => void }) {
  return (
    <Card tone={f.severity === "fix" ? "fall" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-bold leading-snug">{f.title}</h4>
        {f.severity !== "good" && f.points.of > 0 && <Chip>up to +{Math.round((f.points.of - f.points.got) * 10) / 10} points</Chip>}
      </div>
      <p className="mt-1.5 text-sm text-muted">{f.why}</p>
      <p className="mt-2 text-sm"><b>What to do:</b> {f.fix}</p>
      {f.example && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface2 p-3 text-sm"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Before</p><p className="mt-1">{f.example.before}</p></div>
          <div className="rounded-2xl bg-risesoft p-3 text-sm"><p className="text-xs font-semibold uppercase tracking-wide text-rise">After (fill in the brackets)</p><p className="mt-1">{f.example.after}</p></div>
        </div>
      )}
      {f.evidence && f.evidence.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-10 cursor-pointer py-1.5 text-sm font-semibold text-accent">Where we saw it ({f.evidence.length})</summary>
          <ul className="mt-1 space-y-1 text-sm">
            {f.evidence.map((e) => <li key={e.n} className="rounded-xl bg-surface2 px-3 py-2"><button onClick={() => { onJump(); setTimeout(() => document.getElementById(`line-${e.n}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 80); }} className="mr-2 font-semibold text-accent underline">Line {e.n}</button>{e.text}</li>)}
          </ul>
        </details>
      )}
    </Card>
  );
}

function Annotated({ analysis: a }: { analysis: ResumeAnalysis }) {
  return (
    <Card>
      <H sub="Highlighted lines are the ones to improve. Only you see this; it is not saved.">Your resume, line by line</H>
      <p className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="hl-weak px-1.5 py-0.5">Weak opening</span>
        <span className="hl-nonum px-1.5 py-0.5">No number</span>
        <span className="hl-long px-1.5 py-0.5">Too long</span>
        <span className="hl-personal px-1.5 py-0.5">Personal detail</span>
        <span className="hl-strong px-1.5 py-0.5">Strong</span>
      </p>
      <ol className="space-y-1 font-mono text-[13px] leading-relaxed">
        {a.lines.map((l) => {
          const cls = l.flags.includes("personal") ? "hl-personal" : l.flags.includes("weak") ? "hl-weak" : l.flags.includes("long") ? "hl-long" : l.flags.includes("strong") && l.flags.includes("number") ? "hl-strong" : "";
          return (
            <li key={l.n} id={`line-${l.n}`} className="flex scroll-mt-28 gap-3">
              <span className="num w-6 shrink-0 select-none text-right text-muted">{l.n}</span>
              <span className={`${cls} px-1`}>{l.text}{l.flags.includes("weak") ? "  ← weak opening" : l.flags.includes("long") ? "  ← too long" : ""}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function SkillsFound({ analysis: a }: { analysis: ResumeAnalysis }) {
  const group = (shelf: "fading" | "mid" | "lasting", title: string, hint: string, tone: "fall" | "neutral" | "rise") => {
    const list = a.skills.filter((s) => s.shelf === shelf);
    if (!list.length) return null;
    return (
      <section>
        <h3 className="text-base font-bold">{title} <span className="num font-normal text-muted">({list.length})</span></h3>
        <p className="mb-2 text-sm text-muted">{hint}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map((s) => (
            <li key={s.id} className="rounded-2xl border border-line bg-surface p-3">
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm text-muted">Found: {s.hits.map((h) => `“${h}”`).join(", ")}</p>
              <p className={`mt-1 text-sm font-medium ${tone === "fall" ? "text-fall" : tone === "rise" ? "text-rise" : "text-muted"}`}>Shelf life ≈ {s.expires >= 2040 ? "after 2040" : Math.round(s.expires)}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  };
  return (
    <Card className="space-y-5">
      <p className="text-sm text-muted">Shelf life is when AI is expected to do most of the work behind a skill. These are estimates, not predictions of certainty, weighted by the three futures.</p>
      {group("fading", "Fading soonest", "Keep them, but put your judgment and customer skills first.", "fall")}
      {group("mid", "Medium", "Useful for years, worth pairing with a lasting skill.", "neutral")}
      {group("lasting", "Likely to last", "Lead with these.", "rise")}
      {a.skills.length === 0 && <p>We could not find any skills. Try the text paste option, or answer the questions instead.</p>}
    </Card>
  );
}
