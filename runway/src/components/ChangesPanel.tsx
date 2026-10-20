"use client";
import { useApp } from "./AppProvider";
import { Card, SourceChip, Chip } from "./ui";

const KIND: Record<string, string> = { futures: "Futures", market: "Market", skills: "Skill expiry", jobs: "Jobs", plan: "Plan", demand: "Job demand", forecasters: "Forecasters" };

export function ChangesPanel() {
  const { view, showChanges, setShowChanges } = useApp();
  const changes = view?.changes;
  if (!changes) return null;
  return (
    <div className="mx-auto max-w-5xl px-4 pt-4">
      <Card tone="accent">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">What changed and why <span className="font-normal text-muted">({changes.length} changes after the 2026 Q2 release)</span></h2>
          <button onClick={() => setShowChanges(!showChanges)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-surface/60" aria-expanded={showChanges}>
            {showChanges ? "Hide" : "Show"}
          </button>
        </div>
        {showChanges && (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {changes.map((c, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface p-3">
                <div className="mb-1"><Chip tone="accent">{KIND[c.kind]}</Chip></div>
                <p className="text-sm font-semibold">{c.text}</p>
                <p className="mt-0.5 text-sm text-muted">{c.why}</p>
                <div className="mt-1.5"><SourceChip name={c.source.name} date={c.source.date} url={c.source.url} /></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
