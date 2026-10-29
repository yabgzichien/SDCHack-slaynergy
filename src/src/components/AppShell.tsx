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
import { series } from "@/lib/engine/data";

// The latest real figures are always loaded (the server refreshes them by itself); the next ones come out below.
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTH_SHORT[m - 1]} ${y}`; };
function ReleaseNotice() {
  const { view } = useApp();
  const { t } = useT();
  if (!view) return null;
  const q = view.world.asOfQuarter, pub = series.dosm.publishedAt[q], next = view.world.nextAnswers.dosm;
  const upTo = `${FULL_MONTHS[Number(q[5]) * 3 - 1]} ${q.slice(0, 4)}`;
  // Plain English: the page translator fills the blanks and localises the dates in them.
  const line = `${pub ? `Job figures up to ${upTo} (DOSM, published ${dayOf(pub)}).` : `Job figures up to ${upTo} (DOSM).`} ${next ? `Next: ${dayOf(next)}.` : "Next: DOSM's next release."}`;
  return (
    <div className="app-release-notice">
      <span>{line}</span>
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
  const isPublicLayout = home || start;
  // The step bar belongs to the journey pages only; the forecast game, trends, advisor and the like sit outside it.
  // The dashboard has none: its step cards already show the same five steps.
  const inJourney = currentStep(path) >= 0;

  return (
    <div className={`landing-page public-shell${isPublicLayout ? "" : " app-page-shell"}`}>
      <SiteHeader />
      {isPublicLayout ? (
        <main id="main" className={home ? "public-home" : "public-start"}>{children}</main>
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
