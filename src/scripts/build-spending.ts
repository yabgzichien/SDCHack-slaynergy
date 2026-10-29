// Adds typical living costs by state to data/states.json, from the raw file in data/raw/ (see scripts/fetch-sources.sh).
// Source: DOSM Household Expenditure Survey Report 2024 (Malaysia & States), released 8 Oct 2025, "Table 1: Main
// Statistics", Table 1.4: median monthly per capita household consumption expenditure by state.
//   data/raw/dosm/hes2024_table1.xlsx
// The table is on dosm.gov.my only, not OpenDOSM, so the server does not refresh it: it stays pinned to this edition
// until someone downloads a newer one and runs this again. Run after scripts/build-geo.ts, which rewrites the file.
import fs from "node:fs";
import path from "node:path";
import { buildHesPerCapita } from "../src/lib/datasrc/parse";

const FILE = path.resolve("data/raw/dosm/hes2024_table1.xlsx");
const RELEASED = "2025-10-08";
const URL = "https://www.dosm.gov.my/portal-main/release-content/household-expenditure-survey-report--malaysia--states";

const hes = buildHesPerCapita(new Uint8Array(fs.readFileSync(FILE)));
const out = path.resolve("data/states.json");
const st = JSON.parse(fs.readFileSync(out, "utf8"));
st.spending = {
  source: { id: "spending_state", name: `DOSM Household Expenditure Survey Report ${hes.year}, Table 1.4: Monthly per capita household consumption expenditure by state`, url: URL, latest: `${hes.year} (released ${RELEASED})`, licence: "DOSM publication" },
  year: hes.year,
  released: RELEASED,
  byState: hes.byState,
};
fs.writeFileSync(out, JSON.stringify(st, null, 1) + "\n");
console.log(`states.json: spending per person ${hes.year} for ${Object.keys(hes.byState).length} states`);
