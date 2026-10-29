import { describe, expect, it } from "vitest";
import { SPENDING, STATES, compareMove, setStates, spendingOf, stateJobs, geo, type StatesFile } from "@/lib/engine/geo";
import { leftText, rmAbout } from "@/lib/map-figures";

// D2: typical living costs on the job map come from DOSM's Household Expenditure Survey 2024, Table 1.4
// (median monthly spending per person by state), pinned in data/states.json.
describe("living costs on the job map", () => {
  it("has a dated figure for all 16 states", () => {
    expect(SPENDING).not.toBeNull();
    expect(SPENDING!.year).toBe(2024);
    expect(SPENDING!.released).toBe("2025-10-08");
    expect(STATES).toHaveLength(16);
    for (const s of STATES) expect(spendingOf(s.id)).toBeGreaterThan(0);
  });

  it("matches DOSM's published medians", () => {
    // HES 2024 Table 1.4, median monthly per capita household consumption expenditure, rounded to RM 1
    expect(spendingOf("MY-10")).toBe(1820); // Selangor
    expect(spendingOf("MY-14")).toBe(2378); // W.P. Kuala Lumpur
    expect(spendingOf("MY-02")).toBe(1037); // Kedah
    expect(spendingOf("MY-12")).toBe(838);  // Sabah
  });

  it("left over is median pay minus spending, and a move compares the two", () => {
    for (const r of stateJobs("finance")) expect(r.leftAfter).toBe(r.medianWage - r.spending!);
    const m = compareMove("finance", "MY-02", "MY-10");
    expect(m.leftGap).toBe(m.to.leftAfter! - m.from!.leftAfter!);
    expect(m.leftGap).toBe(m.wageGap! - (1820 - 1037));
  });

  it("stays when the server swaps in a snapshot without it", () => {
    const prev = geo;
    const { spending: _drop, ...older } = prev as StatesFile; // snapshots saved before D2 carry no spending
    void _drop;
    setStates(older as StatesFile);
    try { expect(stateJobs("finance").every((r) => r.spending !== null)).toBe(true); } finally { setStates(prev); }
  });

  it("rounds estimates to RM 10 and says when pay falls short", () => {
    expect(rmAbout(1727)).toBe("RM 1,730");
    expect(leftText(1727)).toBe("≈ RM 1,730 a month");
    expect(leftText(-124)).toBe("≈ RM 120 short a month");
  });
});
