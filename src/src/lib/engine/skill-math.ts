import { series, skillById } from "./data";
import { CROWD_TILT, DOSM_SIGMA_MIN, FADE_PER_QUARTER, FUTURES, FUTURE_FLOOR, P_MAX, P_MIN, UPDATE_STRENGTH, type FutureId } from "./futures-def";
import type { Weights3 } from "./futures";
import { expiryFor, nowYear } from "./expiry";
import {
  COVERAGE_MISSING, EXPOSURE_NOT_IN_TABLE, EXPOSURE_NO_OCCUPATION, HEADLINE_YEAR, HORIZON, RATE_BASE, RATE_PER_COVERAGE, THRESHOLD,
  yearsToThreshold, type SkillMath, type SkillMathRow,
} from "./expiry-math";

// The numbers behind each skill's date, with where they came from, for the "How we got this" page (/skills/how).
// Every value is read from expiryFor, the function that makes the dates, or from the same data it reads, so the page can
// show its working without a second copy of the arithmetic that could drift from the engine.
export function skillMathFor(skills: { skillId: string; name: string }[], w: Weights3): SkillMath {
  const rows = skills.map(({ skillId, name }): SkillMathRow => {
    const sk = skillById[skillId];
    const e = expiryFor(skillId, w);
    const ilo = sk.ilo ? series.ilo[sk.ilo] : undefined;
    const years = {} as SkillMathRow["years"], dates = {} as SkillMathRow["dates"], capped = {} as SkillMathRow["capped"];
    for (const f of FUTURES) {
      const y = yearsToThreshold(e.exposure, e.rate, f.adoptMult);
      years[f.id] = Number.isFinite(y) ? y : null;
      dates[f.id] = Number.isFinite(e.byFuture[f.id]) ? e.byFuture[f.id] : null;
      capped[f.id] = e.byFuture[f.id] > HORIZON;
    }
    return {
      skillId, name,
      exposure: { value: e.exposure, basis: sk.complement || !sk.ilo ? "none" : ilo ? "ilo" : "not-in-table", code: sk.ilo, title: ilo?.title ?? null, gradient: ilo?.gradient ?? null },
      coverage: {
        value: e.coverage,
        basis: sk.onet.some((c) => typeof series.aei[c]?.coverage === "number") ? "aei" : "none",
        occupations: sk.onet.flatMap((c) => (typeof series.aei[c]?.coverage === "number" ? [{ code: c, title: series.aei[c].title, coverage: series.aei[c].coverage, tasks: series.aei[c].tasks }] : [])),
      },
      rate: e.rate,
      need: e.exposure > THRESHOLD ? THRESHOLD / e.exposure : null,
      years, dates, capped,
      forecast: e.durable ? null : e.expected,
    };
  });
  return {
    consts: {
      now: nowYear(), threshold: THRESHOLD, horizon: HORIZON, rateBase: RATE_BASE, ratePerCoverage: RATE_PER_COVERAGE, headlineYear: HEADLINE_YEAR,
      exposureNoOccupation: EXPOSURE_NO_OCCUPATION, exposureNotInTable: EXPOSURE_NOT_IN_TABLE, coverageMissing: COVERAGE_MISSING,
      floor: FUTURE_FLOOR, fade: FADE_PER_QUARTER, update: UPDATE_STRENGTH, crowdTilt: CROWD_TILT, pMin: P_MIN, pMax: P_MAX, dosmSigmaMin: DOSM_SIGMA_MIN,
    },
    futures: FUTURES.map((f) => ({ id: f.id as FutureId, name: f.name.replace(" AI progress", ""), mult: f.adoptMult, weight: w[f.id] })),
    skills: rows,
  };
}
