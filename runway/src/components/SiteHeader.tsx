"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, CircleUserRound, Menu } from "lucide-react";
import { useApp } from "./AppProvider";
import { STEPS, forgetProgress } from "./Journey";

export function SiteHeader() {
  const path = usePathname();
  const router = useRouter();
  const { state, view, act, busy } = useApp();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>(".landing-header details[open]").forEach((detail) => { detail.open = false; });
  }, [path]);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 70);
    window.addEventListener("scroll", onScroll, { passive: true });
    const frame = requestAnimationFrame(onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <header className={`landing-header${compact ? " is-compact" : ""}`}>
      <Link href="/" className="landing-brand" aria-label="Jobbery home"><Image src="/cockatiel-ai-icon-v2.png" alt="" width={48} height={48} /><span>Jobbery<span className="landing-brand-dot">.</span></span></Link>
      <nav aria-label="Main navigation" className="landing-nav"><Link href="/about#about">About Us</Link><Link href="/start" aria-current={path === "/start" ? "page" : undefined}>Evaluate Yourself</Link><Link href="/about#statistics">Statistics</Link><Link href="/forecast" aria-current={path === "/forecast" ? "page" : undefined}>Forecast</Link><Link href="/courses" aria-current={path === "/courses" ? "page" : undefined}>Courses</Link></nav>
      <div className="landing-header-end">
        <details className="landing-profile"><summary aria-label="Open profile menu"><CircleUserRound size={22} aria-hidden /><ChevronDown size={14} aria-hidden /></summary><div className="landing-dropdown landing-profile-dropdown">
          {state?.profile ? <><span className="landing-dropdown-caption">{state.profile.name}</span><Link href="/">Your dashboard</Link><Link href="/profile">Your profile</Link></> : <Link href="/start">Create a profile</Link>}
          <span className="landing-dropdown-caption">Your journey</span>
          {STEPS.map((step) => <Link key={step.href} href={step.href} aria-current={step.match.some((match) => path === match || path.startsWith(`${match}/`)) ? "page" : undefined}>{step.label}</Link>)}
          <span className="landing-dropdown-caption">Explore</span>
          <Link href="/market">Prediction market</Link><Link href="/advisor">Meet an advisor</Link><Link href="/counsellor">Advisor view</Link><Link href="/trends">Job market trends</Link><Link href="/trust">Our approach</Link>
          {state?.profile && <button disabled={busy || !view} onClick={async () => { try { sessionStorage.removeItem("runway-onboarding-v2"); } catch { /* ignore */ } forgetProgress(); await act("reset"); router.push("/"); }}>Start over</button>}
        </div></details>
        <details className="landing-mobile-menu"><summary aria-label="Open navigation menu"><Menu size={23} aria-hidden /></summary><nav aria-label="Mobile navigation" className="landing-dropdown"><Link href="/about#about">About Us</Link><Link href="/start" aria-current={path === "/start" ? "page" : undefined}>Evaluate Yourself</Link><Link href="/about#statistics">Statistics</Link><Link href="/forecast" aria-current={path === "/forecast" ? "page" : undefined}>Forecast</Link><Link href="/courses" aria-current={path === "/courses" ? "page" : undefined}>Courses</Link><Link href="/">Your dashboard</Link><Link href="/market">Prediction market</Link><Link href="/advisor">Meet an advisor</Link><Link href="/counsellor">Advisor view</Link></nav></details>
      </div>
    </header>
  );
}
