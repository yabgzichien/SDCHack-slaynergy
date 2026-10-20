"use client";
import { FUTURE_COLOR, FUTURE_NAME } from "./ui";

const FROM = 2026, TO = 2040;
const yearOf = (label: string): number | null => {
  const m = label.match(/(\d{4})/);
  if (!m || label.startsWith("after")) return null;
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(label.slice(0, 3));
  return Number(m[1]) + (mon >= 0 ? mon / 12 : 0);
};

// A small timeline: one marker per future, plus a bar for the weighted expected date.
export function ExpiryTrack({ byFuture, expected, durable }: { byFuture: Record<string, string>; expected: string; durable: boolean }) {
  const x = (y: number | null) => (y === null ? 100 : Math.max(0, Math.min(100, ((y - FROM) / (TO - FROM)) * 100)));
  return (
    <div>
      <div className="relative h-8" role="img" aria-label={`Expected expiry ${expected}. ${Object.entries(byFuture).map(([k, v]) => `${FUTURE_NAME[k]}: ${v}`).join("; ")}`}>
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface2" />
        {!durable && <div className="bar-fill absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-fall/70" style={{ left: 0, width: `${x(yearOf(expected))}%` }} />}
        {Object.entries(byFuture).map(([k, v]) => (
          <span key={k} title={`${FUTURE_NAME[k]}: ${v}`} className="bar-fill absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
            style={{ left: `${x(yearOf(v))}%`, background: FUTURE_COLOR[k] }} />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted"><span>{FROM}</span><span>2030</span><span>2035</span><span>{TO}+</span></div>
    </div>
  );
}
export const ExpiryLegend = () => (
  <p className="flex flex-wrap gap-x-3 text-xs text-muted">
    {(["slow", "medium", "fast"] as const).map((k) => <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: FUTURE_COLOR[k] }} />{FUTURE_NAME[k]} future</span>)}
    <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-4 rounded-full bg-fall/70" />weighted expected date</span>
  </p>
);
