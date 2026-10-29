"use client";
import Link from "next/link";
import { useApp } from "./AppProvider";

// A real overlay floating over the page, so it may carry a shadow.
const PANEL = "rounded-[22px] border border-line bg-raised p-4 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]"; // taste-skill-ignore

// When the server loads new public numbers while the app is open: one line that leads to the full list of changes.
export function ReleaseOverlay() {
  const { showChanges, setShowChanges, view } = useApp();
  if (!showChanges) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[26rem]" role="status" aria-live="polite">
      <div className={PANEL}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm"><span className="font-medium">New numbers are out.</span> {view?.changes?.length ?? 0} things changed.</p>
          <div className="flex shrink-0 items-center gap-1">
            <Link href="/changes" onClick={() => setShowChanges(false)} className="press inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primaryink">See them</Link>
            <button onClick={() => setShowChanges(false)} className="press min-h-10 rounded-full px-3 text-sm text-muted hover:text-ink" aria-label="Dismiss">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
