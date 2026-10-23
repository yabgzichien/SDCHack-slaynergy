"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, CircleUserRound, Menu } from "lucide-react";
import { useApp } from "./AppProvider";
import { useT } from "./I18nProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { STEPS, forgetProgress } from "./Journey";

export function SiteHeader() {
  const path = usePathname();
  const router = useRouter();
  const { state, view, act, busy } = useApp();
  const { t } = useT();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>(".landing-header details[open]").forEach((detail) => { detail.open = false; });
  }, [path]);
  useEffect(() => {
    // Hysteresis: shrinking the header changes page height, so one threshold would flip back and forth.
    const onScroll = () => setCompact((c) => (c ? window.scrollY > 24 : window.scrollY > 110));
    window.addEventListener("scroll", onScroll, { passive: true });
    const frame = requestAnimationFrame(onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <header className={`landing-header${compact ? " is-compact" : ""}`}>
      <Link href="/" className="landing-brand" aria-label={t("Jobbery home")}><Image src="/cockatiel-ai-icon-v2.png" alt="" width={48} height={48} /><span>Jobbery<span className="landing-brand-dot">.</span></span></Link>
      <nav aria-label={t("Main navigation")} className="landing-nav"><Link href="/trends" aria-current={path === "/trends" ? "page" : undefined}>{t("Statistics")}</Link><Link href="/market" aria-current={path === "/market" ? "page" : undefined}>{t("Forecast")}</Link><Link href="/courses" aria-current={path === "/courses" ? "page" : undefined}>{t("Courses")}</Link></nav>
      <div className="landing-header-end">
        <LanguageSwitcher />
        <details className="landing-profile"><summary aria-label={t("Open profile menu")}><CircleUserRound size={22} aria-hidden /><ChevronDown size={14} aria-hidden /></summary><div className="landing-dropdown landing-profile-dropdown">
          {state?.profile ? <><span className="landing-dropdown-caption">{state.profile.name}</span><Link href="/">{t("Your dashboard")}</Link><Link href="/profile">{t("Your profile")}</Link></> : <Link href="/start">{t("Create a profile")}</Link>}
          <span className="landing-dropdown-caption">{t("Your journey")}</span>
          {STEPS.map((step) => <Link key={step.href} href={step.href} aria-current={step.match.some((match) => path === match || path.startsWith(`${match}/`)) ? "page" : undefined}>{t(step.label)}</Link>)}
          <span className="landing-dropdown-caption">{t("Explore")}</span>
          <Link href="/market">{t("Prediction market")}</Link><Link href="/advisor">{t("Meet an advisor")}</Link><Link href="/counsellor">{t("Advisor view")}</Link><Link href="/trends">{t("Job market trends")}</Link><Link href="/trust">{t("Our approach")}</Link>
          {state?.profile && <button disabled={busy || !view} onClick={async () => { try { sessionStorage.removeItem("runway-onboarding-v2"); } catch { /* ignore */ } forgetProgress(); await act("reset"); router.push("/"); }}>{t("Start over")}</button>}
        </div></details>
        <details className="landing-mobile-menu"><summary aria-label={t("Open navigation menu")}><Menu size={23} aria-hidden /></summary><nav aria-label={t("Mobile navigation")} className="landing-dropdown"><Link href="/trends" aria-current={path === "/trends" ? "page" : undefined}>{t("Statistics")}</Link><Link href="/market" aria-current={path === "/market" ? "page" : undefined}>{t("Forecast")}</Link><Link href="/courses" aria-current={path === "/courses" ? "page" : undefined}>{t("Courses")}</Link><Link href="/">{t("Your dashboard")}</Link><Link href="/market">{t("Prediction market")}</Link><Link href="/advisor">{t("Meet an advisor")}</Link><Link href="/counsellor">{t("Advisor view")}</Link></nav></details>
      </div>
    </header>
  );
}
