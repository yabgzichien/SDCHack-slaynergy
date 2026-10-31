"use client";
import Link from "next/link";
import { SdgIcon } from "@/components/SdgIcon";
import { useT } from "@/components/I18nProvider";
import { SDG_SHORT } from "@/components/ui";

const GOALS = Array.from({ length: 17 }, (_, i) => i + 1);

// The 17 UN goals as a row of tiles. A tile turns a whole goal on or off; goals nothing in Jobbery serves yet cannot be picked.
export function SdgFocus({ chosen, available, serving, busy, onToggle, onClear }: {
  chosen: Set<number>; available: Set<number>; serving: Map<number, number>; busy: boolean; onToggle: (goal: number) => void; onClear: () => void;
}) {
  const { t } = useT();
  const names = [...chosen].sort((a, b) => a - b).join(", ");
  return (
    <div>
      <div role="group" aria-label="UN goals to build your working life around" className="flex flex-wrap gap-2">
        {GOALS.map((g) => {
          const on = chosen.has(g);
          const can = available.has(g);
          const n = serving.get(g) ?? 0;
          const name = t(SDG_SHORT[String(g)]);
          const tip = !can ? t("No job or skill in Jobbery serves this goal yet") : n === 1 ? t("1 of your skills serves this goal") : n ? t("{n} of your skills serve this goal", { n }) : t("None of your skills serve this goal yet");
          return (
            <button key={g} type="button" aria-pressed={on} disabled={!can || busy} onClick={() => onToggle(g)}
              title={`${t("UN goal {goal}: {name}", { goal: g, name })}. ${tip}`} aria-label={`${t("UN goal {goal}: {name}", { goal: g, name })}. ${tip}`}
              className={`press relative rounded-xl p-0.5 transition ${on ? "ring-2 ring-ink ring-offset-2" : ""} ${can ? (chosen.size && !on ? "opacity-60 hover:opacity-100" : "") : "cursor-not-allowed opacity-30"}`}>
              <SdgIcon goal={g} size={52} />
              {n > 0 && <span aria-hidden className="num absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold text-white">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {chosen.size ? (
          <>
            <p className="font-medium">{chosen.size === 1 ? t("Skills that serve UN goal {goal} come first.", { goal: names }) : t("Skills that serve UN goals {goals} come first.", { goals: names })}</p>
            <Link href="/plan#sdg-path" className="underline decoration-control underline-offset-2 hover:text-ink">See how your plan serves them</Link>
            <button type="button" onClick={onClear} disabled={busy} className="min-h-11 text-muted underline decoration-control underline-offset-2 hover:text-ink">Clear my choice</button>
          </>
        ) : (
          <p className="text-muted">Pick none, one or several. The number on a tile is how many of your skills serve that goal. Greyed-out goals have no skill or job in Jobbery yet.</p>
        )}
      </div>
    </div>
  );
}
