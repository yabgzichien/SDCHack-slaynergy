"use client";
import { useCallback, useSyncExternalStore } from "react";
import { readStored } from "@/lib/legacy";
import { FORECAST, SPEEDS, type Speed } from "@/lib/speed";

// The AI speed the person is previewing, kept in this browser so every page shows the same one (docs/adr/0002).
// Until they pick one, every page shows Our forecast. Previewing never saves weights or changes the plan.
const KEY = "jobbery-ai-speed";
const EVT = "jobbery-ai-speed";
const read = () => { try { return readStored(localStorage, KEY); } catch { return null; } };
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb); };

export function useSpeed() {
  const chosen = useSyncExternalStore(subscribe, read, () => null);
  const speed: Speed = chosen && (SPEEDS as readonly string[]).includes(chosen) ? (chosen as Speed) : FORECAST;
  const setSpeed = useCallback((id: Speed) => {
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVT));
  }, []);
  return { speed, previewing: speed !== FORECAST, setSpeed };
}
