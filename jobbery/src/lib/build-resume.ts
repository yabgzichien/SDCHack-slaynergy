import { EDUCATION_LABEL, SECTORS, occupationById, skillById } from "@/lib/engine/data";
import { stateById } from "@/lib/engine/geo";
import type { SessionState } from "@/lib/engine/state";
import type { View } from "@/lib/engine/view";

// The worker's updated resume, built from what Jobbery already holds: the profile, the skills confirmed from the
// resume scan, and the plan steps finished so far. Jobbery never stores the uploaded resume itself, so this is a
// structured page the worker copies into their own resume, not their original file.
export type BuiltResume = {
  name: string; headline: string; place: string | null;
  summary: string;
  experience: { title: string; detail: string }[];
  education: string;
  skills: { name: string; isNew: boolean }[];
  courses: { title: string; provider: string }[];
  portfolio: string | null;
  fixes: { id: string; title: string; fix: string }[];
};

// Lowercase only the first letter, so "Working with AI tools" reads "working with AI tools" mid-sentence.
const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);

export function buildResume(state: SessionState, view: View): BuiltResume | null {
  const p = state.profile;
  if (!p) return null;
  const occ = occupationById[p.occupationId];
  const plan = view.plan;
  const done = view.pathway.done;
  const target = plan && plan.kind !== "reshape" ? plan.title : null;
  const had = new Set(p.skills);
  const learned = new Map<string, string>();
  for (const s of plan?.steps ?? []) if (done[s.id] && s.kind === "course") for (const k of s.skills) if (!had.has(k.id)) learned.set(k.id, k.name);
  const quizPassed = !!state.pathway?.quiz?.passed;
  if (quizPassed && !had.has("ai_tools")) learned.set("ai_tools", skillById.ai_tools.name);
  const study = p.study && p.study !== "other" ? SECTORS.find((x) => x.id === p.study)?.label : null;
  return {
    name: p.name || "Your name",
    headline: target ? `${occ?.title ?? "Worker"} moving into ${target.toLowerCase()}` : occ?.title ?? "Student",
    place: p.state ? stateById[p.state]?.name ?? null : null,
    summary: `${p.years > 0 ? `${p.years} year${p.years === 1 ? "" : "s"} of experience${occ ? ` as ${occ.title.toLowerCase()}` : ""}` : "Early in my career"}.${learned.size ? ` Recently trained in ${[...learned.values()].slice(0, 3).map(lowerFirst).join(", ")}.` : ""}${quizPassed ? " I use AI tools and check their output for mistakes." : ""}${target ? ` Looking for a role as ${target.toLowerCase()}.` : ""}`,
    experience: occ ? [{ title: occ.title, detail: `${p.years} year${p.years === 1 ? "" : "s"}` }] : [],
    education: `${EDUCATION_LABEL[p.education]}${study ? `, ${study}` : ""}`,
    skills: [...learned.entries()].map(([id, name]) => ({ name: skillById[id]?.name ?? name, isNew: true })).concat(p.skills.map((id) => ({ name: skillById[id]?.name ?? id, isNew: false }))),
    courses: (plan?.steps ?? []).filter((s) => done[s.id] && s.kind === "course").map((s) => ({ title: s.title, provider: s.provider ?? "" })),
    portfolio: state.pathway?.template || state.pathway?.sheet ? `Wrote a reusable AI prompt and checklist for: ${view.pathway.card?.title.toLowerCase() ?? "a task in my field"}.` : quizPassed ? "Passed a check on spotting mistakes in AI-written work." : null,
    fixes: (state.resume?.findings ?? []).filter((f) => f.severity !== "good").map((f) => ({ id: f.id, title: f.title, fix: f.fix })),
  };
}
