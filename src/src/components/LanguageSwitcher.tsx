"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LANGS, isLang } from "@/lib/i18n";
import { useT } from "./I18nProvider";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div className="lang-picker" ref={box} data-no-translate>
      <button type="button" className="lang-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={t("Language")} onClick={() => setOpen((o) => !o)}>
        <Globe size={17} aria-hidden /><span lang={current.html}>{current.label}</span><ChevronDown size={14} aria-hidden className="lang-chevron" />
      </button>
      {open && (
        <ul className="lang-menu" role="listbox" aria-label={t("Language")}>
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button type="button" lang={l.html} className={l.code === lang ? "is-active" : undefined} onClick={() => { if (isLang(l.code)) setLang(l.code); setOpen(false); }}>
                <span>{l.label}</span>{l.code === lang && <Check size={15} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
