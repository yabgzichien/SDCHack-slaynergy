"use client";

import "./courses.css";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Check, Clock3, ExternalLink, GraduationCap, Landmark, RotateCcw } from "lucide-react";
import coursesJson from "../../../data/courses.json";
import skillsJson from "../../../data/skills.json";
import logosJson from "../../../data/logos.json";
import { logoDomain } from "@/lib/logo-domain.mjs";
import type { Course } from "@/lib/engine/data";
import type { PlanStep } from "@/lib/engine/plan";
import { useApp } from "@/components/AppProvider";

// The real course list (data/courses.json): the same courses the plan is built from, each link checked on a date.
const COURSES = (coursesJson as unknown as Course[]).filter((c) => !c.catalogOnly);
const PROGRAMMES = (coursesJson as unknown as Course[]).filter((c) => c.catalogOnly);
const SKILL_NAME: Record<string, string> = Object.fromEntries((skillsJson as unknown as { id: string; name: string }[]).map((s) => [s.id, s.name]));
const SKILL_OPTIONS = [...new Set(COURSES.flatMap((c) => c.skills))].filter((id) => SKILL_NAME[id]).sort((a, b) => SKILL_NAME[a].localeCompare(SKILL_NAME[b]));
const GAPS = "gaps", ALL = "all";
const LOGOS = new Set(logosJson as string[]);
// The provider's own site icon (saved in public/logos by scripts/fetch-logos.mjs), or a book if it has none.
function Logo({ c, size = 46, fallback: Fallback = BookOpen }: { c: { provider: string; url: string }; size?: number; fallback?: typeof BookOpen }) {
  const d = logoDomain(c);
  return (
    <span className="courses-logo" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local icons, no optimisation needed */}
      {LOGOS.has(d) ? <img src={`/logos/${d}.png`} alt="" width={size * 0.62} height={size * 0.62} /> : <Fallback size={size * 0.5} strokeWidth={1.5} aria-hidden />}
    </span>
  );
}
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const weeks = (s: PlanStep) => (s.weekStart === s.weekEnd ? `week ${s.weekStart}` : `weeks ${s.weekStart} to ${s.weekEnd}`);
const covers = (c: Course, key: string) => key.split("+").every((k) => c.skills.includes(k));

export default function CoursesPage() {
  return <Suspense fallback={null}><Courses /></Suspense>;
}

// One question: which real course should I take for each skill I need, and how far am I?
function Courses() {
  const { view, state, act, busy } = useApp();
  const params = useSearchParams();
  const plan = view?.plan ?? null;
  const gaps = useMemo(() => view?.chosen?.gaps.map((g) => g.skillId) ?? [], [view]);
  const planSteps = useMemo(() => plan?.steps.filter((s) => s.course || s.kind === "programme") ?? [], [plan]);
  const swapSteps = planSteps.filter((s) => s.skillKey);
  const [skill, setSkill] = useState<string>(() => {
    const p = params.get("skill");
    return p && SKILL_NAME[p] ? p : GAPS;
  });
  const [cost, setCost] = useState<"any" | "free">("any");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const prog = state?.progress ?? {};
  const effSkill = skill === GAPS && !gaps.length ? ALL : skill;

  const visible = useMemo(() => {
    const text = q.trim().toLowerCase();
    return COURSES.filter((c) =>
      (effSkill === ALL || (effSkill === GAPS ? c.skills.some((s) => gaps.includes(s)) : c.skills.includes(effSkill))) &&
      (cost === "any" || c.funding === "Free") &&
      (!text || `${c.title} ${c.provider} ${c.skills.map((s) => SKILL_NAME[s]).join(" ")}`.toLowerCase().includes(text)),
    ).sort((a, b) => b.skills.filter((s) => gaps.includes(s)).length - a.skills.filter((s) => gaps.includes(s)).length || a.hours - b.hours);
  }, [effSkill, cost, q, gaps]);

  const swap = async (key: string, courseId: string | null, label: string) => {
    setMsg(null);
    const r = await act("swapCourse", { skillKey: key, courseId });
    setMsg(r ? label : "That change could not be saved. Please try again.");
  };

  return (
    <div className="courses-page">
      <section className="courses-hero" aria-labelledby="courses-title">
        <div className="courses-hero-copy">
          <span className="courses-kicker">LEARN FOR WHAT COMES NEXT</span>
          <h1 id="courses-title">Courses for your <em>next step.</em></h1>
          <p>{COURSES.length} real, free or low-cost online courses from providers such as Microsoft Learn, Khan Academy, Google and Harvard CS50, plus Malaysia&apos;s own programmes. Your plan is built from this same list.</p>
          <span className="courses-preview-note">Every link was checked on the date shown. Hours are estimates. We do not run these courses or track them; you tick a course off when you finish it.</span>
        </div>
        <div className="courses-hero-art" aria-hidden="true"><div className="courses-hero-icon"><GraduationCap size={46} strokeWidth={1.4} /></div><div className="courses-hero-line" /><span>Learn a little. Move forward.</span></div>
      </section>

      {plan ? (
        <section className="courses-catalog" aria-labelledby="courses-plan-title">
          <div className="courses-section-head">
            <div><span className="courses-kicker">IN YOUR PLAN</span><h2 id="courses-plan-title">Your courses for {plan.title}</h2><p>Ticks here and in your plan are the same. Want a different course for a skill? Pick one below and press &quot;Use this instead&quot;.</p></div>
            <div className="courses-count"><BookOpen size={18} aria-hidden /><span>{planSteps.filter((s) => prog[s.id]).length} of {planSteps.length} done</span></div>
          </div>
          <ul className="courses-plan">
            {planSteps.map((s) => (
              <li key={s.id} className={prog[s.id] ? "is-done" : ""}>
                {s.url && s.provider ? <Logo c={{ provider: s.provider, url: s.url }} size={38} /> : <span />}
                <input type="checkbox" checked={!!prog[s.id]} disabled={busy} aria-label={`Mark ${s.title} as done`} onChange={(e) => act("progress", { stepId: s.id, done: e.target.checked })} />
                <div>
                  <p className="courses-plan-title">{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}<ExternalLink size={13} aria-hidden /></a> : s.title}</p>
                  <p className="courses-plan-meta">{s.provider ? `${s.provider} · ` : ""}{weeks(s)} · about {s.hours} {s.hours === 1 ? "hour" : "hours"} · {s.cost}{s.swapped ? " · your choice" : ""}</p>
                  {s.skills.length > 0 && <p className="courses-plan-meta">For: {s.skills.map((k) => k.name).join(", ")}</p>}
                </div>
                <div className="courses-plan-actions">
                  {s.skillKey && !!s.alternatives && <button onClick={() => { setSkill(s.skillKey!.split("+")[0]); document.getElementById("courses-catalog-title")?.scrollIntoView({ behavior: "smooth" }); }}>Other courses</button>}
                  {s.swapped && <button onClick={() => swap(s.skillKey!, null, "Back to the suggested course.")} disabled={busy}><RotateCcw size={13} aria-hidden /> Suggested</button>}
                </div>
              </li>
            ))}
          </ul>
          {msg && <p role="status" className="courses-footnote">{msg}</p>}
          <p className="courses-footnote"><Link href="/plan">Open your full plan</Link>, with the AI practice, resume and interview steps.</p>
        </section>
      ) : (
        <section className="courses-catalog"><div className="courses-empty"><BookOpen size={26} aria-hidden /><h3>No plan yet</h3><p>Choose a job and the courses for your skill gaps appear here, in order, with weeks.</p><Link href={state?.profile ? "/jobs" : "/start"} className="courses-action">{state?.profile ? "Choose a job" : "Get started"} <ArrowRight size={16} aria-hidden /></Link></div></section>
      )}

      <section className="courses-catalog" aria-labelledby="courses-my-title">
        <div className="courses-section-head"><div><span className="courses-kicker">MALAYSIAN PROGRAMMES</span><h2 id="courses-my-title">Free help from the government</h2><p>Platforms, not single courses. Ask an advisor which one fits you.</p></div></div>
        <div className="courses-grid">
          {PROGRAMMES.map((c) => (
            <article key={c.id} className="courses-card">
              <div className="courses-card-top"><span className="courses-topic">{c.funding === "Free" ? "Government" : c.funding}</span><span className="courses-topic">{c.cost}</span></div>
              <div className="courses-card-icon-row"><Logo c={c} fallback={Landmark} /></div>
              <h3>{c.title}</h3>
              <p>{c.note}</p>
              <div className="courses-card-bottom">
                <span className="courses-duration">{c.provider} · link checked {day(c.checked)}</span>
                <a href={c.url} target="_blank" rel="noreferrer" className="courses-action">Open the website <ExternalLink size={15} aria-hidden /></a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="courses-catalog" aria-labelledby="courses-catalog-title">
        <div className="courses-section-head"><div><span className="courses-kicker">ALL COURSES</span><h2 id="courses-catalog-title">Find a course</h2><p>{gaps.length ? "Courses for the skills your chosen job needs come first." : "Choose a job to see the courses for your skill gaps first."}</p></div></div>
        <div className="courses-controls">
          <div className="courses-field">
            <label htmlFor="course-skill">Skill</label>
            <select id="course-skill" value={effSkill} onChange={(e) => setSkill(e.target.value)}>
              {gaps.length > 0 && <option value={GAPS}>Your skill gaps ({gaps.length})</option>}
              <option value={ALL}>All skills</option>
              {SKILL_OPTIONS.map((id) => <option key={id} value={id}>{SKILL_NAME[id]}{gaps.includes(id) ? " (you need this)" : ""}</option>)}
            </select>
          </div>
          <div className="courses-field">
            <label htmlFor="course-cost">Cost</label>
            <select id="course-cost" value={cost} onChange={(e) => setCost(e.target.value as "any" | "free")}><option value="any">Free or partly free</option><option value="free">Completely free</option></select>
          </div>
          <div className="courses-field">
            <label htmlFor="course-q">Search</label>
            <input id="course-q" className="courses-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Excel, SQL, Python…" />
          </div>
          <span className="courses-results" aria-live="polite">{visible.length} {visible.length === 1 ? "course" : "courses"}</span>
        </div>
        {visible.length ? (
          <div className="courses-grid">
            {visible.map((c) => {
              const inPlan = planSteps.find((s) => s.course?.id === c.id);
              const target = inPlan ? null : swapSteps.find((s) => covers(c, s.skillKey!));
              const ok = c.linkStatus === "200";
              return (
                <article className="courses-card" key={c.id}>
                  <div className="courses-card-top"><span className="courses-topic">{c.provider}</span>{inPlan ? <span className="courses-inplan"><Check size={12} aria-hidden /> In your plan, {weeks(inPlan)}</span> : <span className="courses-topic">{c.funding === "Free" ? "Free" : "Partly free"}</span>}</div>
                  <div className="courses-card-icon-row"><Logo c={c} /></div>
                  <h3><a href={c.url} target="_blank" rel="noreferrer">{c.title}</a></h3>
                  {c.funding !== "Free" && <p>{c.cost}</p>}
                  <div className="courses-skills" aria-label="Skills covered">{c.skills.map((s) => <span key={s} className={gaps.includes(s) ? "is-gap" : ""}>{SKILL_NAME[s] ?? s}</span>)}</div>
                  <div className="courses-card-bottom">
                    <span className="courses-duration"><Clock3 size={15} aria-hidden />About {c.hours} {c.hours === 1 ? "hour" : "hours"} · {ok ? `link checked ${day(c.checked)}` : "this site blocks automatic checks; open it to confirm"}</span>
                    {target ? (
                      <button className="courses-action" disabled={busy} onClick={() => swap(target.skillKey!, c.id, `Your plan now uses "${c.title}" for ${target.skills.map((k) => k.name.toLowerCase()).join(", ")}.`)}>Use this instead of &quot;{target.title}&quot;</button>
                    ) : (
                      <a href={c.url} target="_blank" rel="noreferrer" className="courses-action">Open the course <ExternalLink size={15} aria-hidden /></a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="courses-empty"><BookOpen size={26} aria-hidden /><h3>No courses match</h3><p>Try another skill or clear the search.</p><button onClick={() => { setSkill(ALL); setQ(""); setCost("any"); }}>Show all courses</button></div>
        )}
        <p className="courses-footnote">Courses are run by their providers, not by Jobbery. Free means free to learn; some providers charge for a certificate.</p>
      </section>
    </div>
  );
}
