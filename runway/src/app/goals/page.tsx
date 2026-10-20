"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Btn, PageTitle, Skeleton } from "@/components/ui";

// One question: which goals matter to you? The goals that your own reachable jobs serve come first.
export default function GoalsPage() {
  const { view, state, catalog, act, busy } = useApp();
  const router = useRouter();
  const [picked, setPicked] = useState<string[] | null>(null);
  const [more, setMore] = useState(false);
  if (!view || !state || !catalog) return <Skeleton lines={5} />;
  const sel = picked ?? state.goals;
  const yours = [...new Set(view.matches.slice(0, 15).map((m) => m.sdgTarget))];
  const first = catalog.goals.filter((g) => yours.includes(g.target)).slice(0, 6);
  const rest = catalog.goals.filter((g) => !first.includes(g));
  const toggle = (t: string) => setPicked(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t]);
  const save = async () => { if (await act("goals", { goals: sel })) router.push("/jobs"); };
  const row = (g: (typeof catalog.goals)[number]) => {
    const on = sel.includes(g.target);
    return (
      <button key={g.target} type="button" aria-pressed={on} onClick={() => toggle(g.target)}
        className={`press flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl px-5 py-3 text-left ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
        <span><span className="block font-medium">{g.label}</span><span className={`block text-sm ${on ? "opacity-80" : "text-muted"}`}>SDG {g.target} · Goal {g.goal}</span></span>
        {on && <span aria-hidden>✓</span>}
      </button>
    );
  };
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Which goals matter to you?">These are the UN Sustainable Development Goals that the jobs within your reach serve. Jobs serving the goals you pick move up your list. Pick none if you prefer.</PageTitle>
      <div className="space-y-2">{first.map(row)}</div>
      {!more ? (
        <button onClick={() => setMore(true)} className="mt-4 min-h-11 text-sm underline decoration-control underline-offset-2">Show {rest.length} more goals</button>
      ) : <div className="mt-4 space-y-2">{rest.map(row)}</div>}
      <div className="mt-10 flex items-center justify-between gap-3">
        <Btn variant="quiet" href="/jobs">Cancel</Btn>
        <Btn onClick={save} disabled={busy} className="min-h-12 px-6 text-base">{sel.length ? `Save ${sel.length} ${sel.length === 1 ? "goal" : "goals"}` : "Save, no goals"}</Btn>
      </div>
    </div>
  );
}
