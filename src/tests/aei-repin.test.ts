import { describe, expect, it } from "vitest";
import { buildAeiTasks, keepAeiRows } from "@/lib/datasrc/aei";
import { withBundledPins } from "@/lib/server/refresh";
import { series, skills, type Series } from "@/lib/engine/data";

const HEAD = "date_start,date_end,geo_id,geo_level,category_name,hierarchy_level,metric_id,value,node_name,node_external_id";
const row = (geo: string, level: string, metric: string, v: string, id: string, start = "2026-05-01") =>
  `${start},2026-06-01,${geo},${geo === "GLOBAL" ? "global" : "country"},onet,${level},${metric},${v},"Task ${id}",${id}`;
// 1000 filler tasks so the size check passes, plus the tasks of two small occupations.
const filler = Array.from({ length: 1000 }, (_, i) => row("GLOBAL", "0", "pct", "0.01", `9${i}`));
const usage = [HEAD, ...filler,
  row("GLOBAL", "0", "pct", "0.5", "1"), row("GLOBAL", "0", "pct", "0.3", "1", "2026-04-01"), // used both months
  row("GLOBAL", "0", "pct", "0.0", "2"), // rounded to 0.0, but published, so used
  row("MYS", "0", "pct", "4.0", "3"), // a country row: ignored
  row("GLOBAL", "1", "pct", "4.0", "4"), // not a task row: ignored
  row("GLOBAL", "0", "ai_autonomy_mean", "3.1", "5"), // another metric: ignored
].join("\n");
const tasks = ["O*NET-SOC Code\tTask ID\tTask", "13-2011.00\t1\ta", "13-2011.00\t2\tb", "13-2011.00\t3\tc", "13-2011.00\t4\td",
  "43-9021.00\t5\te", "43-9021.00\t6\tf", ...filler.map((_, i) => `99-9999.00\t9${i}\tx`)].join("\n");
const occupations = "O*NET-SOC Code\tTitle\tDescription\n13-2011.00\tAccountants and Auditors\t-\n43-9021.00\tData Entry Keyers\t-";
const crosswalk = ["O*NET-SOC 2010 Code,O*NET-SOC 2010 Title,O*NET-SOC 2019 Code,O*NET-SOC 2019 Title",
  "13-2011.01,Accountants,13-2011.00,Accountants and Auditors", "13-2011.02,Auditors,13-2011.00,Accountants and Auditors",
  "43-9021.00,Data Entry Keyers,43-9021.00,Data Entry Keyers", "11-0000.00,No tasks,11-0000.00,No tasks"].join("\n");

describe("Anthropic Economic Index re-pin (release 2026-06-26 format)", () => {
  const r = buildAeiTasks(usage, tasks, occupations, crosswalk);

  it("counts a job's tasks seen in global task-level usage, under the app's own 2010 codes", () => {
    // 13-2011.00 has tasks 1-4; 1 and 2 are used (2 is a published 0.0); 3 is only a country row, 4 only a higher level.
    expect(r.occupations["13-2011.01"]).toMatchObject({ coverage: 0.5, tasks: 4, title: "Accountants and Auditors", soc2019: ["13-2011.00"] });
    expect(r.occupations["13-2011.02"].coverage).toBe(0.5);
    expect(r.occupations["13-2011.01"].usage).toBeCloseTo(0.4); // task 1: mean of 0.5 and 0.3; task 2: 0
    expect(r.occupations["43-9021.00"].coverage).toBe(0); // task 5 only appears under another metric
  });

  it("leaves out codes with no O*NET task statements, so the app falls back to its default", () => {
    expect(r.occupations["11-0000.00"]).toBeUndefined();
    expect(r.unmatched).toBe(0);
  });

  it("refuses a file that does not look like the expected format", () => {
    expect(() => buildAeiTasks([HEAD, row("GLOBAL", "0", "pct", "1", "1")].join("\n"), tasks, occupations, crosswalk)).toThrow(/format/);
  });

  it("keeps only the global task-level share rows of the large usage file", () => {
    const kept = keepAeiRows(usage).split("\n");
    expect(kept[0]).toBe(HEAD);
    expect(kept).toHaveLength(1 + 1000 + 3);
  });

  it("every skill's job codes are in the pinned data", () => {
    for (const s of skills) for (const c of s.onet) expect(series.aei[c], `${s.id} ${c}`).toBeDefined();
  });
});

describe("carrying a reviewed re-pin into the live snapshots", () => {
  const live = { ...series, aei: { "x": { title: "old", tasks: 1, coverage: 0.9, usage: 0 } }, sources: series.sources.map((s) => s.id === "aei" ? { ...s, latest: "2025-02-10" } : s) } as Series;

  it("swaps only the pinned source that changed, and says what changed", () => {
    const { next, changed } = withBundledPins(live, series);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatch(/Anthropic Economic Index.*2025-02-10 → 2026-06-26/);
    expect(next.aei).toBe(series.aei);
    expect(next.dosm).toBe(live.dosm); // fetched data and the market calendar stay as the live snapshot has them
    expect(next.market).toBe(live.market);
    expect(next.sources.find((s) => s.id === "dosm")).toBe(live.sources.find((s) => s.id === "dosm"));
  });

  it("does nothing when the live snapshot already has the bundled pins", () => {
    expect(withBundledPins(series, series).changed).toEqual([]);
  });
});
