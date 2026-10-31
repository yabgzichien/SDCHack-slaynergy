import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { personas, quarterIndex, prevQuarter, series, skills } from "@/lib/engine/data";
import { computeView } from "@/lib/engine/view";
import { computeWorld } from "@/lib/engine/world";
import { personaState } from "@/lib/engine/review";
import { expiryFor, NOW } from "@/lib/engine/expiry";
import { FUTURES, FUTURE_IDS, FUTURE_FLOOR, FADE_PER_QUARTER, UPDATE_STRENGTH, CROWD_TILT, P_MIN, P_MAX, DOSM_SIGMA_MIN } from "@/lib/engine/futures-def";
import { HEADLINE_YEAR, HORIZON, RATE_BASE, RATE_PER_COVERAGE, THRESHOLD, fmtYear, isCounted, readiness, yearsToThreshold } from "@/lib/engine/expiry-math";
import { skillMathFor } from "@/lib/engine/skill-math";
import { crowdTilt, futureWeights } from "@/lib/engine/futures";
import { updateScores, replayHistory, liveQuestions } from "@/lib/engine/replay";
import { futureProbs, makeQuestions } from "@/lib/engine/questions";
import { SM } from "@/components/skill-math-text";
import { DICT } from "@/lib/i18n";

// These tests are the fact-check behind the "How we worked out your skill dates" page (/skills/how). The formulas the
// page prints are written out again here from the raw data, by hand, with the numbers typed in as the page states them;
// the engine has to agree with that second copy. If a constant changes, the page's formulas and words change with it
// (they read the constants), and a test here fails until this second copy is updated on purpose.

const state = (id: string) => ({ ...personaState(id)!, clock: { t0: new Date().toISOString() } });
const viewOf = (id: string) => computeView(state(id));

describe("the numbers the page states", () => {
  it("are the constants the engine uses", () => {
    expect([THRESHOLD, HORIZON, RATE_BASE, RATE_PER_COVERAGE, HEADLINE_YEAR, NOW]).toEqual([0.45, 2040, 0.15, 0.6, 2031, 2026.8]);
    expect(FUTURES.map((f) => [f.id, f.adoptMult, f.capMult, f.clericalDriftPp])).toEqual([["slow", 0.6, 0.6, -0.05], ["medium", 1, 1, -0.15], ["fast", 1.6, 1.6, -0.35]]);
    expect([FUTURE_FLOOR, FADE_PER_QUARTER, UPDATE_STRENGTH, CROWD_TILT, P_MIN, P_MAX, DOSM_SIGMA_MIN]).toEqual([0.05, 0.85, 0.5, 0.5, 0.04, 0.96, 0.25]);
    expect(fmtYear(NOW)).toBe("Oct 2026");
  });

  it("put every ILO exposure score between 0 and 1", () => {
    const all = Object.values(series.ilo).map((x) => x.score);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...all)).toBeLessThanOrEqual(1);
  });

  it("match the Skills page: the headline year and the counting rule are in its source", () => {
    const src = fs.readFileSync(path.resolve(import.meta.dirname, "../src/app/skills/page.tsx"), "utf8");
    expect(src).toContain(`yearOf(s) < ${HEADLINE_YEAR}`);
    expect(src).toContain(`before ${HEADLINE_YEAR}`);
    expect(src).toContain("byFutureYear[speed] ?? Infinity");
  });
});

describe("a skill's date, worked out again by hand from the raw data", () => {
  const E = (sk: (typeof skills)[number]) => (sk.complement || !sk.ilo ? 0.2 : series.ilo[sk.ilo]?.score ?? 0.4);
  const K = (sk: (typeof skills)[number]) => {
    const v = sk.onet.map((c) => series.aei[c]?.coverage).filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.2;
  };
  const mult = { slow: 0.6, medium: 1.0, fast: 1.6 };

  it("agrees with the engine for all 80 skills under all three speeds", () => {
    expect(skills.length).toBe(80);
    const w = { slow: 0.3, medium: 0.5, fast: 0.2 };
    for (const sk of skills) {
      const e = E(sk), r = 0.15 + 0.6 * K(sk);
      const x = expiryFor(sk.id, w);
      expect(x.exposure).toBe(e);
      expect(x.rate).toBeCloseTo(r, 12);
      for (const f of FUTURE_IDS) {
        // readiness = E x (1 - e^(-r m t)) reaches 0.45 at t = ln(1 / (1 - 0.45 / E)) / (r m)
        const want = e <= 0.45 ? Infinity : 2026.8 + Math.log(1 / (1 - 0.45 / e)) / (r * mult[f]);
        if (want === Infinity) expect(x.byFuture[f]).toBe(Infinity);
        else expect(x.byFuture[f]).toBeCloseTo(want, 9);
      }
      // Our forecast: the weighted average of the dates, each capped at 2040
      const wantAvg = FUTURE_IDS.reduce((a, f) => a + w[f] * Math.min(x.byFuture[f], 2040), 0);
      expect(x.expected).toBeCloseTo(wantAvg, 9);
      expect(x.durable).toBe(e <= 0.45);
    }
  });

  it("really is the date readiness reaches 0.45, and readiness never goes above exposure", () => {
    for (const sk of skills.filter((s) => E(s) > 0.45)) {
      const e = E(sk), r = 0.15 + 0.6 * K(sk);
      for (const f of FUTURE_IDS) {
        const t = yearsToThreshold(e, r, mult[f]);
        expect(readiness(e, r, mult[f], t)).toBeCloseTo(0.45, 9);
        expect(readiness(e, r, mult[f], t * 0.99)).toBeLessThan(0.45);
        expect(readiness(e, r, mult[f], t * 1.01)).toBeGreaterThan(0.45);
      }
    }
    for (const sk of skills) expect(readiness(E(sk), 0.15 + 0.6 * K(sk), 1.6, 500)).toBeLessThanOrEqual(E(sk));
  });

  it("never flags a skill whose exposure is 0.45 or less (those are the lasting ones)", () => {
    const lasting = skills.filter((s) => E(s) <= 0.45);
    expect(lasting.length).toBeGreaterThan(0);
    for (const sk of lasting) {
      const x = expiryFor(sk.id, { slow: 0.3, medium: 0.5, fast: 0.2 });
      expect(FUTURE_IDS.every((f) => x.byFuture[f] === Infinity)).toBe(true);
      expect(x.durable).toBe(true);
    }
    expect(yearsToThreshold(0.45, 0.5, 1)).toBe(Infinity);
    expect(yearsToThreshold(0.4500001, 0.5, 1)).toBeLessThan(Infinity);
  });

  it("uses the stated fallbacks: 0.2 with no ILO occupation, 0.2 coverage with no AEI occupation", () => {
    const none = skills.filter((s) => s.complement || !s.ilo);
    expect(none.map((s) => s.id)).toEqual(["ai_tools"]);
    const v = viewOf(personas[0].id).skillMath;
    const m = skillMathFor([{ skillId: "ai_tools", name: "x" }], { slow: 0.3, medium: 0.5, fast: 0.2 }).skills[0];
    expect(m.exposure).toMatchObject({ value: 0.2, basis: "none", code: null });
    expect(m.coverage).toMatchObject({ value: 0.2, basis: "none", occupations: [] });
    expect(v.consts.exposureNoOccupation).toBe(0.2);
    expect(v.consts.coverageMissing).toBe(0.2);
  });

  it("averages the coverage of a skill's occupations", () => {
    const multi = skills.filter((s) => s.onet.filter((c) => typeof series.aei[c]?.coverage === "number").length > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const sk of multi.slice(0, 10)) {
      const m = skillMathFor([{ skillId: sk.id, name: sk.name }], { slow: 0.3, medium: 0.5, fast: 0.2 }).skills[0];
      expect(m.coverage.value).toBeCloseTo(m.coverage.occupations.reduce((a, o) => a + o.coverage, 0) / m.coverage.occupations.length, 12);
    }
  });
});

describe("the working the page shows is the engine's own", () => {
  it.each(personas.map((p) => p.id))("for %s: dates, forecast and count match the Skills page", (id) => {
    const v = viewOf(id);
    expect(v.skillMath.skills.map((r) => r.skillId)).toEqual(v.profileSkills.map((s) => s.skillId));
    for (const r of v.skillMath.skills) {
      const pv = v.profileSkills.find((s) => s.skillId === r.skillId)!.expiry;
      for (const f of FUTURE_IDS) expect(r.dates[f]).toBe(pv.byFutureYear[f]);
      expect(r.forecast).toBe(pv.byFutureYear.forecast);
      expect(r.exposure.value).toBe(pv.exposure);
      expect(r.coverage.value).toBe(pv.coverage);
    }
    // the count in the Skills page headline, for Our forecast and for each speed taken as certain
    for (const key of ["forecast", ...FUTURE_IDS]) {
      const page = v.profileSkills.filter((s) => (s.expiry.byFutureYear[key] ?? Infinity) < 2031).length;
      const mine = v.skillMath.skills.filter((r) => isCounted(key === "forecast" ? r.forecast : r.dates[key as "slow"])).length;
      expect(mine, key).toBe(page);
    }
  });

  it("reproduces every date from the rounded numbers it prints (within 0.01 of a year)", () => {
    for (const id of personas.map((p) => p.id)) {
      for (const r of viewOf(id).skillMath.skills.filter((x) => x.need !== null)) {
        const E = +r.exposure.value.toFixed(2), rate = +r.rate.toFixed(4);
        const need = +(0.45 / E).toFixed(4), L = +Math.log(1 / (1 - need)).toFixed(4);
        for (const f of FUTURES) expect(Math.abs(2026.8 + L / (rate * f.adoptMult) - r.dates[f.id]!), `${id} ${r.skillId} ${f.id}`).toBeLessThan(0.0105);
      }
    }
  });

  it("counts a date after 2040 as 2040 in Our forecast, and says which dates were capped", () => {
    const w = { slow: 0.2, medium: 0.3, fast: 0.5 };
    const row = skillMathFor(skills.filter((s) => s.ilo && series.ilo[s.ilo].score > 0.45).slice(0, 80).map((s) => ({ skillId: s.id, name: s.name })), w);
    for (const r of row.skills) {
      for (const f of FUTURE_IDS) expect(r.capped[f]).toBe(r.dates[f] !== null && r.dates[f]! > 2040);
      if (r.forecast !== null) expect(r.forecast).toBeCloseTo(FUTURE_IDS.reduce((a, f) => a + w[f] * Math.min(r.dates[f]!, 2040), 0), 9);
    }
  });
});

describe("how likely each speed is (formulas 9a to 9e)", () => {
  const softmax = (xs: number[]) => { const m = Math.max(...xs), e = xs.map((x) => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };

  it("9c: w = 0.05 + 0.85 x softmax(s + tilt), from the scores and tilts the page prints", () => {
    const w = computeWorld(state(personas[0].id));
    const sm = softmax(FUTURE_IDS.map((f) => w.scores[f] + w.crowdTilt[f]));
    FUTURE_IDS.forEach((f, i) => expect(w.weights[f]).toBeCloseTo(0.05 + 0.85 * sm[i], 12));
    expect(FUTURE_IDS.reduce((a, f) => a + w.weights[f], 0)).toBeCloseTo(1, 12);
    for (const f of FUTURE_IDS) expect(w.weights[f]).toBeGreaterThanOrEqual(0.05);
    // with no open questions the likelihood is the stored scores alone
    const stored = softmax(FUTURE_IDS.map((f) => w.scores[f]));
    const earned = futureWeights(w.scores, { slow: 0, medium: 0, fast: 0 });
    FUTURE_IDS.forEach((f, i) => expect(earned[f]).toBeCloseTo(0.05 + 0.85 * stored[i], 12));
  });

  it("9a: a settled result fades the old score by 15% and adds half the log of the chance given to what happened", () => {
    const S = { slow: -1, medium: -2, fast: -3 };
    const runs = [
      { probs: { slow: 0.3, medium: 0.5, fast: 0.8 }, q: { outcome: true } },
      { probs: { slow: 0.4, medium: 0.6, fast: 0.2 }, q: { outcome: false } },
    ] as never;
    const out = updateScores(S, runs);
    expect(out.slow).toBeCloseTo(0.85 * -1 + 0.5 * (Math.log(0.3) + Math.log(1 - 0.4)), 12);
    expect(out.medium).toBeCloseTo(0.85 * -2 + 0.5 * (Math.log(0.5) + Math.log(1 - 0.6)), 12);
    expect(out.fast).toBeCloseTo(0.85 * -3 + 0.5 * (Math.log(0.8) + Math.log(1 - 0.2)), 12);
  });

  it("9b: an open question tilts a speed by 0.25 x [P ln p + (1 - P) ln(1 - p)]", () => {
    const runs = [{ probs: { slow: 0.3, medium: 0.5, fast: 0.8 }, price: 0.7 }, { probs: { slow: 0.4, medium: 0.6, fast: 0.2 }, price: 0.1 }] as never;
    const t = crowdTilt(runs);
    const one = (p: number, P: number) => P * Math.log(p) + (1 - P) * Math.log(1 - p);
    expect(t.slow).toBeCloseTo(0.25 * (one(0.3, 0.7) + one(0.4, 0.1)), 12);
    expect(t.fast).toBeCloseTo(0.25 * (one(0.8, 0.7) + one(0.2, 0.1)), 12);
    expect(CROWD_TILT * UPDATE_STRENGTH).toBe(0.25);
  });

  // normal curve to 1e-7, written again here so the engine's approximation is checked against it
  const phi = (x: number) => { const s = x < 0 ? -1 : 1, a = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * a); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a); return 0.5 * (1 + s * y); };
  const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
  const sd = (x: number[]) => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); };

  it("9d: for an AI test question, p = 1 - Phi((T - c x g) / sigma), kept between 0.04 and 0.96", () => {
    const qs = makeQuestions().filter((q) => q.kind === "epoch" && q.phase !== "replay");
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      const f = series.epoch[q.series].frontier;
      const vals = f.map((x) => x.v);
      const gains = f.slice(1).map((x, i) => ({ q: x.q, g: x.v - f[i].v })).filter((x) => quarterIndex(x.q) <= quarterIndex(prevQuarter(q.quarter))).map((x) => x.g);
      const g = mean(gains.slice(-4));
      const floor = Math.max(0.05, 0.04 * (Math.max(...vals) - Math.min(...vals)));
      const sigma = Math.max(sd(gains.slice(-8)), 0.5 * Math.abs(g), floor);
      const got = futureProbs(q);
      for (const fu of FUTURES) expect(got[fu.id], `${q.id} ${fu.id}`).toBeCloseTo(Math.min(0.96, Math.max(0.04, 1 - phi((q.threshold - fu.capMult * g) / sigma))), 5);
    }
  });

  it("9e: for the office admin question, p = Phi((T - drift) / sigma), sigma at least 0.25", () => {
    const qs = makeQuestions().filter((q) => q.kind === "dosm" && q.phase !== "replay");
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      const quarters = series.dosm.quarters;
      const ch = quarters.slice(1).map((x, i) => ({ q: x.q, d: x.clerical_share - quarters[i].clerical_share })).filter((x) => quarterIndex(x.q) <= quarterIndex(prevQuarter(q.quarter))).map((x) => x.d);
      const sigma = Math.max(sd(ch.slice(-8)), 0.25);
      const got = futureProbs(q);
      for (const fu of FUTURES) expect(got[fu.id], `${q.id} ${fu.id}`).toBeCloseTo(Math.min(0.96, Math.max(0.04, phi((q.threshold - fu.clericalDriftPp) / sigma))), 5);
    }
  });

  it("the scores come from the replayed questions the page counts", () => {
    const w = computeWorld(state(personas[0].id));
    expect(w.replay.questions).toBe(replayHistory().stats.questions);
    expect(liveQuestions("live").length).toBeGreaterThan(0);
  });
});

describe("the page's words", () => {
  it.each(["ms", "zh", "ta"] as const)("every sentence has a translation in %s", (lang) => {
    const missing = Object.values(SM).filter((s) => DICT[lang][s] === undefined);
    expect(missing).toEqual([]);
  });

  it("every blank in a sentence is one the page fills", () => {
    const known = new Set(["x", "y", "a", "b", "c", "n", "total", "s", "lo", "hi"]);
    for (const s of Object.values(SM)) for (const m of s.matchAll(/\{(\w+)\}/g)) expect(known.has(m[1]), `${s} {${m[1]}}`).toBe(true);
  });
});
