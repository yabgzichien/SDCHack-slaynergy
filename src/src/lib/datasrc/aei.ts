// Anthropic Economic Index (CC-BY), pinned: a person reviews each new release before it is used (see server/sources.ts).
// From release 2026-01-15 the index is published as monthly usage rows keyed by O*NET task ID (O*NET 30.0), while the app's
// skills and roles use O*NET-SOC 2010 codes. So coverage is rebuilt here:
//   1. read the global, task-level (hierarchy 0) `pct` rows of aei_claude_ai_<date>.csv: the tasks seen in Claude.ai usage;
//   2. map each app code (O*NET-SOC 2010) to its O*NET-SOC 2019 code(s) with O*NET's official crosswalk;
//   3. coverage = share of those occupations' O*NET 30.0 task statements that appear in usage (pooled when a 2010 code
//      maps to several 2019 codes). The result keeps the 2010 code as its key, so data/skills.json stays as it is.
import { parseCsv } from "./parse";

export type AeiOccupation = { title: string; tasks: number; coverage: number; usage: number; soc2019: string[] };

// O*NET database text files are tab-separated with a header row and no quoting.
export function parseTsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length);
  const head = lines[0].split("\t");
  return lines.slice(1).map((l) => { const c = l.split("\t"); return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ""])); });
}

// usageCsv: the release's aei_claude_ai_<date>.csv. tasksTsv: O*NET 30.0 "Task Statements.txt".
// occupationsTsv: O*NET 30.0 "Occupation Data.txt" (titles). crosswalkCsv: O*NET "2010_to_2019_Crosswalk.csv".
export function buildAeiTasks(usageCsv: string, tasksTsv: string, occupationsTsv: string, crosswalkCsv: string) {
  // Mean share of usage per task across the months in the release. A task counts as used if it was published in any month:
  // the index publishes a cell only above its privacy threshold and rounds to two decimals, so 0.0 still means used.
  const byTask = new Map<string, number[]>();
  for (const r of parseCsv(usageCsv)) {
    if (r.geo_id !== "GLOBAL" || r.category_name !== "onet" || r.hierarchy_level !== "0" || r.metric_id !== "pct") continue;
    const v = Number(r.value);
    if (!Number.isFinite(v)) continue;
    const list = byTask.get(r.node_external_id) ?? [];
    list.push(v);
    byTask.set(r.node_external_id, list);
  }
  if (byTask.size < 1000) throw new Error(`AEI usage file: only ${byTask.size} task rows found; the format may have changed`);

  const tasksBy2019 = new Map<string, string[]>();
  for (const r of parseTsv(tasksTsv)) {
    const list = tasksBy2019.get(r["O*NET-SOC Code"]) ?? [];
    list.push(r["Task ID"]);
    tasksBy2019.set(r["O*NET-SOC Code"], list);
  }
  const unmatched = [...byTask.keys()].filter((id) => ![...tasksBy2019.values()].some((l) => l.includes(id)));
  if (unmatched.length > byTask.size * 0.02) throw new Error(`AEI: ${unmatched.length} used tasks are not in the O*NET task file; wrong O*NET version?`);
  const title2019 = new Map(parseTsv(occupationsTsv).map((r) => [r["O*NET-SOC Code"], r.Title]));

  const to2019 = new Map<string, string[]>();
  for (const r of parseCsv(crosswalkCsv)) {
    const from = r["O*NET-SOC 2010 Code"], to = r["O*NET-SOC 2019 Code"];
    if (!from || !to) continue;
    const list = to2019.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    to2019.set(from, list);
  }

  const out: Record<string, AeiOccupation> = {};
  for (const [code2010, codes] of to2019) {
    const tasks = [...new Set(codes.flatMap((c) => tasksBy2019.get(c) ?? []))];
    if (!tasks.length) continue; // no O*NET task statements for these occupations: left out, so the app uses its default
    let hit = 0, sum = 0;
    for (const t of tasks) {
      const vs = byTask.get(t);
      if (vs) { hit++; sum += vs.reduce((a, b) => a + b, 0) / vs.length; }
    }
    out[code2010] = { title: codes.map((c) => title2019.get(c) ?? c).join("; "), tasks: tasks.length, coverage: +(hit / tasks.length).toFixed(3), usage: +sum.toFixed(4), soc2019: codes };
  }
  return { occupations: out, tasksUsed: byTask.size, unmatched: unmatched.length };
}

// The pinned release and how the build scripts find its raw files (data/raw/aei_<release>/, made by scripts/fetch-sources.sh).
export const AEI_PIN = {
  release: "2026-06-26",
  dir: "aei_2026_06_26",
  usage: "aei_claude_ai_2026-06-26.csv",
  tasks: "onet_30_0_task_statements.txt",
  occupations: "onet_30_0_occupation_data.txt",
  crosswalk: "onet_2010_to_2019_crosswalk.csv",
  reviewed: "2026-10-29",
};
export const AEI_SOURCE = {
  id: "aei",
  name: "Anthropic Economic Index, release 2026-06-26 (Claude.ai usage by O*NET task, Apr–May 2026)",
  url: "https://huggingface.co/datasets/Anthropic/EconomicIndex/tree/main/release_2026_06_26",
  retrieved: AEI_PIN.reviewed,
  latest: "2026-06-26 (reviewed 29 Oct 2026; O*NET 30.0 tasks, matched to the app's O*NET-SOC 2010 codes with O*NET's 2010-to-2019 crosswalk)",
  licence: "CC-BY (data); O*NET 30.0 CC BY 4.0",
};
// The usage file is about 220 MB; only its global task-level share rows are needed, so keep those lines before parsing.
export const AEI_ROW = ",GLOBAL,global,onet,0,pct,";
export const keepAeiRows = (csv: string) => { const lines = csv.split("\n"); return [lines[0], ...lines.filter((l) => l.includes(AEI_ROW))].join("\n"); };
