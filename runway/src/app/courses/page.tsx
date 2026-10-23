"use client";

import "./courses.css";
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Check, Clock3, ExternalLink, GraduationCap, Landmark, RotateCcw, Search } from "lucide-react";
import coursesJson from "../../../data/courses.json";
import skillsJson from "../../../data/skills.json";
import logosJson from "../../../data/logos.json";
import { logoDomain } from "@/lib/logo-domain.mjs";
import type { Course } from "@/lib/engine/data";
import type { PlanStep } from "@/lib/engine/plan";
import { useApp } from "@/components/AppProvider";
import { Card, H } from "@/components/ui";
import "@/app/trends/trends.css";

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
  const pageRef = useRef<HTMLDivElement>(null);
  const ready = Boolean(view);
  // The statistics page's scroll reveal: each card rises in once as it enters; nothing moves with reduced motion.
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!ready || !page || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const parts = page.querySelectorAll<HTMLElement>(".statistics-reveal");
    const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } }, { rootMargin: "0px 0px -24px 0px", threshold: 0 });
    page.classList.add("statistics-motion-ready");
    parts.forEach((el) => io.observe(el));
    return () => { io.disconnect(); page.classList.remove("statistics-motion-ready"); parts.forEach((el) => el.classList.remove("is-visible")); };
  }, [ready]);

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

  const done = planSteps.filter((s) => prog[s.id]).length;
  const selectCls = "min-h-11 w-full appearance-none rounded-xl border border-control bg-raised px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cue";

  return (
    <div className="statistics-page courses-page" ref={pageRef}>
      <header className="statistics-hero statistics-reveal">
        <h1 className="statistics-hero-title"><span className="statistics-headline-highlight">Courses for your next step</span></h1>
        <div className="statistics-hero-banner">
          <span className="statistics-hero-icon" aria-hidden="true"><GraduationCap size={30} strokeWidth={2.4} /></span>
          <p>{`${COURSES.length} real, free or low-cost online courses from providers such as Microsoft Learn, Khan Academy, Google and Harvard CS50, plus Malaysia's own programmes. Your plan is built from this same list. Every link was checked on the date shown, and hours are estimates.`}</p>
        </div>
        <div className="statistics-hero-art" aria-hidden="true">
          <Image src="/cockatiel-reading.png" alt="" width={300} height={300} className="statistics-hero-mascot" priority />
        </div>
      </header>

      {plan ? (
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-learning-heading">
            <H sub="Ticks here and in your plan are the same. Want a different course for a skill? Pick one below and press “Use this instead”.">Your courses for {plan.title}</H>
            <Image src="/cockatiel-welcome.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={planSteps.length} aria-valuenow={done} aria-label="Courses done">
              <div className="h-full rounded-full bg-rise transition-all" style={{ width: `${planSteps.length ? (done / planSteps.length) * 100 : 0}%` }} />
            </div>
            <span className="num shrink-0 text-sm font-semibold">{`${done} of ${planSteps.length} done`}</span>
          </div>
          <ul className="space-y-1.5">
            {planSteps.map((s) => (
              <li key={s.id} className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ${prog[s.id] ? "bg-risesoft" : "bg-raised"}`}>
                <input type="checkbox" className="courses-tick" checked={!!prog[s.id]} disabled={busy} aria-label={`Mark ${s.title} as done`} onChange={(e) => act("progress", { stepId: s.id, done: e.target.checked })} />
                {s.url && s.provider ? <Logo c={{ provider: s.provider, url: s.url }} size={38} /> : null}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${prog[s.id] ? "text-muted line-through" : ""}`}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{s.title}<ExternalLink size={13} aria-hidden /></a> : s.title}</p>
                  <p className="text-xs text-muted">{s.provider ? `${s.provider} · ` : ""}{weeks(s)} · about {s.hours} {s.hours === 1 ? "hour" : "hours"} · {s.cost}{s.swapped ? " · your choice" : ""}</p>
                  {s.skills.length > 0 && <p className="text-xs text-muted">For: {s.skills.map((k) => k.name).join(", ")}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.skillKey && !!s.alternatives && <button className="press min-h-9 rounded-full bg-surface2 px-3 text-xs font-medium hover:bg-control/60" onClick={() => { setSkill(s.skillKey!.split("+")[0]); document.getElementById("courses-catalog-title")?.scrollIntoView({ behavior: "smooth" }); }}>Other courses</button>}
                  {s.swapped && <button className="press inline-flex min-h-9 items-center gap-1 rounded-full bg-surface2 px-3 text-xs font-medium hover:bg-control/60" onClick={() => swap(s.skillKey!, null, "Back to the suggested course.")} disabled={busy}><RotateCcw size={13} aria-hidden /> Suggested</button>}
                </div>
              </li>
            ))}
          </ul>
          {msg && <p role="status" className="mt-3 text-sm font-medium text-rise">{msg}</p>}
          <p className="mt-3 text-sm text-muted"><Link href="/plan" className="font-semibold text-ink underline decoration-control underline-offset-2">Open your full plan</Link>, with the AI practice, resume and advisor steps.</p>
        </Card>
      ) : (
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-learning-heading">
            <H sub="Choose a job and the courses for your skill gaps appear here, in order, with weeks.">No plan yet</H>
            <Image src="/cockatiel-thinking.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <Link href={state?.profile ? "/jobs" : "/start"} className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primaryink">{state?.profile ? "Choose a job" : "Get started"} <ArrowRight size={16} aria-hidden /></Link>
        </Card>
      )}

      <Card className="mt-4 statistics-reveal">
        <div className="statistics-opportunities-heading">
          <H sub="Platforms, not single courses. Ask an advisor which one fits you.">Free help from the government</H>
          <Image src="/cockatiel-spectacles.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMMES.map((c) => (
            <li key={c.id} className="courses-card flex flex-col rounded-2xl bg-raised p-4">
              <div className="flex items-center gap-3"><Logo c={c} size={40} fallback={Landmark} /><div className="min-w-0"><p className="font-semibold leading-snug">{c.title}</p><p className="text-xs text-muted">{c.provider}</p></div></div>
              <p className="mt-2 text-sm text-muted">{c.note}</p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                <span className="rounded-full bg-risesoft px-2.5 py-0.5 text-xs font-semibold text-rise">{c.funding === "Free" ? "Free" : c.funding}</span>
                <a href={c.url} target="_blank" rel="noreferrer" className="press inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-accentink hover:underline">Open the website <ExternalLink size={14} aria-hidden /></a>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 statistics-reveal">
        <div className="statistics-opportunities-heading statistics-risk-heading">
          <H sub={gaps.length ? "Courses for the skills your chosen job needs come first." : "Choose a job to see the courses for your skill gaps first."}><span id="courses-catalog-title">Find a course</span></H>
          <Image src="/cockatiel-peeking.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
          <label className="block text-sm"><span className="mb-1 block text-xs font-semibold text-muted">Skill</span>
            <select value={effSkill} onChange={(e) => setSkill(e.target.value)} className={selectCls}>
              {gaps.length > 0 && <option value={GAPS}>Your skill gaps ({gaps.length})</option>}
              <option value={ALL}>All skills</option>
              {SKILL_OPTIONS.map((id) => <option key={id} value={id}>{SKILL_NAME[id]}{gaps.includes(id) ? " (you need this)" : ""}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="mb-1 block text-xs font-semibold text-muted">Cost</span>
            <select value={cost} onChange={(e) => setCost(e.target.value as "any" | "free")} className={selectCls}><option value="any">Free or partly free</option><option value="free">Completely free</option></select>
          </label>
          <label className="block text-sm"><span className="mb-1 block text-xs font-semibold text-muted">Search</span>
            <span className="relative block"><Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Excel, SQL, Python…" className={`${selectCls} pl-9`} /></span>
          </label>
          <p className="num pb-2.5 text-sm font-semibold" aria-live="polite">{visible.length} {visible.length === 1 ? "course" : "courses"}</p>
        </div>
        {visible.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => {
              const inPlan = planSteps.find((s) => s.course?.id === c.id);
              const target = inPlan ? null : swapSteps.find((s) => covers(c, s.skillKey!));
              const ok = c.linkStatus === "200";
              const fits = c.skills.some((s) => gaps.includes(s));
              return (
                <li key={c.id} className={`courses-card flex flex-col rounded-2xl p-4 ${inPlan ? "bg-risesoft ring-2 ring-rise" : "bg-raised"} ${!inPlan && fits ? "ring-2 ring-cue" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Logo c={c} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug"><a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">{c.title}</a></p>
                      <p className="text-xs text-muted">{c.provider}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {inPlan ? <span className="inline-flex items-center gap-1 rounded-full bg-rise px-2.5 py-0.5 text-xs font-semibold text-white"><Check size={12} aria-hidden /> In your plan, {weeks(inPlan)}</span>
                      : fits ? <span className="rounded-full bg-cuesoft px-2.5 py-0.5 text-xs font-semibold text-cueink">For a skill you need</span> : null}
                    <span className="rounded-full bg-surface2 px-2.5 py-0.5 text-xs font-medium">{c.funding === "Free" ? "Free" : "Partly free"}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-0.5 text-xs font-medium"><Clock3 size={12} aria-hidden />{c.hours} {c.hours === 1 ? "hour" : "hours"}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted">{c.skills.map((s) => SKILL_NAME[s] ?? s).join(" · ")}</p>
                  {c.funding !== "Free" && <p className="mt-1 text-xs text-muted">{c.cost}</p>}
                  <div className="mt-auto pt-3">
                    {target ? (
                      <button className="press min-h-10 w-full rounded-full bg-primary px-4 text-sm font-semibold text-primaryink disabled:opacity-50" disabled={busy} onClick={() => swap(target.skillKey!, c.id, `Your plan now uses "${c.title}" for ${target.skills.map((k) => k.name.toLowerCase()).join(", ")}.`)}>Use this instead</button>
                    ) : (
                      <a href={c.url} target="_blank" rel="noreferrer" className="press inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full bg-surface2 px-4 text-sm font-semibold hover:bg-control/60">Open the course <ExternalLink size={14} aria-hidden /></a>
                    )}
                    <p className="mt-1.5 text-[11px] text-muted">{ok ? `Link checked ${day(c.checked)}` : "This site blocks automatic checks; open it to confirm."}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl bg-raised p-6 text-center">
            <p className="font-semibold">No courses match</p>
            <p className="mt-1 text-sm text-muted">Try another skill or clear the search.</p>
            <button className="press mt-3 min-h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primaryink" onClick={() => { setSkill(ALL); setQ(""); setCost("any"); }}>Show all courses</button>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">Courses are run by their providers, not by Jobbery. Free means free to learn; some providers charge for a certificate. We do not track these courses; you tick one off when you finish it.</p>
      </Card>
    </div>
  );
}
