"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { DEFAULT_LANG, LANGS, isLang, translate, type Lang } from "@/lib/i18n";
import { startDomTranslator } from "@/lib/i18n/dom";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (text: string, vars?: Record<string, string | number>) => string };

// The chosen language lives in this browser only, as a tiny external store (same pattern as the journey progress).
const KEY = "jobbery-lang";
const EVT = "jobbery-lang";
const read = (): Lang => { try { const v = localStorage.getItem(KEY); return isLang(v) ? v : DEFAULT_LANG; } catch { return DEFAULT_LANG; } };
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };

const C = createContext<Ctx | null>(null);
export const useT = () => {
  const c = useContext(C);
  if (!c) throw new Error("I18nProvider missing");
  return c;
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, read, () => DEFAULT_LANG);
  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(KEY, l); } catch { /* private mode: the choice lasts until reload */ }
    window.dispatchEvent(new Event(EVT));
  }, []);
  useEffect(() => { document.documentElement.lang = LANGS.find((l) => l.code === lang)?.html ?? "en"; }, [lang]);
  // Text that comes from data or from the engine is translated on the page itself, so it follows the language too.
  const langRef = useRef(lang);
  const dom = useRef<ReturnType<typeof startDomTranslator> | null>(null);
  useEffect(() => {
    langRef.current = lang;
    if (!dom.current) dom.current = startDomTranslator(() => langRef.current);
    else dom.current.retranslateAll();
  }, [lang]);
  useEffect(() => () => { dom.current?.stop(); dom.current = null; }, []);
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (text, vars) => translate(lang, text, vars) }), [lang, setLang]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
