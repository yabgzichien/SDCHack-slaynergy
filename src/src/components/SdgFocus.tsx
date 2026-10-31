"use client";
import Link from "next/link";
import { SdgIcon } from "@/components/SdgIcon";
import { useT } from "@/components/I18nProvider";
import { SDG_SHORT } from "@/components/ui";

const ALL_GOALS = Array.from({ length: 17 }, (_, i) => i + 1);

// A row of tiles for the UN goals that something on the page serves (a goal with a count of zero has nothing to reorder, so it is
// left out, unless it is chosen, so it can still be switched off). A tile turns a whole goal on or off. serving counts what each tile stands for: "yours" is the person's own skills, "page" is
// the jobs and skills listed on the page. showPlan adds the link to the plan's contribution (only useful with a profile).
export function SdgFocus({ chosen, available, serving, busy, onToggle, onClear, count = "yours", showPlan = true }: {
  chosen: Set<number>; available: Set<number>; serving: Map<number, number>; busy: boolean; onToggle: (goal: number) => void; onClear: () => void;
  count?: "yours" | "page"; showPlan?: boolean;
}) {
  const { t } = useT();
  const names = [...chosen].sort((a, b) => a - b).join(", ");
  return (
    <div>
      <div role="group" aria-label="UN goals to build your working life around" className="flex flex-wrap gap-2">
        {ALL_GOALS.filter((g) => available.has(g) && ((serving.get(g) ?? 0) > 0 || chosen.has(g))).map((g) => {
          const on = chosen.has(g);
          const n = serving.get(g) ?? 0;
          const name = t(SDG_SHORT[String(g)]);
          const tip = count === "page" ? (n === 1 ? t("1 job or skill listed on this page serves this goal") : n ? t("{n} jobs and skills listed on this page serve this goal", { n }) : t("Nothing listed on this page serves this goal"))
            : n === 1 ? t("1 of your skills serves this goal") : n ? t("{n} of your skills serve this goal", { n }) : t("None of your skills serve this goal yet");
          return (
            <button key={g} type="button" aria-pressed={on} disabled={busy} onClick={() => onToggle(g)}
              title={`${t("UN goal {goal}: {name}", { goal: g, name })}. ${tip}`} aria-label={`${t("UN goal {goal}: {name}", { goal: g, name })}. ${tip}`}
              className={`press relative rounded-xl p-0.5 transition ${on ? "ring-2 ring-ink ring-offset-2" : ""} ${chosen.size && !on ? "opacity-60 hover:opacity-100" : ""}`}>
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
            {showPlan && <Link href="/plan#sdg-path" className="underline decoration-control underline-offset-2 hover:text-ink">See how your plan serves them</Link>}
            <button type="button" onClick={onClear} disabled={busy} className="min-h-11 text-muted underline decoration-control underline-offset-2 hover:text-ink">Clear my choice</button>
          </>
        ) : (
          <p className="text-muted">{count === "page"
            ? "Pick none, one or several. The number on a tile is how many jobs and skills listed below serve that goal."
            : "Pick none, one or several. The number on a tile is how many of your skills serve that goal."}</p>
        )}
      </div>
    </div>
  );
}
