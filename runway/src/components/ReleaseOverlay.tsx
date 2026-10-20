"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "./AppProvider";

const STAGES = [
  "Loading the real, held-back release: DOSM 2026 Q2, published 18 Aug 2026",
  "Settling the open questions against the real figures",
  "Updating forecaster accuracy and influence",
  "Re-weighting the three futures",
  "Recomputing expiry dates, job ranking and your plan",
];

export function ReleaseOverlay() {
  const { stage } = useApp();
  return (
    <AnimatePresence>
      {stage > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[26rem]" role="status" aria-live="polite">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-fast">New data released</p>
            <ol className="mt-2 space-y-1.5">
              {STAGES.map((s, i) => {
                const n = i + 1;
                const state = n < stage ? "done" : n === stage ? "now" : "todo";
                return (
                  <li key={s} className={`flex items-start gap-2 text-sm ${state === "todo" ? "text-muted/60" : "text-ink"}`}>
                    <span aria-hidden className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${state === "done" ? "bg-rise" : state === "now" ? "animate-pulse bg-fast" : "bg-line"}`} />
                    <span className={state === "now" ? "font-semibold" : ""}>{s}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
