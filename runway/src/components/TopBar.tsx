"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "./AppProvider";

const STEPS = [
  { href: "/start", match: ["/start", "/resume", "/profile"], label: "You" },
  { href: "/skills", match: ["/skills"], label: "Skills" },
  { href: "/jobs", match: ["/jobs"], label: "Jobs" },
  { href: "/plan", match: ["/plan"], label: "Plan" },
];

export function TopBar() {
  const { state, view, act, busy, stage } = useApp();
  const path = usePathname();
  const router = useRouter();
  const hasProfile = !!state?.profile;
  const released = state?.release === 1;
  const home = path === "/";
  return (
    <header className="glass z-30 sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <Link href="/" className="order-1 flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span aria-hidden className="inline-block h-6 w-6 rounded-lg bg-accent" /> Runway
        </Link>

        {!home && (
          <nav aria-label="Steps" className="scroll-x order-4 w-full md:order-2 md:w-auto md:flex-1 md:px-4">
            <ol className="flex gap-1 md:justify-center">
              {STEPS.map((s, i) => {
                const active = s.match.includes(path);
                const locked = !hasProfile && i > 0;
                const cls = "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium";
                return (
                  <li key={s.href}>
                    {locked ? <span className={`${cls} text-muted/50`} aria-disabled="true"><span className="text-xs">{i + 1}</span>{s.label}</span> : (
                      <Link href={s.href} aria-current={active ? "step" : undefined} className={`press ${cls} ${active ? "bg-ink text-bg" : "text-ink hover:bg-surface2"}`}>
                        <span className="text-xs opacity-60">{i + 1}</span>{s.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <div className="order-3 ml-auto flex items-center gap-2 md:order-3">
          <button onClick={async () => { await act("release"); }} disabled={busy || released || stage > 0 || !view}
            title="Load the real DOSM 2026 Q2 release that the app held back, and watch the forecasts update"
            className="press inline-flex min-h-10 items-center gap-2 rounded-full bg-fast px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="New data released: load the real held-back DOSM 2026 Q2 release">
            <span aria-hidden className={released ? "" : "animate-pulse"}>●</span>
            <span>{released ? "Data released" : stage > 0 ? "Updating…" : "New data released"}</span>
          </button>
          <details className="relative">
            <summary className="press flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-surface px-3 text-sm font-medium" aria-label="More">•••</summary>
            <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-xl">
              <p className="px-3 py-2 text-xs text-muted">Data as of: {view?.world.asOfLabel ?? "…"}</p>
              <MenuLink href="/futures">Forecasts: how sure are we?</MenuLink>
              <MenuLink href="/counsellor">Counsellor view</MenuLink>
              <MenuLink href="/trust">How we keep this honest</MenuLink>
              <button onClick={async () => { await act("reset"); router.push("/"); }} disabled={busy || !view}
                className="press flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-surface2">Start over</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="press flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-surface2">{children}</Link>;
}
