"use client";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { SdgIcon } from "@/components/SdgIcon";

// Five goals shown, picked ones first. Any other goal is found by search and added by the user.
export function GoalsPicker() {
  const { view, state, catalog } = useApp();
  if (!view || !state || !catalog) return null;
  return <Picker />;
}

// The shown list is fixed when it first appears, so clicking never reorders or removes a goal. Searched goals are appended.
function Picker() {
  const { view, state, catalog, act } = useApp();
  const [q, setQ] = useState("");
  const sel = state!.goals;
  const [order, setOrder] = useState<string[]>(() => {
    const yours = [...new Set(view!.matches.slice(0, 15).map((m) => m.sdgTarget))];
    return [...sel, ...yours.filter((t) => !sel.includes(t))].slice(0, Math.max(5, sel.length));
  });
  const all = catalog!.goals;
  const shown = order.map((t) => all.find((g) => g.target === t)).filter((g): g is NonNullable<typeof g> => !!g);
  const toggle = (t: string) => { act("goals", { goals: sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t] }); };
  const add = (t: string) => { setOrder((o) => [...o, t]); setQ(""); toggle(t); };
  const needle = q.trim().toLowerCase();
  const found = needle
    ? all.filter((g) => !shown.includes(g) && `${g.label} ${g.goal} ${g.target}`.toLowerCase().includes(needle)).slice(0, 5)
    : [];
  const chip = (g: (typeof all)[number], on: boolean, onClick: () => void) => (
    <button key={g.target} type="button" aria-pressed={on} onClick={onClick}
      className={`press flex min-h-12 items-center gap-3 rounded-2xl transition-colors px-4 py-2 text-left text-sm ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
      <SdgIcon goal={Number(g.target.split(".")[0])} />
      <span className="font-medium">{g.label}</span>
    </button>
  );
  return (
    <div>
      <div className="flex flex-wrap gap-2">{shown.map((g) => chip(g, sel.includes(g.target), () => toggle(g.target)))}</div>
      <label className="mt-4 block">
        <span className="sr-only">Search other goals</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for another goal, e.g. water, health, education"
          className="min-h-11 w-full max-w-md rounded-full bg-surface px-4 text-sm outline-none ring-1 ring-control focus:ring-2" />
      </label>
      {needle && (
        <div className="mt-3 flex flex-wrap gap-2">
          {found.length ? found.map((g) => chip(g, false, () => add(g.target))) : <p className="text-sm text-muted">No other goal matches that.</p>}
        </div>
      )}
    </div>
  );
}
