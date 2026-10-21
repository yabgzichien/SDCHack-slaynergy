import { roles, roleById, skillById, series, courses, courseById, GROUP_LABEL, EDUCATION_RANK, isEducation, isStudyField, fieldLocked, type Education, type StudyField, type SectorId, type GroupKey, type Role, type Course } from "./data";
import { expiryFor, durability, fmtYear, type SkillExpiry } from "./expiry";
import type { Weights3 } from "./futures";
import { clamp } from "./math";
import { FUTURE_IDS } from "./futures-def";

// The ONLY inputs matching may see. Age, gender and background are not on this type, on purpose.
export type MatchInput = {
  skills: string[]; months: number; hoursPerWeek: number; interests: string[]; goals: string[]; education: Education; field?: SectorId;
  // What they studied. Only used for the entry check on field-locked degree jobs; when unknown, their last job's field stands in.
  study?: StudyField | null;
};
export function pickInputs(p: Record<string, unknown> & Partial<MatchInput>): MatchInput {
  return {
    skills: [...(p.skills ?? [])].sort(),
    months: Number(p.months ?? 6),
    hoursPerWeek: Number(p.hoursPerWeek ?? 10),
    interests: [...(p.interests ?? [])].sort(),
    goals: [...(p.goals ?? [])].sort(),
    education: isEducation(p.education) ? p.education : "diploma",
    field: p.field,
    study: isStudyField(p.study) ? p.study : p.study === null ? null : undefined,
  };
}

export const WEIGHTS = { overlap: 0.25, outlook: 0.3, demand: 0.2, reach: 0.15, interest: 0.1 };
export const AT_RISK_BELOW = 0.55; // roles whose skills mostly expire soon are flagged "skills at risk"
// The ranking favours jobs that last: a penalty that grows smoothly from 0 (outlook 0.70) to 8 points (outlook 0.40),
// so a small change in the futures' weights never makes a role jump by crossing a cliff.
export const AT_RISK_PENALTY = 0.08;
export const PENALTY_FROM = 0.7, PENALTY_FULL = 0.4;
export const riskPenalty = (outlook: number) => AT_RISK_PENALTY * clamp((PENALTY_FROM - outlook) / (PENALTY_FROM - PENALTY_FULL), 0, 1);
export const SDG_BONUS = 0.12;
export const WEEKS_PER_MONTH = 4.345;

// ---------- demand from DOSM major-group trend ----------
// DOSM changed what its online job-ad series covers from 2025 Q3, so quarters before that are not comparable.
// Demand trend = the latest quarter's share of ads against the average share since the change.
export const DOSM_BREAK = "2025Q3";
export type Demand = { group: GroupKey; label: string; recent: number; before: number; trend: number; score: number; period: string; latest: string };
export function demandFor(group: GroupKey, upTo: string): Demand {
  const all = series.dosm.quarters.filter((d) => d.q <= upTo);
  const share = (d: (typeof all)[number]) => (d[group] / d.total) * 100;
  const post = all.filter((d) => d.q >= DOSM_BREAK);
  const latest = all[all.length - 1];
  const base = post.length >= 3 ? post.slice(0, -1) : all.slice(-5, -1);
  const recent = share(latest);
  const before = base.reduce((x, d) => x + share(d), 0) / Math.max(1, base.length);
  // Few comparable quarters exist, so the trend is shrunk towards "no change" (n / (n + 2)) to keep one noisy quarter
  // from swinging the ranking. Size counts a little: a group with 20% or more of all ads scores full marks on it.
  const raw = before > 0 ? recent / before - 1 : 0;
  const trend = raw * (base.length / (base.length + 2));
  const score = clamp(0.5 + 1.25 * trend, 0, 1) * 0.75 + clamp(recent / 20, 0, 1) * 0.25;
  return { group, label: GROUP_LABEL[group], recent, before, trend, score, latest: latest.q, period: `${base[0].q} to ${base[base.length - 1].q}` };
}

// ---------- courses ----------
export type Pick = { skillIds: string[]; course: Course | null; hours: number };
// Greedy cover: choose the vetted free course that covers the most missing skills per hour.
export function coverGaps(gaps: string[]): Pick[] {
  const left = new Set(gaps);
  const picks: Pick[] = [];
  while (left.size) {
    let best: { c: Course; cover: string[]; score: number } | null = null;
    for (const c of courses) {
      if (c.strand) continue;
      const cover = c.skills.filter((s) => left.has(s));
      if (!cover.length) continue;
      const score = cover.length / c.hours;
      if (!best || score > best.score) best = { c, cover, score };
    }
    if (!best) break;
    best.cover.forEach((s) => left.delete(s));
    picks.push({ skillIds: best.cover, course: best.c, hours: best.c.hours });
  }
  // Skills with no vetted course: a counsellor-identified programme (estimate, never invented)
  for (const s of left) picks.push({ skillIds: [s], course: null, hours: 20 });
  return picks;
}

export type Gap = { skillId: string; name: string; importance: number; expiry: SkillExpiry };
export type RoleMatch = {
  roleId: string; title: string; onet: string; sector: SectorId; requires: Education; closest: boolean; blocked: boolean; blockedBy: "education" | "field" | null; sdgTarget: string; sdgWhy: string; group: GroupKey;
  atRisk: boolean; penalty: number; overlap: number; outlook: number; demand: Demand; reach: number; interest: number;
  base: number; score: number; sdgMatch: boolean;
  weeks: number; courseWeeks: number; bufferWeeks: number; hours: number; reachable: boolean; deadlineWeeks: number;
  gaps: Gap[]; have: string[]; picks: Pick[];
  rank: number; baseRank: number;
  parts: { key: string; label: string; value: number; weight: number }[];
};

export function matchRoles(input: MatchInput, w: Weights3, upTo: string): RoleMatch[] {
  const have = new Set(input.skills);
  const deadlineWeeks = Math.floor(input.months * WEEKS_PER_MONTH - 2);
  const expCache = new Map<string, SkillExpiry>();
  const exp = (id: string) => {
    if (!expCache.has(id)) expCache.set(id, expiryFor(id, w));
    return expCache.get(id)!;
  };
  const out: RoleMatch[] = [];
  for (const r of roles) {
    const total = Object.values(r.skills).reduce((a, b) => a + b, 0);
    const got = Object.entries(r.skills).reduce((a, [s, imp]) => a + (have.has(s) ? imp : 0), 0);
    const overlap = got / total;
    const outlook = Object.entries(r.skills).reduce((a, [s, imp]) => a + imp * durability(exp(s)), 0) / total;
    const demand = demandFor(r.group, upTo);
    const gapIds = Object.keys(r.skills).filter((s) => !have.has(s));
    const picks = coverGaps(gapIds);
    const hours = picks.reduce((a, p) => a + p.hours, 0);
    const courseWeeks = Math.ceil(hours / Math.max(1, input.hoursPerWeek));
    const bufferWeeks = Math.ceil(r.minWeeks * (1 - overlap)) + 2; // practice, certification and applications shrink as you already have more of the skills
    const weeks = courseWeeks + bufferWeeks;
    const study = input.study === undefined ? input.field : input.study;
    const blockedBy = EDUCATION_RANK[input.education] < EDUCATION_RANK[r.requires] ? "education" as const
      : fieldLocked(r) && study !== r.sector ? "field" as const : null;
    const blocked = blockedBy !== null;
    const reachable = weeks <= deadlineWeeks && !blocked;
    const reach = clamp(1 - weeks / Math.max(1, deadlineWeeks), 0, 1);
    const tagFit = r.tags.length ? clamp(r.tags.filter((t) => input.interests.includes(t)).length / Math.min(2, r.tags.length), 0, 1) : 0;
    const interest = clamp(0.5 * tagFit + (input.field && input.field === r.sector ? 0.5 : 0), 0, 1);
    const base = WEIGHTS.overlap * overlap + WEIGHTS.outlook * outlook + WEIGHTS.demand * demand.score + WEIGHTS.reach * reach + WEIGHTS.interest * interest - riskPenalty(outlook);
    const sdgMatch = input.goals.includes(r.sdg.target);
    out.push({
      roleId: r.id, title: r.title, onet: r.onet, sector: r.sector, requires: r.requires, closest: r.closest, blocked, blockedBy, sdgTarget: r.sdg.target, sdgWhy: r.sdg.why, group: r.group,
      atRisk: outlook < AT_RISK_BELOW, penalty: riskPenalty(outlook), overlap, outlook, demand, reach, interest, base, score: base + (sdgMatch ? SDG_BONUS : 0), sdgMatch,
      weeks, courseWeeks, bufferWeeks, hours, reachable, deadlineWeeks,
      gaps: gapIds.map((s) => ({ skillId: s, name: skillById[s].name, importance: r.skills[s], expiry: exp(s) })),
      have: Object.keys(r.skills).filter((s) => have.has(s)),
      picks, rank: 0, baseRank: 0,
      parts: [
        { key: "overlap", label: "Skill overlap", value: overlap, weight: WEIGHTS.overlap },
        { key: "outlook", label: "Future outlook", value: outlook, weight: WEIGHTS.outlook },
        { key: "demand", label: "Job demand", value: demand.score, weight: WEIGHTS.demand },
        { key: "reach", label: "Reachable in time", value: reach, weight: WEIGHTS.reach },
        { key: "interest", label: "Fits your interests and field", value: interest, weight: WEIGHTS.interest },
      ],
    });
  }
  const ok = out.filter((m) => m.reachable);
  [...ok].sort((a, b) => b.base - a.base).forEach((m, i) => (m.baseRank = i + 1));
  [...ok].sort((a, b) => b.score - a.score || a.roleId.localeCompare(b.roleId)).forEach((m, i) => (m.rank = i + 1));
  return ok.sort((a, b) => a.rank - b.rank).concat(out.filter((m) => !m.reachable).sort((a, b) => a.weeks - b.weeks));
}

export function tradeoff(m: RoleMatch, ranked: RoleMatch[]): string | null {
  if (!m.sdgMatch) return null;
  const top = ranked.find((r) => r.baseRank === 1);
  if (!top || top.roleId === m.roleId) return `Also your top pick without the goals: it serves SDG ${m.sdgTarget}.`;
  const diff = m.weeks - top.weeks;
  const t = diff === 0 ? "the same training time" : diff > 0 ? `+${diff} weeks of training` : `${-diff} fewer weeks of training`;
  return `${t} compared with ${top.title}, but it serves SDG ${m.sdgTarget}: ${m.sdgWhy}`;
}
export { roleById, courseById, FUTURE_IDS, fmtYear };
export type { Role };
