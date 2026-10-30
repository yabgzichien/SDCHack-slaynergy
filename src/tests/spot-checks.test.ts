import { describe, expect, it } from "vitest";
import { courses, personas, roles } from "@/lib/engine/data";
import { computeView } from "@/lib/engine/view";
import { personaState } from "@/lib/engine/review";
import { pathContribution, HRD_NOTE } from "@/lib/engine/plan";
import { roundToTotal } from "@/lib/engine/math";

const now = () => ({ t0: new Date().toISOString() });
const viewOf = (id: string, extra: object = {}) => computeView({ ...personaState(id)!, clock: now(), ...extra });

describe("course spot checks (T7)", () => {
  it("every skill a job lists has a real course, so no plan falls back to the e-LATiH placeholder step", () => {
    const usable = new Set(courses.filter((c) => !c.strand && !c.catalogOnly).flatMap((c) => c.skills));
    const missing = [...new Set(roles.flatMap((r) => Object.keys(r.skills)))].filter((s) => !usable.has(s));
    expect(missing).toEqual([]);
    for (const p of personas) {
      const plan = viewOf(p.id).plan!;
      expect(plan.steps.filter((s) => s.kind === "programme")).toEqual([]);
    }
  });

  it("names HRD Corp only on plans for people who keep a job", () => {
    for (const p of personas) {
      const plan = viewOf(p.id).plan!;
      expect(plan.note.includes(HRD_NOTE)).toBe(plan.kind !== "switch");
    }
  });
});

describe("path contribution (T10)", () => {
  it("rounds to whole numbers that add up to the rounded total", () => {
    expect(roundToTotal([7.5, 7.5, 5])).toEqual([8, 7, 5]);
    expect(roundToTotal([0.4, 0.4, 0.4]).reduce((a, b) => a + b, 0)).toBe(1);
    expect(roundToTotal([30.2, -8.6, 12]).reduce((a, b) => a + b, 0)).toBe(34);
  });

  it("adds up to the plan's hours, splitting a step's hours evenly between its skills", () => {
    for (const p of personas) {
      const plan = viewOf(p.id).plan!;
      const c = plan.summary.path;
      const hours = plan.steps.reduce((a, s) => a + s.hours, 0);
      expect(c.total).toBe(Math.round(hours));
      expect(c.byTarget.reduce((a, x) => a + x.hours, 0) + c.untagged).toBe(c.total);
      expect(c.freeCourseHours).toBeLessThanOrEqual(c.courseHours);
      // 4.4 is a second count of the learning hours, never more than the plan has.
      expect(c.learningTarget).toBe("4.4");
      expect(c.learningHours).toBeGreaterThan(0);
      expect(c.learningHours).toBeLessThanOrEqual(c.total);
    }
    const step = (id: string, hours: number, targets: string[]) => ({ id, kind: "course" as const, weekStart: 1, weekEnd: 1, title: id, hours, strand: "job" as const, shortLived: false, funding: "Free", cost: "Free",
      skills: targets.map((t, i) => ({ id: `${id}${i}`, name: id, sdgTarget: t, sdgWhy: "" })) });
    const c = pathContribution([step("a", 20, ["9.5", "8.2"]), step("b", 5, ["8.2"]), { ...step("c", 4, []), kind: "adapt" }], "3.8");
    expect(c.byTarget).toEqual([{ target: "8.2", hours: 15 }, { target: "9.5", hours: 10 }]);
    expect(c.untagged).toBe(4);
    expect(c.learningHours).toBe(25);
    expect(c.jobTarget).toBe("3.8");
  });

  it("differs between personas, and changes when a course is swapped", () => {
    const sums = personas.map((p) => JSON.stringify(viewOf(p.id).plan!.summary.path.byTarget));
    expect(new Set(sums).size).toBeGreaterThan(1);
    // Find a persona with a course step that has an alternative, swap it, and check the breakdown moves.
    for (const p of personas) {
      const v = viewOf(p.id);
      const st = v.plan!.steps.find((s) => s.skillKey && s.alternatives);
      if (!st) continue;
      const keys = st.skillKey!.split("+");
      const alt = courses.find((c) => c.id !== st.course?.id && !c.strand && !c.catalogOnly && keys.every((k) => c.skills.includes(k)) && c.hours !== st.hours);
      if (!alt) continue;
      const after = viewOf(p.id, { courseSwaps: { [st.skillKey!]: alt.id } }).plan!.summary.path;
      expect(JSON.stringify(after)).not.toBe(JSON.stringify(v.plan!.summary.path));
      return;
    }
    throw new Error("no persona has a swappable course with different hours");
  });
});
