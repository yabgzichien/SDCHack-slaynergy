"use client";
import "@/app/landing-v2.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "./AppProvider";
import { StepBar } from "./Journey";
import { SiteHeader } from "./SiteHeader";

function ReleaseNotice() {
  const { state, view, act, busy, stage } = useApp();
  if (!view) return null;
  return (
    <div className="app-release-notice">
      <span>Job figures up to {state?.release === 1 ? "June 2026" : "March 2026"}.</span>
      {state?.release === 1 ? (
        <Link href="/changes">See what changed</Link>
      ) : (
        <button onClick={() => void act("release")} disabled={busy || stage > 0}>
          {stage > 0 ? "Updating…" : "Load the new figures"}
        </button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { state } = useApp();
  const home = (path === "/" && !state?.profile) || path === "/about";
  const start = path === "/start";
  const courses = path === "/courses";
  const isPublicLayout = home || start || courses;

  return (
    <div className={`landing-page public-shell${isPublicLayout ? "" : " app-page-shell"}`}>
      <SiteHeader />
      {isPublicLayout ? (
        <main id="main" className={home ? "public-home" : start ? "public-start" : "public-courses"}>{children}</main>
      ) : (
        <>
          <StepBar />
          <main id="main" className="app-page-main">{children}</main>
          <footer className="app-page-footer">
            <ReleaseNotice />
            <p>Estimates, not certainties. You decide; an advisor is there if you want one. The guessing game uses points, never money, and the other players are computer-made.</p>
            <p>SDC Hackathon 2026, Domain 1. Apache-2.0. · <Link href="/trends">Job market trends</Link> · <Link href="/trust">How we keep this honest</Link></p>
          </footer>
        </>
      )}
    </div>
  );
}
