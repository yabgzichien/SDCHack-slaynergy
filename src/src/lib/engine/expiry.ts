import { series, skillById, type Skill } from "./data";
import { FUTURES, FUTURE_IDS, type FutureId } from "./futures-def";
import { clamp } from "./math";
import type { Weights3 } from "./futures";
import { COVERAGE_MISSING, EXPOSURE_NOT_IN_TABLE, EXPOSURE_NO_OCCUPATION, HORIZON, THRESHOLD, fmtYear, rateFor, yearsToThreshold } from "./expiry-math";

// Skill expiry date = when AI is expected to do most of the work behind a skill AND be commonly used for it.
// readiness(t) = exposure x adoption(t); we solve readiness >= THRESHOLD.
//   exposure  = ILO 2025 GenAI exposure score of the skill's reference occupation (0..1)
//   adoption  = 1 - exp(-rate x speed x years), rate = 0.15 + 0.6 x (Anthropic Economic Index task coverage)
//   speed     = the future's adoption multiplier (slow 0.6, medium 1.0, fast 1.6)
// The arithmetic and its constants are in expiry-math.ts, shared with the page that explains them (/skills/how).
export const NOW = 2026.8;
// The skill-date clock. Today it is NOW; the history timeline moves it to a past release's day while it builds that
// day's view (history.ts), then puts it back. The engine is synchronous, so the change never reaches another request.
let clock = NOW;
export const nowYear = () => clock;
export function withNow<T>(year: number, f: () => T): T {
  const before = clock;
  clock = year;
  try { return f(); } finally { clock = before; }
}
export { THRESHOLD, HORIZON };

export type SkillExpiry = {
  skillId: string; exposure: number; coverage: number; rate: number;
  byFuture: Record<FutureId, number>; // decimal year, Infinity if not within horizon
  expected: number; // probability-weighted, capped at HORIZON
  durable: boolean;
};

export function exposureOf(sk: Skill) {
  if (sk.complement || !sk.ilo) return EXPOSURE_NO_OCCUPATION;
  return series.ilo[sk.ilo]?.score ?? EXPOSURE_NOT_IN_TABLE;
}
export function coverageOf(sk: Skill) {
  const v = sk.onet.map((c) => series.aei[c]?.coverage).filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : COVERAGE_MISSING;
}

export function expiryFor(skillId: string, w: Weights3): SkillExpiry {
  const sk = skillById[skillId];
  const e = exposureOf(sk), cov = coverageOf(sk);
  const rate = rateFor(cov);
  const byFuture = {} as Record<FutureId, number>;
  for (const f of FUTURES) byFuture[f.id] = clock + yearsToThreshold(e, rate, f.adoptMult);
  const expected = FUTURE_IDS.reduce((a, id) => a + w[id] * Math.min(byFuture[id], HORIZON), 0);
  return { skillId, exposure: e, coverage: cov, rate, byFuture, expected, durable: FUTURE_IDS.every((id) => byFuture[id] === Infinity) };
}

// 0 (expires now) .. 1 (lasts at least 8 more years)
export const durability = (x: SkillExpiry) => clamp((x.expected - clock) / 8, 0, 1);

export { fmtYear };
