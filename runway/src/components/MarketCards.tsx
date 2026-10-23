"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Briefcase, Bug, Check, ChevronLeft, ChevronRight, GraduationCap, Lock, Terminal, Timer, X, type LucideIcon } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventView, StrikeView } from "@/lib/engine/world";
import { Chip } from "./ui";

// Market cards: each question is one event with three answers (easier to harder), each with its own
// chance and colour. The colours are shared with the question page so a line means the same thing everywhere.
export const STRIKE_COLORS = ["#3b82f6", "#a855f7", "#f59e0b"];

const TOPIC: Record<string, { icon: LucideIcon; tag: string; tint: string }> = {
  dosm: { icon: Briefcase, tag: "Malaysia jobs", tint: "#0ea5e9" },
  swe: { icon: Bug, tag: "AI ability", tint: "#8b5cf6" },
  tbench: { icon: Terminal, tag: "AI ability", tint: "#6366f1" },
  hle: { icon: GraduationCap, tag: "AI ability", tint: "#ec4899" },
  metr: { icon: Timer, tag: "AI ability", tint: "#14b8a6" },
};
export const topicOf = (eventId: string) => TOPIC[eventId.split("-")[0]] ?? { icon: Briefcase, tag: "Question", tint: "#64748b" };

export function EventIcon({ eventId, size = 40 }: { eventId: string; size?: number }) {
  const t = topicOf(eventId);
  const Icon = t.icon;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl text-white" style={{ width: size, height: size, background: `linear-gradient(135deg, ${t.tint}, ${t.tint}bb)` }} aria-hidden>
      <Icon size={size * 0.5} strokeWidth={1.9} />
    </span>
  );
}

const yesOf = (s: StrikeView) => (s.settled ? (s.settled.outcome ? 1 : 0) : s.price);

function OddsPill({ s }: { s: StrikeView }) {
  if (s.settled) return <Chip tone={s.settled.outcome ? "rise" : "fall"}>{s.settled.outcome ? "Yes" : "No"}</Chip>;
  return <span className="num inline-flex min-w-[4.5rem] items-center justify-center rounded-xl border border-rise/60 px-3 py-1.5 text-base font-medium text-rise">{Math.round(s.price * 100)}%</span>;
}

function OptionRow({ s, i, compact }: { s: StrikeView; i: number; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className={`leading-snug ${compact ? "text-sm" : ""}`}>{s.label}</p>
        <div className="mt-1 h-0.5 rounded-full" style={{ width: `${Math.max(6, yesOf(s) * 100)}%`, background: STRIKE_COLORS[i] }} aria-hidden />
      </div>
      <OddsPill s={s} />
    </div>
  );
}

// A pulsing green dot: this question is still open for predictions.
export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-risesoft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-rise">
      <span className="relative flex size-2" aria-hidden><span className="absolute inline-flex size-full rounded-full bg-rise opacity-60 motion-safe:animate-ping" /><span className="relative inline-flex size-2 rounded-full bg-rise" /></span>Live
    </span>
  );
}
// Grey "answered" label for questions the official numbers have already settled.
export function AnsweredBadge() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#5b6575] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white"><Lock size={11} aria-hidden />Answered</span>;
}
// The result of a settled question, as a stamp instead of a 0% or 100%.
export function AnswerStamp({ yes, big }: { yes: boolean; big?: boolean }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-xl border-2 font-bold uppercase tracking-wide ${big ? "px-4 py-2 text-lg" : "px-3 py-1 text-sm"} ${yes ? "border-rise text-rise" : "border-fall text-fall"}`}>
      {yes ? <Check size={big ? 20 : 16} strokeWidth={3} aria-hidden /> : <X size={big ? 20 : 16} strokeWidth={3} aria-hidden />}The answer was {yes ? "Yes" : "No"}
    </p>
  );
}

// One card per question. Open ones are bright with a LIVE badge (amber ring if you have not predicted yet);
// answered ones are grey with the result stamped on, so nobody reads a settled 0% as a live market.
export function MarketCard({ e }: { e: EventView }) {
  const held = e.strikes.some((s) => s.position.yes > 1e-6 || s.position.no > 1e-6);
  const main = e.strikes[1] ?? e.strikes[0];
  const href = `/market/${encodeURIComponent(e.id)}`;
  if (e.settled) {
    const pnl = e.strikes.reduce((a, s) => a + (s.settled?.pnl ?? 0), 0);
    return (
      <Link href={href} className="press flex h-full flex-col rounded-[22px] border border-[#cfd6df] bg-[#eef1f5] p-5 text-[#3c4655] hover:bg-[#e6eaf0]">
        <div className="flex items-center justify-between gap-2"><AnsweredBadge /><span className="text-xs text-[#6b7686]">{topicOf(e.id).tag}</span></div>
        <div className="mt-3 flex items-start gap-3">
          <span className="grayscale"><EventIcon eventId={e.id} size={36} /></span>
          <p className="min-w-0 font-medium leading-snug">{e.title}</p>
        </div>
        <p className="mt-2 text-sm">{main.label}</p>
        <div className="mt-3"><AnswerStamp yes={!!main.settled?.outcome} /></div>
        {e.fact && <p className="num mt-3 text-xs">{e.fact}</p>}
        <p className="mt-auto pt-4 text-xs text-[#6b7686]">{held ? `Your result: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(0)} points` : "Closed. No more predictions."}</p>
      </Link>
    );
  }
  return (
    <Link href={href} className={`press flex h-full flex-col rounded-[22px] bg-raised p-5 shadow-[0_1px_3px_rgb(0_0_0/0.06)] hover:bg-surface ${held ? "border border-line" : "ring-2 ring-cue"}`}>
      <div className="flex items-center justify-between gap-2">
        <LiveBadge />
        {held ? <span className="text-xs font-medium text-rise">You predicted here</span> : <span className="rounded-full bg-cuesoft px-2 py-0.5 text-xs font-semibold text-cueink">Not predicted yet</span>}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <EventIcon eventId={e.id} size={36} />
        <div className="min-w-0"><p className="font-medium leading-snug">{e.title}</p><p className="text-xs text-muted">{topicOf(e.id).tag}</p></div>
      </div>
      <p className="mt-3 text-sm">{main.label}?</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p><span className="num text-3xl font-semibold leading-none">{Math.round(main.price * 100)}%</span> <span className="text-sm text-muted">think Yes</span></p>
        <span className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-primary px-4 text-sm font-medium text-primaryink">Make a prediction <ChevronRight size={16} aria-hidden /></span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2" aria-hidden><div className="h-full rounded-full bg-rise" style={{ width: `${Math.round(main.price * 100)}%` }} /></div>
      <p className="mt-auto pt-4 text-xs text-muted">Answer comes from: {e.settles.replace(/ \(.*\)$/, "")}</p>
    </Link>
  );
}

type Feed = { event: string; clockStart: number; nowT: number; strikes: { id: string; series: [number, number, number][] }[] };
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// The big card at the top: one question at a time, its answers on the left and all three chance lines on the right.
export function FeaturedMarkets({ events }: { events: EventView[] }) {
  const [k, setK] = useState(0);
  const e = events[Math.min(k, events.length - 1)];
  const [raw, setFeed] = useState<Feed | null>(null);
  const feed = raw && e && raw.event === e.id ? raw : null; // ignore a chart that belongs to the previous question
  useEffect(() => {
    let on = true;
    const pull = () => fetch(`/api/market?event=${encodeURIComponent(e.id)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => on && d && setFeed(d)).catch(() => {});
    pull();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") pull(); }, 5000);
    return () => { on = false; window.clearInterval(id); };
  }, [e.id]);
  const lines = useMemo(() => feed?.strikes.map((s) => s.series.map(([t, p]) => ({ x: feed.clockStart + t * 1000, p: p * 100 }))) ?? [], [feed]);
  if (!e) return null;
  const go = (d: number) => setK((x) => (x + d + events.length) % events.length);

  return (
    <section className="rounded-[22px] bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted"><EventIcon eventId={e.id} size={22} />{topicOf(e.id).tag}</p>
        {events.length > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => go(-1)} aria-label="Previous question" className="press inline-flex h-9 w-9 items-center justify-center rounded-full border border-line hover:bg-surface2"><ChevronLeft size={16} /></button>
            <span className="num text-sm text-muted">{k + 1} of {events.length}</span>
            <button onClick={() => go(1)} aria-label="Next question" className="press inline-flex h-9 w-9 items-center justify-center rounded-full border border-line hover:bg-surface2"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>
      <h3><Link href={`/market/${encodeURIComponent(e.id)}`} className="mt-3 block text-2xl font-semibold leading-tight hover:underline sm:text-[1.75rem]">{e.short}</Link></h3>
      <p className="mt-2 font-medium">{e.title}</p>
      <p className="mt-1 text-sm text-muted">{e.text}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <div className="mb-2 flex justify-between text-xs text-muted"><span>Answer</span><span className="w-[4.5rem] text-center">Think Yes</span></div>
          <div className="space-y-4">{e.strikes.map((s, i) => <OptionRow key={s.marketId} s={s} i={i} />)}</div>
          <div className="mt-5 flex items-center justify-between">
            <p className="num text-xs text-muted">{e.strikes.reduce((a, s) => a + s.trades, 0).toLocaleString()} predictions, mostly computer-made</p>
            <Link href={`/market/${encodeURIComponent(e.id)}`} className="press inline-flex min-h-10 items-center gap-1 rounded-full bg-primary px-4 text-sm font-medium text-primaryink">Make a prediction <ChevronRight size={16} aria-hidden /></Link>
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {e.strikes.map((s, i) => (
              <span key={s.marketId} className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: STRIKE_COLORS[i] }} />{s.label} <b className="num">{Math.round(yesOf(s) * 100)}%</b></span>
            ))}
          </div>
          <div className="h-56" role="img" aria-label={`How the Yes % changed for each answer to: ${e.title}`}>
            {feed ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <XAxis type="number" dataKey="x" domain={["dataMin", "dataMax"]} tickFormatter={clock} tick={{ fontSize: 11, fill: "var(--muted)" }} tickCount={4} axisLine={false} tickLine={false} />
                  <YAxis type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`} orientation="right" width={40} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(0)}%`, "Think Yes"]} labelFormatter={(x) => clock(Number(x))} contentStyle={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 12 }} />
                  {lines.map((d, i) => <Line key={i} data={d} dataKey="p" type="stepAfter" stroke={STRIKE_COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />)}
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-full animate-pulse rounded-2xl bg-surface2" />}
          </div>
        </div>
      </div>
    </section>
  );
}
