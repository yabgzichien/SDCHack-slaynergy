import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import seriesJson from "../data/series.json";
import statesJson from "../data/states.json";
import { withSeries, type DosmQuarter, type Series } from "../src/lib/engine/data";
import type { StatesFile } from "../src/lib/engine/geo";
import { calendarMoved, deriveCalendar, newlySettled } from "../src/lib/engine/calendar";
import { epochSettleDay, ladder, makeQuestions } from "../src/lib/engine/questions";
import { computeWorld } from "../src/lib/engine/world";
import { initialState } from "../src/lib/engine/state";
import { checkDosm, checkEpoch, checkStates } from "../src/lib/datasrc/validate";
import { buildDosm, buildStateLabour, isXlsx } from "../src/lib/datasrc/parse";
import { refreshInterval } from "../src/lib/server/refresh";

const S0 = seriesJson as unknown as Series;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const at = (day: string) => `${day}T02:00:00.000Z`;
const LIVE = ["metr", "swe", "hle", "tbench"];

// The data with one more DOSM quarter, as the 17 Nov 2026 release would bring.
function withDosm(s: Series, q: string, share: number): Omit<Series, "market"> {
  const n = clone(s);
  const last = n.dosm.quarters.at(-1)!;
  const total = last.total;
  n.dosm.quarters.push({ ...last, q, clerical: Math.round((share / 100) * total), clerical_share: share } as DosmQuarter);
  n.dosm.publishedAt[q] = "2026-11-17";
  return n;
}
// The data with an Epoch AI result for quarter q on every live benchmark (gain added to the last value).
function withEpoch(s: Omit<Series, "market">, q: string, gain: number): Omit<Series, "market"> {
  const n = clone(s);
  for (const id of LIVE) {
    const f = n.epoch[id].frontier;
    if (!f.some((x) => x.q === q)) f.push({ q, v: +(f.at(-1)!.v + gain).toFixed(4) });
  }
  return n;
}
const settle = (base: Omit<Series, "market">, prev: Series["market"], day: string): Series => ({ ...base, market: deriveCalendar(base, prev, at(day)) });

describe("the market calendar comes from the data", () => {
  it("snapshot 0 is on the same quarters the app used to hard-code", () => {
    expect(S0.market.dosm).toEqual({ live: "2026Q2", next: "2026Q3" });
    expect(S0.market.epoch).toEqual({ live: "2026Q2", open: ["2026Q4"] });
    expect(deriveCalendar(S0, null, at("2026-10-24"))).toMatchObject({ dosm: S0.market.dosm, epoch: S0.market.epoch });
  });

  it("a new DOSM quarter settles the open DOSM question and opens the next one", () => {
    const s1 = settle(withDosm(S0, "2026Q3", 7.0), S0.market, "2026-11-17");
    expect(s1.market.dosm).toEqual({ live: "2026Q3", next: "2026Q4" });
    expect(newlySettled(S0.market, s1.market)).toEqual(["dosm-2026Q3"]);
    expect(s1.market.frozen["dosm-2026Q3"].pair).toEqual([7.274, 7.0]);
    expect(calendarMoved(S0.market, s1.market)).toBe(true);
    const w = withSeries(s1, () => computeWorld({ ...initialState(), clock: { t0: at("2026-11-17") } }));
    expect(w.settledEvents.map((e) => e.id)).toContain("dosm-2026Q3");
    expect(w.events.map((e) => e.id)).toContain("dosm-2026Q4");
    expect(w.settledEvents.find((e) => e.id === "dosm-2026Q3")!.strikes[1].settled!.outcome).toBe(true); // 7.274 -> 7.0 fell
  });

  it("a prediction made on the open question is paid out when the real release settles it", () => {
    const st = { ...initialState(), clock: { t0: at("2026-10-24") }, orders: [{ id: "o1", market: "dosm-2026Q3~1", t: 60, side: "yes" as const, action: "buy" as const, amount: 20 }] };
    const before = computeWorld(st);
    const yes = before.events.find((e) => e.id === "dosm-2026Q3")!.strikes[1].position.yes;
    expect(yes).toBeGreaterThan(0);
    const s1 = settle(withDosm(S0, "2026Q3", 7.0), S0.market, "2026-11-17");
    const after = withSeries(s1, () => computeWorld(st));
    const settled = after.settledEvents.find((e) => e.id === "dosm-2026Q3")!.strikes[1].settled!;
    expect(settled.payout).toBeCloseTo(yes, 6);
    expect(after.you.scored).toBeGreaterThan(0);
  });

  it("a settlement is final: a later DOSM revision is not re-settled", () => {
    const s1 = settle(withDosm(S0, "2026Q3", 7.0), S0.market, "2026-11-17");
    const revised = clone(s1) as Omit<Series, "market"> & { market?: unknown };
    delete revised.market;
    revised.dosm.quarters.at(-1)!.clerical_share = 7.4; // now it would have risen
    const s2 = settle(revised, s1.market, "2026-11-20");
    expect(s2.market.frozen["dosm-2026Q3"].pair).toEqual([7.274, 7.0]);
    const q = withSeries(s2, () => makeQuestions().find((x) => x.id === "dosm-2026Q3")!);
    expect(q.outcome).toBe(true);
    expect(withSeries(s2, () => ladder(q).map((x) => x.outcome))).toEqual(withSeries(s1, () => ladder(q).map((x) => x.outcome)));
  });

  it("an open question keeps the lines it was first asked with when late Epoch results arrive", () => {
    const q0 = makeQuestions().find((x) => x.id === "swe-2026Q4")!;
    const lines0 = ladder(q0).map((x) => x.threshold);
    const s1 = settle(withEpoch(S0, "2026Q3", 5), S0.market, "2026-10-25");
    const q1 = withSeries(s1, () => makeQuestions().find((x) => x.id === "swe-2026Q4")!);
    expect(q1.threshold).toBe(q0.threshold);
    expect(q1.text).toBe(q0.text);
    expect(withSeries(s1, () => ladder(q1).map((x) => x.threshold))).toEqual(lines0);
  });
});

describe("Epoch AI questions settle 30 days after their quarter ends", () => {
  it("waits the 30 days, and waits for every benchmark to have a result", () => {
    expect(epochSettleDay("2026Q3")).toBe("2026-10-30");
    const withQ3 = withEpoch(S0, "2026Q3", 2);
    expect(deriveCalendar(withQ3, S0.market, at("2026-10-29")).epoch.live).toBe("2026Q2");
    expect(deriveCalendar(withQ3, S0.market, at("2026-10-30")).epoch.live).toBe("2026Q3");
    // Without a Q3 result on every live benchmark, 30 days are not enough: those results are late, not zero.
    expect(deriveCalendar(S0, S0.market, at("2026-12-01")).epoch.live).toBe("2026Q2");
  });

  it("a quarter that ended unsettled stays open (closed to new predictions) next to the new quarter", () => {
    const withQ3 = withEpoch(S0, "2026Q3", 2);
    const nov = deriveCalendar(withQ3, S0.market, at("2026-11-01"));
    expect(nov.epoch).toEqual({ live: "2026Q3", open: ["2026Q4"] });
    const jan = deriveCalendar(withQ3, nov, at("2027-01-05"));
    expect(jan.epoch).toEqual({ live: "2026Q3", open: ["2026Q4", "2027Q1"] });
    const s = { ...withQ3, market: jan } as Series;
    const w = withSeries(s, () => computeWorld({ ...initialState(), clock: { t0: at("2027-01-05") } }));
    expect(w.events.find((e) => e.id === "swe-2026Q4")!.closesAt).toBe("2026-12-31");
    const end = deriveCalendar(withEpoch(withQ3, "2026Q4", 3), jan, at("2027-01-30"));
    expect(end.epoch).toEqual({ live: "2026Q4", open: ["2027Q1"] });
    expect(newlySettled(jan, end)).toEqual(expect.arrayContaining(LIVE.map((id) => `${id}-2026Q4`)));
  });

  it("a quarter that was never opened (it had ended before) is settled without ever being open", () => {
    const nov = deriveCalendar(withEpoch(S0, "2026Q3", 2), S0.market, at("2026-11-01"));
    expect(newlySettled(S0.market, nov)).not.toContain("swe-2026Q3");
    expect(nov.frozen["swe-2026Q3"].pair).toBeDefined();
  });
});

describe("the validation gate", () => {
  const q = S0.dosm.quarters;
  it("accepts the same data and a believable new quarter", () => {
    expect(checkDosm(q, q)).toBeNull();
    expect(checkDosm(q, withDosm(S0, "2026Q3", 7.0).dosm.quarters)).toBeNull();
    expect(checkEpoch(S0.epoch, S0.epoch)).toBeNull();
    expect(checkEpoch(S0.epoch, withEpoch(S0, "2026Q3", 2).epoch)).toBeNull();
    expect(checkStates(statesJson as unknown as StatesFile, statesJson as unknown as StatesFile)).toBeNull();
  });
  it("rejects a quarter that disappeared", () => expect(checkDosm(q, q.slice(1))).toMatch(/disappeared/));
  it("rejects a big revision to the past", () => {
    const r = clone(q); r[r.length - 2].clerical_share += 1;
    expect(checkDosm(q, r)).toMatch(/revised/);
  });
  it("rejects an unbelievable new quarter", () => expect(checkDosm(q, withDosm(S0, "2026Q3", 14).dosm.quarters)).toMatch(/moved/));
  it("rejects a misread number", () => {
    const r = clone(q); (r[3] as unknown as Record<string, unknown>).total = "n/a";
    expect(checkDosm(q, r)).toMatch(/not a number/);
  });
  it("rejects an Epoch best score that falls or a series that vanished", () => {
    const e = clone(S0.epoch); e.swe.frontier.at(-1)!.v -= 3;
    expect(checkEpoch(S0.epoch, e)).toMatch(/went down|fell/);
    const gone = clone(S0.epoch); delete (gone as Record<string, unknown>).hle;
    expect(checkEpoch(S0.epoch, gone)).toMatch(/missing/);
  });
  it("rejects state figures that jumped", () => {
    const st = clone(statesJson) as unknown as StatesFile; st.states[0].wages.median *= 2;
    expect(checkStates(statesJson as unknown as StatesFile, st)).toMatch(/median wage/);
  });
});

describe("when the server checks", () => {
  it("daily, and hourly on DOSM's release day and the two days after", () => {
    const H = 3600_000;
    expect(refreshInterval(Date.parse("2026-11-10T04:00:00Z"), "2026-11-17")).toBe(24 * H);
    expect(refreshInterval(Date.parse("2026-11-17T04:00:00Z"), "2026-11-17")).toBe(H);
    expect(refreshInterval(Date.parse("2026-11-19T04:00:00Z"), "2026-11-17")).toBe(H);
    expect(refreshInterval(Date.parse("2026-11-20T04:00:00Z"), "2026-11-17")).toBe(24 * H);
    expect(refreshInterval(Date.parse("2026-11-20T04:00:00Z"), undefined)).toBe(24 * H);
  });

  it("only one refresh holds the lock at a time, and an expired lock can be taken", async () => {
    process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "runway-lock-")), "t.db");
    const { setKvIf, setKv } = await import("../src/lib/server/store");
    const now = "2026-10-24T00:00:00.000Z", until = "2026-10-24T00:10:00.000Z";
    const [a, b] = await Promise.all([setKvIf("lock", until, now), setKvIf("lock", until, now)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await setKvIf("lock", until, now)).toBe(false);
    expect(await setKvIf("lock", "2026-10-24T00:21:00.000Z", "2026-10-24T00:11:00.000Z")).toBe(true); // the first lock ran out
    await setKv("lock", new Date(0).toISOString());
    expect(await setKvIf("lock", until, now)).toBe(true);
  });
});

// The parsers against the saved raw files (never the live network). data/raw/ is git-ignored, so these run only where
// scripts/fetch-sources.sh has been run.
const RAW = path.resolve("data/raw");
describe.skipIf(!fs.existsSync(path.join(RAW, "dosm/jmi_q2_2026.xlsx")))("parsers on the saved source files", () => {
  it("the DOSM workbook gives the snapshot's quarters", () => {
    const b = new Uint8Array(fs.readFileSync(path.join(RAW, "dosm/jmi_q2_2026.xlsx")));
    expect(isXlsx(b)).toBe(true);
    expect(buildDosm(b, "2026Q2")).toEqual(S0.dosm.quarters);
    expect(isXlsx(new Uint8Array(fs.readFileSync(path.join(RAW, "dosm/lfs_annual_2024.pdf"))))).toBe(false);
  });
  it("the OpenDOSM files give the job map's labour figures", () => {
    const r = buildStateLabour(fs.readFileSync(path.join(RAW, "opendosm/lfs_qtr_state.csv"), "utf8"), fs.readFileSync(path.join(RAW, "opendosm/wages_state.csv"), "utf8"));
    for (const s of (statesJson as unknown as StatesFile).states) expect(r.byState[s.id]).toEqual({ lfs: s.lfs, wages: s.wages });
  });
});
