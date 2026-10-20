// Builds data/states.json and public/geo/malaysia-states.json from the raw files in data/raw/ (see scripts/fetch-sources.sh).
// Sources (all open):
//   OpenDOSM lfs_qtr_state      Quarterly labour force by state (CC BY 4.0)            data/raw/opendosm/lfs_qtr_state.csv
//   OpenDOSM wages_state        Annual salaries and wages by state (CC BY 4.0)          data/raw/opendosm/wages_state.csv
//   data.gov.my (DOSM)          Employed persons by industry and state, 1982-2021 (CC BY) data/raw/opendosm/employed_industry_state_1982_2021.csv
//   geoBoundaries gbOpen MYS ADM1, simplified (OpenStreetMap; ODbL 1.0)                 data/raw/geo/mys_adm1_simplified.geojson
import fs from "node:fs";
import path from "node:path";

const RAW = path.resolve("data/raw");
const STATES = [
  ["MY-01", "Johor", "Johor"], ["MY-02", "Kedah", "Kedah"], ["MY-03", "Kelantan", "Kelantan"], ["MY-04", "Melaka", "Melaka"],
  ["MY-05", "Negeri Sembilan", "N. Sembilan"], ["MY-06", "Pahang", "Pahang"], ["MY-07", "Pulau Pinang", "Penang"], ["MY-08", "Perak", "Perak"],
  ["MY-09", "Perlis", "Perlis"], ["MY-10", "Selangor", "Selangor"], ["MY-11", "Terengganu", "Terengganu"], ["MY-12", "Sabah", "Sabah"],
  ["MY-13", "Sarawak", "Sarawak"], ["MY-14", "W.P. Kuala Lumpur", "Kuala Lumpur"], ["MY-15", "W.P. Labuan", "Labuan"], ["MY-16", "W.P. Putrajaya", "Putrajaya"],
];
const byName = Object.fromEntries(STATES.map(([id, name]) => [name.toUpperCase(), id]));

// Industry sections (MSIC 2008) as named in the DOSM file -> short keys used by the app.
const INDUSTRY = {
  "Agriculture, forestry and fishing": "agriculture", "Mining and quarrying": "mining", "Manufacturing": "manufacturing",
  "Electricity, gas, steam and air conditioning supply": "utilities", "Water supply; sewerage, waste management and remediation activities": "water",
  "Construction": "construction", "Wholesale and retail trade, repair of motor vehicles and motorcycles": "trade",
  "Transportation and storage": "transport", "Accommodation and food service activities": "accommodation",
  "Information and communication": "ict", "Financial and insurance/takaful activities": "finance", "Real estate activities": "realestate",
  "Professional, scientific and technical activities": "professional", "Administrative and support service activities": "admin",
  "Public administration and defence; compulsory social security": "public", "Education": "education",
  "Human health and social work activities": "health", "Arts, entertainment and recreation": "arts", "Others service activities": "otherservices",
  "Activities of households as employers": "households",
};

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    rows.push(out);
  }
  const [h, ...body] = rows;
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), r[i]])));
}
// DOSM writes "-" for nil; treat it as zero.
const num = (s) => { const t = String(s ?? "").replace(/,/g, "").trim(); return t === "-" || t === "" ? 0 : Number(t); };
const quarterOf = (date) => `${date.slice(0, 4)}Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;

// ---- labour force by state (quarterly) ----
const lfs = parseCsv(fs.readFileSync(path.join(RAW, "opendosm/lfs_qtr_state.csv"), "utf8"));
const lfsLatest = lfs.map((r) => r.date).sort().at(-1);
const lfsYearAgo = `${Number(lfsLatest.slice(0, 4)) - 1}${lfsLatest.slice(4)}`;
// ---- wages by state (annual) ----
const wages = parseCsv(fs.readFileSync(path.join(RAW, "opendosm/wages_state.csv"), "utf8")).filter((r) => r.sex === "both");
const wagesLatest = wages.map((r) => r.date).sort().at(-1);
// ---- employed persons by industry and state (annual, to 2021) ----
const ind = parseCsv(fs.readFileSync(path.join(RAW, "opendosm/employed_industry_state_1982_2021.csv"), "utf8"));
const indYear = String(Math.max(...ind.map((r) => Number(r.Year))));
const indRows = ind.filter((r) => r.Year === indYear);
for (const r of indRows) if (!INDUSTRY[r.Industry]) throw new Error(`Unknown industry label: ${r.Industry}`);

const states = STATES.map(([id, name, short]) => {
  const L = lfs.find((r) => r.state === name && r.date === lfsLatest);
  const P = lfs.find((r) => r.state === name && r.date === lfsYearAgo);
  const W = wages.find((r) => r.state === name && r.date === wagesLatest);
  if (!L || !P || !W) throw new Error(`Missing labour or wage data for ${name}`);
  const industry = {};
  for (const r of indRows.filter((x) => x.State.toUpperCase() === name.toUpperCase())) industry[INDUSTRY[r.Industry]] = num(r["Employed person in Thousands"]);
  if (Object.keys(industry).length < 15) throw new Error(`Industry data missing for ${name}`);
  for (const k of Object.values(INDUSTRY)) industry[k] ??= 0; // a section with no row is nil
  return {
    id, name, short,
    lfs: { quarter: quarterOf(lfsLatest), labourForce: num(L.lf), employed: num(L.lf_employed), unemployed: num(L.lf_unemployed), uRate: num(L.u_rate), uRateYearAgo: num(P.u_rate) },
    wages: { year: Number(wagesLatest.slice(0, 4)), median: num(W.wages_median), mean: num(W.wages_mean) },
    industry,
  };
});
const nat = indRows.filter((r) => r.State === "MALAYSIA");
const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: [
    { id: "lfs_state", name: "OpenDOSM: Quarterly Principal Labour Force Statistics by State (lfs_qtr_state)", url: "https://open.dosm.gov.my/data-catalogue/lfs_qtr_state", latest: quarterOf(lfsLatest), licence: "CC BY 4.0" },
    { id: "wages_state", name: "OpenDOSM: Annual Salaries & Wages by State (wages_state)", url: "https://open.dosm.gov.my/data-catalogue/wages_state", latest: wagesLatest.slice(0, 4), licence: "CC BY 4.0" },
    { id: "industry_state", name: "DOSM via data.gov.my: Employed persons by industry and state, 1982-2021", url: "https://archive.data.gov.my/data/dataset/employed-persons-by-industry-and-state", latest: indYear, licence: "CC BY" },
    { id: "boundaries", name: "geoBoundaries gbOpen MYS ADM1 (simplified), from OpenStreetMap", url: "https://www.geoboundaries.org/countryDownloads.html", latest: "2017 boundaries", licence: "ODbL 1.0" },
  ],
  industryYear: Number(indYear),
  nationalIndustry: Object.fromEntries(nat.map((r) => [INDUSTRY[r.Industry], num(r["Employed person in Thousands"])])),
  states,
};
fs.writeFileSync(path.resolve("data/states.json"), JSON.stringify(out, null, 1) + "\n");

// ---- boundaries: round to ~100 m, drop specks, keep the state code as the id ----
const geo = JSON.parse(fs.readFileSync(path.join(RAW, "geo/mys_adm1_simplified.geojson"), "utf8"));
const ISO = Object.fromEntries(STATES.map(([id]) => [id, id]));
const round = (c) => [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000];
const ringArea = (r) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const cleanRing = (r) => { const o = []; for (const p of r.map(round)) if (!o.length || o.at(-1)[0] !== p[0] || o.at(-1)[1] !== p[1]) o.push(p); return o; };
const features = geo.features.map((f) => {
  const id = f.properties.shapeISO;
  if (!ISO[id]) throw new Error(`Unknown boundary ${id}`);
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const kept = polys.map((p) => p.map(cleanRing)).filter((p) => p[0].length >= 4);
  const big = kept.filter((p) => ringArea(p[0]) > 0.0004);
  const name = STATES.find((s) => s[0] === id)[1];
  return { type: "Feature", properties: { id, name }, geometry: { type: "MultiPolygon", coordinates: (big.length ? big : kept).map((p) => [p[0]]) } };
});
fs.mkdirSync(path.resolve("public/geo"), { recursive: true });
fs.writeFileSync(path.resolve("public/geo/malaysia-states.json"), JSON.stringify({ type: "FeatureCollection", features }));
console.log(`states.json: ${states.length} states, labour force ${quarterOf(lfsLatest)}, wages ${wagesLatest.slice(0, 4)}, industry ${indYear}`);
console.log(`malaysia-states.json: ${(fs.statSync(path.resolve("public/geo/malaysia-states.json")).size / 1024).toFixed(0)} KB`);
