import { NextResponse } from "next/server";
import { matchRoles, pickInputs } from "@/lib/engine/matching";
import { occupations } from "@/lib/engine/data";
import { computeWorld } from "@/lib/engine/world";
import { initialState } from "@/lib/engine/state";

export const dynamic = "force-dynamic";

// Runs matching on profile pairs that differ ONLY in age/gender and checks that the results are identical.
export async function GET() {
  const w = computeWorld(initialState()).weights;
  let pairs = 0, same = 0;
  for (const o of occupations) {
    const base = { skills: o.skills, months: 5, hoursPerWeek: 10, interests: ["numbers"], goals: [] as string[] };
    const variants: Record<string, unknown>[] = [
      { ...base, age: 24, gender: "female" }, { ...base, age: 58, gender: "male" }, { ...base, age: 41, gender: "non-binary" },
    ];
    const ref = JSON.stringify(matchRoles(pickInputs(variants[0]), w, "2026Q1").map((m) => [m.roleId, m.score]));
    for (const v of variants.slice(1)) {
      pairs++;
      if (JSON.stringify(matchRoles(pickInputs(v), w, "2026Q1").map((m) => [m.roleId, m.score])) === ref) same++;
    }
  }
  return NextResponse.json({ pairs, identical: same, pass: pairs === same, tested: "age and gender are never inputs to matching" });
}
