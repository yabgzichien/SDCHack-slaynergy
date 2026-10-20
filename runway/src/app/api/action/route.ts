import { NextResponse } from "next/server";
import { computeView } from "@/lib/engine/view";
import { computeWorld } from "@/lib/engine/world";
import { skillById, personas, occupationById, roleById, INTERESTS } from "@/lib/engine/data";
import { initialState, type Profile, type SessionState } from "@/lib/engine/state";
import { normaliseOverride } from "@/lib/engine/futures";
import { respond } from "@/lib/server/respond";
import { getSessionId } from "@/lib/server/session";
import { loadState, logEvent, resetState, saveState } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const INTEREST_IDS = INTERESTS.map((i) => i.id);
const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });
const num = (x: unknown, lo: number, hi: number, d: number) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function cleanProfile(raw: Record<string, unknown>): Profile | string {
  const occ = String(raw.occupationId ?? "");
  if (!occupationById[occ]) return "Choose your previous job from the list.";
  const skills = Array.isArray(raw.skills) ? [...new Set(raw.skills.map(String))].filter((s) => skillById[s]) : [];
  if (skills.length < 1) return "Pick at least one skill you have.";
  return {
    personaId: raw.personaId ? String(raw.personaId) : undefined,
    name: String(raw.name ?? "You").slice(0, 40) || "You",
    occupationId: occ,
    education: raw.education === "degree" || raw.education === "spm" || raw.education === "diploma" ? raw.education : occupationById[occ].education,
    years: Math.round(num(raw.years, 0, 40, 2)),
    skills,
    interests: (Array.isArray(raw.interests) ? raw.interests.map(String) : []).filter((i) => INTEREST_IDS.includes(i)).slice(0, 3),
    months: Math.round(num(raw.months, 1, 6, 6)),
    hoursPerWeek: Math.round(num(raw.hoursPerWeek, 1, 40, 10)),
    budget: raw.budget === "low" || raw.budget === "flexible" ? raw.budget : "free",
    synthetic: !!raw.synthetic,
  };
}

export async function POST(req: Request) {
  const sid = (await getSessionId())!;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad("Invalid request."); }
  const type = String(body.type ?? "");
  let state: SessionState = await loadState(sid);
  if (!state.clock) state = { ...state, clock: { t0: new Date().toISOString() } };

  switch (type) {
    case "reset": {
      await resetState(sid);
      state = initialState();
      return respond(state);
    }
    case "startPersona": {
      const p = personas.find((x) => x.id === body.personaId);
      if (!p) return bad("Unknown demo profile.");
      const o = occupationById[p.occupation];
      state = { ...initialState(), profile: { personaId: p.id, name: p.name, occupationId: p.occupation, education: p.education, years: p.years, skills: o.skills, interests: p.interests, months: p.months, hoursPerWeek: p.hoursPerWeek, budget: "free", synthetic: true } };
      await logEvent("profile", sid, { synthetic: true, persona: p.id, months: p.months });
      break;
    }
    case "setProfile": {
      const prof = cleanProfile((body.profile ?? {}) as Record<string, unknown>);
      if (typeof prof === "string") return bad(prof);
      state = { ...state, profile: prof, chosenRoleId: null, approval: { status: "draft" }, progress: {} };
      await logEvent("profile", sid, { synthetic: prof.synthetic, occupation: prof.occupationId, months: prof.months });
      break;
    }
    case "order": {
      const market = String(body.market ?? "");
      const side = body.side === "no" ? "no" : "yes";
      const action = body.action === "sell" ? "sell" : "buy";
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return bad("Enter an amount greater than zero.");
      if (amount > 500) return bad("The most you can trade in one order is 500.");
      const w = computeWorld(state);
      if (w.events.some((e) => e.settled)) return bad("That market has already settled.");
      const strike = w.events.flatMap((e) => e.strikes).find((s) => s.marketId === market);
      if (!strike) return bad("That market is not open.");
      if (action === "buy" && amount > w.user.balance + 1e-6) return bad(`You only have ${w.user.balance.toFixed(0)} points.`);
      if (action === "sell" && amount > (side === "yes" ? strike.position.yes : strike.position.no) + 1e-6) return bad(`You hold fewer ${side === "yes" ? "Yes" : "No"} contracts than that.`);
      const ev = w.events.find((e) => e.strikes.some((s) => s.marketId === market))!;
      const t = Math.max(0, (Date.now() - ev.clockStart) / 1000);
      if (state.orders.length >= 300) return bad("Order limit reached for this session. Press Start over to reset.");
      state = { ...state, orders: [...state.orders, { id: `o${state.orders.length + 1}`, market, t, side, action, amount }] };
      await logEvent("order", sid, { market, side, action, amount: +amount.toFixed(2) });
      break;
    }
    case "release": {
      if (state.release === 1) return bad("The new data has already been released.");
      const before = computeView(state);
      state = { ...state, release: 1, clock: { t0: state.clock?.t0 ?? new Date().toISOString(), t1: new Date().toISOString() } };
      const after = computeView(state);
      await logEvent("data_release", sid, {
        release: "DOSM 2026 Q2 (published 2026-08-18) with Epoch AI data to 2026-06-30",
        settled: after.world.settledEvents.map((e) => { const s = e.strikes.find((x) => x.base)!; return { id: e.id, outcome: s.settled!.outcome, crowd: +s.close.toFixed(3) }; }),
        futures: { before: before.world.futures.map((f) => +f.weight.toFixed(3)), after: after.world.futures.map((f) => +f.weight.toFixed(3)) },
      });
      break;
    }
    case "goals": {
      const goals = (Array.isArray(body.goals) ? body.goals.map(String) : []).filter((g) => /^\d+\.\d+$/.test(g)).slice(0, 8);
      state = { ...state, goals };
      break;
    }
    case "override": {
      const w = body.weights as Record<string, unknown> | null;
      state = { ...state, override: w ? normaliseOverride({ slow: Number(w.slow), medium: Number(w.medium), fast: Number(w.fast) }) : null };
      break;
    }
    case "chooseRole": {
      const id = String(body.roleId ?? "");
      if (!roleById[id]) return bad("Unknown role.");
      state = { ...state, chosenRoleId: id, approval: { status: "draft" }, progress: {} };
      break;
    }
    case "progress": {
      state = { ...state, progress: { ...state.progress, [String(body.stepId ?? "")]: !!body.done } };
      break;
    }
    case "submit": {
      const v = computeView(state);
      if (!v.plan) return bad("Make a profile first.");
      state = { ...state, approval: { status: "submitted", submittedAt: new Date().toISOString(), planRoleId: v.plan.roleId } };
      await logEvent("plan_submitted", sid, { role: v.plan.roleId, weeks: v.plan.totalWeeks });
      break;
    }
    case "approve": {
      if (state.approval.status !== "submitted") return bad("There is no plan waiting for approval.");
      state = { ...state, approval: { ...state.approval, status: "approved", approvedAt: new Date().toISOString(), note: String(body.note ?? "").slice(0, 500) } };
      await logEvent("plan_approved", sid, { role: state.approval.planRoleId, note: state.approval.note ? "added" : "none" });
      break;
    }
    default:
      return bad("Unknown action.");
  }
  if (!state.clock) state = { ...state, clock: { t0: new Date().toISOString() } };
  await saveState(sid, state);
  return respond(state);
}
