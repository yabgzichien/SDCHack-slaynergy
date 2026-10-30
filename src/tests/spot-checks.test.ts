import { describe, expect, it } from "vitest";
import { courses, personas, roles } from "@/lib/engine/data";
import { computeView, raiseView, viewAsOf } from "@/lib/engine/view";
import { historyStops } from "@/lib/engine/history";
import { personaState } from "@/lib/engine/review";
import { pathContribution, HRD_NOTE } from "@/lib/engine/plan";
import { roundToTotal } from "@/lib/engine/math";
import { lastGood } from "@/lib/last-good";

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

describe("what would raise this score (T8)", () => {
  it("shows the score as points that add up exactly to the score shown, under Our forecast and every AI speed", () => {
    for (const p of personas) {
      const st = { ...personaState(p.id)!, clock: now() };
      const v = computeView(st);
      for (const m of v.matches.slice(0, 5)) {
        const r = raiseView(st, m.roleId)!;
        expect(r.forecast.total).toBe(Math.round(m.score * 100));
        expect(r.forecast.lines.reduce((a, l) => a + l.points, 0)).toBe(r.forecast.total);
        for (const s of v.scenarios!) expect(r[s.id].total).toBe(Math.round(s.roles[m.roleId].score * 100));
      }
    }
  });

  it("predicts exactly the score you get after learning the top skill or adding hours", () => {
    const st = { ...personaState("hafiz")!, clock: now() };
    const v = computeView(st);
    const m = v.chosen!;
    const r = raiseView(st, m.roleId)!.forecast;
    const skill = r.raisers.find((x) => x.kind === "skill")!;
    expect(skill.points).toBeGreaterThan(0);
    const learnt = computeView({ ...st, profile: { ...st.profile!, skills: [...st.profile!.skills, skill.skillId!] } });
    expect(Math.round(learnt.matches.find((x) => x.roleId === m.roleId)!.score * 100)).toBe(r.total + skill.points);
    const hours = r.raisers.find((x) => x.kind === "hours");
    if (hours) {
      const more = computeView({ ...st, profile: { ...st.profile!, hoursPerWeek: hours.hoursPerWeek! } });
      expect(Math.round(more.matches.find((x) => x.roleId === m.roleId)!.score * 100)).toBe(r.total + hours.points);
    }
    // Ordered biggest first, and every raiser adds something.
    expect(r.raisers.every((x, i) => x.points > 0 && (i === 0 || r.raisers[i - 1].points >= x.points))).toBe(true);
  });
});

describe("score raisers only move the parts a change touches", () => {
  it("learning a skill never changes the interest or outlook parts, and the part changes add up to the points", () => {
    for (const p of personas) {
      const st = { ...personaState(p.id)!, clock: now() };
      const v = computeView(st);
      for (const m of v.matches.slice(0, 5)) {
        for (const r of raiseView(st, m.roleId)!.forecast.raisers) {
          expect(Object.values(r.parts).reduce((a, b) => a + b, 0)).toBe(r.points);
          expect(r.parts.interest ?? 0).toBe(0);
          expect(r.parts.outlook ?? 0).toBe(0);
          if (r.kind === "hours") expect(Object.keys(r.parts).every((k) => k === "reach")).toBe(true);
        }
      }
    }
  });
});

describe("Future Skills Radar (T11)", () => {
  it("follows the release picker: the lists change across releases, and each row's numbers change one release back", () => {
    const st = { ...personaState("hafiz")!, clock: now() };
    const today = computeView(st).radar;
    const pastStops = historyStops().filter((s) => !s.today);
    const radars = pastStops.map((s) => viewAsOf(st, s.q).radar);
    const ids = (xs: { roleId?: string; occupationId?: string }[]) => xs.map((x) => x.roleId ?? x.occupationId).join();
    // Some past release has a different good-jobs list and a different at-risk list from today.
    expect(radars.some((r) => ids(r.risingJobs) !== ids(today.risingJobs))).toBe(true);
    expect(radars.some((r) => ids(r.decliningJobs) !== ids(today.decliningJobs))).toBe(true);
    // One release back, the same jobs can stay on the lists, but the DOSM figures on their rows move.
    const before = radars.at(-1)!;
    expect(before.cite.dosm).not.toBe(today.cite.dosm);
    expect(before.decliningJobs.map((j) => j.trend).join()).not.toBe(today.decliningJobs.map((j) => j.trend).join());
  });

  it("ranks at-risk jobs mostly by AI exposure, and every row carries its numbers", () => {
    const r = computeView({ ...personaState("hafiz")!, clock: now() }).radar;
    expect(r.decliningJobs).toHaveLength(6);
    expect(r.decliningJobs[0].exposure).toBeGreaterThan(0.4);
    for (const j of r.decliningJobs) expect(j.exposure).toBeGreaterThan(0);
    expect(r.cite).toEqual({ dosm: expect.stringMatching(/^DOSM \d{4} Q\d$/), ilo: "ILO 2025", aei: expect.stringMatching(/^AEI \d{4}-\d{2}-\d{2}$/) });
  });
});

describe("intake and robustness (T12)", () => {
  it("a thin profile (1 skill, 1 month, 2 hours a week) still builds a view the Jobs and Plan pages can show", () => {
    const base = personaState("hafiz")!;
    const st = { ...base, clock: now(), chosenRoleId: null, profile: { ...base.profile!, skills: [base.profile!.skills[0]], months: 1, hoursPerWeek: 2 } };
    const v = computeView(st);
    // No new job fits in a month at 2 hours a week, so Jobs shows its empty state and lists the longer paths.
    expect(v.matches).toEqual([]);
    expect(v.unreachable.length).toBeGreaterThan(0);
    expect(v.unreachable.every((u) => u.reason === "qualification" || u.weeks > 0)).toBe(true);
    // Plan either keeps the person in their job (a plan to stay) or asks them to choose a job: never a broken plan.
    if (v.plan) expect(v.plan.steps.length).toBeGreaterThan(0);
  });

  it("editing one skill or the weekly hours visibly reorders the jobs", () => {
    const base = { ...personaState("aina")!, clock: now() };
    const order = (s: typeof base) => computeView(s).matches.map((m) => `${m.roleId}:${Math.round(m.score * 100)}`).join();
    const p = base.profile!;
    expect(order({ ...base, profile: { ...p, hoursPerWeek: p.hoursPerWeek + 10 } })).not.toBe(order(base));
    expect(order({ ...base, profile: { ...p, skills: p.skills.slice(1) } })).not.toBe(order(base));
  });

  it("names the last good figures when a source check fails", () => {
    expect(lastGood("dosm")).toMatch(/^\d{4} Q\d, published \d{1,2} [A-Z][a-z]{2} \d{4}$/);
    expect(lastGood("epoch")).toMatch(/^models to \d{4}-\d{2}-\d{2}$/);
    expect(lastGood("opendosm", "2026-10-20T03:00:00Z")).toBe("loaded 20 Oct 2026");
  });
});
