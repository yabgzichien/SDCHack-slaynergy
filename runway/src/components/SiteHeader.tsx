"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, CircleUserRound, Menu } from "lucide-react";

export function SiteHeader() {
  const path = usePathname();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 70);
    window.addEventListener("scroll", onScroll, { passive: true });
    const frame = requestAnimationFrame(onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <header className={`landing-header${compact ? " is-compact" : ""}`}>
      <Link href="/" className="landing-brand" aria-label="Jobbery home"><Image src="/cockatiel-ai-icon-v2.png" alt="" width={48} height={48} /><span>Jobbery<span className="landing-brand-dot">.</span></span></Link>
      <nav aria-label="Main navigation" className="landing-nav"><Link href="/#about">About Us</Link><Link href="/start" aria-current={path === "/start" ? "page" : undefined}>Evaluate Yourself</Link><Link href="/#statistics">Statistics</Link><Link href="/forecast">Forecast</Link><Link href="/courses" aria-current={path === "/courses" ? "page" : undefined}>Courses</Link></nav>
      <div className="landing-header-end">
        <details className="landing-profile"><summary aria-label="Open profile menu"><CircleUserRound size={22} aria-hidden /><ChevronDown size={14} aria-hidden /></summary><div className="landing-dropdown"><Link href="/start">Create a profile</Link><Link href="/start">Evaluate yourself</Link><Link href="/trust">Our approach</Link></div></details>
        <details className="landing-mobile-menu"><summary aria-label="Open navigation menu"><Menu size={23} aria-hidden /></summary><nav aria-label="Mobile navigation" className="landing-dropdown"><Link href="/#about">About Us</Link><Link href="/start" aria-current={path === "/start" ? "page" : undefined}>Evaluate Yourself</Link><Link href="/#statistics">Statistics</Link><Link href="/forecast">Forecast</Link><Link href="/courses" aria-current={path === "/courses" ? "page" : undefined}>Courses</Link></nav></details>
      </div>
    </header>
  );
}
