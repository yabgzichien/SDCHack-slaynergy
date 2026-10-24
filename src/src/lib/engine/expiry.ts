import { series, skillById, type Skill } from "./data";
import { FUTURES, FUTURE_IDS, type FutureId } from "./futures-def";
import { clamp } from "./math";
import type { Weights3 } from "./futures";

// Skill expiry date = when AI is expected to do most of the work behind a skill AND be commonly used for it.
// readiness(t) = exposure x adoption(t); we solve readiness >= THRESHOLD.
//   exposure  = ILO 2025 GenAI exposure score of the skill's reference occupation (0..1)
//   adoption  = 1 - exp(-rate x speed x years), rate = 0.15 + 0.6 x (Anthropic Economic Index task coverage)
//   speed     = the future's adoption multiplier (slow 0.6, medium 1.0, fast 1.6)
export const NOW = 2026.8;
export const THRESHOLD = 0.45;
export const HORIZON = 2040;

export type SkillExpiry = {
  skillId: string; exposure: number; coverage: number; rate: number;
  byFuture: Record<FutureId, number>; // decimal year, Infinity if not within horizon
  expected: number; // probability-weighted, capped at HORIZON
  durable: boolean;
};

export function exposureOf(sk: Skill) {
  if (sk.complement || !sk.ilo) return 0.2;
  return series.ilo[sk.ilo]?.score ?? 0.4;
}
export function coverageOf(sk: Skill) {
  const v = sk.onet.map((c) => series.aei[c]?.coverage).filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.2;
}

export function expiryFor(skillId: string, w: Weights3): SkillExpiry {
  const sk = skillById[skillId];
  const e = exposureOf(sk), cov = coverageOf(sk);
  const rate = 0.15 + 0.6 * cov;
  const byFuture = {} as Record<FutureId, number>;
  for (const f of FUTURES) {
    if (e <= THRESHOLD) byFuture[f.id] = Infinity;
    else {
      const need = THRESHOLD / e; // adoption needed
      byFuture[f.id] = NOW + Math.log(1 / (1 - need)) / (rate * f.adoptMult);
    }
  }
  const expected = FUTURE_IDS.reduce((a, id) => a + w[id] * Math.min(byFuture[id], HORIZON), 0);
  return { skillId, exposure: e, coverage: cov, rate, byFuture, expected, durable: FUTURE_IDS.every((id) => byFuture[id] === Infinity) };
}

// 0 (expires now) .. 1 (lasts at least 8 more years)
export const durability = (x: SkillExpiry) => clamp((x.expected - NOW) / 8, 0, 1);

export function fmtYear(y: number) {
  if (!Number.isFinite(y) || y >= HORIZON) return `after ${HORIZON}`;
  const year = Math.floor(y);
  const m = Math.min(11, Math.floor((y - year) * 12));
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m]} ${year}`;
}
