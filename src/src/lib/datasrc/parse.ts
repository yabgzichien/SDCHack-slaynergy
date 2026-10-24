// Parsers for the public source files. Pure functions over bytes or text, shared by the build scripts
// (scripts/build-series.ts, scripts/build-geo.ts) and the server's automatic refresh (src/lib/server/refresh.ts),
// so a snapshot built by hand and one fetched by the server can never be parsed differently.
import { unzipSync, strFromU8 } from "fflate";
import type { DosmQuarter, EpochSeries } from "../engine/data";

// ---------- xlsx (first sheet only), read by header rather than position ----------
function colToNum(c: string) {
  let n = 0;
  for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export const isXlsx = (bytes: Uint8Array) => {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false; // "PK": a zip file
  try { const z = unzipSync(bytes, { filter: (f) => f.name === "xl/worksheets/sheet1.xml" }); return !!z["xl/worksheets/sheet1.xml"]; } catch { return false; }
};

export function readSheet(bytes: Uint8Array): Record<number, Record<string, string>> {
  const z = unzipSync(bytes);
  const sst = z["xl/sharedStrings.xml"] ? strFromU8(z["xl/sharedStrings.xml"]) : "";
  const strings = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
  const sheet = strFromU8(z["xl/worksheets/sheet1.xml"]);
  const rows: Record<number, Record<string, string>> = {};
  for (const r of sheet.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string> = {};
    for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = (c[3] || "").match(/<v>([\s\S]*?)<\/v>/);
      if (!v) continue;
      cells[c[1]] = c[2].includes('t="s"') ? strings[Number(v[1])] : v[1];
    }
    rows[Number(r[1])] = cells;
  }
  return rows;
}

// ---------- DOSM Job Market Insights: online job ads by occupation group, one row per quarter ----------
const DOSM_GROUPS = {
  managers: "Managers",
  professionals: "Professionals",
  technicians: "Technicians and associate professionals",
  clerical: "Clerical support workers",
  service: "Service and sales workers",
  craft: "Craft and related trades workers",
  operators: "Plant and machine operators and assemblers",
  elementary: "Elementary Occupations",
} as const;

// latestQuarter labels the last quarterly column; the workbook only says Q1..Q4, so earlier columns count back from it.
export function buildDosm(bytes: Uint8Array, latestQuarter: string): DosmQuarter[] {
  const rows = readSheet(bytes);
  const headerRow = Object.entries(rows).find(([, c]) => c.B === "Occupation");
  if (!headerRow) throw new Error("DOSM workbook: 'Occupation' header row not found");
  const hn = Number(headerRow[0]);
  const header = headerRow[1];
  const find = (label: string) => {
    for (let r = hn + 1; r < hn + 14; r++) if (rows[r]?.B === label) return rows[r];
    throw new Error(`DOSM workbook: row '${label}' not found`);
  };
  const total = find("Jumlah");
  // the quarterly block ends where the monthly block (month names) starts, so these are exactly the quarter columns
  const qCols = Object.keys(header)
    .filter((c) => /^Q[1-4]$/.test(header[c]) && total[c] !== undefined)
    .sort((a, b) => colToNum(a) - colToNum(b));
  let y = Number(latestQuarter.slice(0, 4)), q = Number(latestQuarter.slice(5));
  const labels: string[] = [];
  for (let i = qCols.length - 1; i >= 0; i--) {
    if (header[qCols[i]] !== `Q${q}`) throw new Error(`DOSM workbook: quarter label mismatch at ${qCols[i]}: expected Q${q}, got ${header[qCols[i]]}`);
    labels.unshift(`${y}Q${q}`);
    q--;
    if (q === 0) { q = 4; y--; }
  }
  const rowsBy = Object.fromEntries(Object.entries(DOSM_GROUPS).map(([k, l]) => [k, find(l)]));
  const out: DosmQuarter[] = [];
  qCols.forEach((c, i) => {
    const t = Number(total[c]);
    if (!Number.isFinite(t) || t <= 0) return;
    const rec: Record<string, number | string> = { q: labels[i], total: t };
    for (const k of Object.keys(DOSM_GROUPS)) {
      const n = Number(rowsBy[k][c]);
      rec[k] = Number.isFinite(n) ? n : 0;
    }
    rec.clerical_share = +(((rec.clerical as number) / t) * 100).toFixed(3);
    out.push(rec as unknown as DosmQuarter);
  });
  return out;
}

// ---------- CSV (quoted fields may hold commas and newlines) ----------
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = (rows.shift() ?? []).map((h) => h.trim());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

export const quarterOfDate = (iso: string) => `${iso.slice(0, 4)}Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
const nextQ = (q: string) => { let y = +q.slice(0, 4), n = +q[5] + 1; if (n === 5) { n = 1; y++; } return `${y}Q${n}`; };

// ---------- Epoch AI benchmark frontier: the best score released by the end of each quarter ----------
export const EPOCH = [
  { id: "metr", name: "METR time horizon (50%)", file: "metr_time_horizons_external.csv", col: "Time horizon", tf: Math.log2, unit: "doublings (log2 minutes)", short: "task length AI can finish" },
  { id: "swe", name: "SWE-bench Verified", file: "swe_bench_verified.csv", col: "mean_score", tf: (x: number) => x * 100, unit: "% solved", short: "software-engineering tasks solved" },
  { id: "hle", name: "Humanity's Last Exam", file: "hle_external.csv", col: "Accuracy", tf: (x: number) => x * 100, unit: "% correct", short: "expert-level questions answered" },
  { id: "tbench", name: "Terminal-Bench", file: "terminalbench_external.csv", col: "Accuracy mean", tf: (x: number) => x * 100, unit: "% solved", short: "command-line agent tasks solved" },
  // Replay-only series: used for the history replay (forecaster track records), never as live questions.
  { id: "fmath", name: "FrontierMath", file: "frontiermath.csv", col: "mean_score", tf: (x: number) => x * 100, unit: "% solved", short: "research-level maths problems solved", replayOnly: true },
  { id: "aider", name: "Aider Polyglot", file: "aider_polyglot_external.csv", col: "Percent correct", tf: (x: number) => x, unit: "% correct", short: "multi-language coding edits correct", replayOnly: true },
  { id: "arc", name: "ARC-AGI", file: "arc_agi_external.csv", col: "Score", tf: (x: number) => (x <= 1 ? x * 100 : x), unit: "% solved", short: "novel reasoning puzzles solved", replayOnly: true },
  { id: "osworld", name: "OSWorld", file: "os_world_external.csv", col: "Score", tf: (x: number) => (x <= 1 ? x * 100 : x), unit: "% solved", short: "computer-use tasks solved", replayOnly: true },
  { id: "weirdml", name: "WeirdML", file: "weirdml_external.csv", col: "Accuracy", tf: (x: number) => (x <= 1 ? x * 100 : x), unit: "% accuracy", short: "unusual machine-learning tasks", replayOnly: true },
  { id: "simple", name: "SimpleBench", file: "simplebench_external.csv", col: "Score (AVG@5)", tf: (x: number) => (x <= 1 ? x * 100 : x), unit: "% score", short: "common-sense reasoning questions", replayOnly: true },
];

export function frontier(csv: string, scoreCol: string, transform: (x: number) => number = (x) => x) {
  const pts = parseCsv(csv)
    .map((r) => ({ date: (r["Release date"] || "").slice(0, 10), v: Number(r[scoreCol]) }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.v) && p.v > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const best = new Map<string, number>();
  let run = -Infinity;
  for (const p of pts) {
    run = Math.max(run, transform(p.v));
    best.set(quarterOfDate(p.date), run);
  }
  const qs = [...best.keys()].sort();
  const out: { q: string; v: number }[] = [];
  if (!qs.length) return out;
  let last = 0;
  for (let q = qs[0]; q <= qs[qs.length - 1]; q = nextQ(q)) {
    if (best.has(q)) last = best.get(q)!;
    out.push({ q, v: +last.toFixed(4) });
  }
  return out;
}

// files: Epoch CSVs by file name (as in benchmark_data.zip). cutoff: the last complete quarter at retrieval, so a
// quarter still running never enters the data.
export function buildEpoch(files: Record<string, string>, cutoff: string): Record<string, EpochSeries> {
  const out: Record<string, EpochSeries> = {};
  for (const e of EPOCH) {
    const csv = files[e.file];
    if (csv === undefined) throw new Error(`Epoch data: ${e.file} missing`);
    out[e.id] = { name: e.name, unit: e.unit, short: e.short, replayOnly: !!e.replayOnly, frontier: frontier(csv, e.col, e.tf).filter((p) => p.q <= cutoff) };
  }
  return out;
}

// benchmark_data.zip may keep its CSVs in a folder; key them by base name.
export function unzipCsvs(bytes: Uint8Array): Record<string, string> {
  const z = unzipSync(bytes, { filter: (f) => f.name.endsWith(".csv") });
  return Object.fromEntries(Object.entries(z).map(([k, v]) => [k.split("/").pop()!, strFromU8(v)]));
}

// ---------- Anthropic Economic Index (release 2025-02-10): occupation AI-usage index (pinned) ----------
export function buildAei(mappingCsv: string, statementsCsv: string) {
  const pct = new Map(parseCsv(mappingCsv).map((r) => [r.task_name.trim().toLowerCase(), Number(r.pct)]));
  const occ = new Map<string, { title: string; n: number; hit: number; sum: number }>();
  for (const r of parseCsv(statementsCsv)) {
    const o = occ.get(r["O*NET-SOC Code"]) || { title: r.Title, n: 0, hit: 0, sum: 0 };
    o.n++;
    const p = pct.get(r.Task.trim().toLowerCase());
    if (p) { o.hit++; o.sum += p; }
    occ.set(r["O*NET-SOC Code"], o);
  }
  const out: Record<string, { title: string; tasks: number; coverage: number; usage: number }> = {};
  for (const [code, o] of occ) out[code] = { title: o.title, tasks: o.n, coverage: +(o.hit / o.n).toFixed(3), usage: +o.sum.toFixed(4) };
  return out;
}

// ---------- ILO 2025 GenAI exposure scores (ISCO-08, CC-BY 4.0) (pinned) ----------
export function buildIlo(bytes: Uint8Array) {
  const rows = readSheet(bytes);
  const head = rows[1];
  const col = (name: string) => Object.keys(head).find((k) => head[k] === name);
  const cIsco = col("ISCO_08"), cTitle = col("Title"), cScore = col("mean_score_2025"), cPot = col("potential25");
  if (!cIsco || !cScore || !cTitle || !cPot) throw new Error("ILO workbook: expected columns not found");
  const out: Record<string, { title: string; score: number; gradient: string | null }> = {};
  for (const [n, r] of Object.entries(rows)) {
    if (Number(n) === 1) continue;
    const code = r[cIsco], score = Number(r[cScore]);
    if (!code || !Number.isFinite(score) || out[code]) continue;
    out[code] = { title: r[cTitle], score: +score.toFixed(3), gradient: r[cPot] || null };
  }
  return out;
}

// ---------- OpenDOSM labour force (quarterly) and wages (annual) by state ----------
export const MY_STATES: [id: string, name: string, short: string][] = [
  ["MY-01", "Johor", "Johor"], ["MY-02", "Kedah", "Kedah"], ["MY-03", "Kelantan", "Kelantan"], ["MY-04", "Melaka", "Melaka"],
  ["MY-05", "Negeri Sembilan", "N. Sembilan"], ["MY-06", "Pahang", "Pahang"], ["MY-07", "Pulau Pinang", "Penang"], ["MY-08", "Perak", "Perak"],
  ["MY-09", "Perlis", "Perlis"], ["MY-10", "Selangor", "Selangor"], ["MY-11", "Terengganu", "Terengganu"], ["MY-12", "Sabah", "Sabah"],
  ["MY-13", "Sarawak", "Sarawak"], ["MY-14", "W.P. Kuala Lumpur", "Kuala Lumpur"], ["MY-15", "W.P. Labuan", "Labuan"], ["MY-16", "W.P. Putrajaya", "Putrajaya"],
];
// DOSM writes "-" for nil; treat it as zero.
export const num = (s: unknown) => { const t = String(s ?? "").replace(/,/g, "").trim(); return t === "-" || t === "" ? 0 : Number(t); };

export type StateLabour = {
  lfs: { quarter: string; labourForce: number; employed: number; unemployed: number; uRate: number; uRateYearAgo: number };
  wages: { year: number; median: number; mean: number };
};
export function buildStateLabour(lfsCsv: string, wagesCsv: string): { byState: Record<string, StateLabour>; lfsQuarter: string; wagesYear: string } {
  const lfs = parseCsv(lfsCsv);
  const lfsLatest = lfs.map((r) => r.date).sort().at(-1);
  if (!lfsLatest) throw new Error("lfs_qtr_state: no rows");
  const lfsYearAgo = `${Number(lfsLatest.slice(0, 4)) - 1}${lfsLatest.slice(4)}`;
  const wages = parseCsv(wagesCsv).filter((r) => r.sex === "both");
  const wagesLatest = wages.map((r) => r.date).sort().at(-1);
  if (!wagesLatest) throw new Error("wages_state: no rows");
  const byState: Record<string, StateLabour> = {};
  for (const [id, name] of MY_STATES) {
    const L = lfs.find((r) => r.state === name && r.date === lfsLatest);
    const P = lfs.find((r) => r.state === name && r.date === lfsYearAgo);
    const W = wages.find((r) => r.state === name && r.date === wagesLatest);
    if (!L || !P || !W) throw new Error(`Missing labour or wage data for ${name}`);
    byState[id] = {
      lfs: { quarter: quarterOfDate(lfsLatest), labourForce: num(L.lf), employed: num(L.lf_employed), unemployed: num(L.lf_unemployed), uRate: num(L.u_rate), uRateYearAgo: num(P.u_rate) },
      wages: { year: Number(wagesLatest.slice(0, 4)), median: num(W.wages_median), mean: num(W.wages_mean) },
    };
  }
  return { byState, lfsQuarter: quarterOfDate(lfsLatest), wagesYear: wagesLatest.slice(0, 4) };
}
