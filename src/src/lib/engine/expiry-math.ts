import type { FutureId } from "./futures-def";

// The arithmetic behind a skill's date, with no data in it. The engine (expiry.ts) and the "How we got this" page
// (components/SkillMathExplain.tsx) call these same functions and read these same constants, so what the page explains
// is what the engine does. A skill is flagged on the day its readiness, exposure x adoption, reaches THRESHOLD.
export const THRESHOLD = 0.45;
export const HORIZON = 2040;
export const RATE_BASE = 0.15;
export const RATE_PER_COVERAGE = 0.6;
// What is used when the data has no figure for a skill.
export const EXPOSURE_NO_OCCUPATION = 0.2; // a skill AI works alongside, or one with no ILO occupation
export const EXPOSURE_NOT_IN_TABLE = 0.4; // an ILO code that is missing from the table
export const COVERAGE_MISSING = 0.2;
// The Skills page headline counts the skills whose date is before 1 January of this year.
export const HEADLINE_YEAR = 2031;

// The rule behind the Skills page headline: a skill counts when it has a date and the date is before 1 January HEADLINE_YEAR.
export const isCounted = (date: number | null) => (date ?? Infinity) < HEADLINE_YEAR;
export const rateFor = (coverage: number) => RATE_BASE + RATE_PER_COVERAGE * coverage;
// Share of companies using AI for a skill, t years from now, under a speed's multiplier.
export const adoption = (rate: number, mult: number, years: number) => 1 - Math.exp(-rate * mult * years);
export const readiness = (exposure: number, rate: number, mult: number, years: number) => exposure * adoption(rate, mult, years);
// Years from now until readiness reaches THRESHOLD; Infinity when exposure never gets there (exposure <= THRESHOLD).
export function yearsToThreshold(exposure: number, rate: number, mult: number) {
  if (exposure <= THRESHOLD) return Infinity;
  const need = THRESHOLD / exposure; // adoption needed
  return Math.log(1 / (1 - need)) / (rate * mult);
}

// A decimal year as "Mar 2029"; from HORIZON on it is "after 2040".
export function fmtYear(y: number) {
  if (!Number.isFinite(y) || y >= HORIZON) return `after ${HORIZON}`;
  const year = Math.floor(y);
  const m = Math.min(11, Math.floor((y - year) * 12));
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m]} ${year}`;
}

// Everything the explanation page shows for one skill, built by engine/skill-math.ts from the same data and functions
// the dates come from. A date of null means the skill is never flagged under that speed (exposure at or below THRESHOLD).
export type SkillMathRow = {
  skillId: string; name: string;
  exposure: { value: number; basis: "ilo" | "none" | "not-in-table"; code: string | null; title: string | null; gradient: string | null };
  coverage: { value: number; basis: "aei" | "none"; occupations: { code: string; title: string; coverage: number; tasks: number }[] };
  rate: number;
  need: number | null; // THRESHOLD / exposure, the adoption needed; null when exposure is at or below THRESHOLD
  years: Record<FutureId, number | null>; // years from now to THRESHOLD under each speed
  dates: Record<FutureId, number | null>; // the same as a decimal year (now + years)
  capped: Record<FutureId, boolean>; // the date is after HORIZON, so Our forecast counts it as HORIZON
  forecast: number | null; // Our forecast: the likelihood-weighted average of the three dates, each capped at HORIZON
};
export type SkillMath = {
  consts: {
    now: number; threshold: number; horizon: number; rateBase: number; ratePerCoverage: number; headlineYear: number;
    exposureNoOccupation: number; exposureNotInTable: number; coverageMissing: number;
    floor: number; fade: number; update: number; crowdTilt: number; pMin: number; pMax: number; dosmSigmaMin: number;
  };
  futures: { id: FutureId; name: string; mult: number; weight: number }[];
  skills: SkillMathRow[];
};
