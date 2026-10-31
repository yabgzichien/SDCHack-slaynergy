// The three futures. Each is a stated set of assumptions; every number is shown in the app.
export type FutureId = "slow" | "medium" | "fast";
export type FutureDef = {
  id: FutureId; name: string; capMult: number; adoptMult: number; clericalDriftPp: number; blurb: string;
};

export const FUTURES: FutureDef[] = [
  { id: "slow", name: "Slow AI progress", capMult: 0.6, adoptMult: 0.6, clericalDriftPp: -0.05,
    blurb: "Benchmarks improve at 60% of the recent pace; firms adopt AI slowly; clerical vacancies drift down 0.05 points a quarter." },
  { id: "medium", name: "Medium AI progress", capMult: 1.0, adoptMult: 1.0, clericalDriftPp: -0.15,
    blurb: "Benchmarks keep their recent pace; adoption follows; clerical vacancies drift down 0.15 points a quarter." },
  { id: "fast", name: "Fast AI progress", capMult: 1.6, adoptMult: 1.6, clericalDriftPp: -0.35,
    blurb: "Benchmarks improve at 160% of the recent pace; adoption speeds up; clerical vacancies drift down 0.35 points a quarter." },
];
export const FUTURE_IDS: FutureId[] = ["slow", "medium", "fast"];

// Settled outcomes count at half strength, with older quarters fading (damped, as agreed).
export const UPDATE_STRENGTH = 0.5;
export const FADE_PER_QUARTER = 0.85;
// The crowd's view of open questions counts for less than a real outcome.
export const CROWD_TILT = 0.5;
export const FUTURE_FLOOR = 0.05;

// The chance a future gives to Yes is kept between these, so no future is ever certain (questions.ts futureProbs).
export const P_MIN = 0.04;
export const P_MAX = 0.96;
// The smallest spread (in points of job ads) the office admin question allows when it turns a drift into a chance.
export const DOSM_SIGMA_MIN = 0.25;
