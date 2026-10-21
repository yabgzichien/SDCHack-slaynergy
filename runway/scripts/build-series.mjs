// Builds data/series.json from the raw source files in data/raw/.
// Re-run `npm run data:build` after dropping a new release into data/raw/ (see scripts/fetch-sources.sh).
import fs from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const RAW = path.resolve("data/raw");
const OUT = path.resolve("data/series.json");

// ---------- DOSM Job Market Insights (xlsx, parsed by header, not position) ----------
function colToNum(c) {
  let n = 0;
  for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function readSheet(file) {
  const z = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const sst = strFromU8(z["xl/sharedStrings.xml"]);
  const strings = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
  const sheet = strFromU8(z["xl/worksheets/sheet1.xml"]);
  const rows = {};
  for (const r of sheet.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = (c[3] || "").match(/<v>([\s\S]*?)<\/v>/);
      if (!v) continue;
      cells[c[1]] = c[2].includes('t="s"') ? strings[Number(v[1])] : v[1];
    }
    rows[Number(r[1])] = cells;
  }
  return rows;
}

function buildDosm(file, latestQuarter) {
  const rows = readSheet(file);
  const headerRow = Object.entries(rows).find(([, c]) => c.B === "Occupation");
  if (!headerRow) throw new Error("DOSM workbook: 'Occupation' header row not found");
  const hn = Number(headerRow[0]);
  const header = headerRow[1];
  // quarterly block = the first run of consecutive Q1..Q4 labels after column J
  const totalRow = (() => { for (let r = hn + 1; r < hn + 14; r++) if (rows[r]?.B === "Jumlah") return rows[r]; throw new Error("DOSM workbook: 'Jumlah' row not found"); })();
  const qCols = Object.keys(header)
    .filter((c) => /^Q[1-4]$/.test(header[c]) && totalRow[c] !== undefined)
    .sort((a, b) => colToNum(a) - colToNum(b));
  // the quarterly block ends where the monthly block (month names) starts, so qCols are exactly the quarter columns
  const [ly, lq] = [Number(latestQuarter.slice(0, 4)), Number(latestQuarter.slice(5))];
  const labels = [];
  let y = ly, q = lq;
  for (let i = qCols.length - 1; i >= 0; i--) {
    if (header[qCols[i]] !== `Q${q}`) throw new Error(`Quarter label mismatch at ${qCols[i]}: expected Q${q}, got ${header[qCols[i]]}`);
    labels.unshift(`${y}Q${q}`);
    q--;
    if (q === 0) { q = 4; y--; }
  }
  const find = (label) => {
    for (let r = hn + 1; r < hn + 14; r++) if (rows[r]?.B === label) return rows[r];
    throw new Error(`DOSM workbook: row '${label}' not found`);
  };
  const total = find("Jumlah");
  const GROUPS = {
    managers: "Managers",
    professionals: "Professionals",
    technicians: "Technicians and associate professionals",
    clerical: "Clerical support workers",
    service: "Service and sales workers",
    craft: "Craft and related trades workers",
    operators: "Plant and machine operators and assemblers",
    elementary: "Elementary Occupations",
  };
  const rowsBy = Object.fromEntries(Object.entries(GROUPS).map(([k, l]) => [k, find(l)]));
  const out = [];
  qCols.forEach((c, i) => {
    const t = Number(total[c]);
    if (!Number.isFinite(t) || t <= 0) return;
    const rec = { q: labels[i], total: t };
    for (const k of Object.keys(GROUPS)) {
      const n = Number(rowsBy[k][c]);
      rec[k] = Number.isFinite(n) ? n : 0;
    }
    rec.clerical_share = +((rec.clerical / t) * 100).toFixed(3);
    out.push(rec);
  });
  return out;
}

// ---------- Epoch AI benchmark frontier series ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
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
  const head = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const quarterOf = (iso) => `${iso.slice(0, 4)}Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
const nextQ = (q) => { let y = +q.slice(0, 4), n = +q[5] + 1; if (n === 5) { n = 1; y++; } return `${y}Q${n}`; };

function frontier(file, scoreCol, transform = (x) => x) {
  const rows = parseCsv(fs.readFileSync(path.join(RAW, "epoch", file), "utf8"));
  const pts = rows
    .map((r) => ({ date: (r["Release date"] || "").slice(0, 10), v: Number(r[scoreCol]) }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.v) && p.v > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const best = new Map();
  let run = -Infinity;
  for (const p of pts) {
    run = Math.max(run, transform(p.v));
    best.set(quarterOf(p.date), run);
  }
  const qs = [...best.keys()].sort();
  const out = [];
  let last = null;
  for (let q = qs[0]; q <= qs[qs.length - 1]; q = nextQ(q)) {
    if (best.has(q)) last = best.get(q);
    out.push({ q, v: +last.toFixed(4) });
  }
  return out;
}

const EPOCH = [
  { id: "metr", name: "METR time horizon (50%)", file: "metr_time_horizons_external.csv", col: "Time horizon", tf: Math.log2, unit: "doublings (log2 minutes)", short: "task length AI can finish" },
  { id: "swe", name: "SWE-bench Verified", file: "swe_bench_verified.csv", col: "mean_score", tf: (x) => x * 100, unit: "% solved", short: "software-engineering tasks solved" },
  { id: "hle", name: "Humanity's Last Exam", file: "hle_external.csv", col: "Accuracy", tf: (x) => x * 100, unit: "% correct", short: "expert-level questions answered" },
  { id: "tbench", name: "Terminal-Bench", file: "terminalbench_external.csv", col: "Accuracy mean", tf: (x) => x * 100, unit: "% solved", short: "command-line agent tasks solved" },
  // Replay-only series: used for the history replay (forecaster track records), never as live questions.
  { id: "fmath", name: "FrontierMath", file: "frontiermath.csv", col: "mean_score", tf: (x) => x * 100, unit: "% solved", short: "research-level maths problems solved", replayOnly: true },
  { id: "aider", name: "Aider Polyglot", file: "aider_polyglot_external.csv", col: "Percent correct", tf: (x) => x, unit: "% correct", short: "multi-language coding edits correct", replayOnly: true },
  { id: "arc", name: "ARC-AGI", file: "arc_agi_external.csv", col: "Score", tf: (x) => (x <= 1 ? x * 100 : x), unit: "% solved", short: "novel reasoning puzzles solved", replayOnly: true },
  { id: "osworld", name: "OSWorld", file: "os_world_external.csv", col: "Score", tf: (x) => (x <= 1 ? x * 100 : x), unit: "% solved", short: "computer-use tasks solved", replayOnly: true },
  { id: "weirdml", name: "WeirdML", file: "weirdml_external.csv", col: "Accuracy", tf: (x) => (x <= 1 ? x * 100 : x), unit: "% accuracy", short: "unusual machine-learning tasks", replayOnly: true },
  { id: "simple", name: "SimpleBench", file: "simplebench_external.csv", col: "Score (AVG@5)", tf: (x) => (x <= 1 ? x * 100 : x), unit: "% score", short: "common-sense reasoning questions", replayOnly: true },
];

// ---------- Anthropic Economic Index (release 2025-02-10): occupation AI-usage index ----------
function buildAei() {
  const dir = path.join(RAW, "aei_2025_02_10");
  const mapping = parseCsv(fs.readFileSync(path.join(dir, "onet_task_mappings.csv"), "utf8"));
  const pct = new Map(mapping.map((r) => [r.task_name.trim().toLowerCase(), Number(r.pct)]));
  const statements = parseCsv(fs.readFileSync(path.join(dir, "onet_task_statements.csv"), "utf8"));
  const occ = new Map();
  for (const r of statements) {
    const o = occ.get(r["O*NET-SOC Code"]) || { title: r.Title, n: 0, hit: 0, sum: 0 };
    o.n++;
    const p = pct.get(r.Task.trim().toLowerCase());
    if (p) { o.hit++; o.sum += p; }
    occ.set(r["O*NET-SOC Code"], o);
  }
  const out = {};
  for (const [code, o] of occ) {
    out[code] = { title: o.title, tasks: o.n, coverage: +(o.hit / o.n).toFixed(3), usage: +o.sum.toFixed(4) };
  }
  return out;
}

// ---------- ILO 2025 GenAI exposure scores (ISCO-08, CC-BY 4.0) ----------
function buildIlo() {
  const rows = readSheet(path.join(RAW, "ilo", "ilo.xlsx"));
  const head = rows[1];
  const col = (name) => Object.keys(head).find((k) => head[k] === name);
  const cIsco = col("ISCO_08"), cTitle = col("Title"), cScore = col("mean_score_2025"), cPot = col("potential25");
  if (!cIsco || !cScore) throw new Error("ILO workbook: expected columns not found");
  const out = {};
  for (const [n, r] of Object.entries(rows)) {
    if (Number(n) === 1) continue;
    const code = r[cIsco], score = Number(r[cScore]);
    if (!code || !Number.isFinite(score) || out[code]) continue;
    out[code] = { title: r[cTitle], score: +score.toFixed(3), gradient: r[cPot] || null };
  }
  return out;
}

const dosm = buildDosm(path.join(RAW, "dosm", "jmi_q2_2026.xlsx"), "2026Q2");
// Last complete quarter. The app still holds 2026 Q2 back as the release it replays; Q3 (closed 30 Sep 2026) is only used
// to set the thresholds of the open Oct to Dec 2026 questions, so no open question asks about a quarter that has ended.
const EPOCH_CUTOFF = "2026Q3";
const epoch = {};
for (const e of EPOCH) {
  epoch[e.id] = { name: e.name, unit: e.unit, short: e.short, replayOnly: !!e.replayOnly, frontier: frontier(e.file, e.col, e.tf).filter((p) => p.q <= EPOCH_CUTOFF) };
}
const aei = buildAei();
const ilo = buildIlo();

const series = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: [
    { id: "ilo", name: "ILO Working Paper 140: Generative AI and Jobs, 2025 update (ISCO-08 exposure scores)", url: "https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure", retrieved: "2026-10-20", latest: "2025 scores", licence: "CC BY 4.0 (ILO; Gmyrek et al. 2025)" },
    { id: "dosm", name: "DOSM Big Data Analytics: Job Market Insights (Job Vacancies Advertised Online)", url: "https://www.dosm.gov.my/portal-main/release-content/big-data-analytics-job-market-insights-q22026", retrieved: "2026-10-20", latest: "2026Q2 (published 2026-08-18)", next: "2026-11-17", licence: "DOSM open statistics; redistribution terms to be confirmed" },
    { id: "epoch", name: "Epoch AI Capabilities & benchmarking data", url: "https://epoch.ai/benchmarks", retrieved: "2026-10-20", latest: "models to 2026-10-15", licence: "CC-BY 4.0 (Epoch AI)" },
    { id: "aei", name: "Anthropic Economic Index, release 2025-02-10 (O*NET task usage)", url: "https://huggingface.co/datasets/Anthropic/EconomicIndex", retrieved: "2026-10-20", latest: "2025-02-10 (newer releases exist; not yet parsed)", licence: "CC-BY (data)" },
  ],
  dosm: { publishedAt: { "2026Q2": "2026-08-18" }, quarters: dosm },
  epoch,
  aei,
  ilo,
};
fs.writeFileSync(OUT, JSON.stringify(series));
console.log("DOSM quarters:", dosm.length, dosm[0].q, "->", dosm[dosm.length - 1].q);
console.log("last 3 clerical shares:", dosm.slice(-3).map((d) => `${d.q} ${d.clerical_share}%`).join(", "));
for (const e of EPOCH) {
  const f = epoch[e.id].frontier;
  console.log(e.id, f.length, "quarters", f[0].q, "->", f[f.length - 1].q, "last5:", f.slice(-5).map((x) => `${x.q}:${x.v}`).join(" "));
}
console.log("ILO occupations:", Object.keys(ilo).length, JSON.stringify(ilo["4132"]), JSON.stringify(ilo["4311"]), JSON.stringify(ilo["2411"]));
console.log("AEI occupations:", Object.keys(aei).length, "43-3031.00:", JSON.stringify(aei["43-3031.00"]));
