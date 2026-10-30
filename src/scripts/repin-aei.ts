// Re-pins the Anthropic Economic Index in data/series.json (the starting snapshot) after a person has reviewed a new
// release: rebuilds only `aei` and its entry in `sources`, leaving every other figure and the frozen questions as they are.
// The server then carries the change into the live snapshots by itself (applyPins in src/lib/server/refresh.ts).
// Needs data/raw/aei_<release>/ from scripts/fetch-sources.sh.  Run: npm run data:repin-aei
import fs from "node:fs";
import path from "node:path";
import { AEI_PIN, AEI_SOURCE, buildAeiTasks, keepAeiRows } from "../src/lib/datasrc/aei";

const RAW = path.resolve("data/raw", AEI_PIN.dir), OUT = path.resolve("data/series.json");
const read = (f: string) => fs.readFileSync(path.join(RAW, f), "utf8");
const r = buildAeiTasks(keepAeiRows(read(AEI_PIN.usage)), read(AEI_PIN.tasks), read(AEI_PIN.occupations), read(AEI_PIN.crosswalk));
const series = JSON.parse(fs.readFileSync(OUT, "utf8"));
const before = series.aei as Record<string, { coverage: number }>;
series.aei = r.occupations;
series.sources = series.sources.map((s: { id: string }) => (s.id === "aei" ? AEI_SOURCE : s));
fs.writeFileSync(OUT, JSON.stringify(series));
const moved = Object.keys(before).filter((c) => r.occupations[c] && Math.abs(r.occupations[c].coverage - before[c].coverage) >= 0.1).length;
console.log(`AEI ${AEI_PIN.release}: ${r.tasksUsed} tasks used, ${r.unmatched} not in O*NET 30.0, ${Object.keys(r.occupations).length} occupations; ${moved} moved by 0.1 or more.`);
