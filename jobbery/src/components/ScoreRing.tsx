"use client";
import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function ScoreRing({ value, max = 100, size = 168, label, color = "var(--accent)" }: { value: number; max?: number; size?: number; label?: string; color?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const [shown, setShown] = useState(reduce ? value : 0);
  const stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const dash = useTransform(mv, (v) => c * (1 - Math.min(1, v / max)));
  useEffect(() => {
    const a = animate(mv, value, reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 1.1 });
    const u = mv.on("change", (v) => setShown(Math.round(v)));
    return () => { a.stop(); u(); };
  }, [value, mv, reduce]);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"}: ${value} out of ${max}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} style={{ strokeDashoffset: dash }} />
      </svg>
      <div className="absolute text-center">
        <p className="num text-5xl font-extrabold tracking-tight" style={{ fontSize: size * 0.3 }}>{shown}</p>
        <p className="-mt-1 text-xs text-muted">{label ?? `out of ${max}`}</p>
      </div>
    </div>
  );
}
