"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "./AppProvider";

type Item = { href: string; label: string; match?: string[]; needsProfile?: boolean; count?: number };

const JOURNEY: Item[] = [
  { href: "/start", label: "You", match: ["/start", "/resume", "/profile"] },
  { href: "/skills", label: "Your skills", needsProfile: true },
  { href: "/forecast", label: "The forecast", match: ["/forecast", "/futures"] },
  { href: "/jobs", label: "Jobs", match: ["/jobs", "/goals"], needsProfile: true },
  { href: "/plan", label: "Your plan", needsProfile: true },
];
const FORECASTING: Item[] = [
  { href: "/market", label: "Prediction market" },
  { href: "/leaderboard", label: "Leaderboard" },
];
const MORE: Item[] = [
  { href: "/trends", label: "Job market trends", match: ["/trends", "/radar"] },
  { href: "/counsellor", label: "Counsellor view" },
  { href: "/trust", label: "How we keep this honest" },
];

// Runway's mark: a runway seen from above, its centre line dashed.
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="1.5" width="14" height="21" rx="3" fill="var(--ink)" />
      <path d="M12 4.5v3M12 10.5v3M12 16.5v3" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function isActive(path: string, it: Item) {
  return (it.match ?? [it.href]).some((m) => path === m || path.startsWith(`${m}/`));
}

function NavList({ title, items, path, hasProfile, onPick }: { title?: string; items: Item[]; path: string; hasProfile: boolean; onPick?: () => void }) {
  return (
    <div>
      {title && <p className="mb-1.5 mt-7 px-3 text-[13px] text-muted">{title}</p>}
      <ul className="space-y-0.5">
        {items.map((it) => {
          const active = isActive(path, it);
          const locked = it.needsProfile && !hasProfile;
          const cls = "flex min-h-9 items-center justify-between gap-2 rounded-xl px-3 text-sm";
          return (
            <li key={it.href}>
              {locked ? (
                <span className={`${cls} text-muted/60`} aria-disabled="true" title="Answer the first questions to open this">{it.label}</span>
              ) : (
                <Link href={it.href} onClick={onPick} aria-current={active ? "page" : undefined}
                  className={`press ${cls} ${active ? "bg-surface2 font-medium text-ink" : "text-ink/80 hover:bg-surface"}`}>
                  <span>{it.label}</span>
                  {it.count ? <span className="num rounded-full bg-accentsoft px-2 text-xs text-accent">{it.count}</span> : null}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReleaseBox({ onPick }: { onPick?: () => void }) {
  const { state, view, act, busy, stage } = useApp();
  const released = state?.release === 1;
  return (
    <div className="rounded-2xl bg-surface p-3">
      <p className="text-[13px] text-muted">Data as of</p>
      <p className="text-sm">{released ? "DOSM 2026 Q2, published 18 Aug 2026" : "DOSM 2026 Q1. The 2026 Q2 release is held back."}</p>
      {!released ? (
        <button onClick={async () => { onPick?.(); await act("release"); }} disabled={busy || stage > 0 || !view}
          className="press mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primaryink disabled:opacity-40"
          title="Load the real DOSM 2026 Q2 release that the app held back, and watch the forecasts update">
          {stage > 0 ? "Updating…" : "Release the new data"}
        </button>
      ) : (
        <Link href="/changes" onClick={onPick} className="press mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-surface2 px-4 text-sm font-medium hover:bg-control/60">
          See what changed
        </Link>
      )}
    </div>
  );
}

function SidebarBody({ onPick }: { onPick?: () => void }) {
  const { state, view, act, busy } = useApp();
  const path = usePathname();
  const router = useRouter();
  const p = state?.profile;
  const hasProfile = !!p;
  const changes = view?.changes?.length ?? 0;
  const more = changes ? [{ href: "/changes", label: "What changed", count: changes }, ...MORE] : MORE;
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onPick} className="flex items-center gap-2.5 px-3 pt-1 text-lg font-semibold"><Mark /> Runway</Link>
      <p className="mt-1 px-3 text-[13px] text-muted">{p ? `${p.name}${p.synthetic ? ", made-up profile" : ""}` : "No profile yet"}</p>
      <NavList title="Your plan" items={JOURNEY} path={path} hasProfile={hasProfile} onPick={onPick} />
      <NavList title="Forecasting" items={FORECASTING} path={path} hasProfile={hasProfile} onPick={onPick} />
      <NavList title="More" items={more} path={path} hasProfile={hasProfile} onPick={onPick} />
      <div className="mt-auto space-y-2 pt-8">
        <ReleaseBox onPick={onPick} />
        <button onClick={async () => { onPick?.(); await act("reset"); router.push("/"); }} disabled={busy || !view}
          className="press min-h-9 w-full rounded-xl px-3 text-left text-sm text-muted hover:bg-surface hover:text-ink">Start over</button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const title = [...JOURNEY, ...FORECASTING, ...MORE].find((it) => isActive(path, it))?.label ?? "Runway";
  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 overflow-y-auto px-3 py-6 lg:block" aria-label="Main">
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-bg px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="press -ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface" aria-label="Open menu" aria-expanded={open}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <Link href="/" className="flex items-center gap-2 font-semibold"><Mark size={20} /></Link>
        <p className="min-w-0 flex-1 truncate text-sm">{title}</p>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-bg px-4 py-4 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button onClick={() => setOpen(false)} className="press absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface" aria-label="Close menu">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
          <div className="h-full overflow-y-auto pb-6"><SidebarBody onPick={() => setOpen(false)} /></div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-8 sm:px-8 lg:pt-14">{children}</main>
        <footer className="mx-auto max-w-[1100px] px-4 pb-10 text-sm text-muted sm:px-8">
          <p>Estimates, not predictions of certainty. You choose; a counsellor reviews and approves. Points only, never money. Forecasters shown are simulated demo data.</p>
          <p className="mt-1">SDC Hackathon 2026, Domain 1. Apache-2.0. <Link href="/trust" className="underline decoration-control underline-offset-2 hover:text-ink">How we keep this honest</Link></p>
        </footer>
      </div>
    </div>
  );
}
