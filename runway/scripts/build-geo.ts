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
import { buildStateLabour, MY_STATES as STATES, num, parseCsv } from "../src/lib/datasrc/parse";

const RAW = path.resolve("data/raw");
const LFS_YEAR = 2024; // the Labour Force Survey Report the two state tables come from
const OCCUPATIONS = ["managers", "professionals", "technicians", "clerical", "service", "agriculture", "craft", "operators", "elementary"];

// ---- labour force by state (quarterly) and wages by state (annual): the part the server also refreshes by itself ----
const labour = buildStateLabour(fs.readFileSync(path.join(RAW, "opendosm/lfs_qtr_state.csv"), "utf8"), fs.readFileSync(path.join(RAW, "opendosm/wages_state.csv"), "utf8"));
// ---- employed persons by state and industry / occupation (annual LFS report tables, thousands) ----
const indRows = parseCsv(fs.readFileSync(path.join(RAW, `dosm/lfs${LFS_YEAR}_employed_state_industry.csv`), "utf8"));
const occRows = parseCsv(fs.readFileSync(path.join(RAW, `dosm/lfs${LFS_YEAR}_employed_state_occupation.csv`), "utf8"));
const INDUSTRIES = Object.keys(indRows[0]).filter((k) => k !== "state" && k !== "total");
const pick = (row: Record<string, string>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, num(row[k])]));

const states = STATES.map(([id, name, short]) => {
  const I = indRows.find((r) => r.state === name), O = occRows.find((r) => r.state === name);
  if (!I || !O) throw new Error(`Industry or occupation data missing for ${name}`);
  return {
    id, name, short,
    ...labour.byState[id],
    industry: pick(I, INDUSTRIES),
    occupation: pick(O, OCCUPATIONS),
  };
});
const natInd = indRows.find((r) => r.state === "Malaysia")!, natOcc = occRows.find((r) => r.state === "Malaysia")!;
const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: [
    { id: "lfs_state", name: "OpenDOSM: Quarterly Principal Labour Force Statistics by State (lfs_qtr_state)", url: "https://open.dosm.gov.my/data-catalogue/lfs_qtr_state", latest: labour.lfsQuarter, licence: "CC BY 4.0" },
    { id: "wages_state", name: "OpenDOSM: Annual Salaries & Wages by State (wages_state)", url: "https://open.dosm.gov.my/data-catalogue/wages_state", latest: labour.wagesYear, licence: "CC BY 4.0" },
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
type Pt = number[]; type Ring = Pt[]; type Poly = Ring[];
type Feature = { properties: { shapeISO: string }; geometry: { type: string; coordinates: Poly | Poly[] } };
const geo = JSON.parse(fs.readFileSync(path.join(RAW, "geo/mys_adm1_simplified.geojson"), "utf8")) as { features: Feature[] };
const ISO = Object.fromEntries(STATES.map(([id]) => [id, id]));
const round = (c: Pt): Pt => [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000];
const ringArea = (r: Ring) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const cleanRing = (r: Ring) => { const o: Ring = []; for (const p of r.map(round)) if (!o.length || o.at(-1)![0] !== p[0] || o.at(-1)![1] !== p[1]) o.push(p); return o; };
const features = geo.features.map((f) => {
  const id = f.properties.shapeISO;
  if (!ISO[id]) throw new Error(`Unknown boundary ${id}`);
  const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Poly[];
  const kept = polys.map((p) => p.map(cleanRing)).filter((p) => p[0].length >= 4);
  const big = kept.filter((p) => ringArea(p[0]) > 0.0004);
  const name = STATES.find((s) => s[0] === id)![1];
  return { type: "Feature", properties: { id, name }, geometry: { type: "MultiPolygon", coordinates: (big.length ? big : kept).map((p) => [p[0]]) } };
});
// geoBoundaries files Pulau Tioman and Pulau Seri Buat (off Endau, north of the Johor–Pahang line) under Johor.
// Both belong to Pahang (Rompin district), so move any island centred in that box across.
// Tinggi, Pemanggil and Aur further south really are Johor's and stay.
const MIS_FILED = [{ from: "MY-01", to: "MY-06", box: [103.85, 104.3, 2.62, 2.95] }];
const centre = (r: Ring) => [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
for (const { from, to, box: [w, e, s, n] } of MIS_FILED) {
  const src = features.find((f) => f.properties.id === from)!, dst = features.find((f) => f.properties.id === to)!;
  const inBox = (p: Ring[]) => { const [x, y] = centre(p[0]); return x >= w && x <= e && y >= s && y <= n; };
  const moved = src.geometry.coordinates.filter(inBox);
  if (!moved.length) throw new Error(`No ${from} islands left in the ${to} box; check whether the source was fixed`);
  src.geometry.coordinates = src.geometry.coordinates.filter((p) => !inBox(p));
  dst.geometry.coordinates.push(...moved);
}
fs.mkdirSync(path.resolve("public/geo"), { recursive: true });
fs.writeFileSync(path.resolve("public/geo/malaysia-states.json"), JSON.stringify({ type: "FeatureCollection", features }));
console.log(`states.json: ${states.length} states, labour force ${labour.lfsQuarter}, wages ${labour.wagesYear}, industry and occupation ${LFS_YEAR}`);
console.log(`malaysia-states.json: ${(fs.statSync(path.resolve("public/geo/malaysia-states.json")).size / 1024).toFixed(0)} KB`);
