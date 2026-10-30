"use client";
import { useEffect, useState } from "react";
import { dayLabel as day, lastGood } from "@/lib/last-good";
import type { DataStatus } from "@/lib/server/refresh";

const LABEL: Record<string, string> = { dosm: "DOSM job ads", epoch: "Epoch AI benchmarks", opendosm: "OpenDOSM state figures" };
// One muted line per source whose last automatic check failed (docs/adr/0003): nothing is shown while all is well.
export function SourceDownNote({ status, className = "" }: { status?: DataStatus | null; className?: string }) {
  const [own, setOwn] = useState<DataStatus | null>(null);
  useEffect(() => {
    if (status !== undefined) return;
    let on = true;
    fetch("/api/data?info=1", { cache: "no-store" }).then((r) => r.json()).then((d) => on && setOwn(d.info?.status ?? null)).catch(() => {});
    return () => { on = false; };
  }, [status]);
  const st = status ?? own;
  const down = st ? (["dosm", "epoch", "opendosm"] as const).filter((k) => st.sources[k] && !st.sources[k]!.ok) : [];
  if (!down.length) return null;
  return (
    <ul className={`space-y-1 text-sm text-muted ${className}`} role="status">
      {down.map((k) => <li key={k}>{`We could not check ${LABEL[k]} on ${day(st!.sources[k]!.checkedAt)}, so we are showing the last good figures: ${lastGood(k, st!.sources[k]!.updatedAt)}.`}</li>)}
    </ul>
  );
}
