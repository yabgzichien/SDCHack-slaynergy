// Turns two tables of the DOSM Labour Force Survey Report 2024 (employed persons, thousands) into CSVs in data/raw/dosm/:
//   Table B4.5 by state and occupation (PDF page 251)      -> lfs2024_employed_state_occupation.csv
//   Table B4.8 by state and industry (PDF pages 256-258)   -> lfs2024_employed_state_industry.csv
// Input is pdftotext -layout output (see scripts/fetch-sources.sh). Every row and column is checked against the table's own
// totals, so a layout change fails loudly instead of shifting numbers.
import fs from "node:fs";

const DIR = "data/raw/dosm";
const STATES = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Pulau Pinang", "Perak", "Perlis", "Selangor", "Terengganu", "Sabah", "Sarawak", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya"];
const OCCUPATIONS = ["managers", "professionals", "technicians", "clerical", "service", "agriculture", "craft", "operators", "elementary"];
// MSIC 2008 sections in the column order of Table B4.8, as the short keys build-geo.mjs uses
const INDUSTRIES = [
  ["agriculture", "mining", "manufacturing", "utilities", "water", "construction", "trade"],
  ["transport", "accommodation", "ict", "finance", "realestate", "professional", "admin"],
  ["public", "education", "health", "arts", "otherservices", "households"],
];

// The thousands half of one table page: Malaysia first, then the 16 states, each a row of `cols` numbers.
function readPage(file, cols) {
  const text = fs.readFileSync(file, "utf8");
  const block = text.slice(0, text.indexOf("Jumlah (%)"));
  const re = new RegExp(`^\\s*(\\S.*?)?\\s*[\\d,]+\\.\\d(\\s+[\\d,]+\\.\\d){${cols - 1}}\\s*$`);
  const rows = block.split("\n").filter((l) => re.test(l)).map((l) => l.match(/[\d,]+\.\d/g).map((x) => Number(x.replace(/,/g, ""))));
  if (rows.length !== 17) throw new Error(`${file}: expected 17 rows (Malaysia + 16 states), got ${rows.length}`);
  return rows;
}
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
// states add up to Malaysia in every column (rounding: 0.1 per state)
function checkColumns(rows, names, file) {
  names.forEach((n, j) => { if (Math.abs(sum(rows.slice(1).map((r) => r[j])) - rows[0][j]) > 1) throw new Error(`${file}: ${n} states do not add up`); });
}
function write(file, header, rows) {
  const lines = [header.join(","), ["Malaysia", ...rows[0]].join(","), ...rows.slice(1).map((r, i) => [`"${STATES[i]}"`, ...r].join(","))];
  fs.writeFileSync(`${DIR}/${file}`, lines.join("\n") + "\n");
  console.log(`wrote ${DIR}/${file}`);
}

// ---- B4.5: total + 9 occupation groups ----
const occ = readPage(`${DIR}/lfs_annual_2024_p251.txt`, 10);
occ.forEach((r, i) => { if (Math.abs(sum(r.slice(1)) - r[0]) > 0.6) throw new Error(`B4.5 ${i ? STATES[i - 1] : "Malaysia"}: groups do not add up`); });
checkColumns(occ, ["total", ...OCCUPATIONS], "B4.5");
write("lfs2024_employed_state_occupation.csv", ["state", "total", ...OCCUPATIONS], occ);

// ---- B4.8: total + 7 industries, then 7, then 6, across three pages ----
const [p1, p2, p3] = [256, 257, 258].map((p, k) => readPage(`${DIR}/lfs_annual_2024_p${p}.txt`, INDUSTRIES[k].length + (k === 0 ? 1 : 0)));
const ind = p1.map((r, i) => [...r, ...p2[i], ...p3[i]]);
// the total also counts extraterritorial bodies, which have no column: industries may fall short of it, never exceed it
ind.forEach((r, i) => { const gap = r[0] - sum(r.slice(1)); if (gap < -0.6 || gap > 5) throw new Error(`B4.8 ${i ? STATES[i - 1] : "Malaysia"}: industries do not add up (gap ${gap.toFixed(1)})`); });
checkColumns(ind, ["total", ...INDUSTRIES.flat()], "B4.8");
write("lfs2024_employed_state_industry.csv", ["state", "total", ...INDUSTRIES.flat()], ind);
