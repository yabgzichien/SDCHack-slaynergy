// Builds data/series.json (snapshot 0, the data the app starts from) from the raw source files in data/raw/
// (see scripts/fetch-sources.sh). The server refreshes DOSM and Epoch AI by itself after that (src/lib/server/refresh.ts);
// re-run this only to rebuild the starting snapshot, or after reviewing a new ILO or AEI release.
import fs from "node:fs";
import path from "node:path";
import { buildAei, buildDosm, buildEpoch, buildIlo, EPOCH } from "../src/lib/datasrc/parse";
import { deriveCalendar, quarterOfDay } from "../src/lib/engine/calendar";
import { prevQuarter, type MarketCalendar, type Series } from "../src/lib/engine/data";

const RAW = path.resolve("data/raw");
const OUT = path.resolve("data/series.json");
const read = (...p: string[]) => fs.readFileSync(path.join(RAW, ...p));
const text = (...p: string[]) => read(...p).toString("utf8");

// The workbook in data/raw/dosm is the 2026 Q2 release; its last quarterly column is that quarter.
const DOSM_FILE = "jmi_q2_2026.xlsx", DOSM_LATEST = "2026Q2", DOSM_PUBLISHED = "2026-08-18";
const RETRIEVED = "2026-10-20";

const dosm = buildDosm(new Uint8Array(read("dosm", DOSM_FILE)), DOSM_LATEST);
// Only complete quarters: the last one that had ended when the Epoch data was retrieved.
const epochFiles = Object.fromEntries(EPOCH.map((e) => [e.file, text("epoch", e.file)]));
const epoch = buildEpoch(epochFiles, prevQuarter(quarterOfDay(RETRIEVED)));
const aei = buildAei(text("aei_2025_02_10", "onet_task_mappings.csv"), text("aei_2025_02_10", "onet_task_statements.csv"));
const ilo = buildIlo(new Uint8Array(read("ilo", "ilo.xlsx")));

const data: Omit<Series, "market"> = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: [
    { id: "ilo", name: "ILO Working Paper 140: Generative AI and Jobs, 2025 update (ISCO-08 exposure scores)", url: "https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure", retrieved: RETRIEVED, latest: "2025 scores", licence: "CC BY 4.0 (ILO; Gmyrek et al. 2025)" },
    { id: "dosm", name: "DOSM Big Data Analytics: Job Market Insights (Job Vacancies Advertised Online)", url: "https://www.dosm.gov.my/portal-main/release-content/big-data-analytics-job-market-insights-q22026", retrieved: RETRIEVED, latest: `${DOSM_LATEST} (published ${DOSM_PUBLISHED})`, next: "2026-11-17", licence: "DOSM open statistics; redistribution terms to be confirmed" },
    { id: "epoch", name: "Epoch AI Capabilities & benchmarking data", url: "https://epoch.ai/benchmarks", retrieved: RETRIEVED, latest: "models to 2026-10-15", licence: "CC-BY 4.0 (Epoch AI)" },
    { id: "aei", name: "Anthropic Economic Index, release 2025-02-10 (O*NET task usage)", url: "https://huggingface.co/datasets/Anthropic/EconomicIndex", retrieved: RETRIEVED, latest: "2025-02-10 (newer releases exist; not yet parsed)", licence: "CC-BY (data)" },
  ],
  dosm: { publishedAt: { [DOSM_LATEST]: DOSM_PUBLISHED }, quarters: dosm },
  epoch,
  aei,
  ilo,
};
// Keep the questions already frozen in the current file, so a rebuild never rewrites a question.
const prev: MarketCalendar | null = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, "utf8")) as Partial<Series>).market ?? null : null;
const market = deriveCalendar(data, prev, `${RETRIEVED}T00:00:00.000Z`);
fs.writeFileSync(OUT, JSON.stringify({ ...data, market }));

console.log("DOSM quarters:", dosm.length, dosm[0].q, "->", dosm[dosm.length - 1].q);
console.log("last 3 clerical shares:", dosm.slice(-3).map((d) => `${d.q} ${d.clerical_share}%`).join(", "));
for (const e of EPOCH) {
  const f = epoch[e.id].frontier;
  console.log(e.id, f.length, "quarters", f[0].q, "->", f[f.length - 1].q, "last5:", f.slice(-5).map((x) => `${x.q}:${x.v}`).join(" "));
}
console.log("ILO occupations:", Object.keys(ilo).length, JSON.stringify(ilo["4132"]), JSON.stringify(ilo["4311"]), JSON.stringify(ilo["2411"]));
console.log("AEI occupations:", Object.keys(aei).length, "43-3031.00:", JSON.stringify(aei["43-3031.00"]));
console.log("Market:", JSON.stringify({ dosm: market.dosm, epoch: market.epoch }), "frozen questions:", Object.keys(market.frozen).length);
