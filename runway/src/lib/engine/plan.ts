import { skillById, type Course } from "./data";
import { durability } from "./expiry";
import type { RoleMatch } from "./matching";

// HRD Corp's free e-learning hub, open to all Malaysians. Used only when no checked course covers a skill.
export const ELATIH_URL = "https://elatih.hrdcorp.gov.my/";
export type PlanStep = {
  id: string; kind: "course" | "programme" | "practice" | "apply";
  weekStart: number; weekEnd: number; title: string; provider?: string; url?: string; hours: number;
  skills: { id: string; name: string; sdgTarget: string; sdgWhy: string }[];
  shortLived: boolean; shortLivedNote?: string;
  funding: string; cost: string; course?: Course; checked?: string;
};
export type Plan = {
  roleId: string; title: string; totalWeeks: number; deadlineWeeks: number; hours: number;
  steps: PlanStep[]; summary: { layer1: string[]; layer2: string };
  note: string;
};

export function buildPlan(m: RoleMatch, hoursPerWeek: number): Plan {
  const gapDur = Object.fromEntries(m.gaps.map((g) => [g.skillId, durability(g.expiry)]));
  const picks = [...m.picks].sort((a, b) => {
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
    });
    week += w;
  });
  const buffer = m.bufferWeeks;
  const practice = Math.max(1, Math.ceil(buffer / 2));
  const apply = Math.max(1, buffer - practice);
  const aiSkill = { id: "ai_tools", name: skillById.ai_tools.name, sdgTarget: skillById.ai_tools.sdg.target, sdgWhy: skillById.ai_tools.sdg.why };
  steps.push({
    id: `s${steps.length + 1}`, kind: "practice", weekStart: week, weekEnd: week + practice - 1,
    title: `Practice project for ${m.title}: use AI tools, then check and correct their output`,
    hours: practice * hoursPerWeek, skills: [aiSkill], shortLived: false, funding: "Free", cost: "Free",
  });
  week += practice;
  steps.push({
    id: `s${steps.length + 1}`, kind: "apply", weekStart: week, weekEnd: week + apply - 1,
    title: `Apply for ${m.title} roles and prepare interviews with your counsellor`,
    hours: apply * hoursPerWeek, skills: [], shortLived: false, funding: "Free", cost: "Free",
  });
  week += apply;
  const layer1 = ["4.4", "8.5"];
  if (steps.some((s) => s.kind === "course" && s.cost.startsWith("Free"))) layer1.push("4.3");
  return {
    roleId: m.roleId, title: m.title, totalWeeks: week - 1, deadlineWeeks: m.deadlineWeeks, hours: m.hours,
    steps,
    summary: {
      layer1,
      layer2: `Your new job as ${m.title} serves UN goal ${m.sdgTarget.split(".")[0]} (target ${m.sdgTarget}): ${m.sdgWhy}`,
    },
    note: "A plan is a suggestion. You choose, and your counsellor reviews and approves it.",
  };
}
