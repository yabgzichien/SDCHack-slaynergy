import type { View, RoleMatchView } from "@/lib/engine/view";
import { occupationById, type GroupKey } from "@/lib/engine/data";
import { FORECAST } from "@/lib/speed";

// The jobs Jobbery suggests, in order: the best job, then up to four other good matches (the quick bridge job is
// offered separately). The Jobs page and the Job Map show the same set.
// Previewing an AI speed ranks the same jobs as if that speed were certain (view.scenarios); "forecast" is Our forecast.
export function suggestedJobs(view: View, speed: string = FORECAST): RoleMatchView[] {
  const sc = speed === FORECAST ? null : view.scenarios?.find((s) => s.id === speed) ?? null;
  const list = sc ? [...view.matches].sort((a, b) => (sc.roles[a.roleId]?.rank ?? 1e9) - (sc.roles[b.roleId]?.rank ?? 1e9)) : view.matches;
  const best = (sc ? list.find((m) => m.roleId === sc.best?.roleId) : view.lasting) ?? list[0] ?? null;
  if (!best) return [];
  const others = list.filter((m) => m.roleId !== best.roleId && m.roleId !== view.bridge?.roleId).slice(0, 4);
  return [best, ...others];
}

// How many places a job moves on the list under a previewed speed: positive is up. Null under Our forecast.
export function rankMove(view: View, speed: string, roleId: string): number | null {
  const r = speed === FORECAST ? undefined : view.scenarios?.find((s) => s.id === speed)?.roles[roleId]?.rank;
  const was = view.matches.find((m) => m.roleId === roleId)?.rank;
  return r === undefined || was === undefined ? null : was - r;
}

// ISCO-08 major group (first digit) to the occupation groups the state figures use, for the worker's current job.
const ISCO_GROUP: Record<string, GroupKey> = { "1": "managers", "2": "professionals", "3": "technicians", "4": "clerical", "5": "service", "7": "craft", "8": "operators" };
export function currentJob(occupationId: string | undefined) {
  const o = occupationId ? occupationById[occupationId] : undefined;
  return o ? { id: o.id, title: o.title, sector: o.sector, group: ISCO_GROUP[o.isco.charAt(0)] } : null;
}
