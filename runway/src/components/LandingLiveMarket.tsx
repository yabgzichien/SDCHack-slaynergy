"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventView } from "@/lib/engine/world";
import { LiveBadge } from "./MarketCards";

type Feed = { event: string; nowT: number; clockStart: number; strikes: { id: string; label: string; price: number; change1h: number; trades: number; series: [number, number, number][] }[] };
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const WINDOW_S = 3600;

// The landing page's live market: the main Yes % of one open question over the last hour, pulled every 3 seconds
// from the same feed as the question page, so the line moves while the visitor reads.
export function LandingLiveMarket({ event }: { event: EventView }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  useEffect(() => {
    let on = true;
    const pull = () => fetch(`/api/market?event=${encodeURIComponent(event.id)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => on && d && setFeed(d)).catch(() => {});
    pull();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") pull(); }, 3000);
    return () => { on = false; window.clearInterval(id); };
  }, [event.id]);
  const main = feed?.strikes[1] ?? feed?.strikes[0];
  const data = useMemo(() => {
    if (!feed || !main) return [];
    const from = feed.nowT - WINDOW_S;
    const pts = main.series.filter(([t]) => t >= from).map(([t, p]) => ({ x: feed.clockStart + t * 1000, p: Math.round(p * 1000) / 10 }));
    const last = pts[pts.length - 1];
    return last ? [...pts, { x: feed.clockStart + feed.nowT * 1000, p: last.p }] : pts;
  }, [feed, main]);
  const change = main ? Math.round(main.change1h * 100) : 0;

  return (
    <article className="landing-chart-card landing-reveal">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="landing-card-index">LIVE MARKET</span>
        <LiveBadge />
      </div>
      <h3 className="mt-2">Will office admin job ads shrink?</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{main?.label ?? "Drops at all"} in Malaysia&apos;s job ads, {event.title.split(", ").pop()}</p>
      <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="num text-5xl font-semibold leading-none text-[#213c32]" aria-live="polite">{main ? Math.round(main.price * 100) : "–"}%</p>
        <p className="pb-1 text-sm text-[var(--muted)]">think Yes</p>
        <p className={`num pb-1 text-sm font-semibold ${change > 0 ? "text-[#3f8a52]" : change < 0 ? "text-[#b86a2c]" : "text-[var(--muted)]"}`}>{change === 0 ? "no change" : `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}`} in the last hour</p>
      </div>
      <div className="mt-4 h-48" role="img" aria-label={`Live chart of how many players think Yes over the last hour, now ${main ? Math.round(main.price * 100) : 0}%`}>
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
              <defs><linearGradient id="lp-live" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient></defs>
              <XAxis type="number" dataKey="x" domain={["dataMin", "dataMax"]} tickFormatter={clock} tick={{ fontSize: 11, fill: "#61756a" }} tickCount={4} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} orientation="right" width={40} tick={{ fontSize: 11, fill: "#61756a" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(0)}%`, "Think Yes"]} labelFormatter={(x) => clock(Number(x))} contentStyle={{ background: "#fff", border: "1px solid #d8e4db", borderRadius: 12 }} />
              <Area type="stepAfter" dataKey="p" stroke="#a855f7" strokeWidth={2.5} fill="url(#lp-live)" isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <div className="h-full animate-pulse rounded-2xl bg-[#e8f1e9]" />}
      </div>
      <p className="landing-data-note">The line updates every few seconds. {main ? `${main.trades.toLocaleString()} predictions so far, ` : ""}mostly by computer-made players. Free points, never money.</p>
      <Link href={`/market/${encodeURIComponent(event.id)}`} className="landing-primary landing-forecast-cta">Make a prediction <ArrowRight size={17} aria-hidden /></Link>
    </article>
  );
}
