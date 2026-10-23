import { EDUCATION_RANK, occupationById, personas } from "./data";
import { badgeRecord, completionGate, type BadgeRecord } from "./pathway";
import type { Plan } from "./plan";
import { initialState, type SessionState, type Signer } from "./state";

// Made-up workers for the advisor demo, the advisor meeting that completes a plan's meeting step, and issuing the badge.

export function personaState(personaId: string): SessionState | null {
  const p = personas.find((x) => x.id === personaId);
  if (!p) return null;
  const o = occupationById[p.occupation];
  return {
    ...initialState(),
    profile: { personaId: p.id, name: p.name, age: p.age, state: p.state ?? null, occupationId: p.occupation, education: p.education, study: EDUCATION_RANK[p.education] >= 1 ? o.sector : null, years: p.years, skills: o.skills, interests: p.interests, months: p.months, hoursPerWeek: p.hoursPerWeek, budget: "free", synthetic: true },
  };
}

// The meeting step is done when an advisor sends advice after meeting this worker. The first meeting with advice counts.
export function recordMeeting(state: SessionState, met: { at: string; by: Signer; meetingId: string; topic: string }): SessionState {
  if (state.pathway?.advisorMet) return state;
  return { ...state, pathway: { ...state.pathway, advisorMet: met } };
}

// The worker claims their badge once every step is done, the advisor meeting included. No separate sign-off is needed:
// the human in the loop is the meeting itself.
export function issueBadge(state: SessionState, plan: Plan | null, now: string, badgeId: string): { state: SessionState; record: BadgeRecord } | string {
  if (state.completion.status === "confirmed") return "This pathway is finished and its badge is issued.";
  if (!plan || !completionGate(plan, state).ok) return "The pathway is not finished yet.";
  const record = badgeRecord(plan, state, badgeId, now);
  return { record, state: { ...state, completion: { status: "confirmed", confirmedAt: now, badgeId, by: state.pathway.advisorMet?.by } } };
}
