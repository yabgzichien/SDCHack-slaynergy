import type { EventView } from "./engine/world";

export type PositionRow = {
  key: string; eventId: string; title: string; label: string; sides: ("yes" | "no")[];
  yesNow: number; outcome: boolean | null; // null while the question is open
  put: number; back: number; worth: number; gain: number; // gain: on what you still hold while open, the final result once answered
};

// One row per side you hold on an open answer, and one per answer you predicted on once it is answered.
export function positionRows(events: EventView[], settled: EventView[]): PositionRow[] {
  const rows: PositionRow[] = [];
  for (const e of [...events, ...settled]) {
    for (const s of e.strikes) {
      const { position: pos } = s;
      if (s.settled) {
        if (!s.executions.length) continue;
        const sides = (["yes", "no"] as const).filter((x) => s.executions.some((ex) => ex.side === x));
        rows.push({ key: s.marketId, eventId: e.id, title: e.title, label: s.label, sides, yesNow: s.price, outcome: s.settled.outcome, put: 0, back: 0, worth: 0, gain: s.settled.pnl });
        continue;
      }
      for (const side of ["yes", "no"] as const) {
        const shares = pos[side];
        if (shares <= 1e-6) continue;
        const put = shares * (pos[side === "yes" ? "avgYes" : "avgNo"] ?? 0);
        const worth = shares * (side === "yes" ? s.price : 1 - s.price);
        rows.push({ key: `${s.marketId}|${side}`, eventId: e.id, title: e.title, label: s.label, sides: [side], yesNow: s.price, outcome: null, put, back: shares, worth, gain: worth - put });
      }
    }
  }
  return rows;
}
