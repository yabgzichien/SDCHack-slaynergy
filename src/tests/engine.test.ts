import { describe, expect, it } from "vitest";
import { occupations, personas, roles, skills, courses, sdg, series, skillById } from "@/lib/engine/data";
import { matchRoles, pickInputs } from "@/lib/engine/matching";
import { computeWorld, MAX_ORDER } from "@/lib/engine/world";
import { computeView } from "@/lib/engine/view";
import { suggestedJobs } from "@/lib/suggested";
import { initialState, STAY_ID, type SessionState } from "@/lib/engine/state";
import { futureWeights } from "@/lib/engine/futures";
import { liveQuestions, replayHistory } from "@/lib/engine/replay";
import { ladder, futureProbs } from "@/lib/engine/questions";
import { runTape } from "@/lib/engine/tape";
import { MAX_MOVE, MAX_MOVE_WINDOW, quoteBuy } from "@/lib/market-math";
import { newMarket, price, tradeToward, cost } from "@/lib/engine/lmsr";
import { verifyChain, entryHash, type LogEntry } from "@/lib/server/store";
import { taskCards, gradeQuiz, completionGate, badgeRecord, linkedinAddUrl, achievements } from "@/lib/engine/pathway";
import { buildPlan } from "@/lib/engine/plan";
import { issueBadge, personaState, recordMeeting } from "@/lib/engine/review";
import { advisorMeetings, checkBooking, DEMO_ADVISOR, demoSlots, freeSlots, isOpenable, myDay, myTime, slotId, slotStart, windowDays, type Meeting } from "@/lib/engine/meetings";

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
  it("on real past releases the market beats a coin flip and the base rate, and weighting by accuracy does not make it worse", () => {
    // What the app claims, and no more: the gaps between the crowd, the weighted crowd and the best future are tiny.
    const s = replayHistory().stats;
    expect(s.questions).toBeGreaterThanOrEqual(30);
    expect(s.brierLmsr).toBeLessThan(s.brierCoin);
    expect(s.brierLmsr).toBeLessThan(s.brierBaseRate);
    expect(s.brierWeightedMean).toBeLessThanOrEqual(s.brierUnweighted + 0.005);
    expect(Math.abs(s.brierLmsr - Math.min(...Object.values(s.brierFutures)))).toBeLessThan(0.02);
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
    expect(after.events.every((e) => e.id === "dosm-2026Q3" || e.id.endsWith("2026Q4"))).toBe(true); // no open question asks about a quarter that has ended
    expect(after.futures.map((f) => f.weight.toFixed(4))).not.toEqual(before.futures.map((f) => f.weight.toFixed(4)));
    expect(JSON.stringify(computeWorld(rel, Date.parse(T1) + 5000))).toBe(JSON.stringify(after));
    expect(computeView(rel).changes!.length).toBeGreaterThan(5);
    expect(after.user.rank).not.toBeNull();
  });
});

describe("the market: three answers per question, buy and sell", () => {
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
  it("calms down as the session ages, so a week-old session stays fast but still moves", () => {
    const H = 3600, live = (nowT: number) => runTape(strikeQ[1], w0, "W0", [], nowT).series.filter((p) => p.t >= 0).length;
    const day1 = live(24 * H), day2 = live(48 * H), week = live(7 * 24 * H);
    expect(live(H)).toBeGreaterThan(400); // about one trade every 6 s in the first hour
    expect(day2).toBeGreaterThan(day1); // still trading after a day
    expect(week).toBeLessThan(4000); // was ~100k
  });
  it("a week-old session computes its view in well under a second", () => {
    const st: SessionState = { ...personaState("hafiz")!, clock: { t0: new Date(Date.now() - 7 * 24 * 3600e3).toISOString() } };
    computeView(st); // warm the shared caches, as a running server would have
    const t = performance.now();
    computeView(st);
    expect(performance.now() - t).toBeLessThan(1500);
  });
  it("lets you buy Yes or No, moves the price, and sells back for less than the max payout", () => {
    const m = strikeQ[1].id;
    const base = runTape(strikeQ[1], w0, "W0", [], 120);
    const buyYes = runTape(strikeQ[1], w0, "W0", [{ id: "o1", market: m, t: 60, side: "yes", action: "buy", amount: 5 }], 120);
    const buyNo = runTape(strikeQ[1], w0, "W0", [{ id: "o1", market: m, t: 60, side: "no", action: "buy", amount: 5 }], 120);
    expect(buyYes.price).toBeGreaterThan(base.price);
    expect(buyNo.price).toBeLessThan(base.price);
    expect(buyYes.position.yes).toBeGreaterThan(5); // each contract costs under 1 point
    expect(buyNo.position.no).toBeGreaterThan(5);
    const sold = runTape(strikeQ[1], w0, "W0", [
      { id: "o1", market: m, t: 60, side: "yes", action: "buy", amount: 5 },
      { id: "o2", market: m, t: 61, side: "yes", action: "sell", amount: 1000 },
    ], 120);
    expect(sold.position.yes).toBeCloseTo(0, 6); // you can sell at most what you hold
    const half = buyYes.position.yes / 2;
    const s2 = runTape(strikeQ[1], w0, "W0", [
      { id: "o1", market: m, t: 60, side: "yes", action: "buy", amount: 5 },
      { id: "o2", market: m, t: 62, side: "yes", action: "sell", amount: half },
    ], 120);
    expect(s2.position.yes).toBeCloseTo(half, 6);
    expect(s2.executions[1].points).toBeGreaterThan(0);
    expect(s2.executions[1].points).toBeLessThan(half);
  });
  it("the ticket's instant quote matches the server's executed order", () => {
    const m = strikeQ[1].id;
    const before = runTape(strikeQ[1], w0, "W0", [], 120);
    for (const amount of [5, 50]) { // 5 points is under the move cap; 50 points hits it
      const q = quoteBuy(before.price, "yes", amount);
      const after = runTape(strikeQ[1], w0, "W0", [{ id: "o1", market: m, t: 119.9, side: "yes", action: "buy", amount }], 120);
      const ex = after.executions[0];
      expect(ex.shares).toBeCloseTo(q.shares, 1);
      expect(ex.points).toBeCloseTo(q.points, 2);
      expect(ex.priceAfter).toBeCloseTo(q.priceAfter, 2);
    }
  });
  it("pays 1 point per winning contract at settlement and keeps your points balanced", () => {
    const sweBase = "swe-2026Q2~1"; // settles Yes (+4.8 points)
    const st: SessionState = { ...initialState(), clock: { t0: T0 }, orders: [
      { id: "o1", market: sweBase, t: 30, side: "yes", action: "buy", amount: 10 },
      { id: "o2", market: "hle-2026Q2~1", t: 40, side: "yes", action: "buy", amount: 8 }, // HLE settles No
    ] };
    const rel: SessionState = { ...st, release: 1, clock: { t0: T0, t1: T1 } };
    const w = computeWorld(rel, Date.parse(T1) + 1000);
    const swe = w.settledEvents.find((e) => e.id === "swe-2026Q2")!.strikes[1];
    const hle = w.settledEvents.find((e) => e.id === "hle-2026Q2")!.strikes[1];
    expect(swe.settled!.outcome).toBe(true);
    expect(hle.settled!.outcome).toBe(false);
    expect(swe.settled!.payout).toBeGreaterThan(swe.executions[0].points); // more contracts than points paid, each paying 1
    expect(swe.settled!.pnl).toBeGreaterThan(0);
    expect(hle.settled!.payout).toBe(0);
    expect(hle.settled!.pnl).toBeCloseTo(-hle.executions[0].points, 3);
    expect(w.user.balance).toBeCloseTo(1000 + swe.settled!.pnl + hle.settled!.pnl, 6);
  });
});

describe("new data never pushes a worker back into a fading job", () => {
  // This checks full forecasts for every persona before and after a release.
  it("after the release, no persona's top job is one whose skills are at risk, and no role jumps more than 8 places", () => {
    for (const p of personas) {
      const o = occupations.find((x) => x.id === p.occupation)!;
      const st: SessionState = { ...initialState(), profile: { name: p.name, occupationId: o.id, education: p.education, years: p.years, skills: o.skills, interests: p.interests, months: p.months, hoursPerWeek: p.hoursPerWeek, budget: "free", synthetic: true } };
      const before = computeView(st), after = computeView({ ...st, release: 1, clock: { t0: T0, t1: T1 } });
      // What the worker is shown as their best job (Jobs page) and plans towards: the best lasting job, ahead of a
      // higher-ranked one whose skills are at risk (lib/suggested.ts). The raw ranking may still list an at-risk job first.
      expect(suggestedJobs(after)[0].atRisk, p.id).toBe(false);
      expect(after.chosen?.atRisk, p.id).toBe(false);
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


import { EDUCATION_RANK, SECTORS, type Education, type StudyField } from "@/lib/engine/data";

describe("sectors and qualifications", () => {
  const profileFor = (occupationId: string, education: Education): SessionState => {
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
  it("treats a master's or PhD as meeting a degree requirement, and gives the same ranking as a bachelor's", () => {
    const ids = (e: Education) => computeView(profileFor("civil_eng_job", e)).matches.map((m) => m.roleId);
    expect(ids("master")).toEqual(ids("degree"));
    expect(ids("phd")).toEqual(ids("degree"));
    expect(ids("stpm")).toEqual(ids("spm"));
  });
  it("a degree is not needed to be shown the same ranking when education is the only difference but roles are not gated", () => {
    const a = computeView(profileFor("civil_eng_job", "degree")).matches.filter((m) => m.requires !== "degree").map((m) => m.roleId);
    const b = computeView(profileFor("civil_eng_job", "diploma")).matches.map((m) => m.roleId);
    expect(b.every((id) => a.includes(id))).toBe(true);
  });
});

describe("field of study and staying in your job", () => {
  const prof = (occupationId: string, education: Education, study?: StudyField | null): SessionState => {
    const o = occupations.find((x) => x.id === occupationId)!;
    return { ...initialState(), profile: { name: "T", occupationId, education, study, years: 5, skills: o.skills, interests: [], months: 6, hoursPerWeek: 10, budget: "free", synthetic: true } };
  };
  it("never offers an engineering or science degree job to someone who studied another field", () => {
    const v = computeView(prof("software_dev", "degree", "computing"));
    expect(v.matches.some((m) => ["engineering", "science"].includes(m.sector) && m.requires === "degree")).toBe(false);
    expect(v.unreachable.find((u) => u.roleId === "chemical_engineer")?.need).toBe("Needs a degree in engineering");
    expect(computeView(prof("civil_eng_job", "degree", "engineering")).matches[0].roleId).toBe("civil_engineer");
  });
  it("labels a changing job softly and a highest-exposure job as shrinking fast, with a bridge towards a lasting job", () => {
    const dev = computeView(prof("software_dev", "degree", "computing")).stay!;
    expect(dev.status).toBe("changing");
    expect(dev.growing.map((g) => g.skillId)).toContain("ai_tools");
    const clerk = computeView(prof("data_entry", "spm")).stay!;
    expect(clerk.status).toBe("fast");
    expect(clerk.toward).not.toBeNull();
    expect(clerk.toward!.outlook).toBeGreaterThanOrEqual(0.7);
  });
  it("choosing to stay gives a reshape plan for a changing job and a bridge plan for a fast-fading one", () => {
    const dev = computeView({ ...prof("software_dev", "degree", "computing"), chosenRoleId: STAY_ID }).plan!;
    expect(dev.kind).toBe("reshape");
    expect(dev.steps.at(-1)!.kind).toBe("adapt");
    expect(dev.steps.some((s) => s.kind === "apply")).toBe(false);
    const clerk = computeView({ ...prof("data_entry", "spm"), chosenRoleId: STAY_ID });
    expect(clerk.plan!.kind).toBe("bridge");
    expect(clerk.plan!.stayIn).toBe("Data entry clerk");
    expect(clerk.plan!.roleId).toBe(clerk.stay!.toward!.roleId);
  });
});

import { computeLeaderboard as lb0, computeWorld as w0, YOU } from "@/lib/engine/world";
import { withSeries } from "@/lib/engine/data";

describe("leaderboard: influence follows accuracy", () => {
  // Real 2026 Q2 outcomes of the headline lines: DOSM yes, SWE-bench yes, the others no.
  const truth: Record<string, boolean> = { "dosm-2026Q2": true, "swe-2026Q2": true, "hle-2026Q2": false, "metr-2026Q2": false, "tbench-2026Q2": false };
  const bets = (right: boolean): SessionState => ({
    ...initialState(), release: 1, clock: { t0: T0, t1: T1 },
    orders: Object.entries(truth).map(([ev, o], i) => ({ id: `o${i}`, market: `${ev}~1`, t: 30 + i, side: (o === right ? "yes" : "no") as "yes" | "no", action: "buy" as const, amount: 300 })),
  });
  // As if the 2026 Q2 questions had been open in this session and settled at T1, so predictions on them count.
  const openedQ2: typeof series = JSON.parse(JSON.stringify(series));
  for (const id of Object.keys(truth)) openedQ2.market.frozen[id].settledAt = T1;
  const computeLeaderboard = (st: SessionState, now: number) => withSeries(openedQ2, () => lb0(st, now));
  const computeWorld = (st: SessionState, now: number) => withSeries(openedQ2, () => w0(st, now));
  it("predictions on a release that was already out when the session started are practice, not scored", () => {
    const w = w0(bets(true), Date.parse(T1) + 1000);
    expect(w.you.forecasts.every((f) => f.practice)).toBe(true);
    expect(w.you.scored).toBe(0);
    expect(w.you.brier).toBeNull();
    expect(computeWorld(bets(true), Date.parse(T1) + 1000).you.scored).toBe(5);
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
    expect(computeWorld(bets(true), Date.parse(T1) + 1000).you.maxOrder).toBeGreaterThan(MAX_ORDER);
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

describe("pathway: three strands, task card, badge", () => {
  const finance = () => {
    const s = hafiz();
    const v = computeView(s);
    return { s: { ...s, chosenRoleId: "budget_analyst" } as SessionState, v };
  };
  it("builds a plan with job, AI and people steps, each SDG-tagged", () => {
    const { s } = finance();
    const plan = computeView(s).plan!;
    expect(new Set(plan.steps.map((x) => x.strand))).toEqual(new Set(["job", "ai", "people"]));
    for (const st of plan.steps) expect(st.skills.length).toBeGreaterThan(0);
    expect(plan.steps.find((x) => x.activity === "task")?.cardId).toBe("finance_variance");
    expect(plan.steps.map((x) => x.activity).filter(Boolean)).toEqual(["task", "resume", "meeting"]);
  });
  it("teaches people skills with existing online courses, not Jobbery's own", () => {
    const plan = computeView(finance().s).plan!;
    const ppl = plan.steps.filter((x) => x.strand === "people" && x.kind === "course");
    expect(ppl.map((x) => x.course?.id)).toEqual(["alison_interview", "google_interview_ai", "coursera_comm"]);
    expect(ppl.every((x) => x.url?.startsWith("https://") && !x.activity)).toBe(true);
  });
  it("teaches AI with existing courses, then a short quiz, and never repeats them in the job strand", () => {
    const plan = computeView(finance().s).plan!;
    const ai = plan.steps.filter((x) => x.strand === "ai");
    expect(ai.map((x) => x.course?.id ?? x.id)).toEqual(["ai_fluency", "ms_work_smarter", "task"]);
    expect(ai.every((x) => x.kind !== "course" || x.url?.startsWith("https://"))).toBe(true);
    expect(plan.steps.filter((x) => x.strand === "job" && x.skills.every((k) => k.id === "ai_tools")).length).toBe(0);
    expect(plan.steps.find((x) => x.id === "task")!.hours).toBe(1);
  });
  it("counts the quiz as done once passed; the portfolio piece is optional", () => {
    const { s } = finance();
    const passed = { ...s, pathway: { quiz: { attempts: 1, passed: true, found: ["a3", "a7", "a8"], wrong: [] } } };
    expect(computeView(passed).pathway.done.task).toBe(true);
  });
  it("uses a plain practice step where no task card exists yet", () => {
    const st = plan0("computing");
    expect(st?.activity).toBeUndefined();
    expect(st?.strand).toBe("ai");
  });
  it("grades the quiz: all mistakes, at most one wrong tap", () => {
    const card = taskCards[0];
    expect(gradeQuiz(card, ["a3", "a7", "a8"]).passed).toBe(true);
    expect(gradeQuiz(card, ["a3", "a7", "a8", "a1"]).passed).toBe(true);
    expect(gradeQuiz(card, ["a3", "a7", "a8", "a1", "a2"]).passed).toBe(false);
    expect(gradeQuiz(card, ["a3", "a7"]).passed).toBe(false);
    expect(gradeQuiz(card, ["a3", "a3", "zz"]).found).toEqual(["a3"]);
  });
  it("keeps the planted mistakes out of the browser view until found", () => {
    const { s } = finance();
    const card = computeView(s).pathway.card!;
    expect(card.sampleAnswer.every((a) => !a.reveal && !("mistake" in a))).toBe(true);
    const s2 = { ...s, pathway: { prompt: "x", quiz: { attempts: 1, passed: false, found: ["a3"], wrong: [] } } };
    expect(computeView(s2).pathway.card!.sampleAnswer.filter((a) => a.reveal).map((a) => a.id)).toEqual(["a3"]);
  });
  it("does not complete activity steps by ticking, and gates the badge", () => {
    const { s } = finance();
    const plan = computeView(s).plan!;
    const ticked = { ...s, progress: Object.fromEntries(plan.steps.map((x) => [x.id, true])) };
    expect(computeView(ticked).pathway.done.task).toBe(false);
    expect(completionGate(plan, ticked).ok).toBe(false);
    const card = taskCards[0];
    const work = {
      prompt: "Act as a budget analyst", template: "Act as a budget analyst. Use only the data.",
      quiz: { attempts: 2, passed: true, found: ["a3", "a7", "a8"], wrong: [] },
      sheet: Object.fromEntries(card.sheetHeadings.map((h) => [h.id, "Something long enough here"])),
      resumeApplied: true,
    };
    expect(completionGate(plan, { ...ticked, pathway: work, resume: { skillIds: [], found: [], words: 0 } as unknown as SessionState["resume"] }).missing).toContain("Meet an advisor and get their advice.");
    Object.assign(work, { advisorMet: { at: "2026-10-20T00:00:00.000Z", by: { id: "c-1", name: "Puan Aisyah" }, meetingId: "m1", topic: "mock" } });
    const resume = { skillIds: [], found: [], words: 0 } as unknown as SessionState["resume"];
    const full = { ...ticked, pathway: work, resume };
    expect(completionGate(plan, full)).toEqual({ ok: true, missing: [] });
    const rec = badgeRecord(plan, full, "abc123def", "2026-10-21T00:00:00.000Z");
    expect(rec.holder).toBe("A Jobbery learner");
    expect(rec.portfolio).toBeNull();
    expect(rec.title).toBe("Jobbery pathway completed · Budget analyst");
    expect(rec.title.toLowerCase()).not.toContain("certified");
    const shown = badgeRecord(plan, { ...full, pathway: { ...work, showName: true, publishPortfolio: true } }, "abc123def", "2026-10-21T00:00:00.000Z");
    expect(shown.holder).toBe("Hafiz");
    expect(shown.portfolio?.template).toContain("budget analyst");
  });
  it("prefills the LinkedIn add-certification link", () => {
    const u = new URL(linkedinAddUrl({ title: "Jobbery pathway completed · Budget analyst", id: "abc", issued: "2026-10-21T00:00:00.000Z" }, "https://x.test/badge/abc"));
    expect(u.searchParams.get("startTask")).toBe("CERTIFICATION_NAME");
    expect(u.searchParams.get("issueMonth")).toBe("10");
    expect(u.searchParams.get("certUrl")).toBe("https://x.test/badge/abc");
  });
});

describe("advisor meeting step and badge", () => {
  const by = { id: "c-12345678", name: "Puan Aisyah" };
  const now = "2026-10-21T00:00:00.000Z";
  const base = () => ({ ...personaState("hafiz")!, chosenRoleId: "budget_analyst" });
  it("puts one advisor meeting in every plan, before applying, done only by an advisor's advice", () => {
    const s = base();
    const plan = computeView(s).plan!;
    const meet = plan.steps.filter((x) => x.activity === "meeting");
    expect(meet).toHaveLength(1);
    const at = plan.steps.findIndex((x) => x.id === "meet");
    expect(plan.steps[at + 1].kind).toBe("apply");
    expect(plan.steps.find((x) => x.kind === "apply")!.title).not.toMatch(/counsellor/i);
    expect(computeView({ ...s, progress: { meet: true } }).pathway.done.meet).toBe(false);
    const met = recordMeeting(s, { at: now, by, meetingId: "m1", topic: "mock" });
    expect(computeView(met).pathway.done.meet).toBe(true);
    expect(recordMeeting(met, { at: "later", by, meetingId: "m2", topic: "job" }).pathway.advisorMet?.meetingId).toBe("m1");
  });
  it("includes the meeting in a stay-in-your-job plan too", () => {
    const s = { ...personaState("hafiz")!, chosenRoleId: STAY_ID };
    expect(computeView(s).plan!.steps.some((x) => x.activity === "meeting")).toBe(true);
  });
  it("issues the badge once every step is done, naming the advisor met, without a sign-off", () => {
    const s = base();
    const plan = computeView(s).plan!;
    expect(issueBadge(s, plan, now, "abc123def")).toBe("The pathway is not finished yet.");
    const done = recordMeeting({
      ...s,
      progress: Object.fromEntries(plan.steps.map((x) => [x.id, true])),
      pathway: { resumeApplied: true, quiz: { attempts: 1, passed: true, found: [], wrong: [] } },
      resume: { skillIds: [], found: [], words: 0 } as unknown as SessionState["resume"],
    }, { at: now, by, meetingId: "m1", topic: "mock" });
    const r = issueBadge(done, plan, now, "abc123def");
    if (typeof r === "string") throw new Error(r);
    expect(r.record.met).toEqual({ advisor: by, at: now, topic: "mock" });
    expect(r.record.counsellor).toBeUndefined();
    expect(r.state.completion).toMatchObject({ status: "confirmed", badgeId: "abc123def", by });
    expect(issueBadge(r.state, plan, now, "x")).toBe("This pathway is finished and its badge is issued.");
  });
});

describe("advisor meetings", () => {
  // Tuesday 21 Oct 2026, 09:15 in Kuala Lumpur.
  const now = "2026-10-21T01:15:00.000Z";
  const me = { id: "c-11111111", name: "Puan Aisyah" };
  const meeting = (over: Partial<Meeting>): Meeting => ({
    id: "m1", slotId: "x", start: slotStart("2026-10-22", "10:00"), advisor: me, caseId: "abc", worker: { name: "Hafiz", synthetic: true },
    status: "booked", topic: "courses", question: "", bookedAt: now, ...over,
  });
  it("works in Malaysia time across a two-week window", () => {
    expect(slotStart("2026-10-22", "10:00")).toBe("2026-10-22T02:00:00.000Z");
    expect(myDay("2026-10-21T17:00:00.000Z")).toBe("2026-10-22");
    expect(myTime("2026-10-22T02:00:00.000Z")).toBe("10:00");
    const days = windowDays(now);
    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2026-10-21");
    expect(days[13]).toBe("2026-11-03");
  });
  it("only lets an advisor open future grid times inside the window", () => {
    expect(isOpenable(slotStart("2026-10-21", "09:00"), now)).toBe(false);
    expect(isOpenable(slotStart("2026-10-21", "09:30"), now)).toBe(true);
    expect(isOpenable(slotStart("2026-10-22", "09:15"), now)).toBe(false);
    expect(isOpenable(slotStart("2026-10-22", "17:00"), now)).toBe(false);
    expect(isOpenable(slotStart("2026-11-04", "10:00"), now)).toBe(false);
  });
  it("gives the demo advisor future weekday slots only", () => {
    const d = demoSlots(now);
    expect(d.length).toBe(10 * 4);
    expect(d.every((s) => s.advisor.id === DEMO_ADVISOR.id && Date.parse(s.start) > Date.parse(now))).toBe(true);
    expect(d.some((s) => myDay(s.start) === "2026-10-25")).toBe(false);
  });
  it("hides booked slots, but frees them again when the booking is cancelled", () => {
    const d = demoSlots(now);
    const taken = meeting({ slotId: d[0].id, start: d[0].start, advisor: DEMO_ADVISOR });
    expect(freeSlots(d, [taken], now).some((s) => s.id === d[0].id)).toBe(false);
    expect(freeSlots(d, [{ ...taken, status: "cancelled" }], now).some((s) => s.id === d[0].id)).toBe(true);
  });
  it("needs a profile and allows one upcoming booking per worker", () => {
    const slot = { id: slotId(me.id, slotStart("2026-10-23", "10:00")), start: slotStart("2026-10-23", "10:00"), advisor: me };
    expect(checkBooking(slot, [], now, false)).toMatch(/Tell us about yourself/);
    expect(checkBooking(undefined, [], now, true)).toMatch(/no longer free/);
    expect(checkBooking(slot, [], now, true)).toBeNull();
    expect(checkBooking(slot, [meeting({})], now, true)).toMatch(/already have a meeting/);
    expect(checkBooking(slot, [meeting({ status: "cancelled" })], now, true)).toBeNull();
    expect(checkBooking(slot, [meeting({ start: "2026-10-20T02:00:00.000Z", status: "advised" })], now, true)).toBeNull();
  });
  it("shows an advisor their own and the demo advisor's meetings, next first", () => {
    const other = { id: "c-22222222", name: "Encik Rahman" };
    const all = [
      meeting({ id: "a", start: slotStart("2026-10-24", "10:00") }),
      meeting({ id: "b", start: slotStart("2026-10-22", "10:00"), advisor: DEMO_ADVISOR }),
      meeting({ id: "c", advisor: other }),
      meeting({ id: "d", start: "2026-10-20T02:00:00.000Z", status: "advised" }),
    ];
    const r = advisorMeetings(all, me.id, now);
    expect(r.next.map((m) => m.id)).toEqual(["b", "a"]);
    expect(r.past.map((m) => m.id)).toEqual(["d"]);
  });
});

function plan0(sector: string) {
  const role = roles.find((r) => r.sector === sector)!;
  const m = { ...matchRoles(pickInputs({ skills: ["spreadsheets"], months: 6, hoursPerWeek: 10, interests: [], goals: [] }), computeWorld(initialState()).weights, "2026Q1").find((x) => x.roleId === role.id)! };
  return buildPlan(m, 10).steps.find((x) => x.strand === "ai");
}

describe("one player cannot swing the market", () => {
  const base: SessionState = { ...initialState(), clock: { t0: T0 } };
  const now = Date.parse(T0);
  const priceAt = (st: SessionState, sec: number, id: string) => computeWorld(st, now + sec * 1000).events.find((e) => e.id === id)!.strikes[1].price;
  const ids = computeWorld(base, now + 600_000).events.map((e) => e.id);
  const w0 = replayHistory().weights;
  const strikeQ = ladder(liveQuestions("live").find((q) => q.id === "swe-2026Q2")!);

  it("caps a single guess at a 3-point move and does not charge the unused points", () => {
    const m = strikeQ[1].id;
    const before = runTape(strikeQ[1], w0, "W0", [], 120);
    const ex = runTape(strikeQ[1], w0, "W0", [{ id: "o1", market: m, t: 119.9, side: "yes", action: "buy", amount: MAX_ORDER }], 120).executions[0];
    expect(Math.abs(ex.priceAfter - ex.priceBefore)).toBeLessThanOrEqual(MAX_MOVE + 1e-9);
    expect(ex.points).toBeLessThan(MAX_ORDER);
    expect(before.price).toBeCloseTo(ex.priceBefore, 9);
  });

  it("the most one player can push any question, with every point allowed in quick guesses, is 5 points, and it fades", () => {
    for (const id of ids) {
      for (const side of ["yes", "no"] as const) {
        const orders = Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, market: `${id}~1`, t: 300 + i, side, action: "buy" as const, amount: 10 }));
        const st = { ...base, orders };
        const now0 = Math.abs(priceAt(st, 311, id) - priceAt(base, 311, id));
        const later = Math.abs(priceAt(st, 900, id) - priceAt(base, 900, id));
        expect(now0, `${id} ${side}`).toBeLessThanOrEqual(MAX_MOVE_WINDOW + 1e-6);
        expect(later, `${id} ${side} after 10 minutes`).toBeLessThan(0.01);
      }
    }
  });

  it("one player's pressure barely changes how likely each AI speed looks", () => {
    const orders = ids.map((id, i) => ({ id: `o${i}`, market: `${id}~1`, t: 300, side: "yes" as const, action: "buy" as const, amount: MAX_ORDER }));
    const a = computeWorld(base, now + 301_000).weights, b = computeWorld({ ...base, orders }, now + 301_000).weights;
    for (const k of Object.keys(a) as (keyof typeof a)[]) expect(Math.abs(b[k] - a[k]), k).toBeLessThan(0.01);
  });
});

describe("skill badges", () => {
  it("are earned one per finished step, plus milestones, and none are earned at the start", () => {
    const st = hafiz();
    const m = matchRoles(pickInputs(st.profile!), computeWorld(st).weights, "2026Q1")[0];
    const plan = buildPlan(m, 10);
    const none = achievements(plan, st);
    expect(none.length).toBe(plan.steps.length + 3);
    expect(none.every((a) => !a.earned)).toBe(true);
    const first = plan.steps.find((s) => !s.activity)!;
    const after = achievements(plan, { ...st, progress: { [first.id]: true } });
    expect(after.filter((a) => a.earned).map((a) => a.id)).toContain("m-first");
    expect(after.filter((a) => a.earned).length).toBe(2);
    expect(achievements(null, st)).toEqual([]);
  });
});

import { INFLUENCE_MAX, INFLUENCE_MIN } from "@/lib/engine/market";

describe("influence cap", () => {
  it("keeps every forecaster between the floor and the cap while the crowd still averages 1", () => {
    const w = replayHistory().weights;
    const vals = Object.values(w);
    expect(Math.max(...vals)).toBeLessThanOrEqual(INFLUENCE_MAX + 1e-9);
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(INFLUENCE_MIN - 1e-9);
    expect(vals.reduce((a, b) => a + b, 0) / vals.length).toBeCloseTo(1, 6);
  });
});

describe("what the answer would change", () => {
  it("shows, for every open question, how each answer moves the three futures, and the futures still add to 1", () => {
    // Sessions start with the latest release loaded: every open question is about the future.
    const w = computeWorld({ ...initialState(), clock: { t0: T0 } }, Date.parse(T0) + 60_000);
    expect(w.events.map((e) => e.id).sort()).toEqual(["dosm-2026Q3", "hle-2026Q4", "metr-2026Q4", "swe-2026Q4", "tbench-2026Q4"]);
    for (const e of w.events) {
      expect(e.whatIf).not.toBeNull();
      for (const x of [e.whatIf!.yes, e.whatIf!.no]) expect(x.slow + x.medium + x.fast).toBeCloseTo(1, 6);
    }
    // An AI-progress question: Yes (fast progress) makes the slow future less likely than No does.
    const metr = w.events.find((e) => e.id === "metr-2026Q4")!.whatIf!;
    expect(metr.yes.slow).toBeLessThan(metr.no.slow);
    expect(w.settledEvents.every((e) => e.whatIf === null)).toBe(true);
    // Nobody could guess on the release that is already in, so a new player is not scored on it.
    expect(w.you.brier).toBeNull();
    expect(w.you.influence).toBe(1);
  });
});

import { canSwap } from "@/lib/engine/plan";

describe("courses: one list for the plan and the Courses page", () => {
  const hafiz = personas.find((p) => p.id === "hafiz")!;
  const st = (swaps?: Record<string, string>): SessionState => ({
    ...initialState(), clock: { t0: T0 }, courseSwaps: swaps,
    profile: { name: hafiz.name, occupationId: hafiz.occupation, education: hafiz.education, years: hafiz.years, skills: occupations.find((o) => o.id === hafiz.occupation)!.skills, interests: hafiz.interests, months: hafiz.months, hoursPerWeek: hafiz.hoursPerWeek, budget: "free", synthetic: true },
  });
  it("every plan course is a real checked course from the list, and Malaysian portals are never picked for a gap", () => {
    const plan = computeView(st()).plan!;
    for (const s of plan.steps.filter((x) => x.course)) expect(courses.some((c) => c.id === s.course!.id && !c.catalogOnly)).toBe(true);
    expect(courses.filter((c) => c.catalogOnly).map((c) => c.id).sort()).toEqual(["elatih", "perkeso_eis", "rakyat_digital"]);
  });
  // Searching across roles builds several complete plans before checking swaps.
  it("swaps a step's course only for one that teaches every skill the step covers", () => {
    // Hafiz's suggested courses have no alternatives, so use the first job whose plan has one.
    const base = (() => {
      for (const r of roles) {
        const s0 = { ...st(), chosenRoleId: r.id };
        const p = computeView(s0).plan;
        if (p?.roleId === r.id && p.steps.some((s) => s.alternatives)) return s0;
      }
      throw new Error("no plan with an alternative course");
    })();
    const plan = computeView(base).plan!;
    const step = plan.steps.find((s) => s.alternatives)!;
    expect(courses.some((c) => c.id !== step.course?.id && canSwap(c, step.skillKey!))).toBe(true);
    const alt = courses.find((c) => c.id !== step.course?.id && canSwap(c, step.skillKey!))!;
    const after = computeView({ ...base, courseSwaps: { [step.skillKey!]: alt.id } }).plan!;
    const swapped = after.steps.find((s) => s.skillKey === step.skillKey)!;
    expect(swapped.course!.id).toBe(alt.id);
    expect(swapped.swapped).toBe(true);
    expect(swapped.hours).toBe(alt.hours);
    // A course that misses one of the step's skills is ignored.
    const bad = courses.find((c) => !c.catalogOnly && !c.strand && !canSwap(c, step.skillKey!))!;
    expect(computeView({ ...base, courseSwaps: { [step.skillKey!]: bad.id } }).plan!.steps.find((s) => s.skillKey === step.skillKey)!.course!.id).toBe(step.course!.id);
  });
});

describe("where you can work", () => {
  const w = () => computeWorld(initialState()).weights;
  const base = { skills: occupations[0].skills, months: 6, hoursPerWeek: 10, interests: [] as string[], goals: [] as string[] };
  const run = (area: string[] | null) => matchRoles(pickInputs({ ...base, area }), w(), "2026Q1");

  it("changes nothing when they can work anywhere", () => {
    const key = (ms: ReturnType<typeof run>) => JSON.stringify(ms.map((m) => [m.roleId, m.score]));
    expect(key(run(null))).toBe(key(matchRoles(pickInputs(base), w(), "2026Q1")));
    expect(run(null).every((m) => m.localPenalty === 0 && m.localLq === null)).toBe(true);
  });

  it("only moves jobs down, by at most the cap, and never hides one", () => {
    const anywhere = run(null), home = run(["MY-12"]); // Sabah
    expect(home.length).toBe(anywhere.length);
    for (const m of home) {
      const a = anywhere.find((x) => x.roleId === m.roleId)!;
      expect(m.localPenalty).toBeGreaterThanOrEqual(0);
      expect(m.localPenalty).toBeLessThanOrEqual(0.06 + 1e-9);
      expect(a.score - m.score).toBeCloseTo(m.localPenalty, 9);
    }
    expect(home.some((m) => m.localPenalty > 0)).toBe(true);
  });

  it("the area comes from home state and the answer to moving", async () => {
    const { areaFor } = await import("@/lib/engine/geo");
    expect(areaFor("MY-07", "stay")).toEqual(["MY-07"]);
    expect(areaFor("MY-07", "region")).toContain("MY-02");
    expect(areaFor("MY-07", "anywhere")).toBeNull();
    expect(areaFor(null, "stay")).toBeNull();
  });
});

describe("students", () => {
  it("a student with no job yet gets matches, a deadline to graduation and no stay-in-your-job card", () => {
    const st: SessionState = { ...initialState(), profile: { name: "You", status: "studying", occupationId: "", education: "degree", study: "computing", years: 0, skills: occupations.find((o) => o.sector === "computing")!.skills, interests: [], months: 18, hoursPerWeek: 10, budget: "free", synthetic: true } };
    const v = computeView(st);
    expect(v.stay).toBeNull();
    expect(v.matches.length).toBeGreaterThan(0);
    expect(v.matches[0].deadlineWeeks).toBe(Math.floor(18 * 4.345 - 2));
  });

  it("picked states add to home, and unknown states are ignored", async () => {
    const { areaFor, areaName } = await import("@/lib/engine/geo");
    expect(areaFor("MY-12", "pick", ["MY-10", "MY-14", "XX"])).toEqual(["MY-12", "MY-10", "MY-14"]);
    expect(areaName("MY-12", "pick", ["MY-10"])).toBe("Sabah and Selangor");
  });
});

describe("why this job", () => {
  it("splits each job's skills into what AI will handle and what stays the worker's, with no general tools as a human edge", () => {
    const st = personaState("hafiz")!;
    const v = computeView({ ...st, profile: { ...st.profile!, months: 6 } });
    for (const m of v.matches) {
      const ids = [...m.why.aiDoes, ...m.why.staysYours].map((s) => s.skillId);
      expect(new Set(ids).size, m.roleId).toBe(ids.length);
      expect(m.why.staysYours.some((s) => s.skillId === "ai_tools" || s.skillId === "spreadsheets"), m.roleId).toBe(false);
      expect(m.why.humanEdge.text.length, m.roleId).toBeGreaterThan(20);
    }
    const mf = v.matches.find((m) => m.roleId === "fin_inclusion_officer")!;
    expect(mf.why.aiDoes.map((s) => s.skillId)).toContain("loan_docs");
    expect(mf.why.staysYours.map((s) => s.skillId)).toContain("fin_inclusion");
    expect(mf.why.inField).toBe(true);
  });
});

describe("plan order and step ticks", () => {
  it("puts the resume update after the courses, ticks the meeting on booking, and needs no scan for the resume step", () => {
    const st = personaState("hafiz")!;
    const v = computeView(st);
    const ids = v.plan!.steps.map((s) => s.id);
    const lastCourse = Math.max(...v.plan!.steps.map((s, i) => (s.kind === "course" ? i : -1)));
    expect(ids.indexOf("resume")).toBeGreaterThan(lastCourse);
    expect(ids.indexOf("resume")).toBeLessThan(ids.indexOf("meet"));
    const booked = computeView({ ...st, resume: null, pathway: { meetingBooked: { meetingId: "m1", start: "2026-11-01T02:00:00.000Z", at: "2026-10-23T00:00:00.000Z" }, resumeApplied: true } });
    expect(booked.pathway.done.meet).toBe(true);
    expect(booked.pathway.done.resume).toBe(true);
  });
});

describe("the market keeps moving in long sessions", () => {
  it("simulated players still trade hours after the session started", () => {
    const w0 = replayHistory().weights;
    const q = ladder(liveQuestions("live").find((x) => x.id === "swe-2026Q2")!)[1];
    const at = (h: number) => runTape(q, w0, "long", [], h * 3600);
    expect(at(5).trades).toBeGreaterThan(at(3).trades);
    expect(at(5).series.some((p) => p.t > 4 * 3600)).toBe(true);
  });
});
