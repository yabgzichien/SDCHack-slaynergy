"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { View } from "@/lib/engine/view";

// The AI speed the person picked on Skills, kept in this browser so every page shows the same dates.
// Until they pick one, every page uses the speed we think is most likely.
const KEY = "runway-ai-speed";
const EVT = "runway-ai-speed";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb); };

export function useSpeed(view: View | null) {
  const chosen = useSyncExternalStore(subscribe, read, () => null);
  const futures = view?.pace.futures ?? [];
  const likely = futures.length ? [...futures].sort((a, b) => b.weight - a.weight)[0].id : "medium";
  const speed = chosen && futures.some((f) => f.id === chosen) ? chosen : likely;
  const setSpeed = useCallback((id: string) => {
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVT));
  }, []);
  return { speed, likely, setSpeed };
}
