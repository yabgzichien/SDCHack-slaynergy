"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { View } from "@/lib/engine/view";
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

  const act = useCallback(async (type: string, body: Record<string, unknown> = {}) => {
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
  }, [apply]);

  const refresh = useCallback(async () => {
    try { await apply(await (await fetch("/api/state")).json()); } catch { /* keep showing the last good data */ }
  }, [apply]);

  const value = useMemo<Ctx>(() => ({
    state: data?.state ?? null, view: data?.view ?? null, catalog: data?.catalog ?? null,
    busy, error, act, refresh, dataVersion: data?.dataVersion ?? dataVersion, showChanges, setShowChanges,
  }), [data, busy, error, act, refresh, showChanges]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
