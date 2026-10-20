"use client";
import { FUTURE_COLOR, FUTURE_NAME } from "./ui";

const FROM = 2026, TO = 2040;
const yearOf = (label: string): number | null => {
  const m = label.match(/(\d{4})/);
  if (!m || label.startsWith("after")) return null;
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(label.slice(0, 3));
  return Number(m[1]) + (mon >= 0 ? mon / 12 : 0);
};

// A skill's shelf life on a 2026–2040 axis: one dot per future, and a bar to the weighted date.
export function ExpiryTrack({ byFuture, expected, durable, axis = true }: { byFuture: Record<string, string>; expected: string; durable: boolean; axis?: boolean }) {
  const x = (y: number | null) => (y === null ? 100 : Math.max(0, Math.min(100, ((y - FROM) / (TO - FROM)) * 100)));
  return (
    <div>
      <div className="relative h-6" role="img" aria-label={`Expected ${expected}. ${Object.entries(byFuture).map(([k, v]) => `${FUTURE_NAME[k]} future: ${v}`).join("; ")}`}>
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface2" />
        {!durable && <div className="bar-fill absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-fall" style={{ left: 0, width: `${x(yearOf(expected))}%` }} />}
        {Object.entries(byFuture).map(([k, v]) => (
          <span key={k} title={`${FUTURE_NAME[k]} future: ${v}`} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-raised"
            style={{ left: `${x(yearOf(v))}%`, background: FUTURE_COLOR[k] }} />
        ))}
      </div>
      {axis && <ExpiryAxis />}
    </div>
  );
}
export const ExpiryAxis = () => (
  <div className="num relative h-4 text-xs text-muted" aria-hidden>
    {[2026, 2030, 2035, 2040].map((y) => (
      <span key={y} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${((y - FROM) / (TO - FROM)) * 100}%` }}>{y === TO ? `${TO}+` : y}</span>
    ))}
  </div>
);
export const ExpiryLegend = () => (
  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
    {(["slow", "medium", "fast"] as const).map((k) => <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FUTURE_COLOR[k] }} />{FUTURE_NAME[k]} future</span>)}
    <span className="inline-flex items-center gap-1"><span className="inline-block h-1 w-4 rounded-full bg-fall" />weighted date</span>
  </p>
);
