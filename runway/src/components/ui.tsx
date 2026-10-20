"use client";
import Link from "next/link";
import type { ReactNode } from "react";

export const FUTURE_COLOR: Record<string, string> = { slow: "var(--slow)", medium: "var(--medium)", fast: "var(--fast)" };
export const FUTURE_NAME: Record<string, string> = { slow: "Slow", medium: "Medium", fast: "Fast" };
export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

export function Card({ children, className = "", tone }: { children: ReactNode; className?: string; tone?: "accent" | "demo" | "rise" | "fall" }) {
  const t = tone === "accent" ? "bg-accentsoft border-accent/30" : tone === "demo" ? "bg-demosoft border-demo/30" : tone === "rise" ? "bg-risesoft border-rise/30" : tone === "fall" ? "bg-fallsoft border-fall/30" : "bg-surface border-line";
  return <section className={`card-surface rounded-3xl border p-5 sm:p-6 ${t} ${className}`}>{children}</section>;
}

export function H({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{children}</h2>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function PageTitle({ step, title, children }: { step?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-5">
      {step && <p className="text-xs font-semibold uppercase tracking-wider text-accent">{step}</p>}
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-muted">{children}</p>}
    </header>
  );
}

export function Chip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "accent" | "demo" | "rise" | "fall"; title?: string }) {
  const t = { neutral: "bg-surface2 text-muted", accent: "bg-accentsoft text-accent", demo: "bg-demosoft text-demo", rise: "bg-risesoft text-rise", fall: "bg-fallsoft text-fall" }[tone];
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export const DemoLabel = () => <Chip tone="demo" title="Simulated forecasters are demo data, not real people">Simulated forecasters · demo data</Chip>;

export function SourceChip({ name, date, url }: { name: string; date: string; url?: string }) {
  const inner = <>Source: {name} · {date}</>;
  const cls = "inline-flex max-w-full items-center rounded-md border border-line bg-surface2 px-2 py-0.5 text-xs text-muted";
  return url ? <a href={url} target="_blank" rel="noreferrer" className={`${cls} underline-offset-2 hover:underline`}>{inner}</a> : <span className={cls}>{inner}</span>;
}

export function SdgTag({ target, why }: { target: string; why?: string }) {
  return <span title={why} className="inline-flex items-center rounded-md bg-accentsoft px-2 py-0.5 text-xs font-semibold text-accent">SDG {target}</span>;
}

export function Bar({ value, color = "var(--accent)", label, height = 8 }: { value: number; color?: string; label?: string; height?: number }) {
  return (
    <div className="w-full rounded-full bg-surface2" style={{ height }} role="img" aria-label={label ?? `${Math.round(value * 100)}%`}>
      <div className="bar-fill h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Btn({ children, onClick, href, variant = "primary", disabled, className = "", type = "button" }: {
  children: ReactNode; onClick?: () => void; href?: string; variant?: "primary" | "ghost" | "quiet" | "accent2"; disabled?: boolean; className?: string; type?: "button" | "submit";
}) {
  const v = {
    primary: "bg-accent text-accentink hover:opacity-90",
    accent2: "bg-ink text-bg hover:opacity-90",
    ghost: "border border-line bg-surface text-ink hover:bg-surface2",
    quiet: "text-accent hover:bg-accentsoft",
  }[variant];
  const cls = `press inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

export function FutureBar({ futures, height = 14 }: { futures: { id: string; weight: number }[]; height?: number }) {
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-surface2" style={{ height }} role="img" aria-label={futures.map((f) => `${FUTURE_NAME[f.id]} ${pct(f.weight)}`).join(", ")}>
      {futures.map((f) => (
        <div key={f.id} className="bar-fill" style={{ width: `${f.weight * 100}%`, background: FUTURE_COLOR[f.id] }} />
      ))}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="h-5 rounded bg-surface2" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function Estimate() {
  return <p className="rounded-lg bg-fallsoft px-3 py-2 text-sm text-fall" role="note">These are estimates, not predictions of certainty.</p>;
}
