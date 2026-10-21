import { skills, skillById, roles, roleById, occupations, occupationById, series, sdg, sourceById, SECTORS, EDUCATION_LABEL, EDUCATION_RANK, quarterIndex, type SectorId } from "./data";
import { computeWorld, type World } from "./world";
import { expiryFor, durability, fmtYear, NOW, THRESHOLD, type SkillExpiry } from "./expiry";
import { matchRoles, pickInputs, demandFor, tradeoff, AT_RISK_BELOW, type RoleMatch } from "./matching";
import { buildPlan, buildReshapePlan, type Plan } from "./plan";
import { FUTURES, FUTURE_IDS } from "./futures-def";
import { STAY_ID, type SessionState } from "./state";
import { mean } from "./math";
import { tailorTips, type ResumeSummary } from "./resume";
import { cardById, completionGate, doneMap, gradeQuiz, interview, promptChecklist, type Interview, type TaskCard } from "./pathway";

export type RadarSkill = {
  skillId: string; name: string; expected: string; expectedYear: number; byFuture: Record<string, string>;
  exposure: number; gradient: string | null; coverage: number; iloTitle: string | null; sdgTarget: string; durable: boolean;
};
export type RadarJob = { roleId: string; title: string; trend: number; share: number; group: string; outlook: number; sdgTarget: string };
export type Radar = {
  declining: RadarSkill[]; rising: (RadarSkill & { demand: number })[];
  risingJobs: RadarJob[]; decliningJobs: { occupationId: string; title: string; exposure: number; gradient: string | null; earliest: string }[];
  sources: { name: string; detail: string; url: string; date: string }[];
};
export type Change = { kind: "futures" | "market" | "skills" | "jobs" | "plan" | "demand" | "forecasters"; text: string; why: string; source: { name: string; url: string; date: string } };

export type View = {
  world: World;
  radar: Radar;
  profileSkills: { skillId: string; name: string; expiry: SkillExpiryView }[];
  pace: { futures: Pace[]; expectedMonths: number; asOf: string; source: { name: string; url: string } };
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
  data: { name: string; detail: string; url: string; date: string; licence: string }[];
};
// The task card as the browser sees it: the planted mistakes stay on the server until the worker finds them.
export type CardView = Omit<TaskCard, "sampleAnswer"> & { sampleAnswer: { id: string; text: string; reveal?: { kind: string; why: string } }[]; mistakes: number };
export type PathwayView = {
  done: Record<string, boolean>;
  gate: { ok: boolean; missing: string[] };
  card: CardView | null;
  promptCovers: string[];
  interview: Interview;
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
    card, promptCovers: c && w.prompt ? promptChecklist(c, w.prompt) : [],
    interview,
  };
}

// steady: ILO finds little GenAI exposure. changing: exposed, so the job is shifting but should last if you add its
// growing skills. fast: ILO's highest-exposure gradient (most tasks automatable), so staying is shown as a bridge
// towards a lasting job (toward), if one is reachable.
export type StayView = {
  occupationId: string; title: string; status: "steady" | "changing" | "fast"; fast: boolean; outlook: number;
  ilo: { score: number; gradient: string | null; title: string } | null;
  fadeYear: string | null; // the year by which most of this job's skills are expected to fade
  fading: { skillId: string; name: string; expected: string }[];
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
};

const eview = (e: SkillExpiry): SkillExpiryView => ({
  expected: e.durable ? `after 2040` : fmtYear(e.expected), expectedYear: e.expected, exposure: e.exposure, durable: e.durable, coverage: e.coverage,
  byFuture: Object.fromEntries(FUTURE_IDS.map((id) => [id, Number.isFinite(e.byFuture[id]) ? fmtYear(e.byFuture[id]) : "after 2040"])),
  byFutureYear: Object.fromEntries(FUTURE_IDS.map((id) => [id, Number.isFinite(e.byFuture[id]) ? e.byFuture[id] : null])),
});

function radarFor(w: World): Radar {
  const wt = w.weights;
  const all = skills.map((s) => {
    const e = expiryFor(s.id, wt);
    return { s, e };
  });
  const toSkill = ({ s, e }: { s: (typeof skills)[number]; e: SkillExpiry }): RadarSkill => ({
    skillId: s.id, name: s.name, expected: e.durable ? "after 2040" : fmtYear(e.expected), expectedYear: e.expected,
    byFuture: Object.fromEntries(FUTURE_IDS.map((id) => [id, Number.isFinite(e.byFuture[id]) ? fmtYear(e.byFuture[id]) : "after 2040"])),
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
    .filter((x) => x.durable || x.expectedYear > NOW + 5)
    .sort((a, b) => b.rank - a.rank).slice(0, 9)
    .map((x) => { const out: RadarSkill & { demand: number } = { ...x }; delete (out as Record<string, unknown>).rank; return out; });

  const risingJobs = roles
    .map((r) => {
      const d = demands[r.id];
      const out = Object.entries(r.skills).reduce((a, [sid, imp]) => a + imp * durability(expiryFor(sid, wt)), 0) / Object.values(r.skills).reduce((a, b) => a + b, 0);
      return { roleId: r.id, title: r.title, trend: d.trend, share: d.recent, group: d.label, outlook: out, sdgTarget: r.sdg.target, k: out * 0.6 + d.score * 0.4 };
    })
    .sort((a, b) => b.k - a.k).slice(0, 8).map((x) => ({ roleId: x.roleId, title: x.title, trend: x.trend, share: x.share, group: x.group, outlook: x.outlook, sdgTarget: x.sdgTarget }));

  const decliningJobs = occupations
    .map((o) => {
      const ilo = series.ilo[o.isco];
      const earliest = Math.min(...o.skills.map((s) => expiryFor(s, wt).expected));
      return { occupationId: o.id, title: o.title, exposure: ilo?.score ?? 0, gradient: ilo?.gradient ?? null, earliest: fmtYear(earliest), e: earliest };
    })
    .sort((a, b) => b.exposure - a.exposure).slice(0, 6).map((x) => ({ occupationId: x.occupationId, title: x.title, exposure: x.exposure, gradient: x.gradient, earliest: x.earliest }));

  const dosm = sourceById.dosm, ilo = sourceById.ilo, aei = sourceById.aei, ep = sourceById.epoch;
  return {
    declining, rising, risingJobs, decliningJobs,
    sources: [
      { name: "ILO 2025 GenAI exposure (ISCO-08)", detail: "How exposed each occupation's tasks are to generative AI", url: ilo.url, date: `scores ${ilo.latest}; retrieved ${ilo.retrieved}` },
      { name: "Anthropic Economic Index", detail: "Share of an occupation's tasks seen in real AI use", url: aei.url, date: `release ${aei.latest.split(" ")[0]}; retrieved ${aei.retrieved}` },
      { name: "DOSM Job Market Insights", detail: "Online job ads by occupation group (demand)", url: dosm.url, date: w.release ? "2026 Q2 (published 18 Aug 2026)" : "to 2026 Q1; Q2 held back" },
      { name: "Epoch AI benchmarks", detail: "How fast AI capability is growing (anchors the futures)", url: ep.url, date: `to ${w.asOfQuarter.replace("Q", " Q")}; retrieved ${ep.retrieved}` },
    ],
  };
}

function viewCore(state: SessionState, release: 0 | 1): View {
  const st = { ...state, release };
  const world = computeWorld(st);
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
  if (p) {
    const occ = occupationById[p.occupationId];
    const study = p.study !== undefined ? p.study : EDUCATION_RANK[p.education] >= 1 ? occ?.sector : null;
    const input = pickInputs({ skills: p.skills, months: p.months, hoursPerWeek: p.hoursPerWeek, interests: p.interests, goals: state.goals, education: p.education, field: occ?.sector, study });
    const all = matchRoles(input, wt, world.asOfQuarter);
    const reachable = all.filter((m) => m.reachable);
    const toView = (m: RoleMatch): RoleMatchView => ({
      ...m, tradeoff: tradeoff(m, reachable), sdgText: sdg[m.sdgTarget]?.text ?? "",
      resumeFit: state.resume ? tailorTips(state.resume.skillIds, roleById[m.roleId].skills).match : null,
      gaps: m.gaps.map((g) => ({ skillId: g.skillId, name: g.name, importance: g.importance, expiry: eview(g.expiry), sdgTarget: skillById[g.skillId].sdg.target })),
    });
    matches = reachable.map(toView);
    unreachable = all.filter((m) => !m.reachable).map((m) => ({ roleId: m.roleId, title: m.title, weeks: m.weeks, sector: m.sector, reason: m.blocked ? "qualification" as const : "time" as const, need: m.blockedBy === "field" ? `Needs a degree in ${SECTOR_NOUN[m.sector]}` : m.blocked ? `Needs a ${EDUCATION_LABEL[m.requires].toLowerCase()}` : `≈ ${m.weeks} weeks` }));
    sectors = SECTORS.map((sec) => {
      const inSec = all.filter((m) => m.sector === sec.id), ok = inSec.filter((m) => m.reachable);
      return { ...sec, reachable: ok.length, total: inSec.length, bestScore: ok[0]?.score ?? null, bestTitle: ok[0]?.title ?? null, avgOutlook: ok.length ? mean(ok.map((m) => m.outlook)) : null };
    });
    lasting = matches.find((m) => m.outlook >= LASTING_OUTLOOK) ?? null;
    const quick = Math.min(BRIDGE_WEEKS, Math.floor((matches[0]?.deadlineWeeks ?? 0) / 2));
    bridge = matches.find((m) => m.outlook < LASTING_OUTLOOK && m.weeks <= quick && m.roleId !== lasting?.roleId) ?? null;
    if (occ) {
      const s = stayFor(occ.id, p.skills, wt);
      const toward = s.fast ? lasting : null;
      stay = { ...s.view, toward };
      if (state.chosenRoleId === STAY_ID) {
        if (toward) { chosen = toward; plan = buildPlan(all.find((m) => m.roleId === toward.roleId)!, p.hoursPerWeek, occ.title); }
        else {
          const ev = occ.evolved ? all.find((m) => m.roleId === occ.evolved) : undefined;
          chosen = ev ? toView(ev) : null;
          plan = buildReshapePlan(occ.title, s.growing, Math.floor(p.months * 4.345 - 2), p.hoursPerWeek, occ.sector);
        }
      }
    }
    if (!plan) {
      const pick = (state.chosenRoleId && matches.find((m) => m.roleId === state.chosenRoleId)) || lasting || matches[0] || null;
      chosen = pick;
      if (pick) plan = buildPlan(all.find((m) => m.roleId === pick.roleId)!, p.hoursPerWeek);
    }
  }
  const targets = new Set<string>();
  if (plan) { plan.summary.layer1.forEach((t) => targets.add(t)); if (chosen) targets.add(chosen.sdgTarget); }
  const sdgSummary = [...targets].map((t) => ({ target: t, goal: sdg[t].goal, text: sdg[t].text }));
  const data = series.sources.map((s) => ({ name: s.name, detail: s.latest, url: s.url, date: s.retrieved, licence: s.licence }));
  const resume = state.resume ?? null;
  const resumeTips = resume && chosen ? tailorTips(resume.skillIds, roleById[chosen.roleId].skills) : null;
  const fr = series.epoch.metr.frontier.filter((x) => quarterIndex(x.q) <= quarterIndex(world.asOfQuarter)).slice(-5);
  const perQuarter = mean(fr.slice(1).map((x, i) => x.v - fr[i].v));
  const paceFutures: Pace[] = FUTURES.map((f) => ({ id: f.id, doublingMonths: 3 / (f.capMult * perQuarter), clericalPerYear: f.clericalDriftPp * 4, weight: world.weights[f.id] }));
  const pace = {
    futures: paceFutures,
    expectedMonths: 3 / (perQuarter * FUTURES.reduce((a, f) => a + world.weights[f.id] * f.capMult, 0)),
    asOf: world.asOfQuarter,
    source: { name: "METR time horizon, via Epoch AI", url: sourceById.epoch.url },
  };
  return { world, radar, profileSkills, pace, matches, unreachable, sectors, chosen, lasting, bridge, stay, plan, pathway: pathwayView(plan, state), sdgSummary, resume, resumeTips, changes: null, data };
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
  const half = byYear[Math.ceil(byYear.length / 2) - 1];
  const fadeYear = half && !half.expiry.durable ? fmtYear(half.expiry.expected) : null;
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
  const show = (x: { skillId: string; expiry: SkillExpiry }) => ({ skillId: x.skillId, name: skillById[x.skillId].name, expected: x.expiry.durable ? "after 2040" : fmtYear(x.expiry.expected) });
  return { growing: grow, fast, view: { occupationId: occ.id, title: occ.title, status, fast, outlook, ilo, fadeYear, fading: mine.map(show), growing: grow.map(show) } };
}

export const LASTING_OUTLOOK = 0.7; // no "fading skills" penalty at or above this outlook
export const BRIDGE_WEEKS = 8;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const monthsBetween = (a: number, b: number) => Math.round((b - a) * 12);

function diffViews(a: View, b: View, state: SessionState): Change[] {
  const out: Change[] = [];
  const dosmSrc = { name: "DOSM Job Market Insights, 2026 Q2 release", url: sourceById.dosm.url, date: "18 Aug 2026" };
  const epochSrc = { name: "Epoch AI benchmarking data", url: sourceById.epoch.url, date: `retrieved ${sourceById.epoch.retrieved}` };

  const headline = b.world.settledEvents.map((e) => ({ e, s: e.strikes.find((x) => x.base)! }));
  for (const { e, s: q } of headline) {
    const o = q.settled!.outcome;
    const fav = FUTURES.map((f) => ({ f, p: o ? q.futures[f.id] : 1 - q.futures[f.id] })).sort((x, y) => y.p - x.p)[0];
    out.push({
      kind: "market", text: `Settled: ${e.text.replace(/^Will /, "").replace(/\?$/, "")}? ${o ? "Yes" : "No"}.`,
      why: `The crowd said ${pct(q.close)}. The ${fav.f.name} future had given this outcome the highest probability (${pct(fav.p)}).`,
      source: e.id.startsWith("dosm") ? dosmSrc : epochSrc,
    });
  }
  for (const f of FUTURES) {
    const x = a.world.futures.find((u) => u.id === f.id)!.weight, y = b.world.futures.find((u) => u.id === f.id)!.weight;
    const d = Math.round((y - x) * 100);
    out.push({
      kind: "futures", text: `${f.name}: ${pct(x)} → ${pct(y)}${d === 0 ? " (unchanged)" : ` (${d > 0 ? "+" : ""}${d} points)`}`,
      why: `It gave the real outcome a probability above 50% in ${headline.filter(({ s: q }) => (q.settled!.outcome ? q.futures[f.id] : 1 - q.futures[f.id]) > 0.5).length} of ${headline.length} settled questions.`,
      source: { name: "Settled market questions", url: sourceById.epoch.url, date: "2026 Q2 data" },
    });
  }
  const ka = a.world.kindSummary, kb = b.world.kindSummary;
  const moved = kb.map((k) => ({ k: k.kind, d: k.influence - ka.find((z) => z.kind === k.kind)!.influence })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
  out.push({
    kind: "forecasters", text: `Influence moved most for simulated ${moved.k}s (${moved.d > 0 ? "up" : "down"} ${Math.abs(moved.d).toFixed(2)}x on average).`,
    why: "Forecasters whose chances were closer to what really happened gained influence.", source: epochSrc,
  });
  if (state.profile) {
    const shifts = b.profileSkills.map((s) => {
      const before = a.profileSkills.find((z) => z.skillId === s.skillId)!;
      return { name: s.name, m: monthsBetween(before.expiry.expectedYear, s.expiry.expectedYear), from: before.expiry.expected, to: s.expiry.expected, dur: s.expiry.durable };
    }).filter((s) => s.m !== 0 && !s.dur).sort((x, y) => Math.abs(y.m) - Math.abs(x.m)).slice(0, 4);
    for (const s of shifts) {
      out.push({
        kind: "skills", text: `${s.name}: expires ${s.from} → ${s.to} (${s.m > 0 ? "+" : ""}${s.m} months).`,
        why: "The expiry date is weighted across the three futures, and the weights moved.", source: { name: "ILO 2025 exposure + Anthropic Economic Index + futures", url: sourceById.ilo.url, date: "weights as of 2026 Q2" },
      });
    }
    if (!shifts.length) out.push({ kind: "skills", text: "No skill expiry date moved by a month or more.", why: "The weights shifted too little to change any date by a full month.", source: epochSrc });
    const ra = new Map(a.matches.map((m) => [m.roleId, m.rank]));
    const moves = b.matches.map((m) => ({ t: m.title, from: ra.get(m.roleId), to: m.rank })).filter((m) => m.from !== m.to).slice(0, 5);
    for (const m of moves) {
      out.push({ kind: "jobs", text: `${m.t}: rank ${m.from ?? "–"} → ${m.to}.`, why: "Future outlook and job demand were recomputed with the new weights and the 2026 Q2 job-ad shares.", source: dosmSrc });
    }
    if (!moves.length) out.push({ kind: "jobs", text: "The job ranking did not change.", why: "The new data moved the scores a little but not enough to reorder reachable roles.", source: dosmSrc });
    if (a.plan && b.plan && (a.plan.roleId !== b.plan.roleId || a.plan.totalWeeks !== b.plan.totalWeeks)) {
      out.push({ kind: "plan", text: a.plan.roleId !== b.plan.roleId ? `Top plan changed: ${a.plan.title} → ${b.plan.title}.` : `Plan length: ${a.plan.totalWeeks} → ${b.plan.totalWeeks} weeks.`, why: "The plan follows the highest-ranked role.", source: dosmSrc });
    } else if (b.plan) out.push({ kind: "plan", text: `Plan unchanged: ${b.plan.title}, ${b.plan.totalWeeks} weeks.`, why: "Your top role stayed the same.", source: dosmSrc });
  }
  const q = series.dosm.quarters;
  const q1 = q.find((d) => d.q === "2026Q1")!, q2 = q.find((d) => d.q === "2026Q2")!;
  out.push({
    kind: "demand", text: `Clerical share of online job ads: ${q1.clerical_share.toFixed(2)}% → ${q2.clerical_share.toFixed(2)}%; total ads ${(((q2.total / q1.total) - 1) * 100).toFixed(1)}%.`,
    why: "Real DOSM figures for the quarter that was held back.", source: dosmSrc,
  });
  return out;
}

export function computeView(state: SessionState): View {
  const v = viewCore(state, state.release);
  if (state.release === 1) {
    const before = viewCore(state, 0);
    v.changes = diffViews(before, v, state);
  }
  return v;
}
export { roleById, occupationById, THRESHOLD };
