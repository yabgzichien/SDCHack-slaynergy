"use client";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Change, View } from "@/lib/engine/view";
import type { Stop, Upcoming, OpenThen } from "@/lib/engine/history";
import type { Weights3 } from "@/lib/engine/futures";
import type { SessionState } from "@/lib/engine/state";
import { dataVersion, setSeries, type Series } from "@/lib/engine/data";
import { setStates, type StatesFile } from "@/lib/engine/geo";

export type Catalog = {
  skills: { id: string; name: string; sdg: { target: string; why: string } }[];
  occupations: { id: string; title: string; skills: string[]; education: string; sector: string }[];
  sectors: { id: string; label: string; blurb: string }[];
  education: { id: string; label: string }[];
  personas: { id: string; name: string; label: string }[];
  goals: { target: string; label: string; goal: string; text: string }[];
  interests: { id: string; label: string }[];
};
type Payload = { state: SessionState; view: View; catalog: Catalog; dataVersion?: number };
type Ctx = {
  state: SessionState | null; view: View | null; catalog: Catalog | null;
  busy: boolean; error: string | null;
  act: (type: string, body?: Record<string, unknown>) => Promise<Payload | null>;
  refresh: () => Promise<void>;
  // The data snapshot on screen. The server refreshes its data by itself; when a newer snapshot arrives while the app
  // is open, showChanges turns on so the page can say what the new numbers changed.
  dataVersion: number;
  showChanges: boolean; setShowChanges: (v: boolean) => void;
  // The release picker on Statistics and the Forecast page. view above is always today's.
  history: History;
};

// The release picker (components/History.tsx), on Statistics and the Forecast page only. The picked release lives in
// this tab's memory: leaving those two pages, a reload or a new tab is back to today, and nothing about it is sent to
// the server except the read-only GET /api/history.
export type HistoryIndex = { dataVersion: number; stops: Stop[]; upcoming: Upcoming; bands: { q: string; weights: Weights3 }[] };
export type HistoryEntry = { stop: Stop; view: View | null; open: OpenThen[]; changes: Change[] };
type History = {
  index: HistoryIndex | null; loadIndex: () => void;
  // The release picked before today, with its view and what it changed; null on today.
  past: HistoryEntry | null;
  loading: string | null; failed: boolean;
  pick: (q: string) => Promise<void>;
  backToToday: () => void;
};

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(C);
  if (!c) throw new Error("AppProvider missing");
  return c;
};

// Load the server's data snapshot into the browser's copy of the engine, so pages that read the data directly (the
// Sources page, the trend charts, the job map) show the same numbers the server computed the view from.
async function syncData(version: number | undefined): Promise<boolean> {
  if (version === undefined || version === dataVersion) return false;
  const d = (await (await fetch("/api/data", { cache: "no-store" })).json()) as { version: number; series: Series; states: StatesFile };
  setSeries(d.series, d.version);
  setStates(d.states);
  return true;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const loaded = useRef(false);
  const [wantIndex, setWantIndex] = useState(false);
  const path = usePathname();
  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [picked, setPicked] = useState<HistoryEntry | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const entries = useRef(new Map<string, HistoryEntry>());
  const want = useRef<string | null>(null);

  // Swap in newer data first, then show the payload computed from it. A swap after the first load means new numbers
  // came out while the app was open.
  const apply = useCallback(async (d: Payload) => {
    try {
      const swapped = await syncData(d.dataVersion);
      if (swapped && loaded.current) setShowChanges(true);
    } catch { /* keep the data already loaded */ }
    loaded.current = true;
    setData(d);
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/state").then((r) => r.json()).then((d) => { if (live) void apply(d); }).catch(() => live && setError("Could not load. Please refresh."));
    return () => { live = false; };
  }, [apply]);

  const viewingPast = !!picked && !picked.stop.today && (path === "/trends" || path === "/market");
  const act = useCallback(async (type: string, body: Record<string, unknown> = {}) => {
    if (viewingPast) { setError("You are viewing the past. Go back to today to make changes."); return null; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, ...body }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Something went wrong."); return null; }
      if (type === "reset") setShowChanges(false);
      await apply(d);
      return d as Payload;
    } catch {
      setError("Network problem. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [apply, viewingPast]);

  const refresh = useCallback(async () => {
    try { await apply(await (await fetch("/api/state")).json()); } catch { /* keep showing the last good data */ }
  }, [apply]);

  // History: the list of releases loads when the panel first opens; each release's view and log load when picked and
  // stay cached for this tab. A new data snapshot or a changed session clears them, since the views depend on both.
  const histKey = `${data?.dataVersion}|${data ? JSON.stringify({ ...data.state, orders: undefined, clock: undefined }) : ""}`;
  const [seenKey, setSeenKey] = useState(histKey);
  if (seenKey !== histKey) { setSeenKey(histKey); setPicked(null); setIndex(null); }
  // Only Statistics and the Forecast page show the past; any other page is today.
  const onHistoryPage = path === "/trends" || path === "/market";
  const [seenPath, setSeenPath] = useState(onHistoryPage);
  if (seenPath !== onHistoryPage) { setSeenPath(onHistoryPage); if (!onHistoryPage) setPicked(null); }
  const loadIndex = useCallback(() => setWantIndex(true), []);
  useEffect(() => {
    if (!wantIndex || index) return;
    let live = true;
    fetch("/api/history").then((r) => r.json()).then((d: HistoryIndex) => { if (live) setIndex(d); }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [wantIndex, index]);
  const pick = useCallback(async (q: string) => {
    want.current = q;
    const k = `${histKey}|${q}`;
    const hit = entries.current.get(k);
    if (index?.stops.find((x) => x.q === q)?.today) { setPicked(null); setError(null); return; }
    if (hit) { setPicked(hit); setError(null); return; }
    setLoading(q); setFailed(false);
    try {
      const r = await fetch(`/api/history?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error();
      const d = (await r.json()) as HistoryEntry;
      entries.current.set(k, d);
      if (want.current === q) { setPicked(d); setError(null); }
    } catch { if (want.current === q) setFailed(true); }
    finally { setLoading((x) => (x === q ? null : x)); }
  }, [histKey, index]);
  const backToToday = useCallback(() => { want.current = null; setPicked(null); setError(null); }, []);
  const past = picked && !picked.stop.today && onHistoryPage ? picked : null;

  const value = useMemo<Ctx>(() => ({
    state: data?.state ?? null, view: data?.view ?? null, catalog: data?.catalog ?? null,
    busy, error, act, refresh, dataVersion: data?.dataVersion ?? dataVersion, showChanges, setShowChanges,
    history: { index, loadIndex, past, loading, failed, pick, backToToday },
  }), [data, busy, error, act, refresh, showChanges, index, loadIndex, past, loading, failed, pick, backToToday]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
