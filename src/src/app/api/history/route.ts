import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { dataVersion } from "@/lib/engine/data";
import { historyStops, openQuestionsAt, upcomingRelease, weightsAt } from "@/lib/engine/history";
import { computeView, historyChanges, viewAsOf, type View } from "@/lib/engine/view";
import type { SessionState } from "@/lib/engine/state";
import { getSessionId } from "@/lib/server/session";
import { loadState } from "@/lib/server/store";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The history timeline. Read-only: it reads the session and the loaded data and never writes, settles or saves.
//   GET /api/history           the releases, the next one, and the forecast weights at each past release
//   GET /api/history?q=2026Q1  that release's view (null for today: the browser already has it) and what it changed

// Past views depend only on the data snapshot and the parts of the session that shape a view, not on predictions.
const MAX = 300;
const cache = new Map<string, View>();
const keyOf = (s: SessionState) => crypto.createHash("sha256").update(JSON.stringify({ ...s, orders: undefined, clock: undefined, release: undefined })).digest("hex").slice(0, 24);
function pastView(state: SessionState, key: string, q: string): View {
  const k = `${dataVersion}|${q}|${key}`;
  let v = cache.get(k);
  if (v) { cache.delete(k); cache.set(k, v); return v; }
  v = viewAsOf(state, q);
  cache.set(k, v);
  if (cache.size > MAX) cache.delete(cache.keys().next().value!);
  return v;
}

export async function GET(req: Request) {
  await ensureData();
  const stops = historyStops();
  const q = new URL(req.url).searchParams.get("q");
  if (!q) {
    return NextResponse.json({
      dataVersion, stops, upcoming: upcomingRelease(),
      // Today's band comes from the view the browser already shows, so it always matches the pages.
      bands: stops.filter((s) => !s.today).map((s) => ({ q: s.q, weights: weightsAt(s.day) })),
    });
  }
  const stop = stops.find((s) => s.q === q);
  if (!stop) return NextResponse.json({ error: "No such release." }, { status: 404 });
  const sid = await getSessionId(false);
  const state = await loadState(sid ?? "");
  const key = keyOf(state);
  let today: View | null = null;
  const at = (x: string) => (stops.find((s) => s.q === x)!.today ? (today ??= computeView(state)) : pastView(state, key, x));
  const changes = historyChanges(state, q, { at });
  return NextResponse.json({
    dataVersion, stop,
    view: stop.today ? null : at(q),
    open: stop.today ? [] : openQuestionsAt(stop.day),
    changes,
  });
}
