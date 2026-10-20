"use client";
import type { RoleMatchView } from "@/lib/engine/view";

export function whyFits(m: Pick<RoleMatchView, "overlap" | "outlook" | "demand" | "weeks" | "atRisk">) {
  const a = m.overlap >= 0.6 ? "You already have most of the skills" : m.overlap >= 0.35 ? "You have a good part of the skills" : "You would learn most of the skills";
  const b = m.outlook >= 0.75 ? "they should last" : m.atRisk ? "but they may fade sooner" : "and they should hold up";
  const c = m.demand.trend > 0.03 ? "its job ads are growing" : m.demand.trend < -0.03 ? "its job ads are shrinking" : "its job ads are steady";
  return `${a}, ${b}, and ${c}. About ${m.weeks} weeks to get ready.`;
}

export function Score({ value, label = "match score" }: { value: number; label?: string }) {
  return (
    <div className="text-right">
      <p className="num text-[2rem] leading-none">{Math.round(value * 100)}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
