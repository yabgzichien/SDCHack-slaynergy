// The figures behind the job map for one kind of work and one measure, shared by the map page and its preview on Jobs.
import { STATES, stateJobs, type StateJobs } from "@/lib/engine/geo";
import type { SectorId } from "@/lib/engine/data";
import { rampFor, type MapValue, type Measure } from "@/lib/map-scale";

export const rm = (x: number) => `RM ${Math.round(x).toLocaleString()}`;
// figures are in thousands; show whole people, rounded to the nearest hundred
export const people = (thousands: number) => (Math.round(thousands * 10) * 100).toLocaleString();
const compactPeople = (t: number) => (t >= 10 ? `${Math.round(t)}k` : t >= 1 ? `${t.toFixed(1)}k` : `${Math.round(t * 1000)}`);
export const times = (x: number) => (x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`);
// quantile edges so each shade holds about the same number of states
const quantileBins = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return [0.2, 0.4, 0.6, 0.8, 1].map((q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]); };

export const metricOf = (r: StateJobs, m: Measure) => (m === "jobs" ? r.workers : m === "unemployment" ? r.uRate : r.medianWage);

export function mapFigures(sector: SectorId, measure: Measure) {
  const rows = stateJobs(sector);
  const values: MapValue[] = rows.map((r) => ({
    id: r.id,
    value: metricOf(r, measure),
    label: measure === "jobs" ? `about ${people(r.workers)} people in this kind of work` : measure === "unemployment" ? `unemployment ${r.uRate.toFixed(1)}%` : `median pay ${rm(r.medianWage)} a month`,
    short: measure === "jobs" ? compactPeople(r.workers) : measure === "unemployment" ? `${r.uRate.toFixed(1)}%` : `RM${(r.medianWage / 1000).toFixed(1)}k`,
  }));
  const bins = quantileBins(values.map((v) => v.value));
  const legend = measure === "jobs" ? "People in this kind of work (estimate)" : measure === "unemployment" ? `Unemployment rate, ${STATES[0].lfs.quarter.replace("Q", " Q")}. Darker is worse.` : `Median monthly pay, ${STATES[0].wages.year}`;
  const fmt = (x: number) => (measure === "jobs" ? compactPeople(x) : measure === "unemployment" ? `${x.toFixed(1)}%` : `RM${(x / 1000).toFixed(1)}k`);
  return { rows, values, bins, ramp: rampFor(measure), legend, fmt };
}
