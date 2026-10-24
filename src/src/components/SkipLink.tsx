"use client";
import { useT } from "./I18nProvider";

export function SkipLink() {
  const { t } = useT();
  return <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">{t("Skip to content")}</a>;
}
