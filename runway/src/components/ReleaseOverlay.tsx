"use client";
import Link from "next/link";
import { useApp } from "./AppProvider";

const STAGES = [
  "Loading the real Apr to Jun 2026 job numbers (published 18 Aug 2026)",
  "Checking every question against the real numbers",
  "Scoring every player's predictions, yours too",
  "Updating how fast we think AI is moving",
  "Updating your skills, jobs and plan",
];

// A real overlay floating over the page, so it may carry a shadow.
const PANEL = "rounded-[22px] border border-line bg-raised p-4 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]"; // taste-skill-ignore

// While the release runs: the five steps the server just did, shown one by one.
// When it ends: one line that leads to the full list of changes.
export function ReleaseOverlay() {
  const { stage, showChanges, setShowChanges, view } = useApp();
  if (stage === 0 && !showChanges) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[26rem]" role="status" aria-live="polite">
      <div className={PANEL}>
        {stage > 0 ? (
          <>
            <p className="font-medium">New numbers are out</p>
            <ol className="mt-2 space-y-1.5">
              {STAGES.map((s, i) => {
                const n = i + 1;
                const st = n < stage ? "done" : n === stage ? "now" : "todo";
                return (
                  <li key={s} className={`flex items-start gap-2 text-sm ${st === "todo" ? "text-muted" : "text-ink"}`}>
                    <span aria-hidden className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${st === "done" ? "bg-accent" : st === "now" ? "bg-ink" : "bg-control"}`} />
                    <span className={st === "now" ? "font-medium" : ""}>{s}</span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm"><span className="font-medium">Your results changed.</span> {view?.changes?.length ?? 0} things changed.</p>
            <div className="flex shrink-0 items-center gap-1">
              <Link href="/changes" onClick={() => setShowChanges(false)} className="press inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primaryink">See them</Link>
              <button onClick={() => setShowChanges(false)} className="press min-h-10 rounded-full px-3 text-sm text-muted hover:text-ink" aria-label="Dismiss">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
