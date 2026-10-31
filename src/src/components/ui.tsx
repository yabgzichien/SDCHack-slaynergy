"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { sdgColor, sdgUrl } from "@/components/SdgIcon";

export const FUTURE_COLOR: Record<string, string> = { slow: "var(--slow)", medium: "var(--medium)", fast: "var(--fast)" };
export const FUTURE_NAME: Record<string, string> = { slow: "Slow", medium: "Medium", fast: "Fast" };
// What each forecast question measures, in everyday words. Keyed by the question id's prefix (dosm-2026Q2, swe-2026Q2, ...).
export const QUESTION_PLAIN: Record<string, string> = {
  dosm: "How many Malaysian job ads are for office admin jobs",
  metr: "How long a task AI can finish on its own",
  swe: "How well AI fixes real software bugs",
  hle: "How well AI answers expert-level questions",
  tbench: "How well AI handles everyday computer tasks",
};
export const questionPlain = (eventId: string) => QUESTION_PLAIN[eventId.split("-")[0]] ?? null;
// The three futures in everyday words. The model's exact settings stay in each future's own blurb.
export const FUTURE_PLAIN: Record<string, string> = {
  slow: "AI improves more slowly than lately, and companies are slow to use it. Office work changes gradually.",
  medium: "AI keeps improving at its recent pace, and companies follow. Routine office tasks shrink steadily.",
  fast: "AI improves faster than lately, and companies rush to use it. Routine office tasks shrink quickly.",
};
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTH_SHORT[m - 1]} ${y}`; };
// When the open questions get their answers, in one sentence (both dates come from the data).
export function nextAnswersLine(n: { dosm: string | null; epoch: string | null }) {
  const jobs = n.dosm ? `Malaysia’s job figures arrive on ${dayOf(n.dosm)}.` : "Malaysia’s job figures arrive with DOSM’s next release.";
  return n.epoch ? `${jobs} AI results are checked from ${dayOf(n.epoch)}.` : jobs;
}
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
      <Tag className="section-heading text-base font-semibold">{children}</Tag>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </div>
  );
}

// The screen's title: one serif sentence that answers the screen's question, with one plain line under it.
export function PageTitle({ title, children, aside, compact = false }: { step?: string; title: ReactNode; children?: ReactNode; aside?: ReactNode; compact?: boolean }) {
  return (
    <header className={`${compact ? "mb-4" : "mb-8"} flex max-w-full flex-wrap items-end justify-between gap-4`}>
      <div className="min-w-0 max-w-full flex-1 basis-[32rem] sm:max-w-3xl">
        <h1 className={`greeting max-w-full [overflow-wrap:anywhere] [text-wrap:balance] ${compact ? "text-[1.5rem] sm:text-[2rem]" : "text-[1.75rem] sm:text-[2.75rem]"}`}>{title}</h1>
        {children && <p className={`${compact ? "mt-1.5 text-sm" : "mt-3 text-base"} text-muted`}>{children}</p>}
      </div>
      {aside}
    </header>
  );
}

export function Chip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "accent" | "demo" | "rise" | "fall" | "negative" | "cue"; title?: string }) {
  const t = { neutral: "bg-surface2 text-ink", accent: "bg-accentsoft text-accent", demo: "bg-surface2 text-demo", rise: "bg-risesoft text-rise", fall: "bg-fallsoft text-fall", negative: "bg-fallsoft text-negative", cue: "bg-cue text-white" }[tone];
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export const DemoLabel = () => <Chip tone="demo" title="The other players are made by the computer for this demo, not real people">Other players are computer-made (demo)</Chip>;

export function SourceChip({ name, date, url }: { name: string; date: string; url?: string }) {
  const inner = <>Source: {name}, {date}</>;
  const cls = "inline-flex max-w-full items-center text-xs text-muted underline decoration-control underline-offset-2";
  return url ? <a href={url} target="_blank" rel="noreferrer" className={`${cls} hover:text-ink`}>{inner}</a> : <span className="text-xs text-muted">{inner}</span>;
}

// Short names for the 17 UN Sustainable Development Goals used in goal details.
export const SDG_SHORT: Record<string, string> = {
  "1": "No poverty", "2": "Zero hunger", "3": "Good health", "4": "Quality education", "5": "Gender equality", "6": "Clean water",
  "7": "Clean energy", "8": "Decent work", "9": "Industry and innovation", "10": "Fewer inequalities", "11": "Sustainable cities",
  "12": "Responsible consumption", "13": "Climate action", "14": "Life below water", "15": "Life on land", "16": "Peace and justice", "17": "Partnerships",
};
export const sdgName = (target: string) => SDG_SHORT[target.split(".")[0]] ?? `Goal ${target}`;

// Keep the chip concise; the exact UN target number sits in the tooltip and the accessible name.
// It links to the UN's own page for the goal; highlight draws it in the goal's colour (the person chose that goal).
export function SdgTag({ target, why, highlight }: { target: string; why?: string; highlight?: boolean }) {
  const goal = target.split(".")[0];
  const tip = `UN Sustainable Development Goal ${goal}, target ${target}${why ? `. ${why}` : ""}`;
  return (
    <a href={sdgUrl(Number(goal))} target="_blank" rel="noreferrer" title={tip} aria-label={tip} onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium hover:underline ${highlight ? "text-white" : "bg-accentsoft text-accentink"}`}
      style={highlight ? { background: sdgColor(Number(goal)) } : undefined}>
      UN goal {goal}<ExternalLink size={11} strokeWidth={2} aria-hidden />
    </a>
  );
}

// Detail most people can skip: the method, the formula, the source codes. Closed by default.
export function More({ summary = "How we worked this out", children, className = "" }: { summary?: string; children: ReactNode; className?: string }) {
  return (
    <details className={`group mt-3 text-sm ${className}`}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-muted underline decoration-control underline-offset-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="transition-transform group-open:rotate-90"><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {summary}
      </summary>
      <div className="mt-2 space-y-2 text-muted">{children}</div>
    </details>
  );
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
    <div className="animate-pulse space-y-3" role="status" aria-busy="true" aria-label="Loading">
      <p className="text-sm text-muted">Loading…</p>
      <div className="h-10 w-2/3 rounded-full bg-surface2" />
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="h-5 rounded-full bg-surface2" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function Estimate() {
  return <p className="text-sm text-muted" role="note">These are estimates, not certainties.</p>;
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

// A numbered stop on a page that is read in order (the Jobs page: best job, other matches, where). The current stop is
// filled, so a first-time visitor sees where to start.
export function Stop({ n, title, sub, current = false, id, children }: { n: number; title: string; sub?: ReactNode; current?: boolean; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-3.5">
        <span aria-hidden className={`num grid size-10 shrink-0 place-items-center rounded-full text-base font-bold ${current ? "bg-cue text-white" : "border-2 border-control text-ink"}`}>{n}</span>
        <div>
          <h2 className="text-xl font-bold leading-tight sm:text-2xl"><span className="sr-only">Step {n}: </span>{title}</h2>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// A native select, styled: rounded, roomy, a chevron, and an amber focus ring. Native keeps it accessible on phones.
export function Select({ value, onChange, disabled, children, label, small = false }: { value: string; onChange: (v: string) => void; disabled?: boolean; children: ReactNode; label?: string; small?: boolean }) {
  return (
    <span className={`relative block ${small ? "" : "mt-1.5"}`}>
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className={`${small ? "min-h-9 rounded-full pl-3 pr-9 text-sm" : "min-h-12 rounded-2xl pl-4 pr-11 text-base"} w-full cursor-pointer appearance-none border border-control bg-raised py-1 font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-colors hover:border-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cue disabled:opacity-50`}>
        {children}
      </select>
      <svg aria-hidden width="18" height="18" viewBox="0 0 20 20" className={`pointer-events-none absolute ${small ? "right-3" : "right-4"} top-1/2 -translate-y-1/2 text-muted`}><path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}
