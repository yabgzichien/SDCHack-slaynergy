import { CROWD_TILT, FUTURE_FLOOR, FUTURE_IDS, UPDATE_STRENGTH, type FutureId } from "./futures-def";
import type { Scores } from "./replay";
import type { MarketRun } from "./market";

export type Weights3 = Record<FutureId, number>;

// One scoring rule for both steps: how likely did the future make the answer?
//  - settled question: the answer is the real outcome (1 or 0) -> stored in `scores`
//  - open question: the answer is the crowd price -> tilt, recalculated each time, never stored
export function crowdTilt(open: MarketRun[]): Scores {
  const t = { slow: 0, medium: 0, fast: 0 } as Scores;
  for (const id of FUTURE_IDS) {
    for (const r of open) {
      const p = r.probs[id], c = r.price;
      t[id] += CROWD_TILT * UPDATE_STRENGTH * (c * Math.log(p) + (1 - c) * Math.log(1 - p));
    }
  }
  return t;
}

export function futureWeights(scores: Scores, tilt: Scores): Weights3 {
  const raw = FUTURE_IDS.map((id) => scores[id] + tilt[id]);
  const mx = Math.max(...raw);
  const ex = raw.map((x) => Math.exp(x - mx));
  const z = ex.reduce((a, b) => a + b, 0);
  const out = {} as Weights3;
  FUTURE_IDS.forEach((id, i) => {
    out[id] = FUTURE_FLOOR + (1 - FUTURE_IDS.length * FUTURE_FLOOR) * (ex[i] / z);
  });
  return out;
}

