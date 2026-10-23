"use client";
import "@/app/landing-v2.css";
import "@/app/trends/trends.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "./AppProvider";
import { useT } from "./I18nProvider";
import { StepBar, currentStep } from "./Journey";
import { SiteHeader } from "./SiteHeader";

// The latest real figures are always loaded; the next ones come out on the dates below.
function ReleaseNotice() {
  const { view } = useApp();
  const { t } = useT();
  if (!view) return null;
  return (
    <div className="app-release-notice">
      <span>{t("Job figures up to June 2026 (DOSM, published 18 Aug 2026). Next: 17 Nov 2026.")}</span>
      <Link href="/changes">{t("What the latest figures changed")}</Link>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { state } = useApp();
  const { t } = useT();
  const home = (path === "/" && !state?.profile) || path === "/about";
  const start = path === "/start";
  const courses = path === "/courses";
  const isPublicLayout = home || start || courses;
  const showCareerPattern = path === "/trends" || path === "/forecast" || path === "/market" || path.startsWith("/market/");
  // The step bar belongs to the journey pages only; the forecast game, trends, advisor and the like sit outside it.
  // The dashboard has none: its step cards already show the same five steps.
  const inJourney = currentStep(path) >= 0;

  return (
    <div className={`landing-page public-shell${isPublicLayout ? "" : " app-page-shell"}${showCareerPattern ? " has-career-pattern" : ""}`}>
      <SiteHeader />
      {isPublicLayout ? (
        <main id="main" className={home ? "public-home" : start ? "public-start" : "public-courses"}>{children}</main>
      ) : (
        <>
          {inJourney && <StepBar />}
          <main id="main" className="app-page-main">{children}</main>
          <footer className="app-page-footer">
            <ReleaseNotice />
            <p>{t("Estimates, not certainties. You decide; an advisor is there if you want one. The prediction game uses points, never money, and the other players are computer-made.")}</p>
            <p>{t("SDC Hackathon 2026, Domain 1. Apache-2.0.")} · <Link href="/trends">{t("Job market trends")}</Link> · <Link href="/trust">{t("How we keep this honest")}</Link></p>
          </footer>
        </>
      )}
    </div>
  );
}
