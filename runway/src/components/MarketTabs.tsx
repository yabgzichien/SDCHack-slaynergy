"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The forecasting section has three sibling pages: the questions you can predict, who predicts best, and where the answers come from.
const TABS = [
  { href: "/market", label: "Questions" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/sources", label: "Data sources" },
];

export function MarketTabs({ rank }: { rank?: string | null }) {
  const path = usePathname();
  return (
    <nav aria-label="Forecasting" className="mb-3 flex w-fit rounded-2xl bg-surface2 p-1">
      {TABS.map((t) => {
        const on = path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={`press inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold sm:px-4 ${on ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}>
            {t.label}
            {t.href === "/leaderboard" && rank && <span className="num rounded-full bg-accentsoft px-2 text-xs font-medium text-accent">{rank}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
