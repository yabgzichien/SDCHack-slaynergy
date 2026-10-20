"use client";
import Link from "next/link";
import type { ReactNode } from "react";

export const FUTURE_COLOR: Record<string, string> = { slow: "var(--slow)", medium: "var(--medium)", fast: "var(--fast)" };
export const FUTURE_NAME: Record<string, string> = { slow: "Slow", medium: "Medium", fast: "Fast" };
export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

// A tonal panel: one step off the white ground, no border, no shadow. tone="raised" is the one white card on a screen.
export function Card({ children, className = "", tone, as: As = "section" }: { children: ReactNode; className?: string; tone?: "accent" | "demo" | "rise" | "fall" | "raised"; as?: "section" | "div" | "li" | "article" }) {
  const t = tone === "accent" ? "bg-accentsoft" : tone === "rise" ? "bg-risesoft" : tone === "fall" ? "bg-fallsoft" : tone === "raised" ? "bg-raised border border-line" : "bg-surface";
  return <As className={`rounded-[22px] p-5 sm:p-6 ${t} ${className}`}>{children}</As>;
}

export function H({ children, sub, level = 2 }: { children: ReactNode; sub?: ReactNode; level?: 2 | 3 }) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-3">
      <Tag className="text-base font-semibold">{children}</Tag>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

// The screen's title: one serif sentence that answers the screen's question, with one plain line under it.
export function PageTitle({ title, children, aside }: { step?: string; title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="greeting text-[1.75rem] sm:text-[2.75rem]">{title}</h1>
        {children && <p className="mt-3 text-base text-muted">{children}</p>}
      </div>
      {aside}
    </header>
  );
}

export function Chip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "accent" | "demo" | "rise" | "fall" | "negative"; title?: string }) {
  const t = { neutral: "bg-surface2 text-ink", accent: "bg-accentsoft text-accent", demo: "bg-surface2 text-demo", rise: "bg-risesoft text-rise", fall: "bg-fallsoft text-fall", negative: "bg-fallsoft text-negative" }[tone];
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export const DemoLabel = () => <Chip tone="demo" title="Simulated forecasters are demo data, not real people">Simulated forecasters, demo data</Chip>;

export function SourceChip({ name, date, url }: { name: string; date: string; url?: string }) {
  const inner = <>Source: {name}, {date}</>;
  const cls = "inline-flex max-w-full items-center text-xs text-muted underline decoration-control underline-offset-2";
  return url ? <a href={url} target="_blank" rel="noreferrer" className={`${cls} hover:text-ink`}>{inner}</a> : <span className="text-xs text-muted">{inner}</span>;
}

export function SdgTag({ target, why }: { target: string; why?: string }) {
  return <span title={why} className="inline-flex items-center rounded-full bg-accentsoft px-2.5 py-0.5 text-xs font-medium text-accent">SDG {target}</span>;
}

export function Bar({ value, color = "var(--accent)", label, height = 6 }: { value: number; color?: string; label?: string; height?: number }) {
  return (
    <div className="w-full rounded-full bg-surface2" style={{ height }} role="img" aria-label={label ?? `${Math.round(value * 100)}%`}>
      <div className="bar-fill h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Btn({ children, onClick, href, variant = "primary", disabled, className = "", type = "button", autoFocus }: {
  children: ReactNode; onClick?: () => void; href?: string; variant?: "primary" | "ghost" | "quiet" | "accent2"; disabled?: boolean; className?: string; type?: "button" | "submit"; autoFocus?: boolean;
}) {
  const v = {
    primary: "bg-primary text-primaryink hover:opacity-90",
    accent2: "bg-primary text-primaryink hover:opacity-90",
    ghost: "bg-surface2 text-ink hover:bg-control/60",
    quiet: "text-ink underline decoration-control underline-offset-4 hover:decoration-ink",
  }[variant];
  const size = variant === "quiet" ? "min-h-11 px-1" : "min-h-11 px-5";
  const cls = `press inline-flex items-center justify-center gap-2 rounded-full ${size} text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} autoFocus={autoFocus} className={cls}>{children}</button>;
}

export function FutureBar({ futures, height = 12 }: { futures: { id: string; weight: number }[]; height?: number }) {
  return (
    <div className="flex w-full gap-0.5 overflow-hidden rounded-full" style={{ height }} role="img" aria-label={futures.map((f) => `${FUTURE_NAME[f.id]} ${pct(f.weight)}`).join(", ")}>
      {futures.map((f) => <div key={f.id} className="bar-fill" style={{ width: `${f.weight * 100}%`, background: FUTURE_COLOR[f.id] }} />)}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-2/3 rounded-full bg-surface" />
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="h-5 rounded-full bg-surface" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function Estimate() {
  return <p className="text-sm text-muted" role="note">These are estimates, not predictions of certainty.</p>;
}

// "Next" row at the foot of a screen: one way back, one way on.
export function NextRow({ back, next, nextLabel, disabled }: { back?: string; next?: string; nextLabel?: string; disabled?: boolean }) {
  return (
    <nav className="mt-10 flex items-center justify-between gap-3" aria-label="Page navigation">
      {back ? <Btn href={back} variant="quiet">Back</Btn> : <span />}
      {next && (disabled ? <Btn disabled>{nextLabel ?? "Next"}</Btn> : <Btn href={next}>{nextLabel ?? "Next"}</Btn>)}
    </nav>
  );
}

// A row that links somewhere, for lists inside a panel.
export function LinkRow({ href, children, aside }: { href: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Link href={href} className="press flex min-h-[63px] items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-3 hover:bg-surface2">
      <div className="min-w-0">{children}</div>
      {aside && <div className="shrink-0 text-right">{aside}</div>}
    </Link>
  );
}

export function Stat({ label, value, caption, href }: { label: string; value: ReactNode; caption?: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="num mt-2 text-[1.75rem] leading-tight">{value}</p>
      {caption && <p className="mt-1 text-sm text-muted">{caption}</p>}
    </>
  );
  return href
    ? <Link href={href} className="press block min-h-32 rounded-[22px] bg-surface p-4 hover:bg-surface2">{body}</Link>
    : <div className="min-h-32 rounded-[22px] bg-surface p-4">{body}</div>;
}
