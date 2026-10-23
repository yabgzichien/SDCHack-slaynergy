import { ms } from "./ms";
import { zh } from "./zh";
import { ta } from "./ta";
import { ROWS } from "./rows";

export type Lang = "en" | "ms" | "zh" | "ta";
export const LANGS: { code: Lang; label: string; html: string }[] = [
  { code: "en", label: "English", html: "en" },
  { code: "ms", label: "Bahasa Malaysia", html: "ms" },
  { code: "zh", label: "中文", html: "zh-Hans" },
  { code: "ta", label: "தமிழ்", html: "ta" },
];
export const DEFAULT_LANG: Lang = "en";
export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);

// English text is the key, so a string with no translation yet simply stays in English.
export type Row = [en: string, ms: string, zh: string, ta: string];
const merge = (base: Record<string, string>, col: 1 | 2 | 3): Record<string, string> => {
  const out = { ...base };
  for (const r of ROWS) out[r[0]] = r[col];
  return out;
};
export const DICT: Record<Exclude<Lang, "en">, Record<string, string>> = { ms: merge(ms, 1), zh: merge(zh, 2), ta: merge(ta, 3) };

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  const out = lang === "en" ? text : DICT[lang][text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}
