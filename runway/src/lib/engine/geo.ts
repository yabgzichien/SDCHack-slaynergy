import statesJson from "../../../data/states.json";
import { GROUP_LABEL, type GroupKey, type SectorId } from "./data";

// Where the work is, state by state. Everything here is computed from public, dated data (data/states.json):
//   - workers by state and industry, and by state and occupation group (DOSM Labour Force Survey Report 2024),
//     scaled to today by each state's employment (OpenDOSM LFS, 2026 Q2)
//   - unemployment by state (OpenDOSM LFS, 2026 Q2) and median monthly wage by state (OpenDOSM, 2025)
// DOSM publishes no state figures for single jobs, nor industry and occupation together by state. So "jobs like this" is
// estimated as the people in a job's industries, times the share of the state's workers in the job's occupation group.
// The app labels these numbers as estimates.

export type StateId = string;
export type StateRow = {
  id: StateId; name: string; short: string;
  lfs: { quarter: string; labourForce: number; employed: number; unemployed: number; uRate: number; uRateYearAgo: number };
  wages: { year: number; median: number; mean: number };
  industry: Record<string, number>;
  occupation: Record<string, number>; // employed persons by MASCO major group, thousands
};
type StatesFile = { generatedAt: string; sources: { id: string; name: string; url: string; latest: string; licence: string }[]; industryYear: number; occupationYear: number; nationalIndustry: Record<string, number>; nationalOccupation: Record<string, number>; states: StateRow[] };
export const geo = statesJson as unknown as StatesFile;
export const STATES = geo.states;
export const stateById: Record<string, StateRow> = Object.fromEntries(STATES.map((s) => [s.id, s]));

export const INDUSTRY_LABEL: Record<string, string> = {
  finance: "finance and insurance", professional: "professional, scientific and technical services", admin: "administrative and support services",
  public: "public administration", ict: "information and communication", manufacturing: "manufacturing", construction: "construction",
  health: "health and social work", trade: "wholesale and retail trade", accommodation: "hotels and food service", transport: "transport and storage",
  utilities: "electricity and gas", education: "education",
};

// Which industries each sector's jobs are found in, and roughly in what mix. Stated openly and shown in the app.
export const SECTOR_INDUSTRIES: Record<SectorId, { key: string; weight: number }[]> = {
  finance: [{ key: "finance", weight: 1 }],
  business: [{ key: "professional", weight: 0.5 }, { key: "admin", weight: 0.3 }, { key: "public", weight: 0.2 }],
  computing: [{ key: "ict", weight: 0.7 }, { key: "professional", weight: 0.3 }],
  engineering: [{ key: "manufacturing", weight: 0.5 }, { key: "construction", weight: 0.3 }, { key: "professional", weight: 0.2 }],
  science: [{ key: "professional", weight: 0.5 }, { key: "manufacturing", weight: 0.3 }, { key: "health", weight: 0.2 }],
  health: [{ key: "health", weight: 1 }],
  service: [{ key: "trade", weight: 0.6 }, { key: "accommodation", weight: 0.4 }],
  logistics: [{ key: "transport", weight: 0.7 }, { key: "trade", weight: 0.3 }],
  trades: [{ key: "construction", weight: 0.5 }, { key: "manufacturing", weight: 0.4 }, { key: "utilities", weight: 0.1 }],
  education: [{ key: "education", weight: 1 }],
};
export const kindOfWork = (sector: SectorId) => SECTOR_INDUSTRIES[sector].map((p) => INDUSTRY_LABEL[p.key]).join(", ");
export const occupationOf = (group: GroupKey) => GROUP_LABEL[group];

const totalOf = (xs: Record<string, number>) => Object.values(xs).reduce((a, b) => a + b, 0);

export type StateJobs = {
  id: StateId; name: string; short: string;
  workers: number;   // estimated workers in this kind of work today, in thousands
  share: number;     // share of Malaysia's workers in this kind of work (0..1)
  lq: number;        // concentration: this state's share of its own jobs in this kind of work, against Malaysia's (1 = average)
  uRate: number; medianWage: number; employed: number;
};

// Workers in a sector's industries, per state, scaled from the report year to the latest labour force quarter.
// With an occupation group, only the state's share of workers in that group is counted (assumes the group is spread
// evenly across the state's industries, the best the published tables allow).
export function stateJobs(sector: SectorId, group?: GroupKey): StateJobs[] {
  const mix = SECTOR_INDUSTRIES[sector];
  const rows = STATES.map((s) => {
    const scale = s.lfs.employed / Math.max(1e-9, totalOf(s.industry));
    const inGroup = group ? (s.occupation[group] ?? 0) / Math.max(1e-9, totalOf(s.occupation)) : 1;
    const workers = mix.reduce((a, p) => a + p.weight * (s.industry[p.key] ?? 0), 0) * inGroup * scale;
    return { s, workers };
  });
  const totalWorkers = rows.reduce((a, r) => a + r.workers, 0);
  const totalEmployed = STATES.reduce((a, s) => a + s.lfs.employed, 0);
  return rows.map(({ s, workers }) => ({
    id: s.id, name: s.name, short: s.short, workers, share: workers / totalWorkers,
    lq: (workers / s.lfs.employed) / (totalWorkers / totalEmployed),
    uRate: s.lfs.uRate, medianWage: s.wages.median, employed: s.lfs.employed,
  }));
}

export type Move = { to: StateJobs; from: StateJobs | null; times: number | null; wageGap: number | null; uGap: number | null };
// What moving from home to another state would mean for one job: how many times as many jobs like it, pay and unemployment.
export function compareMove(sector: SectorId, home: StateId | null | undefined, to: StateId, group?: GroupKey): Move {
  const all = stateJobs(sector, group);
  const dest = all.find((x) => x.id === to)!;
  const from = home ? all.find((x) => x.id === home) ?? null : null;
  return {
    to: dest, from,
    times: from && from.workers > 0 ? dest.workers / from.workers : null,
    wageGap: from ? dest.medianWage - from.medianWage : null,
    uGap: from ? dest.uRate - from.uRate : null,
  };
}

// Best states for a job, outside home: the most jobs like it, then lower unemployment.
export function bestStates(sector: SectorId, home: StateId | null | undefined, n = 3, group?: GroupKey): StateJobs[] {
  return stateJobs(sector, group).filter((x) => x.id !== home).sort((a, b) => b.workers - a.workers || a.uRate - b.uRate).slice(0, n);
}

// ---------- where you can work ----------
// The usual five-region grouping of Malaysia's states, used for "nearby states".
export const REGIONS: { id: string; name: string; states: StateId[] }[] = [
  { id: "north", name: "the northern states", states: ["MY-09", "MY-02", "MY-07", "MY-08"] },
  { id: "central", name: "the central states", states: ["MY-10", "MY-14", "MY-16", "MY-05"] },
  { id: "south", name: "the southern states", states: ["MY-01", "MY-04"] },
  { id: "east", name: "the east coast", states: ["MY-03", "MY-11", "MY-06"] },
  { id: "borneo", name: "Sabah, Sarawak and Labuan", states: ["MY-12", "MY-13", "MY-15"] },
];
export const regionOf = (id: StateId) => REGIONS.find((r) => r.states.includes(id)) ?? null;
export type Reach = "stay" | "region" | "pick" | "anywhere";
export const isReach = (x: unknown): x is Reach => x === "stay" || x === "region" || x === "pick" || x === "anywhere";

// The states someone can work in, or null for anywhere (or when we do not know where they live).
// "pick": home plus the states they chose.
export function areaFor(home: StateId | null | undefined, move: Reach | null | undefined, moveTo?: StateId[] | null): StateId[] | null {
  if (!home || !stateById[home] || !move || move === "anywhere") return null;
  if (move === "stay") return [home];
  if (move === "pick") return [...new Set([home, ...(moveTo ?? []).filter((s) => stateById[s])])];
  return regionOf(home)?.states ?? [home];
}
export function areaName(home: StateId, move: Reach, moveTo?: StateId[] | null): string {
  if (move === "region") return regionOf(home)?.name ?? stateById[home].name;
  if (move === "pick") {
    const names = [...new Set([home, ...(moveTo ?? [])])].filter((s) => stateById[s]).map((s) => stateById[s].name);
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  }
  return stateById[home].name;
}

// How common a job is in an area, against Malaysia as a whole (1 = as common as average, 0.5 = half as common).
export function areaConcentration(sector: SectorId, group: GroupKey, area: StateId[]): number {
  const rows = stateJobs(sector, group);
  const inArea = rows.filter((r) => area.includes(r.id));
  const sum = (xs: StateJobs[], f: (x: StateJobs) => number) => xs.reduce((a, x) => a + f(x), 0);
  const local = sum(inArea, (r) => r.workers) / Math.max(1e-9, sum(inArea, (r) => r.employed));
  const all = sum(rows, (r) => r.workers) / Math.max(1e-9, sum(rows, (r) => r.employed));
  return all > 0 ? local / all : 1;
}
