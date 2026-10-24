import type { View, RoleMatchView } from "@/lib/engine/view";
import { occupationById, type GroupKey } from "@/lib/engine/data";

// The jobs Jobbery suggests, in order: the best job, then up to four other good matches (the quick bridge job is
// offered separately). The Jobs page and the Job Map show the same set.
export function suggestedJobs(view: View): RoleMatchView[] {
  const best = view.lasting ?? view.matches[0] ?? null;
  if (!best) return [];
  const others = view.matches.filter((m) => m.roleId !== best.roleId && m.roleId !== view.bridge?.roleId).slice(0, 4);
  return [best, ...others];
}

// ISCO-08 major group (first digit) to the occupation groups the state figures use, for the worker's current job.
const ISCO_GROUP: Record<string, GroupKey> = { "1": "managers", "2": "professionals", "3": "technicians", "4": "clerical", "5": "service", "7": "craft", "8": "operators" };
export function currentJob(occupationId: string | undefined) {
  const o = occupationId ? occupationById[occupationId] : undefined;
  return o ? { id: o.id, title: o.title, sector: o.sector, group: ISCO_GROUP[o.isco.charAt(0)] } : null;
}
