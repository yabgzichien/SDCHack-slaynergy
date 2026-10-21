import { EDUCATION_RANK, occupationById, personas, roleById } from "./data";
import { badgeRecord, cardById, completionGate, type BadgeRecord } from "./pathway";
import type { Plan } from "./plan";
import { computeView } from "./view";
import { initialState, STAY_ID, type SessionState, type Signer } from "./state";

// The advisor's one sign-off: confirming a finished pathway before its badge is issued. It runs on the worker's saved session.

export function personaState(personaId: string): SessionState | null {
  const p = personas.find((x) => x.id === personaId);
  if (!p) return null;
  const o = occupationById[p.occupation];
  return {
    ...initialState(),
    profile: { personaId: p.id, name: p.name, age: p.age, state: p.state ?? null, occupationId: p.occupation, education: p.education, study: EDUCATION_RANK[p.education] >= 1 ? o.sector : null, years: p.years, skills: o.skills, interests: p.interests, months: p.months, hoursPerWeek: p.hoursPerWeek, budget: "free", synthetic: true },
  };
}

// A made-up worker who has finished every step and asked for confirmation, so the advisor can demo the badge sign-off.
export function finishedPersonaState(personaId: string, now: string): SessionState | null {
  const s = personaState(personaId);
  const plan = s && computeView(s).plan;
  if (!s || !plan) return null;
  const card = cardById(plan.steps.find((x) => x.activity === "task")?.cardId ?? "");
  return {
    ...s, clock: { t0: now }, chosenRoleId: plan.roleId,
    progress: Object.fromEntries(plan.steps.map((x) => [x.id, true])),
    resume: { skillIds: [], found: [], words: 0 } as unknown as SessionState["resume"],
    pathway: { resumeApplied: true, quiz: card ? { attempts: 1, passed: true, found: [], wrong: [] } : undefined },
    completion: { status: "requested", requestedAt: now },
  };
}

export function confirmCompletion(state: SessionState, plan: Plan | null, by: Signer, note: string, now: string, badgeId: string): { state: SessionState; record: BadgeRecord } | string {
  if (state.completion.status !== "requested") return "There is no finished pathway waiting for confirmation.";
  if (!plan || !completionGate(plan, state).ok) return "The pathway is not finished yet.";
  const record = badgeRecord(plan, state, badgeId, now, by);
  return { record, state: { ...state, completion: { ...state.completion, status: "confirmed", confirmedAt: now, note: note.slice(0, 500), badgeId, by } } };
}

export type CaseStatus = "finished" | "badge";
export type CaseSummary = { id: string; name: string; synthetic: boolean; role: string; status: CaseStatus; waiting: boolean; since?: string; own: boolean };

// What the "Pathways to confirm" list shows. "waiting" means the next move is the advisor's.
export function caseSummary(id: string, state: SessionState, own: boolean): CaseSummary {
  const c = state.completion;
  const status: CaseStatus = c.status === "confirmed" ? "badge" : "finished";
  const roleId = state.chosenRoleId;
  const role = roleId === STAY_ID ? "Staying in their job" : (roleId && roleById[roleId]?.title) || "A job plan";
  return { id, name: state.profile?.name ?? "Unnamed", synthetic: !!state.profile?.synthetic, role, status, waiting: status === "finished", since: c.confirmedAt ?? c.requestedAt, own };
}
