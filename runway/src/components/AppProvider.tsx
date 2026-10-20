"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { View } from "@/lib/engine/view";
import type { SessionState } from "@/lib/engine/state";

export type Catalog = {
  skills: { id: string; name: string; sdg: { target: string; why: string } }[];
  occupations: { id: string; title: string; skills: string[]; education: string; sector: string }[];
  sectors: { id: string; label: string; blurb: string }[];
  education: { id: string; label: string }[];
  personas: { id: string; name: string; label: string }[];
  goals: { target: string; label: string; goal: string; text: string }[];
  interests: { id: string; label: string }[];
};
type Payload = { state: SessionState; view: View; catalog: Catalog };
type Ctx = {
  state: SessionState | null; view: View | null; catalog: Catalog | null;
  busy: boolean; error: string | null;
  act: (type: string, body?: Record<string, unknown>) => Promise<Payload | null>;
  refresh: () => Promise<void>;
  stage: number; // 0 idle, 1..5 release animation stages
  showChanges: boolean; setShowChanges: (v: boolean) => void;
  before: View | null;
};

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(C);
  if (!c) throw new Error("AppProvider missing");
  return c;
};

const STAGE_MS = 1100;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [showChanges, setShowChanges] = useState(false);
  const [before, setBefore] = useState<View | null>(null);
  const timers = useRef<number[]>([]);
  const stageRef = useRef(0);
  useEffect(() => { stageRef.current = stage; }, [stage]);

  useEffect(() => {
    let live = true;
    fetch("/api/state").then((r) => r.json()).then((d) => live && setData(d)).catch(() => live && setError("Could not load. Please refresh."));
    return () => { live = false; timers.current.forEach(clearTimeout); };
  }, []);

  const act = useCallback(async (type: string, body: Record<string, unknown> = {}) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, ...body }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Something went wrong."); return null; }
      if (type === "release") {
        setBefore(data?.view ?? null);
        // Staged presentation of the real recomputation the server just did.
        timers.current.forEach(clearTimeout);
        timers.current = [];
        setStage(1);
        for (let i = 2; i <= 5; i++) timers.current.push(window.setTimeout(() => setStage(i), (i - 1) * STAGE_MS));
        timers.current.push(window.setTimeout(() => { setStage(0); setShowChanges(true); }, 5 * STAGE_MS));
        // pages keep showing the old numbers until the stage that updates them
        timers.current.push(window.setTimeout(() => setData(d), 3 * STAGE_MS));
        return d;
      }
      if (type === "reset") { setBefore(null); setShowChanges(false); }
      setData(d);
      return d as Payload;
    } catch {
      setError("Network problem. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [data]);

  const refresh = useCallback(async () => {
    try { const d = await (await fetch("/api/state")).json(); setData((cur) => (stageRef.current > 0 ? cur : d)); } catch { /* keep showing the last good data */ }
  }, []);

  const value = useMemo<Ctx>(() => ({
    state: data?.state ?? null, view: data?.view ?? null, catalog: data?.catalog ?? null,
    busy, error, act, refresh, stage, showChanges, setShowChanges, before,
  }), [data, busy, error, act, refresh, stage, showChanges, before]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
