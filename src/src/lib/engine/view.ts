import { skills, skillById, roles, roleById, occupations, occupationById, series, sdg, sourceById, SECTORS, INTERESTS, EDUCATION_LABEL, EDUCATION_RANK, quarterIndex, prevQuarter, type SectorId, type GroupKey } from "./data";
import { isoDay, ladder, LIVE_QUARTER, makeQuestions, quarterPlain } from "./questions";
import { computeWorld, type World } from "./world";
import { expiryFor, durability, fmtYear, nowYear, withNow, THRESHOLD, type SkillExpiry } from "./expiry";
import { skillMathFor } from "./skill-math";
import type { SkillMath } from "./expiry-math";
import type { Weights3 } from "./futures";
import { areaFor } from "./geo";
import { matchRoles, pickInputs, demandFor, tradeoff, raisersFor, AT_RISK_BELOW, PROJECT_QUARTERS, type MatchInput, type RoleMatch } from "./matching";
import { buildPlan, buildReshapePlan, LEARNING_TARGET, type Plan } from "./plan";
import { FUTURES, FUTURE_IDS, type FutureId } from "./futures-def";
import { FORECAST } from "../speed";
import { STAY_ID, type SessionState } from "./state";
import { clamp, mean } from "./math";
import { dosmQuarterAt, epochQuarterAt, historyStops, scoresAt, settleDay, yearOf, type Stop } from "./history";
import { futureWeights } from "./futures";
import { zeroScores } from "./replay";
import { tailorTips, type ResumeSummary } from "./resume";
import { achievements, cardById, completionGate, doneMap, gradeQuiz, promptChecklist, type Achievement, type TaskCard } from "./pathway";

export type RadarSkill = {
  skillId: string; name: string; expected: string; expectedYear: number; byFuture: Record<string, string>;
  exposure: number; gradient: string | null; coverage: number; iloTitle: string | null; sdgTarget: string; durable: boolean;
};
export type RadarJob = { roleId: string; title: string; trend: number; share: number; group: string; outlook: number; sdgTarget: string };
export type Radar = {
  declining: RadarSkill[]; rising: (RadarSkill & { demand: number })[];
  // trend: the job group's DOSM ads trend (null for groups DOSM does not split out).
  risingJobs: RadarJob[]; decliningJobs: { occupationId: string; title: string; exposure: number; gradient: string | null; earliest: string; trend: number | null }[];
  sources: { name: string; detail: string; url: string; date: string }[];
  // Short source labels for each row's chip (Future Skills Radar: every row shows its source and date).
  cite: { dosm: string; ilo: string; aei: string };
};
export type Change = { kind: "futures" | "market" | "skills" | "jobs" | "plan" | "demand" | "forecasters"; text: string; why: string; source: { name: string; url: string; date: string } };

export type View = {
  world: World;
  radar: Radar;
  profileSkills: { skillId: string; name: string; expiry: SkillExpiryView }[];
  // The working behind each of those skills' dates, for the "How we got this" page (/skills/how); see skill-math.ts.
  skillMath: SkillMath;
  pace: { futures: Pace[]; expectedMonths: number; perQuarter: number; points: { q: string; v: number }[]; asOf: string; source: { name: string; url: string } };
  matches: (RoleMatchView)[];
  unreachable: { roleId: string; title: string; weeks: number; sector: SectorId; reason: "qualification" | "time"; need: string }[];
  sectors: { id: SectorId; label: string; blurb: string; reachable: number; total: number; bestScore: number | null; bestTitle: string | null; avgOutlook: number | null }[];
  chosen: RoleMatchView | null;
  // The best job that should last (its skills hold up), and a quicker job to earn while you train, if one exists.
  lasting: RoleMatchView | null;
  bridge: RoleMatchView | null;
  // Staying in the job you have (or had). Always offered once there is a profile.
  stay: StayView | null;
  plan: Plan | null;
  pathway: PathwayView;
  sdgSummary: { target: string; goal: string; text: string }[];
  resume: ResumeSummary | null;
  resumeTips: ReturnType<typeof tailorTips> | null;
  changes: Change[] | null;
  // For each open question: how your soonest-fading skill's date would move if the main answer settles Yes or No.
  whatIfYou: Record<string, { skill: string; now: string; yes: string; no: string }>;
  data: { name: string; detail: string; url: string; date: string; licence: string }[];
  // Previewing an AI speed: the same reachable jobs ranked as if that speed were certain (docs/adr/0002). Estimates.
  // Null for the "before" view used to list what a release changed.
  scenarios: ScenarioView[] | null;
};
export type ScenarioId = FutureId;
export type ScenarioView = {
  id: ScenarioId; weights: Weights3;
  // Office-admin job ads, projected PROJECT_QUARTERS ahead with this speed's drift: a projection, not a DOSM figure.
  clerical: { now: number; projected: number; quarters: number; driftPp: number };
  // The job the app would suggest under this speed: the best lasting job, else the top of the list.
  best: { roleId: string; title: string; weeks: number; score: number; atRisk: boolean } | null;
  roles: Record<string, { rank: number; score: number; outlook: number; atRisk: boolean }>;
};
// The task card as the browser sees it: the planted mistakes stay on the server until the worker finds them.
export type CardView = Omit<TaskCard, "sampleAnswer"> & { sampleAnswer: { id: string; text: string; reveal?: { kind: string; why: string } }[]; mistakes: number };
export type PathwayView = {
  done: Record<string, boolean>;
  gate: { ok: boolean; missing: string[] };
  achievements: Achievement[];
  card: CardView | null;
  promptCovers: string[];
};
function pathwayView(plan: Plan | null, state: SessionState): PathwayView {
  const step = plan?.steps.find((s) => s.activity === "task");
  const c = step?.cardId ? cardById(step.cardId) : null;
  const w = state.pathway ?? {};
  let card: CardView | null = null;
  if (c) {
    const found = new Set(w.quiz ? gradeQuiz(c, [...w.quiz.found, ...w.quiz.wrong]).found : []);
    card = { ...c, mistakes: c.sampleAnswer.filter((a) => a.mistake).length,
      sampleAnswer: c.sampleAnswer.map((a) => ({ id: a.id, text: a.text, reveal: a.mistake && (found.has(a.id) || w.quiz?.passed) ? a.mistake : undefined })) };
  }
  return {
    done: plan ? doneMap(plan, state) : {},
    gate: completionGate(plan, state),
    achievements: achievements(plan, state),
    card, promptCovers: c && w.prompt ? promptChecklist(c, w.prompt) : [],
  };
}

// steady: ILO finds little GenAI exposure. changing: exposed, so the job is shifting but should last if you add its
// growing skills. fast: ILO's highest-exposure gradient (most tasks automatable), so staying is shown as a bridge
// towards a lasting job (toward), if one is reachable.
export type StayView = {
  occupationId: string; title: string; status: "steady" | "changing" | "fast"; fast: boolean; outlook: number;
  ilo: { score: number; gradient: string | null; title: string } | null;
  fadeYear: Record<string, string | null>; // per AI speed: the date by which most of this job's skills are expected to fade
  fading: { skillId: string; name: string; expected: string; byFuture: Record<string, string> }[];
  growing: { skillId: string; name: string; expected: string }[];
  toward: RoleMatchView | null;
};
export type SkillExpiryView = { expected: string; expectedYear: number; byFuture: Record<string, string>; byFutureYear: Record<string, number | null>; exposure: number; durable: boolean; coverage: number };
// How fast AI is improving in each future, as a rate people can repeat: the length of task AI can finish on its own
// (METR time horizon, via Epoch AI) doubles every so many months. The recent pace is the mean of the last four quarters.
export type Pace = { id: string; doublingMonths: number; clericalPerYear: number; weight: number };
export type RoleMatchView = Omit<RoleMatch, "gaps" | "picks"> & {
  gaps: { skillId: string; name: string; importance: number; expiry: SkillExpiryView; sdgTarget: string }[];
  picks: RoleMatch["picks"];
  tradeoff: string | null;
  sdgText: string;
  resumeFit: number | null;
  // Why this job, in the worker's own terms: the interests they picked that it matches, whether it is in their field,
  // the skills they already have, and the human core of the job against what AI is expected to do in it.
  why: {
    likes: string[]; inField: boolean;
    have: { skillId: string; name: string }[];
    humanEdge: { text: string; tag: string; source: string };
    icon: string;
    aiDoes: { skillId: string; name: string; byFuture: Record<string, string> }[];
    staysYours: { skillId: string; name: string }[];
  };
};

// A skill's date under each AI speed, plus "forecast": the date under Our forecast (the blend), so a page can look up
// whichever the person is previewing with one key.
const yearUnder = (e: SkillExpiry, id: string) => (id === FORECAST ? (e.durable ? Infinity : e.expected) : e.byFuture[id as FutureId]);
const dates = (e: SkillExpiry) => Object.fromEntries([...FUTURE_IDS, FORECAST].map((id) => [id, Number.isFinite(yearUnder(e, id)) ? fmtYear(yearUnder(e, id)) : "after 2040"]));
const years = (e: SkillExpiry) => Object.fromEntries([...FUTURE_IDS, FORECAST].map((id) => [id, Number.isFinite(yearUnder(e, id)) ? yearUnder(e, id) : null]));
const eview = (e: SkillExpiry): SkillExpiryView => ({
  expected: e.durable ? `after 2040` : fmtYear(e.expected), expectedYear: e.expected, exposure: e.exposure, durable: e.durable, coverage: e.coverage,
  byFuture: dates(e), byFutureYear: years(e),
});

// ISCO-08 major group (first digit) to DOSM's job-ad groups; groups DOSM does not split out have no ads trend.
const ISCO_GROUP: Record<string, GroupKey> = { "1": "managers", "2": "professionals", "3": "technicians", "4": "clerical", "5": "service", "7": "craft", "8": "operators" };
export const AT_RISK_EXPOSURE = 0.7;

function radarFor(w: World): Radar {
  const wt = w.weights;
  const all = skills.map((s) => {
    const e = expiryFor(s.id, wt);
    return { s, e };
  });
  const toSkill = ({ s, e }: { s: (typeof skills)[number]; e: SkillExpiry }): RadarSkill => ({
    skillId: s.id, name: s.name, expected: e.durable ? "after 2040" : fmtYear(e.expected), expectedYear: e.expected,
    byFuture: dates(e),
    exposure: e.exposure, gradient: s.ilo ? series.ilo[s.ilo]?.gradient ?? null : null, coverage: e.coverage,
    iloTitle: s.ilo ? series.ilo[s.ilo]?.title ?? null : null, sdgTarget: s.sdg.target, durable: e.durable,
  });
  const declining = all.filter((x) => !x.e.durable).sort((a, b) => a.e.expected - b.e.expected).slice(0, 9).map(toSkill);

  const demands = Object.fromEntries(roles.map((r) => [r.id, demandFor(r.group, w.asOfQuarter)]));
  const rising = all
    .filter((x) => !x.s.complement || true)
    .map((x) => {
      const rs = roles.filter((r) => x.s.id in r.skills);
      const dem = rs.length ? mean(rs.map((r) => demands[r.id].score)) : 0;
      return { ...toSkill(x), demand: dem, rank: dem * durability(x.e) };
    })
    .filter((x) => x.durable || x.expectedYear > nowYear() + 5)
    .sort((a, b) => b.rank - a.rank).slice(0, 9)
    .map((x) => { const out: RadarSkill & { demand: number } = { ...x }; delete (out as Record<string, unknown>).rank; return out; });

  const risingJobs = roles
    .map((r) => {
      const d = demands[r.id];
      const out = Object.entries(r.skills).reduce((a, [sid, imp]) => a + imp * durability(expiryFor(sid, wt)), 0) / Object.values(r.skills).reduce((a, b) => a + b, 0);
      return { roleId: r.id, title: r.title, trend: d.trend, share: d.recent, group: d.label, outlook: out, sdgTarget: r.sdg.target, k: out * 0.6 + d.score * 0.4 };
    })
    .sort((a, b) => b.k - a.k).slice(0, 8).map((x) => ({ roleId: x.roleId, title: x.title, trend: x.trend, share: x.share, group: x.group, outlook: x.outlook, sdgTarget: x.sdgTarget }));

  // Jobs most at risk: mostly how much of the work AI can do (ILO), plus whether job ads for the group are falling (DOSM),
  // so the list moves with each release (docs/adr/0003). The ads part uses the same 0.5-is-steady scale as job demand.
  const exposures = occupations.map((o) => series.ilo[o.isco]?.score ?? 0);
  const maxExposure = Math.max(...exposures, 1e-9);
  const decliningJobs = occupations
    .map((o, i) => {
      const ilo = series.ilo[o.isco];
      const earliest = Math.min(...o.skills.map((s) => expiryFor(s, wt).expected));
      const group = ISCO_GROUP[o.isco[0]];
      const trend = group ? demandFor(group, w.asOfQuarter).trend : null;
      const falling = trend === null ? 0.5 : clamp(0.5 - 1.25 * trend, 0, 1);
      return { occupationId: o.id, title: o.title, exposure: ilo?.score ?? 0, gradient: ilo?.gradient ?? null, earliest: fmtYear(earliest), trend, k: AT_RISK_EXPOSURE * (exposures[i] / maxExposure) + (1 - AT_RISK_EXPOSURE) * falling };
    })
    .sort((a, b) => b.k - a.k || a.occupationId.localeCompare(b.occupationId)).slice(0, 6).map((x) => ({ occupationId: x.occupationId, title: x.title, exposure: x.exposure, gradient: x.gradient, earliest: x.earliest, trend: x.trend }));

  const dosm = sourceById.dosm, ilo = sourceById.ilo, aei = sourceById.aei, ep = sourceById.epoch;
  return {
    declining, rising, risingJobs, decliningJobs,
    cite: { dosm: `DOSM ${w.asOfQuarter.replace("Q", " Q")}`, ilo: `ILO ${ilo.latest.split(" ")[0]}`, aei: `AEI ${aei.latest.split(" ")[0]}` },
    sources: [
      { name: "ILO 2025 GenAI exposure (ISCO-08)", detail: "How exposed each occupation's tasks are to generative AI", url: ilo.url, date: `scores ${ilo.latest}; retrieved ${ilo.retrieved}` },
      { name: "Anthropic Economic Index", detail: "Share of an occupation's tasks seen in real AI use", url: aei.url, date: `release ${aei.latest.split(" ")[0]}; retrieved ${aei.retrieved}` },
      { name: "DOSM Job Market Insights", detail: "Online job ads by occupation group (demand)", url: dosm.url, date: w.asOfLabel.replace(/^DOSM /, "") },
      { name: "Epoch AI benchmarks", detail: "How fast AI capability is growing (anchors the futures)", url: ep.url, date: `to ${(w.epochQuarter ?? w.asOfQuarter).replace("Q", " Q")}; retrieved ${ep.retrieved}` },
    ],
  };
}

function viewCore(state: SessionState, release: 0 | 1, nowMs?: number, withScenarios = true): View {
  return viewFrom(state, computeWorld({ ...state, release }, nowMs), withScenarios);
}

// The reachable jobs ranked under each AI speed taken as certain, with that speed's office-admin drift projected
// PROJECT_QUARTERS ahead. Which jobs are reachable never depends on the speed, so plan lengths are reused (weeksOf).
export function scenarioMatches(input: MatchInput, asOf: string, weeksOf: (roleId: string) => number): ScenarioView[] {
  const now = demandFor("clerical", asOf).recent;
  return FUTURES.map((f) => {
    const weights = { slow: 0, medium: 0, fast: 0, [f.id]: 1 } as Weights3;
    const shift = f.clericalDriftPp * PROJECT_QUARTERS;
    const ms = matchRoles(input, weights, asOf, shift).filter((m) => m.reachable);
    const top = ms.find((m) => m.outlook >= LASTING_OUTLOOK) ?? ms[0] ?? null;
    return {
      id: f.id, weights,
      clerical: { now, projected: Math.max(0, now + shift), quarters: PROJECT_QUARTERS, driftPp: f.clericalDriftPp },
      best: top && { roleId: top.roleId, title: top.title, weeks: weeksOf(top.roleId), score: top.score, atRisk: top.atRisk },
      roles: Object.fromEntries(ms.map((m) => [m.roleId, { rank: m.rank, score: m.score, outlook: m.outlook, atRisk: m.atRisk }])),
    };
  });
}

// The matching inputs for a session's profile: the same everywhere a job is scored (views, score raisers).
export function matchInputFor(state: SessionState): MatchInput | null {
  const p = state.profile;
  if (!p) return null;
  const occ = occupationById[p.occupationId];
  const study = p.study !== undefined ? p.study : EDUCATION_RANK[p.education] >= 1 ? occ?.sector : null;
  return pickInputs({ skills: p.skills, months: p.months, hoursPerWeek: p.hoursPerWeek, interests: p.interests, goals: state.goals, education: p.education, field: occ?.sector, study, area: areaFor(p.state, p.move, p.moveTo) });
}

// Why a job scores what it does and what would raise it, under Our forecast and under each AI speed taken as certain
// (the same weights and office-admin projection as scenarioMatches), so the job page follows the speed picker.
export function raiseView(state: SessionState, roleId: string, nowMs?: number): Record<string, NonNullable<ReturnType<typeof raisersFor>>> | null {
  const input = matchInputFor(state);
  if (!input) return null;
  const world = computeWorld(state, nowMs);
  const out: Record<string, NonNullable<ReturnType<typeof raisersFor>>> = {};
  const f = raisersFor(input, world.weights, world.asOfQuarter, roleId);
  if (!f) return null;
  out[FORECAST] = f;
  for (const s of FUTURES) {
    const r = raisersFor(input, { slow: 0, medium: 0, fast: 0, [s.id]: 1 } as Weights3, world.asOfQuarter, roleId, s.clericalDriftPp * PROJECT_QUARTERS);
    if (r) out[s.id] = r;
  }
  return out;
}

function viewFrom(state: SessionState, world: World, withScenarios = true): View {
  const radar = radarFor(world);
  const p = state.profile;
  const wt = world.weights;
  const profileSkills = p ? p.skills.map((s) => ({ skillId: s, name: skillById[s].name, expiry: eview(expiryFor(s, wt)) })).sort((a, b) => a.expiry.expectedYear - b.expiry.expectedYear) : [];
  let matches: RoleMatchView[] = [];
  let unreachable: View["unreachable"] = [];
  let sectors: View["sectors"] = [];
  let chosen: RoleMatchView | null = null;
  let lasting: RoleMatchView | null = null, bridge: RoleMatchView | null = null;
  let plan: Plan | null = null;
  let stay: StayView | null = null;
  let scenarios: ScenarioView[] | null = null;
  if (p) {
    const occ = occupationById[p.occupationId];
    const input = matchInputFor(state)!;
    const all = matchRoles(input, wt, world.asOfQuarter);
    const reachable = all.filter((m) => m.reachable);
    // Show the length of the plan the person would actually follow, so the Jobs page and the Plan page agree.
    const planWeeks = (m: RoleMatch) => buildPlan(m, p.hoursPerWeek, undefined, state.courseSwaps).totalWeeks;
    const toView = (m: RoleMatch): RoleMatchView => ({
      ...m, weeks: planWeeks(m), tradeoff: tradeoff(m, reachable), sdgText: sdg[m.sdgTarget]?.text ?? "",
      resumeFit: state.resume ? tailorTips(state.resume.skillIds, roleById[m.roleId].skills).match : null,
      gaps: m.gaps.map((g) => ({ skillId: g.skillId, name: g.name, importance: g.importance, expiry: eview(g.expiry), sdgTarget: skillById[g.skillId].sdg.target })),
      why: whyFor(m, p.interests, input.field, wt),
    });
    matches = reachable.map(toView);
    if (withScenarios) {
      const weeks = new Map(matches.map((m) => [m.roleId, m.weeks]));
      scenarios = scenarioMatches(input, world.asOfQuarter, (id) => weeks.get(id) ?? 0);
    }
    unreachable = all.filter((m) => !m.reachable).map((m) => ({ roleId: m.roleId, title: m.title, weeks: planWeeks(m), sector: m.sector, reason: m.blocked ? "qualification" as const : "time" as const, need: m.blockedBy === "field" ? `Needs a degree in ${SECTOR_NOUN[m.sector]}` : m.blocked ? `Needs a ${EDUCATION_LABEL[m.requires].toLowerCase()}` : `≈ ${m.weeks} weeks` }));
    sectors = SECTORS.map((sec) => {
      const inSec = all.filter((m) => m.sector === sec.id), ok = inSec.filter((m) => m.reachable);
      return { ...sec, reachable: ok.length, total: inSec.length, bestScore: ok[0]?.score ?? null, bestTitle: ok[0]?.title ?? null, avgOutlook: ok.length ? mean(ok.map((m) => m.outlook)) : null };
    });
    lasting = matches.find((m) => m.outlook >= LASTING_OUTLOOK) ?? null;
    const quick = Math.min(BRIDGE_WEEKS, Math.floor((matches[0]?.deadlineWeeks ?? 0) / 2));
    bridge = matches.find((m) => m.outlook < LASTING_OUTLOOK && m.weeks <= quick && m.roleId !== lasting?.roleId) ?? null;
    if (occ && p.status !== "studying") {
      const s = stayFor(occ.id, p.skills, wt);
      const toward = s.fast ? lasting : null;
      stay = { ...s.view, toward };
      if (state.chosenRoleId === STAY_ID) {
        if (toward) { chosen = toward; plan = buildPlan(all.find((m) => m.roleId === toward.roleId)!, p.hoursPerWeek, occ.title, state.courseSwaps); }
        else {
          const ev = occ.evolved ? all.find((m) => m.roleId === occ.evolved) : undefined;
          chosen = ev ? toView(ev) : null;
          plan = buildReshapePlan(occ.title, s.growing, Math.floor(p.months * 4.345 - 2), p.hoursPerWeek, occ.sector, state.courseSwaps);
        }
      }
    }
    if (!plan) {
      const pick = (state.chosenRoleId && matches.find((m) => m.roleId === state.chosenRoleId)) || lasting || matches[0] || null;
      chosen = pick;
      if (pick) plan = buildPlan(all.find((m) => m.roleId === pick.roleId)!, p.hoursPerWeek, undefined, state.courseSwaps);
    }
  }
  const targets = new Set<string>();
  if (plan) { if (plan.summary.path.learningHours) targets.add(LEARNING_TARGET); plan.summary.path.byTarget.forEach((x) => targets.add(x.target)); if (chosen) targets.add(chosen.sdgTarget); }
  const sdgSummary = [...targets].map((t) => ({ target: t, goal: sdg[t].goal, text: sdg[t].text }));
  // While viewing the past, DOSM and Epoch AI say what was public that day instead of today's latest.
  const pastDetail = (id: string) => !world.past ? null : id === "dosm" ? `${world.asOfQuarter} (published ${world.past.day})` : id === "epoch" ? `results to ${(world.epochQuarter ?? world.asOfQuarter).replace("Q", " Q")}` : null;
  const data = series.sources.map((s) => ({ name: s.name, detail: pastDetail(s.id) ?? s.latest, url: s.url, date: s.retrieved, licence: s.licence }));
  const resume = state.resume ?? null;
  const resumeTips = resume && chosen ? tailorTips(resume.skillIds, roleById[chosen.roleId].skills) : null;
  const fr = series.epoch.metr.frontier.filter((x) => quarterIndex(x.q) <= quarterIndex(world.epochQuarter ?? world.asOfQuarter)).slice(-5);
  const perQuarter = mean(fr.slice(1).map((x, i) => x.v - fr[i].v));
  const paceFutures: Pace[] = FUTURES.map((f) => ({ id: f.id, doublingMonths: 3 / (f.capMult * perQuarter), clericalPerYear: f.clericalDriftPp * 4, weight: world.weights[f.id] }));
  const pace = {
    futures: paceFutures,
    expectedMonths: 3 / (perQuarter * FUTURES.reduce((a, f) => a + world.weights[f.id] * f.capMult, 0)),
    // The numbers the pace was worked out from, so the page can show its own arithmetic (components/PaceExplain.tsx).
    perQuarter, points: fr.map((x) => ({ q: x.q, v: x.v })),
    asOf: world.epochQuarter ?? world.asOfQuarter,
    source: { name: "METR time horizon, via Epoch AI", url: sourceById.epoch.url },
  };
  const whatIfYou: View["whatIfYou"] = {};
  const soonest = profileSkills.find((x) => !expiryFor(x.skillId, wt).durable);
  if (soonest) {
    for (const e of world.events) if (e.whatIf) {
      const at = (w: Weights3) => fmtYear(expiryFor(soonest.skillId, w).expected);
      whatIfYou[e.id] = { skill: soonest.name, now: at(wt), yes: at(e.whatIf.yes), no: at(e.whatIf.no) };
    }
  }
  const skillMath = skillMathFor(profileSkills, wt);
  return { world, radar, profileSkills, skillMath, pace, whatIfYou, matches, unreachable, sectors, chosen, lasting, bridge, stay, plan, pathway: pathwayView(plan, state), sdgSummary, resume, resumeTips, changes: null, data, scenarios };
}

const SECTOR_NOUN: Record<SectorId, string> = {
  computing: "computing", engineering: "engineering", science: "science", finance: "accounting or finance", business: "business",
  service: "this field", logistics: "logistics", health: "a health field", trades: "this trade", education: "education",
};
const STAY_SKILLS = 4;
// The job you have, scored the same way as target jobs: how long its skills last, which fade first, and what is growing in it.
function stayFor(occId: string, have: string[], wt: World["weights"]) {
  const occ = occupationById[occId];
  const own = occ.skills.map((id) => ({ skillId: id, expiry: expiryFor(id, wt) }));
  const outlook = mean(own.map((x) => durability(x.expiry)));
  const ilo = series.ilo[occ.isco] ?? null;
  const status = ilo?.gradient?.includes("Gradient 4") ? "fast" as const : ilo?.gradient?.startsWith("Exposed") || outlook < AT_RISK_BELOW ? "changing" as const : "steady" as const;
  const fast = status === "fast";
  const byYear = [...own].sort((a, b) => a.expiry.expected - b.expiry.expected);
  const fadeYear = Object.fromEntries([...FUTURE_IDS, FORECAST].map((f) => {
    const ys = own.map((x) => yearUnder(x.expiry, f)).sort((a, b) => a - b);
    const half = ys[Math.ceil(ys.length / 2) - 1];
    return [f, half !== undefined && Number.isFinite(half) ? fmtYear(half) : null];
  }));
  const held = new Set(have);
  const mine = byYear.filter((x) => held.has(x.skillId) && !x.expiry.durable).slice(0, 3);
  // Growing: what the evolved version of this job adds; otherwise the longest-lasting skills in its sector. AI tools always.
  const ev = occ.evolved ? roleById[occ.evolved] : null;
  const fresh = (ids: string[]) => ids.filter((id) => !held.has(id) && !occ.skills.includes(id))
    .map((id) => ({ skillId: id, expiry: expiryFor(id, wt) })).sort((a, b) => durability(b.expiry) - durability(a.expiry));
  // Neighbouring jobs: those that share at least two skills with this one, so a civil engineer is not told to learn mechanics.
  const shares = (r: (typeof roles)[number]) => occ.skills.filter((id) => id in r.skills).length >= 2;
  const sameField = roles.filter((r) => r.sector === occ.sector && shares(r));
  const near = sameField.length ? sameField : roles.filter(shares);
  const count = (id: string) => near.filter((r) => id in r.skills).length;
  const sectorPool = [...new Set(near.flatMap((r) => Object.keys(r.skills)))];
  const first = fresh(["ai_tools", ...(ev ? Object.keys(ev.skills) : [])].filter((id, i, a) => a.indexOf(id) === i));
  first.sort((a, b) => (b.skillId === "ai_tools" ? 1 : 0) - (a.skillId === "ai_tools" ? 1 : 0));
  const fill = fresh(sectorPool).filter((x) => durability(x.expiry) >= LASTING_OUTLOOK && !first.some((f) => f.skillId === x.skillId))
    .sort((a, b) => count(b.skillId) - count(a.skillId) || durability(b.expiry) - durability(a.expiry));
  const grow = [...first, ...fill].slice(0, STAY_SKILLS - 1);
  const show = (x: { skillId: string; expiry: SkillExpiry }) => ({ skillId: x.skillId, name: skillById[x.skillId].name, expected: x.expiry.durable ? "after 2040" : fmtYear(x.expiry.expected),
    byFuture: dates(x.expiry) });
  return { growing: grow, fast, view: { occupationId: occ.id, title: occ.title, status, fast, outlook, ilo, fadeYear, fading: mine.map(show), growing: grow.map(show) } };
}

// A skill AI is expected to take over in time (durability under 1) goes under "AI will handle"; the rest stay the
// worker's. General tools (AI tools, spreadsheets) are not a human edge, so they are left out; if nothing else lasts,
// staysYours is empty and the card points to the human core sentence instead.
function whyFor(m: RoleMatch, interests: string[], field: SectorId | undefined, wt: World["weights"]): RoleMatchView["why"] {
  const r = roleById[m.roleId];
  const own = Object.entries(r.skills).map(([id, imp]) => ({ id, imp, e: expiryFor(id, wt) }));
  const fades = own.filter((x) => !x.e.durable && x.id !== "ai_tools").sort((a, b) => a.e.expected - b.e.expected);
  const stays = own.filter((x) => x.e.durable && !GENERAL_TOOLS.has(x.id)).sort((a, b) => b.imp - a.imp);
  const name = (id: string) => skillById[id].name;
  return {
    likes: INTERESTS.filter((i) => r.tags.includes(i.id) && interests.includes(i.id)).map((i) => i.label),
    inField: !!field && field === r.sector,
    have: m.have.filter((id) => id !== "ai_tools").map((id) => ({ skillId: id, name: name(id) })),
    humanEdge: r.humanEdge, icon: r.icon,
    aiDoes: fades.map((x) => ({ skillId: x.id, name: name(x.id), byFuture: dates(x.e) })),
    staysYours: stays.map((x) => ({ skillId: x.id, name: name(x.id) })),
  };
}

const GENERAL_TOOLS = new Set(["ai_tools", "spreadsheets"]);

export const LASTING_OUTLOOK = 0.7; // no "fading skills" penalty at or above this outlook
export const BRIDGE_WEEKS = 8;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const monthsBetween = (a: number, b: number) => Math.round((b - a) * 12);

function diffViews(a: View, b: View, state: SessionState): Change[] {
  const out: Change[] = [];
  const live = LIVE_QUARTER(), pub = series.dosm.publishedAt[live];
  const dosmSrc = { name: `DOSM Job Market Insights, ${live.replace("Q", " Q")} release`, url: sourceById.dosm.url, date: pub ? isoDay(pub) : `retrieved ${sourceById.dosm.retrieved}` };
  const epochSrc = { name: "Epoch AI benchmarking data", url: sourceById.epoch.url, date: `retrieved ${sourceById.epoch.retrieved}` };

  const headline = b.world.settledEvents.map((e) => ({ e, s: e.strikes.find((x) => x.base)! }));
  for (const { e, s: q } of headline) {
    const o = q.settled!.outcome;
    const fav = FUTURES.map((f) => ({ f, p: o ? q.futures[f.id] : 1 - q.futures[f.id] })).sort((x, y) => y.p - x.p)[0];
    out.push({
      kind: "market", text: `Answered: ${e.text} ${o ? "Yes" : "No"}.`,
      why: `The crowd said ${pct(q.close)}. The ${fav.f.name} future had given this outcome the highest probability (${pct(fav.p)}).`,
      source: e.id.startsWith("dosm") ? dosmSrc : epochSrc,
    });
  }
  for (const f of FUTURES) {
    const x = a.world.futures.find((u) => u.id === f.id)!.weight, y = b.world.futures.find((u) => u.id === f.id)!.weight;
    const d = Math.round((y - x) * 100);
    out.push({
      kind: "futures", text: `${f.name}: ${pct(x)} → ${pct(y)} likely${d === 0 ? " (no change)" : ""}`,
      why: `It predicted the real answer correctly in ${headline.filter(({ s: q }) => (q.settled!.outcome ? q.futures[f.id] : 1 - q.futures[f.id]) > 0.5).length} of ${headline.length} questions.`,
      source: { name: "Settled market questions", url: sourceById.epoch.url, date: `${live.replace("Q", " Q")} data` },
    });
  }
  const ka = a.world.kindSummary, kb = b.world.kindSummary;
  const moved = kb.map((k) => ({ k: k.kind, d: k.influence - ka.find((z) => z.kind === k.kind)!.influence })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
  out.push({
    kind: "forecasters", text: `The computer-made ${moved.k}s' vote changed the most (${moved.d > 0 ? "up" : "down"} ${Math.abs(moved.d).toFixed(2)}× on average).`,
    why: "Players whose predictions were closer to the real answers got a bigger vote.", source: epochSrc,
  });
  out.push(...profileChanges(a, b, state, { jobs: dosmSrc, skills: { name: "ILO 2025 exposure + Anthropic Economic Index + futures", url: sourceById.ilo.url, date: `weights as of ${live.replace("Q", " Q")}` }, unchanged: epochSrc }));
  const q = series.dosm.quarters;
  const q1 = q.find((d) => d.q === prevQuarter(live))!, q2 = q.find((d) => d.q === live)!;
  out.push({
    kind: "demand", text: `Office admin jobs: ${q1.clerical_share.toFixed(1)} → ${q2.clerical_share.toFixed(1)} in every 100 job ads. All job ads ${q2.total >= q1.total ? "up" : "down"} ${Math.abs(((q2.total / q1.total) - 1) * 100).toFixed(1)}%.`,
    why: `Real government (DOSM) numbers for ${quarterPlain(live)}.`, source: dosmSrc,
  });
  return out;
}

// What moved for this person between two views: their skill dates, their job list and their plan.
type Src = { name: string; url: string; date: string };
function profileChanges(a: View, b: View, state: SessionState, src: { jobs: Src; skills: Src; unchanged: Src }, why = { skills: "Our prediction of how fast AI is moving changed, so the date moved." }): Change[] {
  const out: Change[] = [];
  if (!state.profile) return out;
  const shifts = b.profileSkills.map((s) => {
    const before = a.profileSkills.find((z) => z.skillId === s.skillId)!;
    return { name: s.name, m: monthsBetween(before.expiry.expectedYear, s.expiry.expectedYear), from: before.expiry.expected, to: s.expiry.expected, dur: s.expiry.durable };
  }).filter((s) => s.m !== 0 && !s.dur && s.from !== s.to).sort((x, y) => Math.abs(y.m) - Math.abs(x.m)).slice(0, 4);
  for (const s of shifts) {
    out.push({
      kind: "skills", text: `${s.name}: AI could take it over by ${s.to} (was ${s.from}, ${Math.abs(s.m)} ${Math.abs(s.m) === 1 ? "month" : "months"} ${s.m > 0 ? "later" : "sooner"}).`,
      why: why.skills, source: src.skills,
    });
  }
  if (!shifts.length) out.push({ kind: "skills", text: "None of your skill dates moved by a month or more.", why: "Our prediction of how fast AI is moving changed too little to move any date.", source: src.unchanged });
  const ra = new Map(a.matches.map((m) => [m.roleId, m.rank]));
  const moves = b.matches.map((m) => ({ t: m.title, from: ra.get(m.roleId), to: m.rank })).filter((m) => m.from !== m.to).slice(0, 5);
  for (const m of moves) {
    out.push({ kind: "jobs", text: `${m.t}: now number ${m.to} on your list (was ${m.from ?? "not listed"}).`, why: "We rechecked each job with the new job-ad numbers and our new prediction of how fast AI is moving.", source: src.jobs });
  }
  if (!moves.length) out.push({ kind: "jobs", text: "The job ranking did not change.", why: "The new numbers changed the scores a little, but not enough to change the order.", source: src.jobs });
  if (a.plan && b.plan && (a.plan.roleId !== b.plan.roleId || a.plan.totalWeeks !== b.plan.totalWeeks)) {
    out.push({ kind: "plan", text: a.plan.roleId !== b.plan.roleId ? `Top plan changed: ${a.plan.title} → ${b.plan.title}.` : `Plan length: ${a.plan.totalWeeks} → ${b.plan.totalWeeks} weeks.`, why: "Your plan follows the job at the top of your list.", source: src.jobs });
  } else if (b.plan) out.push({ kind: "plan", text: `Plan unchanged: ${b.plan.title}, ${b.plan.totalWeeks} weeks.`, why: "The job at the top of your list stayed the same.", source: src.jobs });
  return out;
}

export function computeView(state: SessionState): View {
  const v = viewCore(state, state.release);
  if (state.release === 1) {
    // "Before" is the app just before the release loaded (t1; a session starts with it loaded, so its start). Building
    // it at that moment also avoids replaying the whole session's simulated trades a second time.
    const t1 = state.clock ? Date.parse(state.clock.t1 ?? state.clock.t0) : undefined;
    const before = viewCore(state, 0, t1, false);
    v.changes = diffViews(before, v, state);
  }
  return v;
}
export { roleById, occupationById, THRESHOLD };

// ---------- history timeline: the app as it stood on a past release's day ----------
// Read-only by construction: these functions only read the session and the loaded data, and return new objects.
function pastWorld(stop: Stop): World {
  const day = stop.day;
  const S = scoresAt(day), w = futureWeights(S, zeroScores());
  const q = dosmQuarterAt(day)!;
  return {
    release: 1, asOfQuarter: q, asOfLabel: `DOSM ${q.replace("Q", " Q")} (published ${isoDay(day)})`, latestLabel: quarterPlain(q),
    // The day of the release after it is left out: it came out after this view's day.
    nextAnswers: { dosm: null, epoch: null },
    events: [], settledEvents: [],
    futures: FUTURES.map((f) => ({ id: f.id, name: f.name, blurb: f.blurb, weight: w[f.id], earned: w[f.id], tilt: 0, capMult: f.capMult, adoptMult: f.adoptMult, drift: f.clericalDriftPp })),
    weights: w, scores: S, crowdTilt: zeroScores(), forecasters: [], kindSummary: [],
    user: { balance: 0, netCash: 0, won: 0, rank: null, of: 0, roi: null, orders: 0, positionValue: 0 },
    replay: { questions: 0, brierLmsr: 0, brierWeighted: 0, brierUnweighted: 0, brierCoin: 0, brierBaseRate: 0, brierBestFuture: 0, bestFuture: "" },
    you: { forecasts: [], brier: null, scored: 0, traded: 0, influenceBefore: 1, influence: 1, maxOrder: 0 },
    agentRoi: {},
    clericalHistory: series.dosm.quarters.filter((d) => d.q >= "2023Q1" && d.q <= q).map((d) => ({ q: d.q, share: d.clerical_share })),
    epochQuarter: epochQuarterAt(day) ?? q,
    past: { q: stop.q, day, label: stop.label, url: stop.url },
  };
}

// The view as of a past stop: DOSM figures published by its day, Epoch AI results settled by it, forecast weights from
// the answers public by it, and skill dates counted from it. Today's ILO and Anthropic Economic Index scores are used.
export function viewAsOf(state: SessionState, q: string): View {
  const stop = historyStops().find((s) => s.q === q);
  if (!stop || stop.today) throw new Error(`No past release ${q}`);
  return withNow(yearOf(stop.day), () => viewFrom(state, pastWorld(stop)));
}

// "What this release changed": the view at a stop against the view at the stop before it. Every before and after
// number is read from those two views, so the log always agrees with what the pages show at each stop.
export function historyChanges(state: SessionState, q: string, views: { at: (q: string) => View }): Change[] {
  const stops = historyStops();
  const i = stops.findIndex((s) => s.q === q);
  if (i < 0) throw new Error(`No release ${q}`);
  const stop = stops[i], prev = i > 0 ? stops[i - 1] : null;
  const b = views.at(stop.q), a = prev ? views.at(prev.q) : null;
  const out: Change[] = [];
  const release = { name: `DOSM Job Market Insights, ${stop.q.replace("Q", " Q")} release`, url: stop.url, date: isoDay(stop.day) };
  const epochSrc = { name: "Epoch AI benchmarking data", url: sourceById.epoch.url, date: `retrieved ${sourceById.epoch.retrieved}` };

  const qb = b.world.asOfQuarter, cur = series.dosm.quarters.find((d) => d.q === qb)!;
  const before = series.dosm.quarters.find((d) => d.q === prevQuarter(qb));
  out.push(prev && before
    ? { kind: "demand", text: `Office admin jobs: ${before.clerical_share.toFixed(1)} → ${cur.clerical_share.toFixed(1)} in every 100 job ads. All job ads ${cur.total >= before.total ? "up" : "down"} ${Math.abs(((cur.total / before.total) - 1) * 100).toFixed(1)}%.`, why: `Real government (DOSM) numbers for ${quarterPlain(qb)}, published ${isoDay(stop.day)}.`, source: release }
    : { kind: "demand", text: `Office admin jobs: ${cur.clerical_share.toFixed(1)} in every 100 job ads.`, why: `The first quarter DOSM counted job ads its new way, so it is not compared with the quarter before.`, source: release });

  // Answers that became public after the stop before and by this one (the first stop: those published that day).
  const answered = makeQuestions().filter((x) => {
    if (x.phase === "next") return false;
    const d = settleDay(x);
    return d !== null && d <= stop.day && (prev ? d > prev.day : d === stop.day);
  });
  if (answered.length) out.push({ kind: "market", text: `${answered.length} ${answered.length === 1 ? "question" : "questions"} answered${prev ? ` since ${isoDay(prev.day)}` : ` on ${isoDay(stop.day)}`}.`, why: "Each answer updates how likely each AI speed is.", source: release });
  for (const x of answered) {
    const o = x.phase === "live" ? ladder(x)[1].outcome : x.outcome;
    out.push({ kind: "market", text: `Answered: ${x.text} ${o ? "Yes" : "No"}.`, why: `Published ${isoDay(settleDay(x)!)}.`, source: x.kind === "dosm" ? release : epochSrc });
  }

  const forecastSrc = { name: "Settled market questions", url: sourceById.epoch.url, date: isoDay(stop.day) };
  for (const f of FUTURES) {
    const y = b.world.weights[f.id];
    if (!a) { out.push({ kind: "futures", text: `${f.name}: ${pct(y)} likely`, why: "Worked out from every answer public that day.", source: forecastSrc }); continue; }
    const x = a.world.weights[f.id], d = Math.round((y - x) * 100);
    out.push({
      kind: "futures", text: `${f.name}: ${pct(x)} → ${pct(y)} likely${d === 0 ? " (no change)" : ""}`,
      why: stop.today ? "Today's forecast also counts the open questions' current predictions, most of them from computer-made players." : "Worked out again from every answer public that day.",
      source: forecastSrc,
    });
  }

  if (state.profile) {
    if (a) {
      const skillsSrc = { name: "ILO 2025 exposure + Anthropic Economic Index + futures", url: sourceById.ilo.url, date: `as of ${isoDay(stop.day)}` };
      out.push(...profileChanges(a, b, state, { jobs: release, skills: skillsSrc, unchanged: skillsSrc }, { skills: "Dates are counted from each release's own day, with the forecast as it stood then." }));
    } else if (b.chosen) out.push({ kind: "plan", text: `Your top job then: ${b.chosen.title}.`, why: "Your plan follows the job at the top of your list.", source: release });
  }
  return out;
}
export type { Stop };
