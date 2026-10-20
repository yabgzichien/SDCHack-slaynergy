import { describe, expect, it } from "vitest";
import { occupations, personas, roles, skills, courses, sdg, series, skillById } from "@/lib/engine/data";
import { matchRoles, pickInputs } from "@/lib/engine/matching";
import { computeWorld } from "@/lib/engine/world";
import { computeView } from "@/lib/engine/view";
import { initialState, type SessionState } from "@/lib/engine/state";
import { futureWeights } from "@/lib/engine/futures";
import { liveQuestions, replayHistory } from "@/lib/engine/replay";
import { ladder, futureProbs } from "@/lib/engine/questions";
import { runTape } from "@/lib/engine/tape";
import { quoteBuy } from "@/lib/market-math";
import { newMarket, price, tradeToward, cost } from "@/lib/engine/lmsr";
import { verifyChain, entryHash, type LogEntry } from "@/lib/server/store";

const hafiz = (): SessionState => {
  const p = personas[0];
  const o = occupations.find((x) => x.id === p.occupation)!;
  return { ...initialState(), profile: { name: p.name, occupationId: o.id, education: p.education, years: p.years, skills: o.skills, interests: p.interests, months: p.months, hoursPerWeek: p.hoursPerWeek, budget: "free", synthetic: true } };
};

describe("fairness: age, gender and background are never inputs", () => {
  it("gives identical results for profiles that differ only in age or gender", () => {
    const w = computeWorld(initialState()).weights;
    for (const o of occupations) {
      const base = { skills: o.skills, months: 5, hoursPerWeek: 10, interests: ["numbers"], goals: [] as string[] };
      const run = (extra: Record<string, unknown>) => JSON.stringify(matchRoles(pickInputs({ ...base, ...extra }), w, "2026Q1").map((m) => [m.roleId, m.score, m.weeks]));
      const a = run({ age: 23, gender: "female" });
      expect(run({ age: 55, gender: "male" })).toBe(a);
      expect(run({ age: 38, gender: "non-binary", ethnicity: "x" })).toBe(a);
    }
  });
});

describe("fairness: the age you give in onboarding never changes your results", () => {
  it("two profiles that differ only in age and name get the same jobs, scores and plan", () => {
    const a = hafiz(), b = hafiz();
    a.profile = { ...a.profile!, age: 23, name: "Aina" };
    b.profile = { ...b.profile!, age: 57, name: "Muthu" };
    const pick = (st: SessionState) => { const v = computeView(st); return JSON.stringify([v.matches.map((m) => [m.roleId, m.score]), v.plan]); };
    expect(pick(a)).toBe(pick(b));
  });
});

describe("closed lists: nothing invented", () => {
  it("every role, skill and course id resolves and every role/skill has an SDG target with UN text", () => {
    for (const r of roles) {
      expect(series.aei[r.onet], `role ${r.id} O*NET id`).toBeTruthy();
      expect(sdg[r.sdg.target], `role ${r.id} sdg`).toBeTruthy();
      for (const k of Object.keys(r.skills)) expect(skillById[k], `${r.id} skill ${k}`).toBeTruthy();
    }
    for (const s of skills) expect(sdg[s.sdg.target], `skill ${s.id}`).toBeTruthy();
    for (const c of courses) {
      expect(c.url.startsWith("https://")).toBe(true);
      expect(c.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const k of c.skills) expect(skillById[k]).toBeTruthy();
    }
    expect(roles.length).toBeGreaterThanOrEqual(80);
    // every skill has at least one checked free course, so no plan step falls back to an estimate
    const covered = new Set(courses.flatMap((c) => c.skills));
    expect(skills.filter((s) => !covered.has(s.id)).map((s) => s.id)).toEqual([]);
  });
});

describe("LMSR market", () => {
  it("prices start at 50% and trades move toward the target without exceeding the budget", () => {
    const m = newMarket(60);
    expect(price(m)).toBeCloseTo(0.5, 6);
    const c0 = cost(m);
    const t = tradeToward(m, 0.8, 1000)!;
    expect(t.side).toBe("yes");
    expect(price(m)).toBeCloseTo(0.8, 3);
    expect(cost(m) - c0).toBeCloseTo(t.spent, 6);
    const m2 = newMarket(60);
    const t2 = tradeToward(m2, 0.9, 5)!;
    expect(t2.spent).toBeLessThanOrEqual(5 + 1e-6);
    expect(price(m2)).toBeLessThan(0.9);
  });
});

describe("futures weights", () => {
  it("keep a 5% floor, no future above 90%, and sum to 1", () => {
    const w = futureWeights({ slow: -200, medium: 0, fast: -90 }, { slow: 0, medium: 0, fast: 0 });
    expect(Math.min(w.slow, w.medium, w.fast)).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(Math.max(w.slow, w.medium, w.fast)).toBeLessThanOrEqual(0.9 + 1e-9);
    expect(w.slow + w.medium + w.fast).toBeCloseTo(1, 9);
  });
  it("earned weights come only from settled outcomes; bets and the crowd never overwrite them", () => {
    const a = computeWorld(initialState());
    const T0 = "2026-10-20T10:00:00.000Z";
    const now = Date.parse(T0) + 300_000;
    const a2 = computeWorld({ ...initialState(), clock: { t0: T0 } }, now);
    const b = computeWorld({ ...initialState(), clock: { t0: T0 }, orders: [{ id: "o1", market: "dosm-2026Q2~1", t: 100, side: "yes", action: "buy", amount: 100 }] }, now);
    a2.futures.forEach((f, i) => expect(f.earned).toBeCloseTo(b.futures[i].earned, 12));
    a.futures.forEach((f, i) => expect(f.earned).toBeCloseTo(b.futures[i].earned, 12));
  });
});

describe("history replay", () => {
  it("accuracy-weighted forecasts beat unweighted ones, and the market beats simple baselines, on real past releases", () => {
    const s = replayHistory().stats;
    expect(s.questions).toBeGreaterThanOrEqual(30);
    expect(s.brierWeightedMean).toBeLessThan(s.brierUnweighted);
    expect(s.brierLmsr).toBeLessThan(s.brierCoin);
    expect(s.brierLmsr).toBeLessThan(s.brierBaseRate);
  });
  it("influence follows accuracy: the most accurate type gains influence and the least accurate types lose it", () => {
    const r = replayHistory();
    const last = r.influenceHistory[r.influenceHistory.length - 1].byKind;
    expect(last.expert).toBeGreaterThan(1);
    expect(last.noisy).toBeLessThan(1);
    expect(last.optimist).toBeLessThan(1);
  });
});

const T0 = "2026-10-20T10:00:00.000Z";
const T1 = "2026-10-20T10:10:00.000Z";
const at = (sec: number) => Date.parse(T0) + sec * 1000;

describe("new data released", () => {
  it("is a deterministic real recomputation that settles the held-back markets and moves the weights", () => {
    const st: SessionState = { ...hafiz(), clock: { t0: T0 }, orders: [{ id: "o1", market: "dosm-2026Q2~1", t: 60, side: "yes", action: "buy", amount: 80 }] };
    const before = computeWorld(st, at(120));
    const rel: SessionState = { ...st, release: 1, clock: { t0: T0, t1: T1 } };
    const after = computeWorld(rel, Date.parse(T1) + 5000);
    expect(after.settledEvents.length).toBe(5);
    expect(after.settledEvents.every((e) => e.strikes.every((s) => s.settled))).toBe(true);
    expect(after.events.every((e) => e.id.endsWith("2026Q3"))).toBe(true);
    expect(after.futures.map((f) => f.weight.toFixed(4))).not.toEqual(before.futures.map((f) => f.weight.toFixed(4)));
    expect(JSON.stringify(computeWorld(rel, Date.parse(T1) + 5000))).toBe(JSON.stringify(after));
    expect(computeView(rel).changes!.length).toBeGreaterThan(5);
    expect(after.user.rank).not.toBeNull();
  });
});

describe("Kalshi-style market", () => {
  const w0 = replayHistory().weights;
  const strikeQ = ladder(liveQuestions("live").find((q) => q.id === "swe-2026Q2")!);
  it("has a ladder of strikes where higher thresholds are less likely", () => {
    const ps = strikeQ.map((s) => futureProbs(s).medium);
    expect(strikeQ.length).toBe(3);
    expect(ps[0]).toBeGreaterThan(ps[1]);
    expect(ps[1]).toBeGreaterThan(ps[2]);
  });
  it("keeps trading live: more trades appear as time passes, and the same inputs give the same chart", () => {
    const a = runTape(strikeQ[1], w0, "W0", [], 10);
    const b = runTape(strikeQ[1], w0, "W0", [], 600);
    expect(b.trades).toBeGreaterThan(a.trades);
    expect(b.series.length).toBeGreaterThan(a.series.length);
    expect(JSON.stringify(runTape(strikeQ[1], w0, "W0", [], 600).series)).toBe(JSON.stringify(b.series));
  });
  it("lets you buy Yes or No, moves the price, and sells back for less than the max payout", () => {
    const m = strikeQ[1].id;
    const base = runTape(strikeQ[1], w0, "W0", [], 120);
    const buyYes = runTape(strikeQ[1], w0, "W0", [{ id: "o1", market: m, t: 60, side: "yes", action: "buy", amount: 100 }], 120);
    const buyNo = runTape(strikeQ[1], w0, "W0", [{ id: "o1", market: m, t: 60, side: "no", action: "buy", amount: 100 }], 120);
    expect(buyYes.price).toBeGreaterThan(base.price);
    expect(buyNo.price).toBeLessThan(base.price);
    expect(buyYes.position.yes).toBeGreaterThan(100); // each contract costs under 1 point
    expect(buyNo.position.no).toBeGreaterThan(100);
    const sold = runTape(strikeQ[1], w0, "W0", [
      { id: "o1", market: m, t: 60, side: "yes", action: "buy", amount: 100 },
      { id: "o2", market: m, t: 61, side: "yes", action: "sell", amount: 1000 },
    ], 120);
    expect(sold.position.yes).toBeCloseTo(0, 6); // you can sell at most what you hold
    const half = buyYes.position.yes / 2;
    const s2 = runTape(strikeQ[1], w0, "W0", [
      { id: "o1", market: m, t: 60, side: "yes", action: "buy", amount: 100 },
      { id: "o2", market: m, t: 62, side: "yes", action: "sell", amount: half },
    ], 120);
    expect(s2.position.yes).toBeCloseTo(half, 6);
    expect(s2.executions[1].points).toBeGreaterThan(0);
    expect(s2.executions[1].points).toBeLessThan(half);
  });
  it("the ticket's instant quote matches the server's executed order", () => {
    const m = strikeQ[1].id;
    const before = runTape(strikeQ[1], w0, "W0", [], 120);
    const q = quoteBuy(before.price, "yes", 75);
    const after = runTape(strikeQ[1], w0, "W0", [{ id: "o1", market: m, t: 119.9, side: "yes", action: "buy", amount: 75 }], 120);
    const ex = after.executions[0];
    expect(ex.shares).toBeCloseTo(q.shares, 1);
    expect(ex.points).toBeCloseTo(75, 3);
    expect(ex.priceAfter).toBeCloseTo(q.priceAfter, 2);
  });
  it("pays 1 point per winning contract at settlement and keeps your points balanced", () => {
    const sweBase = "swe-2026Q2~1"; // settles Yes (+4.8 points)
    const st: SessionState = { ...initialState(), clock: { t0: T0 }, orders: [
      { id: "o1", market: sweBase, t: 30, side: "yes", action: "buy", amount: 100 },
      { id: "o2", market: "hle-2026Q2~1", t: 40, side: "yes", action: "buy", amount: 50 }, // HLE settles No
    ] };
    const rel: SessionState = { ...st, release: 1, clock: { t0: T0, t1: T1 } };
    const w = computeWorld(rel, Date.parse(T1) + 1000);
    const swe = w.settledEvents.find((e) => e.id === "swe-2026Q2")!.strikes[1];
    const hle = w.settledEvents.find((e) => e.id === "hle-2026Q2")!.strikes[1];
    expect(swe.settled!.outcome).toBe(true);
    expect(hle.settled!.outcome).toBe(false);
    expect(swe.settled!.payout).toBeGreaterThan(100); // more than 100 contracts, each paying 1
    expect(swe.settled!.pnl).toBeGreaterThan(0);
    expect(hle.settled!.payout).toBe(0);
    expect(hle.settled!.pnl).toBeCloseTo(-50, 3);
    expect(w.user.balance).toBeCloseTo(1000 + swe.settled!.pnl + hle.settled!.pnl, 6);
  });
});

describe("new data never pushes a worker back into a fading job", () => {
  it("after the release, no persona's top job is one whose skills are at risk, and no role jumps more than 8 places", () => {
    for (const p of personas) {
      const o = occupations.find((x) => x.id === p.occupation)!;
      const st: SessionState = { ...initialState(), profile: { name: p.name, occupationId: o.id, education: p.education, years: p.years, skills: o.skills, interests: p.interests, months: p.months, hoursPerWeek: p.hoursPerWeek, budget: "free", synthetic: true } };
      const before = computeView(st), after = computeView({ ...st, release: 1, clock: { t0: T0, t1: T1 } });
      expect(after.matches[0].atRisk, p.id).toBe(false);
      const r0 = new Map(before.matches.map((m) => [m.roleId, m.rank]));
      for (const m of after.matches) if (r0.has(m.roleId)) expect(Math.abs(r0.get(m.roleId)! - m.rank), `${p.id} ${m.title}`).toBeLessThanOrEqual(8);
    }
  });
  it("the clerical demand score falls when the clerical share of job ads falls", async () => {
    const { demandFor } = await import("@/lib/engine/matching");
    expect(demandFor("clerical", "2026Q2").score).toBeLessThan(demandFor("clerical", "2026Q1").score);
  });
});

describe("matching and plan", () => {
  it("only ranks reachable roles and every persona's plan fits the deadline", () => {
    for (const p of personas) {
      const o = occupations.find((x) => x.id === p.occupation)!;
      const st: SessionState = { ...initialState(), profile: { name: p.name, occupationId: o.id, education: p.education, years: p.years, skills: o.skills, interests: p.interests, months: p.months, hoursPerWeek: p.hoursPerWeek, budget: "free", synthetic: true } };
      const v = computeView(st);
      expect(v.matches.length).toBeGreaterThan(0);
      expect(v.matches.every((m) => m.reachable)).toBe(true);
      expect(v.plan!.totalWeeks).toBeLessThanOrEqual(v.plan!.deadlineWeeks);
      expect(v.plan!.steps.every((s) => s.skills.every((k) => k.sdgTarget))).toBe(true);
    }
  });
  it("the SDG goal picker changes the ranking and shows the trade-off", () => {
    const st = hafiz();
    const base = computeView(st).matches;
    const withGoal = computeView({ ...st, goals: ["16.4"] }).matches;
    expect(withGoal[0].roleId).toBe("aml_analyst");
    expect(base[0].roleId).not.toBe("aml_analyst");
    expect(withGoal[0].tradeoff).toBeTruthy();
  });
});

describe("tamper-evident log", () => {
  const mk = (n: number): LogEntry[] => {
    const out: LogEntry[] = [];
    let prev = "0".repeat(64);
    for (let i = 1; i <= n; i++) {
      const base = { seq: i, ts: "2026-10-20T00:00:00.000Z", type: "bet", session: "abc", payload: `{"n":${i}}`, prev };
      const e = { ...base, hash: entryHash(base) };
      out.push(e);
      prev = e.hash;
    }
    return out;
  };
  it("verifies an intact chain and detects any edited record", () => {
    const chain = mk(5);
    expect(verifyChain(chain).ok).toBe(true);
    chain[2] = { ...chain[2], payload: '{"n":999}' };
    const r = verifyChain(chain);
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(3);
  });
});

import { analyseResume, SAMPLE_RESUME, summarise, tailorTips } from "@/lib/engine/resume";

describe("resume scan", () => {
  const w = { slow: 0.32, medium: 0.61, fast: 0.07 };
  const a = analyseResume(SAMPLE_RESUME, w);
  it("finds the job, experience, sections and skills in the sample resume", () => {
    expect(a.occupation?.id).toBe("bank_ops");
    expect(a.years).toBe(5.5);
    expect(a.sections).toEqual(expect.arrayContaining(["summary", "experience", "education", "skills"]));
    expect(a.skills.map((s) => s.id)).toEqual(expect.arrayContaining(["loan_docs", "data_entry", "spreadsheets"]));
  });
  it("flags weak openings, missing numbers, personal details and missing AI-tool skills, each with evidence", () => {
    const ids = a.findings.filter((f) => f.severity !== "good").map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["verbs", "impact", "personal", "future"]));
    expect(a.findings.find((f) => f.id === "verbs")!.evidence!.length).toBeGreaterThan(0);
    expect(a.findings.find((f) => f.id === "verbs")!.example!.after.startsWith("Processed")).toBe(true);
  });
  it("scores add up to the total and stay within 0..100", () => {
    expect(a.parts.reduce((x, p) => x + p.of, 0)).toBe(100);
    expect(Math.round(a.parts.reduce((x, p) => x + p.got, 0))).toBe(a.score);
    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThan(100);
  });
  it("a stronger rewrite scores higher", () => {
    const better = SAMPLE_RESUME
      .replace("Responsible for processing loan applications and checking documents", "Processed 40 loan applications a week and checked documents with 99% accuracy")
      .replace("Handled customer enquiries by phone and email", "Resolved about 30 customer enquiries a day by phone and email")
      .replace("Assisted with month-end closing", "Closed month-end accounts in 3 days instead of 5")
      .replace("PERSONAL DETAILS\nDate of birth: 12 March 1998\nMarital status: Single\n", "")
      .replace("Microsoft Excel,", "Microsoft Excel, Power BI, ChatGPT to draft and check reports,");
    expect(analyseResume(better, w).score).toBeGreaterThan(a.score + 10);
  });
  it("keeps no resume text in what is saved to the session", () => {
    const json = JSON.stringify(summarise(a));
    expect(json).not.toContain("hafiz.rosli");
    expect(json).not.toContain("Example Bank");
    expect(json).not.toContain("12 March");
  });
  it("tailoring lists the skills a job needs that the resume does not show", () => {
    const t = tailorTips(["spreadsheets"], { spreadsheets: 2, sql: 3 });
    expect(t.match).toBeCloseTo(0.4, 5);
    expect(t.rows[0].id).toBe("sql");
  });
});


import { EDUCATION_RANK, SECTORS } from "@/lib/engine/data";

describe("sectors and qualifications", () => {
  const profileFor = (occupationId: string, education: "spm" | "diploma" | "degree"): SessionState => {
    const o = occupations.find((x) => x.id === occupationId)!;
    return { ...initialState(), profile: { name: "T", occupationId, education, years: 5, skills: o.skills, interests: [], months: 5, hoursPerWeek: 12, budget: "free", synthetic: true } };
  };
  it("covers ten sectors with real jobs in each, including computing, engineering, science, service and trades", () => {
    const by = new Map<string, number>();
    for (const r of roles) by.set(r.sector, (by.get(r.sector) ?? 0) + 1);
    for (const sec of SECTORS) expect(by.get(sec.id) ?? 0, sec.id).toBeGreaterThanOrEqual(3);
    for (const title of ["Software developer", "Civil engineer", "Chemist", "Software QA engineer and tester", "Quality assurance engineer (manufacturing)", "Electrician"]) {
      expect(roles.some((r) => r.title === title), title).toBe(true);
    }
  });
  it("never ranks a job whose qualification the person lacks, and lists it under longer-term paths", () => {
    const v = computeView(profileFor("retail_job", "spm"));
    expect(v.matches.every((m) => EDUCATION_RANK[m.requires] <= EDUCATION_RANK.spm)).toBe(true);
    expect(v.unreachable.some((u) => u.reason === "qualification")).toBe(true);
  });
  it("lets the right worker see their own field first: a civil engineer is matched to civil engineering, a QA tester to QA", () => {
    expect(computeView(profileFor("civil_eng_job", "degree")).matches[0].roleId).toBe("civil_engineer");
    const qa = computeView(profileFor("qa_tester", "diploma")).matches;
    expect(qa[0].sector).toBe("computing");
    expect(qa.slice(0, 3).map((m) => m.roleId)).toContain("qa_tester_software");
    expect(computeView(profileFor("lab_analyst", "degree")).matches.slice(0, 3).map((m) => m.sector)).toEqual(["science", "science", "science"]);
  });
  it("a degree is not needed to be shown the same ranking when education is the only difference but roles are not gated", () => {
    const a = computeView(profileFor("civil_eng_job", "degree")).matches.filter((m) => m.requires !== "degree").map((m) => m.roleId);
    const b = computeView(profileFor("civil_eng_job", "diploma")).matches.map((m) => m.roleId);
    expect(b.every((id) => a.includes(id))).toBe(true);
  });
});

import { computeLeaderboard, YOU } from "@/lib/engine/world";

describe("leaderboard: influence follows accuracy", () => {
  // Real 2026 Q2 outcomes of the headline lines: DOSM yes, SWE-bench yes, the others no.
  const truth: Record<string, boolean> = { "dosm-2026Q2": true, "swe-2026Q2": true, "hle-2026Q2": false, "metr-2026Q2": false, "tbench-2026Q2": false };
  const bets = (right: boolean): SessionState => ({
    ...initialState(), release: 1, clock: { t0: T0, t1: T1 },
    orders: Object.entries(truth).map(([ev, o], i) => ({ id: `o${i}`, market: `${ev}~1`, t: 30 + i, side: (o === right ? "yes" : "no") as "yes" | "no", action: "buy" as const, amount: 300 })),
  });
  it("ranks every simulated forecaster and you by Brier score, lowest first", () => {
    const lb = computeLeaderboard(bets(true), Date.parse(T1) + 1000);
    expect(lb.rows.length).toBe(201);
    const scored = lb.rows.filter((r) => r.brier !== null);
    for (let i = 1; i < scored.length; i++) expect(scored[i].brier!).toBeGreaterThanOrEqual(scored[i - 1].brier!);
    expect(lb.rows.find((r) => r.id === YOU)!.questions).toBe(5);
  });
  it("ranks you by the same score that sets your influence, so one lucky trade does not top the board", () => {
    const one: SessionState = { ...initialState(), release: 1, clock: { t0: T0, t1: T1 }, orders: [{ id: "o1", market: "swe-2026Q2~1", t: 30, side: "yes", action: "buy", amount: 25 }] };
    const lb = computeLeaderboard(one, Date.parse(T1) + 1000);
    const you = lb.rows.find((r) => r.you)!;
    expect(you.influence).toBeLessThan(1);
    expect(you.rank!).toBeGreaterThan(20);
  });
  it("gives you more influence when your forecasts were right and less when they were wrong", () => {
    const good = computeLeaderboard(bets(true), Date.parse(T1) + 1000).rows.find((r) => r.you)!;
    const bad = computeLeaderboard(bets(false), Date.parse(T1) + 1000).rows.find((r) => r.you)!;
    expect(good.brier!).toBeLessThan(bad.brier!);
    expect(good.influence).toBeGreaterThan(1);
    expect(bad.influence).toBeLessThan(1);
    expect(good.rank!).toBeLessThan(bad.rank!);
    expect(computeWorld(bets(true), Date.parse(T1) + 1000).you.maxOrder).toBeGreaterThan(500);
  });
  it("the more accurate a simulated forecaster, the more influence it ends with", () => {
    const rows = computeLeaderboard(bets(true), Date.parse(T1) + 1000).rows.filter((r) => !r.you);
    const top = rows.slice(0, 20), bottom = rows.slice(-20);
    const avg = (xs: typeof rows) => xs.reduce((a, r) => a + r.influence, 0) / xs.length;
    expect(avg(top)).toBeGreaterThan(1);
    expect(avg(bottom)).toBeLessThan(1);
  });
});

import { STATES, stateJobs, compareMove, bestStates, SECTOR_INDUSTRIES } from "@/lib/engine/geo";

describe("job map: states from public data", () => {
  it("covers all 16 states and federal territories with labour force, wages and industry figures", () => {
    expect(STATES.length).toBe(16);
    for (const s of STATES) {
      expect(s.lfs.quarter).toBe("2026Q2");
      expect(s.lfs.employed).toBeGreaterThan(0);
      expect(s.wages.median).toBeGreaterThan(1000);
      expect(Object.values(s.industry).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
  });
  it("shares add up to 100% for every sector, and concentration averages out to 1 across Malaysia", () => {
    for (const sector of Object.keys(SECTOR_INDUSTRIES) as (keyof typeof SECTOR_INDUSTRIES)[]) {
      const rows = stateJobs(sector);
      expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1, 6);
      const employed = rows.reduce((a, r) => a + r.employed, 0);
      expect(rows.reduce((a, r) => a + r.lq * r.employed, 0) / employed).toBeCloseTo(1, 6);
    }
  });
  it("finance work is concentrated in Kuala Lumpur and Selangor, so moving from Kedah shows more jobs", () => {
    const top = bestStates("finance", "MY-02", 2).map((s) => s.id).sort();
    expect(top).toEqual(["MY-10", "MY-14"]);
    const m = compareMove("finance", "MY-02", "MY-14");
    expect(m.times!).toBeGreaterThan(3);
    expect(m.wageGap!).toBeGreaterThan(0);
  });
  it("your home state never changes your job matches", () => {
    const a = hafiz(), b = hafiz();
    a.profile = { ...a.profile!, state: "MY-02" };
    b.profile = { ...b.profile!, state: "MY-14" };
    expect(JSON.stringify(computeView(a).matches.map((m) => [m.roleId, m.score]))).toBe(JSON.stringify(computeView(b).matches.map((m) => [m.roleId, m.score])));
  });
});
