// How a resume's plain text is split into a header and sections. The scanner uses the section rules to score; the
// report uses layoutResume to draw the text as a page. This file imports no data, so it stays small in the browser.

export const SECTION_RE: Record<string, RegExp> = {
  summary: /^(professional\s+)?(summary|profile|objective|about me|career objective)\b/i,
  experience: /^(work(ing)?\s+)?(experience|history)|^employment|^career history|^professional experience/i,
  education: /^(education|qualifications?|academic)/i,
  skills: /^(technical\s+|key\s+|core\s+)?(skills|competenc)/i,
  projects: /^projects?\b/i,
  certifications: /^(certifications?|training|courses|licen[cs]es)/i,
  other: /^(languages?|references?|referees?|achievements?|awards?|interests?|volunteer)/i,
};
// Drawn as its own block but not scored as a section, so adding it here must not change the score.
const PERSONAL_HEAD = /^personal\s+(details|information|particulars)/i;

const BULLET = /^([-•*–·▪●◦]|\d+[.)])\s+/;
export const wc = (s: string) => (s.match(/\S+/g) ?? []).length;
export const isBullet = (s: string) => BULLET.test(s);
export const stripBullet = (s: string) => s.replace(BULLET, "");
export const cleanHeading = (l: string) => l.replace(/[:\-–_=*#]+$/g, "").replace(/^[#*\s]+/, "").trim();

export type ResumeEntry = { kind: "bullet" | "text"; text: string } | { kind: "role"; text: string; org: string; date: string };
export type ResumeBlock = { key: string; head: string; entries: ResumeEntry[]; chips: string[] };
export type ResumeLayout = { name: string; title: string; contact: string[]; main: ResumeBlock[]; side: ResumeBlock[] };

const MAIN = new Set(["summary", "experience", "projects", "intro"]);
const CONTACT = /@|\d{3}|linkedin|https?:|www\./i;
const DATED = /[,|–—-]?\s*\(?((?:[a-z]{3,9}\.?\s+)?(?:19|20)\d{2}\s*(?:–|—|-|to)\s*(?:(?:[a-z]{3,9}\.?\s+)?(?:19|20)\d{2}|present|current|now|ongoing))\)?\s*$/i;

function sectionOf(line: string): string | null {
  if (wc(line) > 5 || isBullet(line)) return null;
  const clean = cleanHeading(line);
  if (PERSONAL_HEAD.test(clean)) return "personal";
  for (const [k, re] of Object.entries(SECTION_RE)) if (re.test(clean)) return k;
  return null;
}

function entryOf(line: string, key: string): ResumeEntry {
  if (isBullet(line)) return { kind: "bullet", text: stripBullet(line) };
  const dated = line.match(DATED);
  const short = wc(line) <= 12 && line.includes(",") && !/[.!?]$/.test(line);
  if (dated || (key === "experience" && short)) {
    const body = dated ? line.slice(0, dated.index).trim() : line;
    const [role, ...org] = body.split(",");
    return { kind: "role", text: role.trim(), org: org.join(",").trim(), date: dated?.[1] ?? "" };
  }
  return { kind: "text", text: line };
}

// lines: the resume's non-empty lines, in order. Never drops a line: anything unrecognised is kept as plain text.
export function layoutResume(lines: string[]): ResumeLayout {
  const rows = lines.map((l) => l.trim()).filter(Boolean);
  const first = rows.findIndex((l) => sectionOf(l));
  const headRows = first === -1 ? rows.slice(0, 1) : rows.slice(0, first);
  const rest = first === -1 ? rows.slice(1) : rows.slice(first);

  const nameOk = headRows[0] && wc(headRows[0]) <= 6 && !CONTACT.test(headRows[0]);
  const name = nameOk ? headRows[0] : "";
  let title = "";
  const contact: string[] = [];
  const intro: string[] = [];
  headRows.slice(nameOk ? 1 : 0).forEach((l) => {
    if (CONTACT.test(l) && wc(l) <= 14) contact.push(l);
    else if (!title && wc(l) <= 8) title = l;
    else if (wc(l) <= 6 && l.includes(",")) contact.push(l);
    else intro.push(l);
  });

  const blocks: ResumeBlock[] = [];
  if (intro.length) blocks.push({ key: "intro", head: "", entries: intro.map((l) => entryOf(l, "intro")), chips: [] });
  let cur: ResumeBlock | null = null;
  for (const l of rest) {
    const key = sectionOf(l);
    if (key) { cur = { key, head: cleanHeading(l), entries: [], chips: [] }; blocks.push(cur); continue; }
    if (!cur) { cur = { key: "intro", head: "", entries: [], chips: [] }; blocks.push(cur); }
    if (cur.key === "skills") cur.chips.push(...stripBullet(l).split(/[,;•|]/).map((s) => s.trim()).filter(Boolean));
    else cur.entries.push(entryOf(l, cur.key));
  }
  return { name, title, contact, main: blocks.filter((b) => MAIN.has(b.key)), side: blocks.filter((b) => !MAIN.has(b.key)) };
}
