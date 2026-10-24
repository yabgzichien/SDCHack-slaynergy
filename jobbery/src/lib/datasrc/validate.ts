// Checks a fetched source must pass before it can go live. Settlement is final, so a bad parse must never reach it:
// when a check fails the server keeps the last good data and says why (src/lib/server/refresh.ts).
// Each check returns null when the data passes, or the reason it was rejected.
import type { DosmQuarter, EpochSeries } from "../engine/data";
import type { StatesFile } from "../engine/geo";

export const LIMITS = {
  // DOSM revises past quarters a little; more than this is a misread column or a changed table.
  dosmRevisionPoints: 0.5, // clerical share, points per 100 ads
  dosmRevisionTotal: 0.1, // all job ads, as a share
  // A new quarter's clerical share moving more than this in one quarter is not believable.
  dosmNewQuarterPoints: 5,
  // Epoch AI past quarters may rise (late benchmark results for older models) but may not fall.
  epochFallTolerance: 0.01,
  stateEmployedChange: 0.15, // employed persons by state, quarter to quarter
  stateWageChange: 0.25, // median wage by state, year to year
};

const finite = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const DOSM_FIELDS: (keyof DosmQuarter)[] = ["total", "managers", "professionals", "technicians", "clerical", "service", "craft", "operators", "elementary", "clerical_share"];

export function checkDosm(prev: DosmQuarter[], next: DosmQuarter[]): string | null {
  if (!next.length) return "no quarters";
  for (const d of next) {
    if (!/^\d{4}Q[1-4]$/.test(d.q)) return `bad quarter label ${d.q}`;
    for (const f of DOSM_FIELDS) if (!finite(d[f])) return `${d.q}: ${f} is not a number`;
    if (d.total <= 0 || d.clerical_share < 0 || d.clerical_share > 100) return `${d.q}: totals out of range`;
  }
  const byQ = new Map(next.map((d) => [d.q, d]));
  for (const p of prev) {
    const n = byQ.get(p.q);
    if (!n) return `${p.q} disappeared`;
    if (Math.abs(n.clerical_share - p.clerical_share) > LIMITS.dosmRevisionPoints) return `${p.q}: clerical share revised ${p.clerical_share} → ${n.clerical_share}, more than ${LIMITS.dosmRevisionPoints} points`;
    if (Math.abs(n.total / p.total - 1) > LIMITS.dosmRevisionTotal) return `${p.q}: all job ads revised ${p.total} → ${n.total}, more than ${LIMITS.dosmRevisionTotal * 100}%`;
  }
  const known = new Set(prev.map((d) => d.q));
  for (let i = 1; i < next.length; i++) {
    if (known.has(next[i].q)) continue;
    const jump = Math.abs(next[i].clerical_share - next[i - 1].clerical_share);
    if (jump > LIMITS.dosmNewQuarterPoints) return `${next[i].q}: clerical share moved ${jump.toFixed(1)} points in one quarter`;
  }
  return null;
}

export function checkEpoch(prev: Record<string, EpochSeries>, next: Record<string, EpochSeries>): string | null {
  for (const id of Object.keys(prev)) {
    const a = prev[id].frontier, b = next[id]?.frontier;
    if (!b?.length) return `${id}: series missing`;
    for (let i = 0; i < b.length; i++) {
      if (!finite(b[i].v)) return `${id} ${b[i].q}: not a number`;
      if (i && b[i].v < b[i - 1].v - 1e-9) return `${id} ${b[i].q}: best score went down (${b[i - 1].v} → ${b[i].v})`;
    }
    const byQ = new Map(b.map((x) => [x.q, x.v]));
    for (const p of a) {
      const v = byQ.get(p.q);
      if (v === undefined) return `${id} ${p.q} disappeared`;
      if (v < p.v - LIMITS.epochFallTolerance) return `${id} ${p.q}: past best score fell ${p.v} → ${v}`;
    }
  }
  return null;
}

export function checkStates(prev: StatesFile, next: StatesFile): string | null {
  if (next.states.length !== prev.states.length) return `${next.states.length} states, expected ${prev.states.length}`;
  for (const s of next.states) {
    const p = prev.states.find((x) => x.id === s.id);
    if (!p) return `unknown state ${s.id}`;
    const { lfs, wages } = s;
    if (![lfs.labourForce, lfs.employed, lfs.unemployed, lfs.uRate, lfs.uRateYearAgo, wages.median, wages.mean].every(finite)) return `${s.name}: a figure is not a number`;
    if (lfs.uRate < 0 || lfs.uRate > 30 || lfs.employed <= 0 || wages.median <= 0) return `${s.name}: figures out of range`;
    if (Math.abs(lfs.employed / p.lfs.employed - 1) > LIMITS.stateEmployedChange) return `${s.name}: employed persons changed ${p.lfs.employed} → ${lfs.employed}`;
    if (Math.abs(wages.median / p.wages.median - 1) > LIMITS.stateWageChange) return `${s.name}: median wage changed ${p.wages.median} → ${wages.median}`;
    if (lfs.quarter < p.lfs.quarter) return `${s.name}: labour force quarter went back ${p.lfs.quarter} → ${lfs.quarter}`;
  }
  return null;
}
