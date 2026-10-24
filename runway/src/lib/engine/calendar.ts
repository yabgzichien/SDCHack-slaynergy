// Which quarters the market is on, derived from the data instead of typed in:
// - DOSM: the newest quarter in the data is the latest release (settled); the quarter after it is open until DOSM
//   publishes it.
// - Epoch AI: a quarter settles once its EPOCH_SETTLE_DAYS are up and every live benchmark has a result for it (a
//   series with nothing for the quarter yet is waiting for late results, not showing "no gain"). The open questions
//   are the current calendar quarter plus any earlier open one that has not settled yet. A quarter that ended before
//   it was ever opened is never opened: nobody should predict a quarter that is already over.
// Every question is frozen the first time it appears, and its settled values are frozen when it settles, so new data
// never rewrites a question people predicted on or an answer already given.
import { nextQuarter, quarterIndex, withSeries, type MarketCalendar, type Series } from "./data";
import { epochSettleDay, ladder, pairOf, rawQuestions, rawStrikes } from "./questions";
import { replayHistory, liveQuestions } from "./replay";
import { updateWeights } from "./market";
import { baseRun } from "./tape";

export const quarterOfDay = (iso: string) => `${iso.slice(0, 4)}Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;

export function deriveCalendar(s: Omit<Series, "market">, prev: MarketCalendar | null, nowIso: string): MarketCalendar {
  const today = nowIso.slice(0, 10);
  const dosmLive = s.dosm.quarters.at(-1)?.q;
  if (!dosmLive) throw new Error("No DOSM quarters in the data");

  const liveIds = Object.keys(s.epoch).filter((id) => !s.epoch[id].replayOnly);
  const hasAll = (q: string) => liveIds.every((id) => s.epoch[id].frontier.some((x) => x.q === q));
  const quarters = [...new Set(liveIds.flatMap((id) => s.epoch[id].frontier.map((x) => x.q)))].sort((a, b) => quarterIndex(a) - quarterIndex(b));
  let epochLive = prev?.epoch.live ?? null;
  for (const q of quarters) {
    if ((!epochLive || quarterIndex(q) > quarterIndex(epochLive)) && hasAll(q) && epochSettleDay(q) <= today) epochLive = q;
  }
  if (!epochLive) throw new Error("No settled Epoch AI quarter in the data");
  const current = quarterOfDay(today);
  const open = [...new Set([...(prev?.epoch.open ?? []), current])]
    .filter((q) => quarterIndex(q) > quarterIndex(epochLive!))
    .sort((a, b) => quarterIndex(a) - quarterIndex(b));

  const cal: MarketCalendar = {
    derivedAt: nowIso,
    dosm: { live: dosmLive, next: nextQuarter(dosmLive) },
    epoch: { live: epochLive, open },
    frozen: Object.fromEntries(Object.entries(prev?.frozen ?? {}).map(([k, v]) => [k, { ...v }])),
  };
  return withSeries({ ...s, market: cal } as Series, () => {
    for (const q of rawQuestions()) {
      cal.frozen[q.id] ??= { threshold: q.threshold, strikes: rawStrikes(q), text: q.text, reason: q.reason };
      if (q.phase !== "next" && !cal.frozen[q.id].pair) {
        const p = pairOf(q, false);
        if (p) { cal.frozen[q.id].pair = p; if (prev) cal.frozen[q.id].settledAt = nowIso; }
      }
    }
    // Influence for each market: a live question keeps the influence it opened with (or, if it was never open, the
    // influence from history); an open one gets the influence after the latest release, as it is opened.
    const W0 = replayHistory().weights;
    const live = liveQuestions("live"), next = liveQuestions("next");
    const tw: Record<string, Record<string, number>> = {};
    for (const q of live) tw[q.id] = prev?.tapeWeights?.[q.id] ?? W0;
    if (next.some((q) => !prev?.tapeWeights?.[q.id])) {
      const W1 = updateWeights(W0, live.map((q) => baseRun(ladder(q)[1], W0, "W0")));
      for (const q of next) tw[q.id] = prev?.tapeWeights?.[q.id] ?? W1;
    } else for (const q of next) tw[q.id] = prev!.tapeWeights![q.id];
    cal.tapeWeights = tw;
    return cal;
  });
}

// The questions that a move from one calendar to the next settles: they had no settled values before and have now.
export function newlySettled(before: MarketCalendar, after: MarketCalendar): string[] {
  return Object.keys(after.frozen).filter((id) => after.frozen[id].pair && !before.frozen[id]?.pair && before.frozen[id]);
}

// True when the calendar moved (a quarter settled or opened), so a new snapshot is due even if no source changed.
export const calendarMoved = (a: MarketCalendar, b: MarketCalendar) =>
  a.dosm.live !== b.dosm.live || a.epoch.live !== b.epoch.live || a.epoch.open.join() !== b.epoch.open.join();
