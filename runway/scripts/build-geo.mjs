// Builds data/states.json and public/geo/malaysia-states.json from the raw files in data/raw/ (see scripts/fetch-sources.sh).
// Sources (all open):
//   OpenDOSM lfs_qtr_state      Quarterly labour force by state (CC BY 4.0)            data/raw/opendosm/lfs_qtr_state.csv
//   OpenDOSM wages_state        Annual salaries and wages by state (CC BY 4.0)          data/raw/opendosm/wages_state.csv
//   DOSM LFS Report 2024        Employed persons by state and industry (Table B4.8)    data/raw/dosm/lfs2024_employed_state_industry.csv
//                               Employed persons by state and occupation (Table B4.5)  data/raw/dosm/lfs2024_employed_state_occupation.csv
//                               (both extracted from the report PDF by scripts/extract-state-occupation.mjs)
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

const LFS_YEAR = 2024; // the Labour Force Survey Report the two state tables come from
const OCCUPATIONS = ["managers", "professionals", "technicians", "clerical", "service", "agriculture", "craft", "operators", "elementary"];

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
// ---- employed persons by state and industry / occupation (annual LFS report tables, thousands) ----
const indRows = parseCsv(fs.readFileSync(path.join(RAW, `dosm/lfs${LFS_YEAR}_employed_state_industry.csv`), "utf8"));
const occRows = parseCsv(fs.readFileSync(path.join(RAW, `dosm/lfs${LFS_YEAR}_employed_state_occupation.csv`), "utf8"));
const INDUSTRIES = Object.keys(indRows[0]).filter((k) => k !== "state" && k !== "total");
const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, num(row[k])]));

const states = STATES.map(([id, name, short]) => {
  const L = lfs.find((r) => r.state === name && r.date === lfsLatest);
  const P = lfs.find((r) => r.state === name && r.date === lfsYearAgo);
  const W = wages.find((r) => r.state === name && r.date === wagesLatest);
  if (!L || !P || !W) throw new Error(`Missing labour or wage data for ${name}`);
  const I = indRows.find((r) => r.state === name), O = occRows.find((r) => r.state === name);
  if (!I || !O) throw new Error(`Industry or occupation data missing for ${name}`);
  return {
    id, name, short,
    lfs: { quarter: quarterOf(lfsLatest), labourForce: num(L.lf), employed: num(L.lf_employed), unemployed: num(L.lf_unemployed), uRate: num(L.u_rate), uRateYearAgo: num(P.u_rate) },
    wages: { year: Number(wagesLatest.slice(0, 4)), median: num(W.wages_median), mean: num(W.wages_mean) },
    industry: pick(I, INDUSTRIES),
    occupation: pick(O, OCCUPATIONS),
  };
});
const natInd = indRows.find((r) => r.state === "Malaysia"), natOcc = occRows.find((r) => r.state === "Malaysia");
const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: [
    { id: "lfs_state", name: "OpenDOSM: Quarterly Principal Labour Force Statistics by State (lfs_qtr_state)", url: "https://open.dosm.gov.my/data-catalogue/lfs_qtr_state", latest: quarterOf(lfsLatest), licence: "CC BY 4.0" },
    { id: "wages_state", name: "OpenDOSM: Annual Salaries & Wages by State (wages_state)", url: "https://open.dosm.gov.my/data-catalogue/wages_state", latest: wagesLatest.slice(0, 4), licence: "CC BY 4.0" },
    { id: "industry_state", name: `DOSM Labour Force Survey Report ${LFS_YEAR}, Table B4.8: Employed persons by state and industry`, url: `https://storage.dosm.gov.my/labour/lfs_annual_${LFS_YEAR}.pdf`, latest: String(LFS_YEAR), licence: "DOSM publication" },
    { id: "occupation_state", name: `DOSM Labour Force Survey Report ${LFS_YEAR}, Table B4.5: Employed persons by state and occupation`, url: `https://storage.dosm.gov.my/labour/lfs_annual_${LFS_YEAR}.pdf`, latest: String(LFS_YEAR), licence: "DOSM publication" },
    { id: "boundaries", name: "geoBoundaries gbOpen MYS ADM1 (simplified), from OpenStreetMap", url: "https://www.geoboundaries.org/countryDownloads.html", latest: "2017 boundaries", licence: "ODbL 1.0" },
  ],
  industryYear: LFS_YEAR,
  occupationYear: LFS_YEAR,
  nationalIndustry: pick(natInd, INDUSTRIES),
  nationalOccupation: pick(natOcc, OCCUPATIONS),
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
console.log(`states.json: ${states.length} states, labour force ${quarterOf(lfsLatest)}, wages ${wagesLatest.slice(0, 4)}, industry and occupation ${LFS_YEAR}`);
console.log(`malaysia-states.json: ${(fs.statSync(path.resolve("public/geo/malaysia-states.json")).size / 1024).toFixed(0)} KB`);
