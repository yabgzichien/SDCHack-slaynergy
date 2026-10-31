// Helpers for the model-assisted fallback (src/lib/server/assist.ts). The model only ever proposes a link or a layout;
// everything here is plain code that decides whether to believe it. The model never supplies a number: the numbers
// are always read from the workbook by buildDosm, using the layout the model pointed at.
import type { DosmQuarter } from "../engine/data";
import { DOSM_GROUPS, readSheet, type DosmGroupKey, type SheetMap } from "./parse";

export const MAPPING_LIMITS = {
  // A layout is believed only if it reads every quarter we already hold to within this share (DOSM revises a little).
  heldTolerance: 0.03,
  maxQuarterCols: 60,
  dumpChars: 14000,
};

const COL = /^[A-Z]{1,3}$/;
const GROUP_KEYS = Object.keys(DOSM_GROUPS) as DosmGroupKey[];
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 200;
const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

// "C..I, K..AH": the columns that hold a value, as runs, so the model can tell a published quarter from an empty heading.
function runs(cols: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < cols.length; ) {
    let j = i;
    while (j + 1 < cols.length && colNum(cols[j + 1]) === colNum(cols[j]) + 1) j++;
    out.push(i === j ? cols[i] : `${cols[i]}..${cols[j]}`);
    i = j + 1;
  }
  return out.length > 8 ? `${out.slice(0, 8).join(", ")}, …` : out.join(", ");
}

// A compact text picture of the workbook for the model: every row's first label, the cells of header-like rows, and the
// last few cells of number rows. Row numbers and column letters are exactly those the layout must use.
export function dumpSheet(bytes: Uint8Array, maxChars = MAPPING_LIMITS.dumpChars): string {
  const rows = readSheet(bytes);
  const out: string[] = [];
  let used = 0;
  for (const [n, cells] of Object.entries(rows)) {
    const cols = Object.keys(cells).sort((a, b) => colNum(a) - colNum(b));
    if (!cols.length) continue;
    const isNum = (c: string) => /^-?\d+(\.\d+)?$/.test(cells[c]) || cells[c] === "-";
    const text = cols.filter((c) => !isNum(c));
    const cut = (s: string) => (s.length > 70 ? `${s.slice(0, 70)}…` : s);
    let line: string;
    if (text.length >= 3 && text.length >= cols.length * 0.7) line = `row ${n} (headings): ${cols.slice(0, 90).map((c) => `${c}=${cut(cells[c])}`).join(" | ")}`;
    else {
      const label = cols.find((c) => !isNum(c));
      const nums = cols.filter(isNum);
      line = `row ${n}: ${label ? `${label}=${cut(cells[label])}` : ""}${nums.length ? ` | numbers in columns ${runs(nums)}` : ""}`;
    }
    if (used + line.length > maxChars) { out.push("(sheet continues)"); break; }
    out.push(line);
    used += line.length + 1;
  }
  return out.join("\n");
}

// Turn whatever the model returned into a SheetMap, or throw. Shape only: whether the labels and columns are really in
// the workbook is settled when buildDosm reads it.
export function parseSheetMap(raw: unknown): SheetMap {
  if (!raw || typeof raw !== "object") throw new Error("layout is not an object");
  const m = raw as Record<string, unknown>;
  const headerRow = Number(m.headerRow);
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 5000) throw new Error("layout: bad headerRow");
  if (typeof m.labelCol !== "string" || !COL.test(m.labelCol)) throw new Error("layout: bad labelCol");
  if (!isStr(m.totalLabel)) throw new Error("layout: bad totalLabel");
  const g = m.groups as Record<string, unknown> | undefined;
  if (!g || typeof g !== "object") throw new Error("layout: groups missing");
  const groups = {} as Record<DosmGroupKey, string>;
  for (const k of GROUP_KEYS) {
    if (!isStr(g[k])) throw new Error(`layout: no label for ${k}`);
    groups[k] = g[k] as string;
  }
  const qc = m.quarterCols;
  if (!Array.isArray(qc) || qc.length < 2 || qc.length > MAPPING_LIMITS.maxQuarterCols || !qc.every((c) => typeof c === "string" && COL.test(c))) throw new Error("layout: bad quarterCols");
  if (new Set(qc).size !== qc.length) throw new Error("layout: repeated quarter column");
  return { headerRow, labelCol: m.labelCol, totalLabel: m.totalLabel, groups, quarterCols: [...(qc as string[])].sort((a, b) => colNum(a) - colNum(b)) };
}

// The strong check on a proposed layout: it must give back every quarter we already hold, group by group, and exactly
// one new quarter. A layout that is shifted by a column, or reads the wrong table, fails this even if its newest
// quarter looks believable.
export function reproducesHeld(held: DosmQuarter[], built: DosmQuarter[], tol = MAPPING_LIMITS.heldTolerance): string | null {
  if (built.length !== held.length + 1) return `read ${built.length} quarters, expected ${held.length + 1}`;
  const by = new Map(built.map((d) => [d.q, d]));
  for (const h of held) {
    const b = by.get(h.q);
    if (!b) return `${h.q} is missing`;
    for (const f of ["total", ...GROUP_KEYS] as (keyof DosmQuarter)[]) {
      const a = Number(h[f]), c = Number(b[f]);
      if (Math.abs(c - a) > Math.max(tol * Math.abs(a), 25)) return `${h.q} ${String(f)} reads ${c}, held ${a}`;
    }
  }
  return null;
}

// The release pages DOSM links to from a release's archive page: the list the model chooses a page from. Only links
// under /portal-main/release-content/ whose address mentions job-market-insights are kept, resolved against DOSM's own
// host, so whatever the model answers can only be one of DOSM's own release pages.
export const DOSM_HOST = "https://www.dosm.gov.my";
export type ReleaseLink = { url: string; text: string };
export function releaseLinks(html: string, skip: string[] = []): ReleaseLink[] {
  const seen = new Map<string, string>();
  for (const m of html.matchAll(/<a\s[^>]*href="([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].trim();
    if (!/^\/portal-main\/release-content\/[A-Za-z0-9-]*job-market-insights[A-Za-z0-9-]*$/.test(href)) continue;
    const url = DOSM_HOST + href;
    if (skip.includes(url)) continue;
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!seen.has(url) || (!seen.get(url) && text)) seen.set(url, text);
  }
  return [...seen].map(([url, text]) => ({ url, text })).slice(0, 80);
}
