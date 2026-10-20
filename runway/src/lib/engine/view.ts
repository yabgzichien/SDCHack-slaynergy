import { skills, skillById, roles, roleById, occupations, occupationById, series, sdg, sourceById, SECTORS, EDUCATION_LABEL, type SectorId } from "./data";
import { computeWorld, type World } from "./world";
import { expiryFor, durability, fmtYear, NOW, THRESHOLD, type SkillExpiry } from "./expiry";
import { matchRoles, pickInputs, demandFor, tradeoff, type RoleMatch } from "./matching";
import { buildPlan, type Plan } from "./plan";
import { FUTURES, FUTURE_IDS } from "./futures-def";
import type { SessionState } from "./state";
import { mean } from "./math";
import { tailorTips, type ResumeSummary } from "./resume";

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
  matches: (RoleMatchView)[];
  unreachable: { roleId: string; title: string; weeks: number; sector: SectorId; reason: "qualification" | "time"; need: string }[];
  sectors: { id: SectorId; label: string; blurb: string; reachable: number; total: number; bestScore: number | null; bestTitle: string | null; avgOutlook: number | null }[];
  chosen: RoleMatchView | null;
  plan: Plan | null;
  sdgSummary: { target: string; goal: string; text: string }[];
  resume: ResumeSummary | null;
  resumeTips: ReturnType<typeof tailorTips> | null;
  changes: Change[] | null;
  data: { name: string; detail: string; url: string; date: string; licence: string }[];
};
export type SkillExpiryView = { expected: string; expectedYear: number; byFuture: Record<string, string>; exposure: number; durable: boolean; coverage: number };
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
  let plan: Plan | null = null;
  if (p) {
    const input = pickInputs({ skills: p.skills, months: p.months, hoursPerWeek: p.hoursPerWeek, interests: p.interests, goals: state.goals, education: p.education, field: occupationById[p.occupationId]?.sector });
    const all = matchRoles(input, wt, world.asOfQuarter);
    const reachable = all.filter((m) => m.reachable);
    const toView = (m: RoleMatch): RoleMatchView => ({
      ...m, tradeoff: tradeoff(m, reachable), sdgText: sdg[m.sdgTarget]?.text ?? "",
      resumeFit: state.resume ? tailorTips(state.resume.skillIds, roleById[m.roleId].skills).match : null,
      gaps: m.gaps.map((g) => ({ skillId: g.skillId, name: g.name, importance: g.importance, expiry: eview(g.expiry), sdgTarget: skillById[g.skillId].sdg.target })),
    });
    matches = reachable.map(toView);
    unreachable = all.filter((m) => !m.reachable).map((m) => ({ roleId: m.roleId, title: m.title, weeks: m.weeks, sector: m.sector, reason: m.blocked ? "qualification" as const : "time" as const, need: m.blocked ? `Needs a ${EDUCATION_LABEL[m.requires].toLowerCase()}` : `≈ ${m.weeks} weeks` }));
    sectors = SECTORS.map((sec) => {
      const inSec = all.filter((m) => m.sector === sec.id), ok = inSec.filter((m) => m.reachable);
      return { ...sec, reachable: ok.length, total: inSec.length, bestScore: ok[0]?.score ?? null, bestTitle: ok[0]?.title ?? null, avgOutlook: ok.length ? mean(ok.map((m) => m.outlook)) : null };
    });
    const pick = (state.chosenRoleId && matches.find((m) => m.roleId === state.chosenRoleId)) || matches[0] || null;
    chosen = pick;
    if (pick) plan = buildPlan(all.find((m) => m.roleId === pick.roleId)!, p.hoursPerWeek);
  }
  const targets = new Set<string>();
  if (plan) { plan.summary.layer1.forEach((t) => targets.add(t)); if (chosen) targets.add(chosen.sdgTarget); }
  const sdgSummary = [...targets].map((t) => ({ target: t, goal: sdg[t].goal, text: sdg[t].text }));
  const data = series.sources.map((s) => ({ name: s.name, detail: s.latest, url: s.url, date: s.retrieved, licence: s.licence }));
  const resume = state.resume ?? null;
  const resumeTips = resume && chosen ? tailorTips(resume.skillIds, roleById[chosen.roleId].skills) : null;
  return { world, radar, profileSkills, matches, unreachable, sectors, chosen, plan, sdgSummary, resume, resumeTips, changes: null, data };
}

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
    why: "Forecasters whose probabilities were closer to the real outcomes gained influence (Brier score).", source: epochSrc,
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
