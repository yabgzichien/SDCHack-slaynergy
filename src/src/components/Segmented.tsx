"use client";
import { motion } from "framer-motion";
import { useId } from "react";

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const gid = useId();
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-2xl bg-surface2 p-1">
      {options.map((o) => (
        <button type="button" key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={`press relative min-h-10 rounded-xl px-4 text-sm font-semibold ${value === o.id ? "text-ink" : "text-muted"}`}>
          {value === o.id && <motion.span layoutId={gid} className="absolute inset-0 rounded-xl bg-raised" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
