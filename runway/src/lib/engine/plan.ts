import { courses, skillById, type Course, type SectorId } from "./data";
import { cardForSector } from "./pathway";
import { durability, type SkillExpiry } from "./expiry";
import { coverGaps, type Pick, type RoleMatch } from "./matching";

// HRD Corp's free e-learning hub, open to all Malaysians. Used only when no checked course covers a skill.
export const ELATIH_URL = "https://elatih.hrdcorp.gov.my/";
export type PlanStep = {
  id: string; kind: "course" | "programme" | "practice" | "apply" | "adapt";
  weekStart: number; weekEnd: number; title: string; provider?: string; url?: string; hours: number;
  skills: { id: string; name: string; sdgTarget: string; sdgWhy: string }[];
  shortLived: boolean; shortLivedNote?: string;
  funding: string; cost: string; course?: Course; checked?: string;
  // job: courses for the gap. ai: working with AI. people: resume, story and interviews.
  strand: Strand;
  // Steps with an activity are done when the work is saved in Runway, not by ticking (see pathway.stepDone).
  activity?: "task" | "story" | "star" | "rehearse" | "resume";
  cardId?: string;
};
export type Strand = "job" | "ai" | "people";
// switch: train for a new job. reshape: stay in your job and add the skills that keep it going.
// bridge: keep your current job for income while you train for a lasting one (stayIn names that job).
export type PlanKind = "switch" | "reshape" | "bridge";
export type Plan = {
  kind: PlanKind; stayIn?: string;
  roleId: string; title: string; totalWeeks: number; deadlineWeeks: number; hours: number;
  steps: PlanStep[]; summary: { layer1: string[]; layer2: string };
  note: string;
};

// Course steps, long-lasting skills first, starting at week 1.
function courseSteps(gaps: { skillId: string; expiry: SkillExpiry }[], picksIn: Pick[], hoursPerWeek: number): { steps: PlanStep[]; week: number } {
  const gapDur = Object.fromEntries(gaps.map((g) => [g.skillId, durability(g.expiry)]));
  const picks = [...picksIn].sort((a, b) => {
    const da = Math.min(...a.skillIds.map((s) => gapDur[s] ?? 1));
    const db = Math.min(...b.skillIds.map((s) => gapDur[s] ?? 1));
    return db - da; // long-lasting skills first
  });
  const steps: PlanStep[] = [];
  let week = 1;
  picks.forEach((p, i) => {
    const w = Math.max(1, Math.ceil(p.hours / hoursPerWeek));
    const sk = p.skillIds.map((id) => ({ id, name: skillById[id].name, sdgTarget: skillById[id].sdg.target, sdgWhy: skillById[id].sdg.why }));
    const minDur = Math.min(...p.skillIds.map((s) => gapDur[s] ?? 1));
    const short = minDur < 0.35;
    steps.push({
      id: `s${i + 1}`, kind: p.course ? "course" : "programme",
      weekStart: week, weekEnd: week + w - 1,
      title: p.course ? p.course.title : `Find a free course for ${sk.map((x) => x.name).join(", ")} on e-LATiH, with your counsellor`,
      provider: p.course?.provider ?? "HRD Corp e-LATiH", url: p.course?.url ?? ELATIH_URL, hours: p.hours, skills: sk, shortLived: short,
      shortLivedNote: short ? "This skill is expected to be automated soon. Learn it for the job, but do not rely on it for the long run." : undefined,
      funding: p.course ? p.course.funding : "PERKESO training support (to confirm with your counsellor)",
      cost: p.course ? p.course.cost : "To be confirmed", course: p.course ?? undefined, checked: p.course?.checked,
      strand: "job",
    });
    week += w;
  });
  return { steps, week };
}

// Lay course steps end to end again from week 1 after some were removed, keeping ids.
function relayout(steps: PlanStep[], hoursPerWeek: number): PlanStep[] {
  let week = 1;
  return steps.map((st) => {
    const w = Math.max(1, Math.ceil(st.hours / hoursPerWeek));
    const out = { ...st, weekStart: week, weekEnd: week + w - 1 };
    week += w;
    return out;
  });
}

const people = (id: string) => ({ id, name: skillById[id].name, sdgTarget: skillById[id].sdg.target, sdgWhy: skillById[id].sdg.why });
// Small people-strand steps share weeks with the learning or applying steps around them.
const RESUME_HOURS = 2, STORY_HOURS = 1, STAR_HOURS = 3, REHEARSE_HOURS = 2;
function resumeStep(): PlanStep {
  return { id: "resume", kind: "practice", strand: "people", activity: "resume", weekStart: 1, weekEnd: 1, hours: RESUME_HOURS,
    title: "Rewrite your resume with the fixes from the scan", skills: [people("communication")], shortLived: false, funding: "Free", cost: "Free" };
}
function interviewSteps(week: number): PlanStep[] {
  const base = { kind: "practice" as const, strand: "people" as const, weekStart: week, weekEnd: week, shortLived: false, funding: "Free", cost: "Free", skills: [people("communication")] };
  return [
    { ...base, id: "story", activity: "story", hours: STORY_HOURS, title: "Write your story in 60 seconds: why you left and where you are going" },
    { ...base, id: "star", activity: "star", hours: STAR_HOURS, title: "Prepare three interview answers with the STAR method" },
    { ...base, id: "rehearse", activity: "rehearse", hours: REHEARSE_HOURS, title: "Rehearse out loud, then do a mock interview with your counsellor" },
  ];
}
// The AI-at-work strand: existing free courses teach it, then a short quiz on a task from the worker's field checks it.
// Where no quiz is written for the field yet, a general practice step takes its place.
export const AI_COURSES = courses.filter((c) => c.strand === "ai");
export const QUIZ_HOURS = 1;
function aiSteps(start: number, minWeeks: number, hoursPerWeek: number, sector: SectorId | undefined, fallback: string): { steps: PlanStep[]; week: number } {
  const steps: PlanStep[] = [];
  let week = start;
  AI_COURSES.forEach((c, i) => {
    const w = Math.max(1, Math.ceil(c.hours / hoursPerWeek));
    steps.push({ id: `ai${i + 1}`, kind: "course", strand: "ai", weekStart: week, weekEnd: week + w - 1, title: c.title, provider: c.provider, url: c.url, hours: c.hours,
      skills: [aiSkill()], shortLived: false, funding: c.funding, cost: c.cost, course: c, checked: c.checked });
    week += w;
  });
  const end = Math.max(week, start + minWeeks);
  const card = cardForSector(sector);
  const last = Math.max(start, end - 1);
  steps.push({
    id: "task", kind: "practice", strand: "ai", weekStart: last, weekEnd: last, hours: card ? QUIZ_HOURS : Math.max(1, end - start) * hoursPerWeek,
    skills: [aiSkill()], shortLived: false, funding: "Free", cost: "Free",
    ...(card
      ? { activity: "task" as const, cardId: card.id, title: `Short quiz: spot the mistakes in an AI-written ${card.title.toLowerCase()}` }
      : { title: `${fallback} (a short quiz for this field comes in a later version)` }),
  });
  return { steps, week: end };
}
// Gap courses that only teach AI tools are covered by the AI strand instead.
const notAiOnly = (st: PlanStep) => !(st.skills.length && st.skills.every((k) => k.id === "ai_tools"));

const aiSkill = () => ({ id: "ai_tools", name: skillById.ai_tools.name, sdgTarget: skillById.ai_tools.sdg.target, sdgWhy: skillById.ai_tools.sdg.why });

export function buildPlan(m: RoleMatch, hoursPerWeek: number, stayIn?: string): Plan {
  const { steps: gapSteps } = courseSteps(m.gaps, m.picks, hoursPerWeek);
  const jobSteps = relayout(gapSteps.filter(notAiOnly), hoursPerWeek);
  const steps: PlanStep[] = [resumeStep(), ...jobSteps];
  const start = jobSteps.length ? jobSteps[jobSteps.length - 1].weekEnd + 1 : 1;
  let week = start;
  const buffer = m.bufferWeeks;
  const practice = Math.max(1, Math.ceil(buffer / 2));
  const apply = Math.max(1, buffer - practice);
  const ai = aiSteps(week, practice, hoursPerWeek, m.sector, `Practice project for ${m.title}: use AI tools, then check and correct their output`);
  steps.push(...ai.steps);
  week = ai.week;
  steps.push(...interviewSteps(week));
  steps.push({
    id: "apply", kind: "apply", strand: "job", weekStart: week, weekEnd: week + apply - 1,
    title: `Apply for ${m.title} roles`,
    hours: apply * hoursPerWeek, skills: [people("communication")], shortLived: false, funding: "Free", cost: "Free",
  });
  week += apply;
  const layer1 = ["4.4", "8.5"];
  if (steps.some((s) => s.kind === "course" && s.cost.startsWith("Free"))) layer1.push("4.3");
  return {
    kind: stayIn ? "bridge" : "switch", stayIn,
    roleId: m.roleId, title: m.title, totalWeeks: week - 1, deadlineWeeks: m.deadlineWeeks, hours: m.hours,
    steps,
    summary: {
      layer1,
      layer2: `Your new job as ${m.title} serves UN goal ${m.sdgTarget.split(".")[0]} (target ${m.sdgTarget}): ${m.sdgWhy}`,
    },
    note: `${stayIn ? `Keep working as ${stayIn.toLowerCase()} for income while you train. ` : ""}A plan is a suggestion. You choose, and your counsellor reviews and approves it.`,
  };
}

// Staying in your job: learn the skills that are growing in it, use AI on your real work, then take on more of that work.
export const ADAPT_WEEKS = 2;
export function buildReshapePlan(job: string, growing: { skillId: string; expiry: SkillExpiry }[], deadlineWeeks: number, hoursPerWeek: number, sector?: SectorId): Plan {
  const picks = coverGaps(growing.map((g) => g.skillId));
  const { steps: gapSteps } = courseSteps(growing, picks, hoursPerWeek);
  const jobSteps = relayout(gapSteps.filter(notAiOnly), hoursPerWeek);
  const steps: PlanStep[] = [resumeStep(), ...jobSteps];
  const ai = aiSteps(jobSteps.length ? jobSteps[jobSteps.length - 1].weekEnd + 1 : 1, ADAPT_WEEKS, hoursPerWeek, sector, "Use AI tools on a real task from your job, then check and correct their output");
  steps.push(...ai.steps);
  let week = ai.week;
  const names = growing.filter((g) => g.skillId !== "ai_tools").map((g) => skillById[g.skillId].name.toLowerCase());
  steps.push({ id: "adapt", kind: "adapt", strand: "job", weekStart: week, weekEnd: week + ADAPT_WEEKS - 1, hours: ADAPT_WEEKS * hoursPerWeek, skills: [], shortLived: false, funding: "Free", cost: "Free",
    title: `Take on more work that uses ${names[0] ?? "AI review and checking"} in your job, and show your manager what you learned` });
  week += ADAPT_WEEKS;
  const layer1 = ["4.4", "8.2"];
  if (steps.some((s) => s.kind === "course" && s.cost.startsWith("Free"))) layer1.push("4.3");
  return {
    kind: "reshape", roleId: "stay", title: `staying in your job as ${job.toLowerCase()}`,
    totalWeeks: week - 1, deadlineWeeks, hours: picks.reduce((a, p) => a + p.hours, 0) + 2 * ADAPT_WEEKS * hoursPerWeek,
    steps,
    summary: { layer1, layer2: "Keeping your skills up to date as AI changes your job supports decent work and productivity through upgrading skills (target 8.2)." },
    note: "A plan is a suggestion. You choose, and your counsellor reviews and approves it.",
  };
}
