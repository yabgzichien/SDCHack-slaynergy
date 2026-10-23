"use client";
import { Globe } from "lucide-react";
import { LANGS, isLang } from "@/lib/i18n";
import { useT } from "./I18nProvider";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useT();
  return (
    <label className="landing-lang" data-no-translate>
      <Globe size={17} aria-hidden />
      <span className="sr-only">{t("Language")}</span>
      <select value={lang} onChange={(e) => { if (isLang(e.target.value)) setLang(e.target.value); }}>
        {LANGS.map((l) => <option key={l.code} value={l.code} lang={l.html}>{l.label}</option>)}
      </select>
    </label>
  );
}
