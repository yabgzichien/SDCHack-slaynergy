import { describe, expect, it } from "vitest";
import { personas } from "@/lib/engine/data";
import { computeView } from "@/lib/engine/view";
import { computeStakes, computeWorld } from "@/lib/engine/world";
import { demandFor, matchRoles, pickInputs, PROJECT_QUARTERS } from "@/lib/engine/matching";
import { FUTURES } from "@/lib/engine/futures-def";
import { personaState } from "@/lib/engine/review";
import { replayHistory, updateScores } from "@/lib/engine/replay";
import { futureWeights } from "@/lib/engine/futures";

const now = () => ({ t0: new Date().toISOString() });
const viewOf = (id: string) => computeView({ ...personaState(id)!, clock: now() });

describe("AI speed previews (must-have 6)", () => {
  it("Slow and Fast change the suggested job or the top 5 for at least 3 of the 4 personas", () => {
    let moved = 0;
    for (const p of personas) {
      const v = viewOf(p.id), sc = v.scenarios!;
      const slow = sc.find((s) => s.id === "slow")!, fast = sc.find((s) => s.id === "fast")!;
      const top5 = (s: typeof slow) => Object.entries(s.roles).sort((a, b) => a[1].rank - b[1].rank).slice(0, 5).map(([id]) => id).sort().join();
      if (slow.best?.roleId !== fast.best?.roleId || top5(slow) !== top5(fast)) moved++;
    }
    expect(moved).toBeGreaterThanOrEqual(3);
  });

  it("ranks exactly the jobs Our forecast can reach, with the same plan lengths", () => {
    const v = viewOf(personas[0].id);
    const ids = v.matches.map((m) => m.roleId).sort();
    for (const s of v.scenarios!) {
      expect(Object.keys(s.roles).sort()).toEqual(ids);
      expect(s.best!.weeks).toBe(v.matches.find((m) => m.roleId === s.best!.roleId)!.weeks);
    }
  });

  it("uses each speed on its own (100%), and projects office-admin ads with that speed's drift", () => {
    const sc = viewOf(personas[0].id).scenarios!;
    for (const f of FUTURES) {
      const s = sc.find((x) => x.id === f.id)!;
      expect(s.weights[f.id]).toBe(1);
      expect(s.clerical.projected).toBeCloseTo(s.clerical.now + f.clericalDriftPp * PROJECT_QUARTERS, 9);
    }
    const proj = (id: string) => sc.find((x) => x.id === id)!.clerical.projected;
    expect(proj("fast")).toBeLessThan(proj("medium"));
    expect(proj("medium")).toBeLessThan(proj("slow"));
  });

  it("the drift moves only office-admin demand, and Our forecast keeps the real DOSM figures", () => {
    const q = "2026Q2";
    expect(demandFor("clerical", q, -1.4).score).toBeLessThan(demandFor("clerical", q).score);
    expect(demandFor("clerical", q, -1.4).projectedPp).toBe(-1.4);
    expect(demandFor("clerical", q).projectedPp).toBeUndefined();
    const v = viewOf(personas[0].id), p = personaState(personas[0].id)!.profile!;
    const input = pickInputs({ skills: p.skills, months: p.months, hoursPerWeek: p.hoursPerWeek, interests: p.interests, goals: [], education: p.education });
    const plain = matchRoles(input, v.world.weights, v.world.asOfQuarter), shifted = matchRoles(input, v.world.weights, v.world.asOfQuarter, -1.4);
    for (const m of plain) {
      const s = shifted.find((x) => x.roleId === m.roleId)!;
      if (m.group === "clerical") expect(s.demand.score).toBeLessThanOrEqual(m.demand.score);
      else expect(s.demand.score).toBe(m.demand.score);
    }
  });

  it("is left out of the 'before' view used to list what a release changed", () => {
    const v = viewOf(personas[0].id);
    expect(v.scenarios).not.toBeNull();
    expect(v.changes).not.toBeNull();
  });
});

describe("what the open questions decide (stakes)", () => {
  const st = { ...personaState(personas[0].id)!, clock: now() };
  const w = computeWorld(st);

  it("settles every combination of the open questions' main answers", () => {
    const n = w.events.length;
    expect(n).toBeGreaterThan(0);
    expect(w.stakes!.questions.length).toBe(n);
    expect(w.stakes!.outcomes.length).toBe(2 ** n);
    expect(new Set(w.stakes!.outcomes.map((o) => o.answers.join())).size).toBe(2 ** n);
    for (const o of w.stakes!.outcomes) expect(o.weights.slow + o.weights.medium + o.weights.fast).toBeCloseTo(1, 9);
  });

  it("settles each release in turn: one question alone matches settling it directly", () => {
    type Run = Parameters<typeof computeStakes>[1][number];
    const run = (id: string, kind: "dosm" | "epoch") => ({ probs: { slow: 0.3, medium: 0.5, fast: 0.7 }, q: { id, kind } }) as unknown as Run;
    const S = replayHistory().scores, none = { slow: 0, medium: 0, fast: 0 };
    // One question: the two outcomes are exactly updateScores with no crowd tilt left.
    const x = run("x", "epoch");
    const direct = (o: boolean) => futureWeights(updateScores(S, [{ ...x, q: { ...x.q, outcome: o } }]), none);
    expect(computeStakes(S, [x], ["dosm", "epoch"]).outcomes.map((o) => o.weights)).toEqual([direct(false), direct(true)]);
    // Two releases fade the older scores twice; one release fades them once.
    const start = { slow: 5, medium: 0, fast: 0 };
    const split = computeStakes(start, [run("a", "dosm"), run("b", "epoch")], ["dosm", "epoch"]);
    const same = computeStakes(start, [run("a", "epoch"), run("b", "epoch")], ["dosm", "epoch"]);
    expect(split.outcomes[0].weights.slow).toBeLessThan(same.outcomes[0].weights.slow);
  });
});
