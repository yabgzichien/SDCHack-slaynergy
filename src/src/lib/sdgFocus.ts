// The UN goals a person wants to build their working life around, kept as the same list of targets ("8.5") that
// the Goals page saves, so one choice re-ranks both the skills and the jobs.

export const goalOf = (target: string) => Number(target.split(".")[0]);

// Every goal that has at least one target in the catalogue, with those targets.
export function targetsByGoal(targets: string[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const t of targets) out.set(goalOf(t), [...(out.get(goalOf(t)) ?? []), t]);
  return out;
}

// The goal numbers a saved list of targets stands for.
export const focusGoals = (saved: string[]) => new Set(saved.map(goalOf));

// Turn a whole goal on or off: all of its targets are added or removed, other goals are left alone.
export function toggleGoal(saved: string[], goal: number, all: string[]): string[] {
  const on = saved.some((t) => goalOf(t) === goal);
  return on ? saved.filter((t) => goalOf(t) !== goal) : [...saved, ...all.filter((t) => !saved.includes(t))];
}

// Skills that serve a chosen goal come first; inside each group the incoming order (soonest to be replaced) is kept.
export function orderByGoals<T>(items: T[], goalFor: (x: T) => number, chosen: Set<number>): T[] {
  if (!chosen.size) return items;
  const hit = items.filter((x) => chosen.has(goalFor(x)));
  return [...hit, ...items.filter((x) => !chosen.has(goalFor(x)))];
}
