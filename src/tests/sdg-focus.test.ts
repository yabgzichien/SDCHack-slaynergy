import { describe, expect, it } from "vitest";
import { focusGoals, goalOf, orderByGoals, targetsByGoal, toggleGoal } from "../src/lib/sdgFocus";
import { skills } from "../src/lib/engine/data";
import goalsJson from "../data/sdg.json";

describe("choosing UN goals for the skills list", () => {
  const all = ["8.5", "8.10", "6.3", "4.4"];

  it("groups the catalogue's targets by goal", () => {
    const g = targetsByGoal(all);
    expect(g.get(8)).toEqual(["8.5", "8.10"]);
    expect(g.get(6)).toEqual(["6.3"]);
    expect(g.has(5)).toBe(false);
  });

  it("turns a whole goal on, and off again, without touching other goals", () => {
    const g = targetsByGoal(all);
    const on = toggleGoal(["4.4"], 8, g.get(8)!);
    expect(on).toEqual(["4.4", "8.5", "8.10"]);
    expect([...focusGoals(on)].sort()).toEqual([4, 8]);
    expect(toggleGoal(on, 8, g.get(8)!)).toEqual(["4.4"]);
  });

  it("does not add a target twice when the Goals page already saved one", () => {
    expect(toggleGoal(["8.5"], 6, ["6.3"])).toEqual(["8.5", "6.3"]);
    expect(toggleGoal(["8.5"], 8, ["8.5", "8.10"])).toEqual([]);
  });

  it("puts skills that serve a chosen goal first and keeps the rest in their order", () => {
    const items = [{ n: "a", g: 8 }, { n: "b", g: 6 }, { n: "c", g: 4 }, { n: "d", g: 6 }];
    expect(orderByGoals(items, (x) => x.g, new Set([6])).map((x) => x.n)).toEqual(["b", "d", "a", "c"]);
    expect(orderByGoals(items, (x) => x.g, new Set([6, 4])).map((x) => x.n)).toEqual(["b", "c", "d", "a"]);
    expect(orderByGoals(items, (x) => x.g, new Set()).map((x) => x.n)).toEqual(["a", "b", "c", "d"]);
  });

  it("every skill's UN target has official text to show under it", () => {
    const missing = skills.filter((s) => !(goalsJson as Record<string, unknown>)[s.sdg.target]).map((s) => s.id);
    expect(missing).toEqual([]);
    expect(skills.every((s) => goalOf(s.sdg.target) >= 1 && goalOf(s.sdg.target) <= 17)).toBe(true);
  });
});
