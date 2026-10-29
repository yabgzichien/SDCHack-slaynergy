import type { Lang } from "./index";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Names = { mon: string[]; monFull: string[]; day: string[]; dayFull: string[]; range: (a: string, b: string, y: string) => string; monthYear: (m: number, name: string, y: string) => string; dayMonth: (d: string, m: number, name: string) => string };
const NAMES: Record<Exclude<Lang, "en">, Names> = {
  ms: {
    mon: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
    monFull: ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"],
    day: ["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"],
    dayFull: ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"],
    range: (a, b, y) => `${a} hingga ${b} ${y}`,
    monthYear: (_m, n, y) => `${n} ${y}`,
    dayMonth: (d, _m, n) => `${d} ${n}`,
  },
  zh: {
    mon: MON.map((_, i) => `${i + 1}月`), monFull: MON.map((_, i) => `${i + 1}月`),
    day: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    dayFull: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    range: (a, b, y) => `${y}年${a}至${b}`,
    monthYear: (m, _n, y) => `${y}年${m + 1}月`,
    dayMonth: (d, m) => `${m + 1}月${d}日`,
  },
  ta: {
    mon: ["ஜன.", "பிப்.", "மார்.", "ஏப்.", "மே", "ஜூன்", "ஜூலை", "ஆக.", "செப்.", "அக்.", "நவ.", "டிச."],
    monFull: ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"],
    day: ["திங்.", "செவ்.", "புத.", "வியா.", "வெள்.", "சனி", "ஞாயி."],
    dayFull: ["திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி", "ஞாயிறு"],
    range: (a, b, y) => `${y} ${a} முதல் ${b} வரை`,
    monthYear: (_m, n, y) => `${n} ${y}`,
    dayMonth: (d, _m, n) => `${d} ${n}`,
  },
};

const monRe = `(${[...MON_FULL, ...MON].join("|")})`;
const monIndex = (w: string) => { const i = MON_FULL.indexOf(w); return i >= 0 ? i : MON.indexOf(w); };
const isFull = (w: string) => MON_FULL.includes(w);
const dayRe = `(${[...DAY_FULL, ...DAY].join("|")})`;

// Month, weekday and date words that sit next to a number: "Apr 2030", "Oct to Dec 2026", "22 Oct", "Thu 22 October".
export function localizeDates(lang: Lang, s: string): string {
  if (lang === "en") return s;
  const N = NAMES[lang];
  const name = (w: string) => (isFull(w) ? N.monFull : N.mon)[monIndex(w)];
  let out = s;
  out = out.replace(new RegExp(`\\b${monRe} to ${monRe} (\\d{4})\\b`, "g"), (_m, a, b, y) => N.range(name(a), name(b), y));
  out = out.replace(new RegExp(`\\b${monRe} (\\d{4})\\b`, "g"), (_m, a, y) => N.monthYear(monIndex(a), name(a), y));
  out = out.replace(new RegExp(`\\b(\\d{1,2}) ${monRe}\\b`, "g"), (_m, d, a) => N.dayMonth(d, monIndex(a), name(a)));
  out = out.replace(new RegExp(`\\b${dayRe}(?= \\d)`, "g"), (_m, w) => (DAY_FULL.includes(w) ? N.dayFull[DAY_FULL.indexOf(w)] : N.day[DAY.indexOf(w)]));
  return out;
}

// True when what is left after the dates are localised has no words, so the whole string is just a date or number.
const WORDS = new RegExp(`\\b(${[...MON_FULL, ...MON, ...DAY_FULL, ...DAY, "to"].join("|")})\\b`, "g");
export const onlyDates = (lang: Lang, s: string) => localizeDates(lang, s) !== s && !/[A-Za-z]{2,}/.test(s.replace(WORDS, ""));
