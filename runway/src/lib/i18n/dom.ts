import { DICT, type Lang } from "./index";
import { localizeDates, onlyDates } from "./dates";

// Translates what React has already put on the page, so text that comes from data (job titles, skill names, engine sentences)
// is covered without wrapping every string by hand. Entries use the English text as the key; "{name}" in a key matches any text.
// React keeps its own idea of each text node, so the English original is remembered per node and every change React makes is re-translated.

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const hasLetters = (s: string) => /\p{L}{2,}/u.test(s);

type Pattern = { re: RegExp; names: string[]; out: string; lit: number };
const compiled = new Map<Lang, { exact: Map<string, string>; ci: Map<string, string>; patterns: Pattern[] }>();
function table(lang: Lang) {
  let t = compiled.get(lang);
  if (t) return t;
  const exact = new Map<string, string>();
  const ci = new Map<string, string>();
  const patterns: Pattern[] = [];
  const entries = lang === "en" ? {} : DICT[lang];
  for (const [k, v] of Object.entries(entries)) {
    if (!k.includes("{")) { exact.set(norm(k), v); ci.set(norm(k).toLowerCase(), v); continue; }
    const names: string[] = [];
    const src = norm(k).split(/(\{[#~]?\w+\})/).map((part) => {
      const m = /^\{([#~]?)(\w+)\}$/.exec(part);
      if (m) { names.push(m[2]); return m[1] === "#" ? "([\\d.,:]+)" : m[1] === "~" ? "([\\s\\S]+?)" : "((?:(?![.!?]\\s+[A-Z])[\\s\\S])+?)"; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
    patterns.push({ re: new RegExp(`^${src}$`, "s"), names, out: v, lit: norm(k).replace(/\{[#~]?\w+\}/g, "").length });
  }
  // The pattern with the most fixed text (the most specific) wins; with a tie, the one with fewer blanks.
  patterns.sort((a, b) => b.lit - a.lit || a.names.length - b.names.length);
  t = { exact, ci, patterns };
  compiled.set(lang, t);
  return t;
}

type Miss = (s: string) => void;
const SENTENCE = /(?<=[.!?])\s+(?=[A-Z“"(\d])/;

// Skill names are often lower-cased inside a sentence ("your safest skills: business communication..."), so try the capitalised form too.
export function lookup(lang: Lang, text: string, onMiss?: Miss, depth = 0): string | null {
  const direct = lookupExact(lang, text, onMiss, depth);
  if (direct !== null) return direct;
  const s = norm(text);
  if (/^[a-z]/.test(s)) {
    const up = lookupExact(lang, s[0].toUpperCase() + s.slice(1), onMiss, depth);
    if (up !== null) return /^[A-Za-z]/.test(up) ? up[0].toLowerCase() + up.slice(1) : up;
    // Names written in lower case inside a sentence ("spreadsheets (excel or sheets)").
    const any = lang === "en" ? undefined : table(lang).ci.get(s.toLowerCase());
    if (any !== undefined) return /^[A-Za-z]/.test(any) ? any[0].toLowerCase() + any.slice(1) : any;
  }
  return null;
}

// Join translated sentences the way each language writes them: Chinese runs sentences together, the others use a space.
const joinSentences = (lang: Lang, parts: string[]) => parts.join(lang === "zh" ? "" : " ");

function lookupExact(lang: Lang, text: string, onMiss: Miss | undefined, depth: number): string | null {
  const s = norm(text);
  if (!s || lang === "en" || !hasLetters(s)) return null;
  const t = table(lang);
  const hit = t.exact.get(s);
  if (hit !== undefined) return hit;
  if (onlyDates(lang, s)) return localizeDates(lang, s);
  if (depth > 5) return null;
  for (const p of t.patterns) {
    const m = p.re.exec(s);
    if (!m) continue;
    const vars: Record<string, string> = {};
    p.names.forEach((n, i) => {
      let tr = lookup(lang, m[i + 1], onMiss, depth + 1);
      // The pattern text may have consumed the closing "?" or "." that the stored key still carries.
      if (tr === null) for (const mark of ["?", "."]) {
        const alt = lookup(lang, m[i + 1] + mark, undefined, depth + 1);
        if (alt !== null) { tr = alt.replace(/[?？.。]$/, ""); break; }
      }
      if (tr === null && onMiss && /[A-Za-z]{4,}/.test(m[i + 1])) onMiss("~" + m[i + 1]);
      vars[n] = tr ?? m[i + 1];
    });
    return p.out.replace(/\{(\w+)\}/g, (all, n) => vars[n] ?? all);
  }
  // Composed text: translate it part by part when the parts are known.
  const split = (parts: string[], join: (tr: string[]) => string) => {
    const tr = parts.map((x) => lookup(lang, x, onMiss, depth + 1));
    if (tr.every((x) => x === null)) return null;
    if (onMiss) parts.forEach((x, i) => { if (tr[i] === null && /[A-Za-z]{3,}/.test(x)) onMiss(x); });
    return join(tr.map((x, i) => x ?? parts[i]));
  };
  if (s.includes(" · ")) { const r = split(s.split(" · "), (tr) => tr.join(" · ")); if (r !== null) return r; }
  const sentences = s.split(SENTENCE);
  if (sentences.length > 1) { const r = split(sentences, (tr) => joinSentences(lang, tr)); if (r !== null) return r; }
  // The same text with its closing punctuation stripped ("... in Apr to Jun 2026?").
  const punct = /^([\s\S]*[^.?!:\s])([.?!:])$/.exec(s);
  if (punct) {
    const inner = lookup(lang, punct[1], onMiss, depth + 1);
    if (inner !== null) return inner + (lang === "zh" ? { ".": "。", "?": "？", "!": "！", ":": "：" }[punct[2]] : punct[2]);
  }
  // "<label>, Apr to Jun 2026": a label followed by the quarter it is about.
  const quarter = /^(.+?), ((?:Jan|Apr|Jul|Oct) to (?:Mar|Jun|Sep|Dec) \d{4})$/.exec(s);
  if (quarter) {
    const head = lookup(lang, quarter[1], onMiss, depth + 1);
    if (head !== null) return head + (lang === "zh" ? "，" : ", ") + localizeDates(lang, quarter[2]);
  }
  // A comma list of known items ("transport and storage, wholesale and retail trade"); items may themselves contain commas.
  if (s.includes(", ")) {
    const pieces = s.split(", ");
    const best: (string[] | null)[] = Array(pieces.length + 1).fill(null);
    best[0] = [];
    for (let i = 1; i <= pieces.length; i++) {
      for (let j = 0; j < i && best[i] === null; j++) {
        const prev = best[j];
        if (!prev) continue;
        const tr = t.exact.get(pieces.slice(j, i).join(", "));
        if (tr !== undefined) best[i] = [...prev, tr];
      }
    }
    const done = best[pieces.length];
    if (done && done.length > 1) return done.join(lang === "zh" ? "、" : ", ");
  }
  // "a and b" where a and b are known names that may themselves contain "and".
  if (s.includes(" and ")) {
    const pieces = s.split(" and ");
    const get = (x: string) => {
      const hit = t.exact.get(x) ?? (/^[a-z]/.test(x) ? t.ci.get(x.toLowerCase()) : undefined);
      if (hit === undefined) return undefined;
      return /^[a-z]/.test(x) && /^[A-Za-z]/.test(hit) ? hit[0].toLowerCase() + hit.slice(1) : hit;
    };
    const best: (string[] | null)[] = Array(pieces.length + 1).fill(null);
    best[0] = [];
    for (let i = 1; i <= pieces.length; i++) {
      for (let j = 0; j < i && best[i] === null; j++) {
        const prev = best[j];
        if (!prev) continue;
        const tr = get(pieces.slice(j, i).join(" and "));
        if (tr !== undefined) best[i] = [...prev, tr];
      }
    }
    const done = best[pieces.length];
    if (done && done.length > 1) return done.join(lang === "zh" ? "和" : lang === "ms" ? " dan " : " மற்றும் ");
  }
  if (s.includes("; ")) { const r = split(s.split("; "), (tr) => tr.join(lang === "zh" ? "；" : "; ")); if (r !== null) return r; }
  return null;
}

type NodeState = { orig: string; written: string | null };
const textState = new WeakMap<Text, NodeState>();
const attrState = new WeakMap<Element, Map<string, NodeState>>();
const missing = new Set<string>();
const produced = new Set<string>();
const report = (x: string) => { if (isMissing(x)) missing.add(norm(x)); };
const isMissing = (s: string) => !produced.has(norm(s)) && /[A-Za-z]{3,}/.test(s);

// The English value of a node, whoever wrote the current content.
function original(n: Text | { value: string } , st: NodeState | undefined, current: string): NodeState {
  if (st && st.written !== null && st.written === current) return st;
  return { orig: current, written: null };
}

const skipped = (el: Element | null) => !el || noTranslate(el) || el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT";

function applyText(el: Element, lang: Lang) {
  // Runs of text nodes between elements form one sentence (React splits "About {n} hours" into several nodes).
  // The empty comment nodes React leaves between adjacent text on server-rendered pages do not break a run.
  const groups: Text[][] = [];
  let run: Text[] = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) run.push(n as Text);
    else if (n.nodeType !== Node.COMMENT_NODE) { if (run.length) groups.push(run); run = []; }
  }
  if (run.length) groups.push(run);
  for (const group of groups) {
    const states = group.map((n) => { const s = original(n, textState.get(n), n.nodeValue ?? ""); textState.set(n, s); return s; });
    const english = states.map((s) => s.orig).join("");
    const tr = lookup(lang, english, report);
    if (tr !== null) produced.add(norm(tr));
    else if (lang !== "en" && isMissing(english)) missing.add(norm(english));
    const lead = english.match(/^\s*/)?.[0] ?? "";
    const trail = english.match(/\s*$/)?.[0] ?? "";
    group.forEach((n, i) => {
      const want = tr === null ? states[i].orig : i === 0 ? lead + tr + (tr.endsWith(" ") ? "" : trail) : "";
      if (n.nodeValue !== want) n.nodeValue = want;
      states[i].written = tr === null ? null : want;
    });
  }
}

function applyAttrs(el: Element, lang: Lang) {
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null) continue;
    let map = attrState.get(el);
    if (!map) { map = new Map(); attrState.set(el, map); }
    const st = original({ value: cur }, map.get(a), cur);
    const tr = lookup(lang, st.orig, report);
    if (tr !== null) produced.add(norm(tr));
    else if (lang !== "en" && isMissing(st.orig)) missing.add(norm(st.orig));
    const want = tr ?? st.orig;
    if (cur !== want) el.setAttribute(a, want);
    map.set(a, { orig: st.orig, written: tr === null ? null : want });
  }
}

// Form fields and code keep their contents (the person typed them), but their placeholders and labels are ours.
const TEXT_SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
const noTranslate = (el: Element) => !!el.closest("[data-no-translate],[translate=no],[contenteditable=true]");
function applyElement(el: Element, lang: Lang) {
  if (noTranslate(el)) return;
  if (!TEXT_SKIP.has(el.tagName)) applyText(el, lang);
  if (el.tagName !== "SCRIPT" && el.tagName !== "STYLE") applyAttrs(el, lang);
}

function applyTree(root: Element, lang: Lang) {
  if (skipped(root)) return;
  applyElement(root, lang);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => skipped(n as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) applyElement(n as Element, lang);
}

const titleOrig = { value: "" };
function applyTitle(lang: Lang) {
  if (!titleOrig.value || document.title !== (lookup(lang, titleOrig.value) ?? titleOrig.value)) titleOrig.value = document.title;
  const want = lookup(lang, titleOrig.value) ?? titleOrig.value;
  if (document.title !== want) document.title = want;
}

export function startDomTranslator(getLang: () => Lang) {
  let frame = 0;
  const pending = new Set<Element>();
  let full = true;
  const flush = () => {
    frame = 0;
    const lang = getLang();
    if (full) { full = false; pending.clear(); applyTree(document.body, lang); }
    else { const els = Array.from(pending); pending.clear(); for (const el of els) if (el.isConnected) applyTree(el, lang); }
    applyTitle(lang);
  };
  const schedule = () => { if (!frame) frame = window.setTimeout(flush, 16); };
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") { if (r.target.parentElement) pending.add(r.target.parentElement); }
      else if (r.type === "attributes") pending.add(r.target as Element);
      else { pending.add(r.target as Element); }
    }
    schedule();
  });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  const retranslateAll = () => { full = true; schedule(); };
  (window as unknown as { __i18n: unknown }).__i18n = { missing: () => Array.from(missing).filter((m) => !produced.has(m)).sort(), clear: () => missing.clear() };
  retranslateAll();
  return { retranslateAll, stop: () => { mo.disconnect(); clearTimeout(frame); } };
}
