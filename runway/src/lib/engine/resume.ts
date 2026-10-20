import kw from "../../../data/skill-keywords.json";
import { occupations, skills, skillById, type Education } from "./data";
import { expiryFor, NOW } from "./expiry";
import type { Weights3 } from "./futures";

// Rule-based resume scanner. No AI model, no network, nothing stored: the text lives only in memory for the request.
// Everything it says points at a line you wrote or a rule you can read below.

export type Severity = "fix" | "improve" | "good";
export type Line = { n: number; text: string; flags: ("weak" | "number" | "long" | "personal" | "strong")[] };
export type Finding = {
  id: string; area: string; severity: Severity; title: string; why: string; fix: string;
  evidence?: { n: number; text: string }[]; example?: { before: string; after: string }; points: { got: number; of: number };
};
export type DetectedSkill = { id: string; name: string; hits: string[]; shelf: "fading" | "lasting" | "mid"; expires: number };
export type ResumeAnalysis = {
  score: number; band: "strong" | "good" | "needs work"; headline: string;
  parts: { key: string; label: string; got: number; of: number }[];
  words: number; sections: string[]; contact: { email: boolean; phone: boolean; linkedin: boolean };
  occupation: { id: string; title: string; confident: boolean } | null; years: number | null; education: Education | null;
  skills: DetectedSkill[]; inferred: { id: string; name: string }[];
  futureReadiness: { fading: number; lasting: number; mid: number; hasAiTools: boolean; note: string };
  findings: Finding[]; lines: Line[];
};
export type ResumeSummary = {
  score: number; band: string; scannedAt: string; occupationId: string | null; years: number | null;
  skillIds: string[]; parts: { key: string; label: string; got: number; of: number }[];
  findings: { id: string; severity: Severity; title: string; fix: string }[];
  fadingShare: number; hasAiTools: boolean;
};

const KEYWORDS = kw as Record<string, string[]>;
const SECTION_RE: Record<string, RegExp> = {
  summary: /^(professional\s+)?(summary|profile|objective|about me|career objective)\b/i,
  experience: /^(work(ing)?\s+)?(experience|history)|^employment|^career history|^professional experience/i,
  education: /^(education|qualifications?|academic)/i,
  skills: /^(technical\s+|key\s+|core\s+)?(skills|competenc)/i,
  projects: /^projects?\b/i,
  certifications: /^(certifications?|training|courses|licen[cs]es)/i,
  other: /^(languages?|references?|referees?|achievements?|awards?|interests?|volunteer)/i,
};
const WEAK = /\b(responsible for|duties (included|include)|in charge of|worked on|helped (with|to)|assisted (with|in)|tasked with|involved in|handled various|various tasks)\b/i;
const STRONG = new Set("processed reconciled reduced increased improved led built created designed automated analysed analyzed prepared managed delivered resolved streamlined trained negotiated audited implemented developed coordinated monitored achieved launched saved cut verified reviewed maintained cleared issued settled investigated recovered approved disbursed onboarded standardised standardized introduced migrated documented compiled tracked supported".split(" "));
const GERUND: Record<string, string> = {
  processing: "Processed", preparing: "Prepared", handling: "Handled", maintaining: "Maintained", reconciling: "Reconciled", managing: "Managed",
  updating: "Updated", checking: "Checked", monitoring: "Monitored", coordinating: "Coordinated", issuing: "Issued", entering: "Entered",
  verifying: "Verified", reviewing: "Reviewed", answering: "Answered", assisting: "Supported", keying: "Keyed in", recording: "Recorded",
  collecting: "Collected", approving: "Approved", filing: "Filed", scheduling: "Scheduled", responding: "Responded to", ensuring: "Ensured",
};
const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const DATE_RANGE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2})\s*(?:–|—|-|to)\s*(?:((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2})|(present|current|now|ongoing))/gi;
const OCC_WORDS: Record<string, string[]> = {
  bank_ops: ["bank operations", "banking operations", "operations executive", "bank executive"],
  ap_ar_clerk: ["accounts payable", "accounts receivable", "ap clerk", "ar clerk", "accounts clerk", "account clerk"],
  bookkeeper: ["bookkeeper", "book-keeper", "bookkeeping"],
  data_entry: ["data entry"],
  payroll_clerk: ["payroll"],
  bank_teller: ["teller"],
  admin_assistant: ["administrative assistant", "admin assistant", "admin executive", "secretary", "office administrator", "admin clerk"],
  loan_clerk: ["loan processing", "loan officer", "loan clerk", "credit clerk", "loan executive", "financing executive"],
  collections: ["collection officer", "collections officer", "debt collector", "credit control", "collections executive"],
  qa_tester: ["software tester", "qa engineer", "quality assurance engineer", "test engineer", "qa analyst"],
  software_dev: ["software developer", "software engineer", "programmer", "full stack", "backend developer", "web developer", "frontend developer"],
  it_support_job: ["it support", "helpdesk", "help desk", "technical support"],
  civil_eng_job: ["civil engineer", "site engineer", "structural engineer"],
  mech_eng_job: ["mechanical engineer"],
  elec_eng_job: ["electrical engineer", "electronics engineer", "e&e engineer"],
  qaqc_exec: ["qa/qc", "quality executive", "quality control", "quality assurance executive", "qc inspector", "qc executive"],
  lab_analyst: ["lab analyst", "chemist", "laboratory analyst", "lab technician", "chemical analyst"],
  retail_job: ["retail", "sales assistant", "cashier", "store assistant"],
  hotel_job: ["front desk", "hotel", "guest service", "reservation"],
  warehouse_job: ["warehouse", "logistics clerk", "storekeeper", "store keeper", "inventory clerk"],
  cs_exec: ["customer service executive", "customer service officer", "call centre", "contact centre"],
};

const wc = (s: string) => (s.match(/\S+/g) ?? []).length;
const isBullet = (s: string) => /^([-•*–·▪●◦]|\d+[.)])\s+/.test(s);
const stripBullet = (s: string) => s.replace(/^([-•*–·▪●◦]|\d+[.)])\s+/, "");
const clip = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function monthsOf(text: string): number | null {
  const spans: [number, number][] = [];
  const nowM = Math.floor(NOW) * 12 + 9;
  for (const m of text.matchAll(DATE_RANGE)) {
    const sm = m[1] ? Math.max(0, MONTHS.indexOf(m[1].trim().slice(0, 3).toLowerCase())) : 0;
    const start = Number(m[2]) * 12 + sm;
    let end: number;
    if (m[5]) end = nowM;
    else end = Number(m[4]) * 12 + (m[3] ? Math.max(0, MONTHS.indexOf(m[3].trim().slice(0, 3).toLowerCase())) : 11);
    if (end > start && end - start < 12 * 45) spans.push([start, end]);
  }
  if (!spans.length) return null;
  spans.sort((a, b) => a[0] - b[0]);
  let total = 0, [cs, ce] = spans[0];
  for (const [s, e] of spans.slice(1)) {
    if (s <= ce) ce = Math.max(ce, e);
    else { total += ce - cs; cs = s; ce = e; }
  }
  return total + (ce - cs);
}

export function analyseResume(raw: string, weights: Weights3): ResumeAnalysis {
  const text = raw.replace(/\r/g, "").replace(/\t/g, " ").slice(0, 60000);
  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  const words = wc(text);

  // ---- sections ----
  const sections: string[] = [];
  const sectionOfLine: string[] = [];
  let cur = "header";
  rawLines.forEach((l) => {
    const short = wc(l) <= 5 && !isBullet(l);
    if (short) {
      const clean = l.replace(/[:\-–_=*#]+$/g, "").replace(/^[#*\s]+/, "").trim();
      for (const [k, re] of Object.entries(SECTION_RE)) {
        if (re.test(clean)) { cur = k; if (!sections.includes(k)) sections.push(k); break; }
      }
    }
    sectionOfLine.push(cur);
  });

  // ---- contact and personal details ----
  const contact = { email: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text), phone: /(\+?6?0\d{1,2}[\s-]?\d{3,4}[\s-]?\d{3,4})|(\+?\d[\d\s-]{8,})/.test(text), linkedin: /linkedin\.com\/in\//i.test(text) };
  const personalRe = /\b(\d{6}-?\d{2}-?\d{4})\b|\b(date of birth|dob|marital status|religion|gender|race|ethnicity|nationality|age\s*:)\b/i;

  // ---- bullets ----
  const lines: Line[] = rawLines.map((t, i) => ({ n: i + 1, text: t, flags: [] }));
  const bullets = lines.filter((l, i) => (isBullet(l.text) || (sectionOfLine[i] === "experience" && wc(l.text) >= 7 && !DATE_RANGE.test(l.text))) && wc(l.text) >= 4);
  DATE_RANGE.lastIndex = 0;
  let quantified = 0, strong = 0, longCount = 0;
  const weakLines: Line[] = [], plainLines: Line[] = [], longLines: Line[] = [];
  for (const b of bullets) {
    const body = stripBullet(b.text);
    const first = body.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    const hasNum = /\d|%|\bRM\b/i.test(body);
    const isWeak = WEAK.test(body);
    if (hasNum) { quantified++; b.flags.push("number"); } else plainLines.push(b);
    if ((STRONG.has(first) || /^[a-z]{3,}ed$/.test(first) || ["led", "ran", "built", "cut", "key", "keyed"].includes(first)) && !isWeak) { strong++; b.flags.push("strong"); }
    if (isWeak) { b.flags.push("weak"); weakLines.push(b); }
    if (wc(body) > 28) { longCount++; b.flags.push("long"); longLines.push(b); }
  }
  lines.forEach((l, i) => { if (personalRe.test(l.text) && sectionOfLine[i] !== "experience") l.flags.push("personal"); });
  const personalLines = lines.filter((l) => l.flags.includes("personal"));
  const nb = Math.max(1, bullets.length);

  // ---- skills ----
  const detected: DetectedSkill[] = [];
  const padded = ` ${lower.replace(/[^a-z0-9&+#./\- ]/g, " ")} `;
  for (const s of skills) {
    const hits = (KEYWORDS[s.id] ?? []).filter((k) => padded.includes(k.includes(" ") || k.length > 3 ? k : ` ${k.trim()} `) || (k.endsWith(" ") && padded.includes(k)) || (k.startsWith(" ") && padded.includes(k)));
    if (!hits.length) continue;
    const e = expiryFor(s.id, weights);
    const shelf: DetectedSkill["shelf"] = e.durable || e.expected > NOW + 8 ? "lasting" : e.expected < NOW + 5 ? "fading" : "mid";
    detected.push({ id: s.id, name: s.name, hits: [...new Set(hits.map((h) => h.trim()))].slice(0, 3), shelf, expires: e.expected });
  }
  detected.sort((a, b) => a.expires - b.expires);

  // ---- occupation ----
  const headText = rawLines.slice(0, Math.max(12, Math.floor(rawLines.length * 0.5))).join("\n").toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const [id, ws] of Object.entries(OCC_WORDS)) {
    let sc = 0;
    for (const w of ws) { if (headText.includes(w)) sc += 3; if (lower.includes(w)) sc += 1; }
    if (sc > 0 && (!best || sc > best.score)) best = { id, score: sc };
  }
  if (!best) {
    for (const o of occupations) {
      const ov = o.skills.filter((s) => detected.some((d) => d.id === s)).length / o.skills.length;
      if (ov > 0 && (!best || ov * 3 > best.score)) best = { id: o.id, score: ov * 3 };
    }
  }
  const occ = best ? occupations.find((o) => o.id === best!.id)! : null;
  const inferred = occ ? occ.skills.filter((s) => !detected.some((d) => d.id === s)).map((id) => ({ id, name: skillById[id].name })) : [];

  const expText = rawLines.filter((_, i) => sectionOfLine[i] === "experience").join("\n");
  const education: Education | null =
    /\b(ph\.?d|doctorate|doktor falsafah)\b/i.test(text) ? "phd"
    : /\b(master'?s?|m\.?sc|mba|m\.?eng|sarjana(?! muda))\b/i.test(text) ? "master"
    : /\b(bachelor|b\.?eng|b\.?sc|b\.?a\b|degree|ijazah|sarjana muda)\b/i.test(text) ? "degree"
    : /\bdiploma\b/i.test(text) ? "diploma"
    : /\b(stpm|matriculation|matrikulasi|foundation|asasi|a-levels?)\b/i.test(text) ? "stpm"
    : /\b(skm|sijil kemahiran)\b/i.test(text) ? "skm"
    : /\b(spm|sijil|certificate)\b/i.test(text) ? "spm" : null;
  const months = monthsOf(expText || text);
  const years = months === null ? null : Math.round((months / 12) * 2) / 2;

  const fading = detected.filter((d) => d.shelf === "fading").length;
  const lasting = detected.filter((d) => d.shelf === "lasting").length;
  const mid = detected.length - fading - lasting;
  const hasAi = detected.some((d) => d.id === "ai_tools");

  // ---- scoring ----
  const parts: ResumeAnalysis["parts"] = [];
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "points">, got: number, of: number) => findings.push({ ...f, points: { got: Math.round(got * 10) / 10, of } });
  const part = (key: string, label: string, got: number, of: number) => parts.push({ key, label, got: Math.round(got * 10) / 10, of });

  // structure 15
  const hasExp = sections.includes("experience"), hasEdu = sections.includes("education"), hasSk = sections.includes("skills"), hasSum = sections.includes("summary");
  const structure = (hasExp ? 6 : 0) + (hasEdu ? 3 : 0) + (hasSk ? 3 : 0) + (hasSum ? 3 : 0);
  part("structure", "Clear sections", structure, 15);
  const missing = [!hasExp && "Work experience", !hasEdu && "Education", !hasSk && "Skills", !hasSum && "Summary"].filter(Boolean) as string[];
  add({ id: "structure", area: "Structure", severity: missing.length >= 2 || !hasExp ? "fix" : missing.length ? "improve" : "good",
    title: missing.length ? `Add clear section headings: ${missing.join(", ")}` : "Your sections are easy to find",
    why: "Recruiters and the software many employers use to sort applications look for standard headings. Missing ones can hide your experience.",
    fix: missing.length ? `Add a heading for each: ${missing.join(", ")}. Keep them on their own line, for example "Work Experience".` : "Keep these headings." }, structure, 15);

  // contact 8
  const cs = (contact.email ? 4 : 0) + (contact.phone ? 4 : 0);
  part("contact", "Contact details", cs, 8);
  add({ id: "contact", area: "Contact", severity: cs < 8 ? "fix" : "good",
    title: cs < 8 ? `Add your ${[!contact.email && "email", !contact.phone && "phone number"].filter(Boolean).join(" and ")}` : "Email and phone are present",
    why: "If an employer cannot reach you in one step, they move on.", fix: "Put your email and a phone number you answer at the top, in plain text (not inside an image)." }, cs, 8);

  // impact 22
  const fracQ = quantified / nb;
  const impact = bullets.length ? 22 * Math.min(1, fracQ / 0.5) : 0;
  part("impact", "Results with numbers", impact, 22);
  add({ id: "impact", area: "Impact", severity: fracQ < 0.25 ? "fix" : fracQ < 0.5 ? "improve" : "good",
    title: bullets.length === 0 ? "Describe your work in short bullet points" : fracQ >= 0.5 ? "Many bullets show results with numbers" : `Only ${quantified} of ${bullets.length} bullets include a number`,
    why: "Numbers show scale and make your work easy to compare. 'Processed invoices' says little; '120 invoices a week' says a lot.",
    fix: "Add how many, how often, how much time or money, or how accurate. Use only real figures; an honest estimate such as 'about 50' is fine.",
    evidence: plainLines.slice(0, 3).map((l) => ({ n: l.n, text: clip(l.text) })),
    example: (() => { const l = plainLines.find((x) => !x.flags.includes("weak")) ?? plainLines[0]; return l ? { before: clip(stripBullet(l.text), 90), after: `${clip(stripBullet(l.text).replace(/[.;]$/, ""), 80)} ([how many / how often / how much saved])` } : undefined; })() }, impact, 22);

  // verbs 15
  const fracS = strong / nb;
  const verbs = bullets.length ? Math.max(0, 15 * Math.min(1, fracS / 0.6) - 1.5 * weakLines.length) : 0;
  part("verbs", "Strong action words", verbs, 15);
  const w0 = weakLines[0];
  const wBody = w0 ? stripBullet(w0.text) : "";
  const gm = wBody.match(/(responsible for|in charge of|tasked with|involved in|assisted (?:with|in)|helped (?:with|to)|worked on|duties (?:included|include))\s+(\w+ing)\b\s*(.*)/i);
  const pastOf = (g: string) => GERUND[g.toLowerCase()] ?? g.charAt(0).toUpperCase() + g.slice(1).replace(/ing$/, "ed");
  const converted = gm ? `${pastOf(gm[2])} ${gm[3]}`.replace(/\band (\w+ing)\b/gi, (_m, g: string) => `and ${pastOf(g).toLowerCase()}`).replace(/[.;]$/, "") : null;
  add({ id: "verbs", area: "Wording", severity: weakLines.length >= 2 || fracS < 0.3 ? "fix" : fracS < 0.6 ? "improve" : "good",
    title: weakLines.length ? `${weakLines.length} bullet${weakLines.length > 1 ? "s" : ""} start with weak phrases like 'responsible for'` : fracS >= 0.6 ? "Bullets start with strong action words" : "Start more bullets with an action word",
    why: "Phrases like 'responsible for' describe a job title. Action words describe what you actually did.",
    fix: "Begin each bullet with a past-tense verb: Processed, Reconciled, Reduced, Prepared, Resolved, Trained.",
    evidence: weakLines.slice(0, 3).map((l) => ({ n: l.n, text: clip(l.text) })),
    example: converted ? { before: clip(wBody, 90), after: `${clip(converted, 80)} ([add a number])` } : undefined }, verbs, 15);

  // concision 10
  const lenOk = words >= 250 && words <= 700 ? 6 : words >= 150 && words <= 900 ? 3 : 0;
  const shortFrac = 1 - longCount / nb;
  const concise = lenOk + 4 * (bullets.length ? shortFrac : 0);
  part("concise", "Length and clarity", concise, 10);
  add({ id: "concise", area: "Length", severity: words < 150 || words > 900 ? "fix" : words < 250 || words > 700 || longCount > 2 ? "improve" : "good",
    title: words < 250 ? `Your resume is short (${words} words)` : words > 700 ? `Your resume is long (${words} words)` : longCount > 2 ? `${longCount} bullets are longer than 28 words` : `Good length (${words} words)`,
    why: "Most hiring managers skim for under a minute. One page (about 250 to 700 words) is enough for under ten years of experience.",
    fix: words < 250 ? "Add 2 or 3 bullets for each job describing what you did and the result." : words > 700 ? "Cut older or less relevant detail. Keep the last 10 years." : "Split long bullets into two shorter ones.",
    evidence: longLines.slice(0, 2).map((l) => ({ n: l.n, text: clip(l.text) })) }, concise, 10);

  // skills 12
  const skillPts = Math.min(1, detected.length / 6) * 8 + (hasSk ? 4 : 0);
  part("skills", "Skills a recruiter can find", skillPts, 12);
  add({ id: "skills", area: "Skills", severity: detected.length < 3 || !hasSk ? "fix" : detected.length < 6 ? "improve" : "good",
    title: !hasSk ? "Add a Skills section" : detected.length < 6 ? `We could find ${detected.length} skills; name more tools and methods` : `We found ${detected.length} skills`,
    why: "Employers search for exact words such as 'Excel', 'SQL', 'reconciliation' or 'AutoCount'. If a skill is not written, it does not exist for the search.",
    fix: "List the software and methods you really use, one per item, in a Skills section.", }, skillPts, 12);

  // future readiness 18
  const dur = detected.length ? lasting / detected.length : 0;
  const future = 18 * (0.6 * Math.min(1, dur / 0.4) + 0.4 * (hasAi ? 1 : 0));
  part("future", "Ready for AI-era jobs", future, 18);
  const fadeNames = detected.filter((d) => d.shelf === "fading").map((d) => d.name);
  add({ id: "future", area: "Future-readiness", severity: !hasAi && dur < 0.25 ? "fix" : !hasAi || dur < 0.4 ? "improve" : "good",
    title: !hasAi ? "Show that you can work alongside AI tools" : dur < 0.4 ? "Your resume leans on skills that AI is expected to take over first" : "Your resume shows skills that should last",
    why: `Most of what we found (${fading} of ${detected.length || 0}) ${fading ? "is expected to be automated within about 5 years" : "looks durable"}. Employers hiring now look for people who check and direct AI, not only do routine work.`,
    fix: `${fadeNames.length ? `Keep ${fadeNames.slice(0, 2).join(" and ").toLowerCase()} but put your judgment first: reviewing, exceptions, customers, controls. ` : ""}Add a line such as 'Used [tool you really use] to draft and check [task], then verified results.' Only add it if it is true.` }, future, 18);

  // personal details (no points; privacy and fairness)
  if (personalLines.length) {
    add({ id: "personal", area: "Privacy", severity: "improve", title: "Remove personal details you do not need",
      why: "ID numbers, date of birth, marital status, religion and similar details add risk and are not needed to judge your skills. Good employers do not need them. Runway never uses them.",
      fix: "Delete these lines. Keep your name, phone, email and city.",
      evidence: personalLines.slice(0, 3).map((l) => ({ n: l.n, text: clip(l.text.replace(/\d{6}-?\d{2}-?\d{4}/g, "[ID number hidden]")) })) }, 0, 0);
  }

  const score = Math.round(parts.reduce((a, p) => a + p.got, 0));
  const band = score >= 75 ? "strong" : score >= 55 ? "good" : "needs work";
  const order = { fix: 0, improve: 1, good: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity] || (b.points.of - b.points.got) - (a.points.of - a.points.got));
  const top = findings.filter((f) => f.severity === "fix")[0] ?? findings.filter((f) => f.severity === "improve")[0];
  const headline = score >= 75 ? "A strong resume. A few polish items remain." : top ? `Start here: ${top.title.charAt(0).toLowerCase()}${top.title.slice(1)}.` : "A solid base to build on.";

  return {
    score, band, headline, parts, words, sections, contact,
    occupation: occ ? { id: occ.id, title: occ.title, confident: !!best && best.score >= 3 } : null, years, education,
    skills: detected, inferred,
    futureReadiness: { fading, lasting, mid, hasAiTools: hasAi, note: detected.length ? `${lasting} lasting, ${mid} medium, ${fading} fading` : "No skills detected yet" },
    findings, lines,
  };
}

// What is kept in the session: no resume text and no line evidence, only scores and your confirmed facts.
export function summarise(a: ResumeAnalysis): ResumeSummary {
  return {
    score: a.score, band: a.band, scannedAt: new Date().toISOString(), occupationId: a.occupation?.id ?? null, years: a.years,
    skillIds: a.skills.map((s) => s.id), parts: a.parts,
    findings: a.findings.filter((f) => f.severity !== "good").map((f) => ({ id: f.id, severity: f.severity, title: f.title, fix: f.fix })),
    fadingShare: a.skills.length ? a.futureReadiness.fading / a.skills.length : 0, hasAiTools: a.futureReadiness.hasAiTools,
  };
}

// Words to add to a resume for a chosen role (only if the person truly has the skill).
export function tailorTips(skillIdsOnResume: string[], roleSkills: Record<string, number>) {
  const have = new Set(skillIdsOnResume);
  const rows = Object.entries(roleSkills).map(([id, imp]) => ({ id, name: skillById[id].name, importance: imp, onResume: have.has(id), keywords: (KEYWORDS[id] ?? []).slice(0, 3).map((k) => k.trim()) }));
  const covered = rows.filter((r) => r.onResume).reduce((a, r) => a + r.importance, 0);
  const total = rows.reduce((a, r) => a + r.importance, 0);
  return { match: total ? covered / total : 0, rows: rows.sort((a, b) => Number(a.onResume) - Number(b.onResume) || b.importance - a.importance) };
}

export { SAMPLE_RESUME } from "../sample-resume";
