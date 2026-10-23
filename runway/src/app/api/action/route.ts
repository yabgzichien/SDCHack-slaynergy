import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { computeView } from "@/lib/engine/view";
import { computeWorld } from "@/lib/engine/world";
import { skillById, personas, occupationById, roleById, INTERESTS, isEducation, isStudyField, EDUCATION_RANK } from "@/lib/engine/data";
import { initialState, STAY_ID, type Profile, type SessionState } from "@/lib/engine/state";
import { normaliseOverride } from "@/lib/engine/futures";
import { stateById, isReach } from "@/lib/engine/geo";
import { respond } from "@/lib/server/respond";
import { getSessionId } from "@/lib/server/session";
import { loadState, logEvent, resetState, saveState } from "@/lib/server/store";
import { cardById, gradeQuiz, MAX_TEXT } from "@/lib/engine/pathway";
import { canSwap } from "@/lib/engine/plan";
import { issueBadge, personaState } from "@/lib/engine/review";
import { courseById } from "@/lib/engine/data";
import type { PathwayWork } from "@/lib/engine/state";
import { MAX_PER_ANSWER, moveAllowance } from "@/lib/market-math";

export const dynamic = "force-dynamic";

const INTEREST_IDS = INTERESTS.map((i) => i.id);
const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });
const num = (x: unknown, lo: number, hi: number, d: number) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

function cleanProfile(raw: Record<string, unknown>): Profile | string {
  const status = raw.status === "studying" ? "studying" as const : "working" as const;
  const occ = String(raw.occupationId ?? "");
  if (!occupationById[occ] && !(status === "studying" && occ === "")) return "Choose your previous job from the list.";
  const skills = Array.isArray(raw.skills) ? [...new Set(raw.skills.map(String))].filter((s) => skillById[s]) : [];
  if (skills.length < 1) return "Pick at least one skill you have.";
  const fallbackEdu = occupationById[occ]?.education ?? "degree";
  const education = isEducation(raw.education) ? raw.education : fallbackEdu;
  const fallbackStudy = occupationById[occ]?.sector ?? "business";
  return {
    personaId: raw.personaId ? String(raw.personaId) : undefined,
    name: String(raw.name ?? "You").slice(0, 40) || "You",
    state: typeof raw.state === "string" && stateById[raw.state] ? raw.state : null,
    move: isReach(raw.move) ? raw.move : null,
    moveTo: raw.move === "pick" && Array.isArray(raw.moveTo) ? [...new Set(raw.moveTo.map(String))].filter((s) => stateById[s]).slice(0, 16) : [],
    status,
    age: raw.age === null || raw.age === undefined || raw.age === "" ? null : Math.round(num(raw.age, 16, 80, 0)) || null,
    occupationId: occ,
    education,
    study: EDUCATION_RANK[education] >= 1 ? (isStudyField(raw.study) ? raw.study : fallbackStudy) : null,
    years: Math.round(num(raw.years, 0, 40, 2)),
    skills,
    interests: (Array.isArray(raw.interests) ? raw.interests.map(String) : []).filter((i) => INTEREST_IDS.includes(i)).slice(0, 3),
    // Students count months to graduation, up to two years; job seekers' support lasts at most about six months.
    months: Math.round(num(raw.months, 1, status === "studying" ? 24 : 6, 6)),
    hoursPerWeek: Math.round(num(raw.hoursPerWeek, 1, 40, 10)),
    budget: raw.budget === "low" || raw.budget === "flexible" ? raw.budget : "free",
    synthetic: !!raw.synthetic,
  };
}

const text = (x: unknown) => String(x ?? "").slice(0, MAX_TEXT);
const fields = (x: unknown, keys: string[]) => {
  const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return Object.fromEntries(keys.map((k) => [k, text(r[k])]));
};

// Only known fields are kept, each trimmed to a fixed length.
// A meeting that really happened still counts after the worker changes job or edits their profile.
const keepMeeting = (s: SessionState): PathwayWork => (s.pathway?.advisorMet ? { advisorMet: s.pathway.advisorMet } : {});

function cleanPathway(raw: Record<string, unknown>, cardId: string | undefined): Partial<PathwayWork> {
  const out: Partial<PathwayWork> = {};
  const card = cardId ? cardById(cardId) : null;
  if ("prompt" in raw) out.prompt = text(raw.prompt);
  if ("template" in raw) out.template = text(raw.template);
  if ("sheet" in raw && card) out.sheet = fields(raw.sheet, card.sheetHeadings.map((h) => h.id));
  if ("resumeApplied" in raw) out.resumeApplied = !!raw.resumeApplied;
  if ("showName" in raw) out.showName = !!raw.showName;
  if ("publishPortfolio" in raw) out.publishPortfolio = !!raw.publishPortfolio;
  return out;
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
      const fresh = personaState(String(body.personaId ?? ""));
      const p = personas.find((x) => x.id === body.personaId);
      if (!fresh || !p) return bad("Unknown demo profile.");
      state = fresh;
      await logEvent("profile", sid, { synthetic: true, persona: p.id, months: p.months });
      break;
    }
    case "setProfile": {
      const prof = cleanProfile((body.profile ?? {}) as Record<string, unknown>);
      if (typeof prof === "string") return bad(prof);
      state = { ...state, profile: prof, chosenRoleId: null, progress: {}, pathway: keepMeeting(state), completion: { status: "none" }, courseSwaps: {} };
      await logEvent("profile", sid, { synthetic: prof.synthetic, occupation: prof.occupationId, months: prof.months });
      break;
    }
    case "order": {
      const market = String(body.market ?? "");
      const side = body.side === "no" ? "no" : "yes";
      const action = body.action === "sell" ? "sell" : "buy";
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return bad("Enter an amount greater than zero.");
      const w = computeWorld(state);
      if (action === "buy" && amount > w.you.maxOrder) return bad(`You can put up to ${w.you.maxOrder} points on one guess.`);
      if (w.events.some((e) => e.settled)) return bad("That market has already settled.");
      const strike = w.events.flatMap((e) => e.strikes).find((s) => s.marketId === market);
      if (!strike) return bad("That market is not open.");
      if (action === "buy" && amount > w.user.balance + 1e-6) return bad(`You only have ${w.user.balance.toFixed(0)} points.`);
      const used = strike.executions.filter((x) => x.action === "buy").reduce((a, x) => a + x.points, 0);
      if (action === "buy" && used + amount > MAX_PER_ANSWER + 1e-6) return bad(`You can put at most ${MAX_PER_ANSWER} points into one answer. You have ${Math.max(0, MAX_PER_ANSWER - used).toFixed(0)} left here.`);
      if (action === "sell" && amount > (side === "yes" ? strike.position.yes : strike.position.no) + 1e-6) return bad(`You hold fewer ${side === "yes" ? "Yes" : "No"} contracts than that.`);
      const ev = w.events.find((e) => e.strikes.some((s) => s.marketId === market))!;
      const t = Math.max(0, (Date.now() - ev.clockStart) / 1000);
      if (action === "buy" && moveAllowance(strike.executions, t) < 0.001) return bad("You have moved this answer as far as one player can for now. Try again in a few minutes, or guess on another answer.");
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
    case "homeState": {
      // A new state can reorder the jobs, but the job they chose, its plan and its approval are kept.
      if (!state.profile) return bad("Make a profile first.");
      const st = typeof body.state === "string" && stateById[body.state] ? body.state : null;
      state = { ...state, profile: { ...state.profile, state: st } };
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
      if (id !== STAY_ID && !roleById[id]) return bad("Unknown role.");
      state = { ...state, chosenRoleId: id, progress: {}, pathway: keepMeeting(state), completion: { status: "none" }, courseSwaps: {} };
      break;
    }
    case "swapCourse": {
      // Choose another course for one plan step. It must teach every skill that step covers; null goes back to the suggestion.
      if (state.completion.status === "confirmed") return bad("This pathway is finished and its badge is issued.");
      const plan = computeView(state).plan;
      const key = String(body.skillKey ?? "");
      const step = plan?.steps.find((s) => s.skillKey === key);
      if (!step) return bad("That course is not part of your plan.");
      const courseId = body.courseId === null ? null : String(body.courseId ?? "");
      if (courseId !== null && !canSwap(courseById[courseId], key)) return bad("That course does not cover every skill this step teaches.");
      const swaps = { ...(state.courseSwaps ?? {}) };
      if (courseId === null) delete swaps[key]; else swaps[key] = courseId;
      // A new course starts unticked.
      state = { ...state, courseSwaps: swaps, progress: { ...state.progress, [step.id]: false } };
      await logEvent("course_swapped", sid, { step: step.id, course: courseId ?? "suggested" });
      break;
    }
    case "progress": {
      state = { ...state, progress: { ...state.progress, [String(body.stepId ?? "")]: !!body.done } };
      break;
    }
    case "pathwaySave": {
      if (state.completion.status === "confirmed") return bad("This pathway is finished and its badge is issued.");
      const plan = computeView(state).plan;
      const cardId = plan?.steps.find((s) => s.activity === "task")?.cardId;
      state = { ...state, pathway: { ...state.pathway, ...cleanPathway((body.work ?? {}) as Record<string, unknown>, cardId) } };
      break;
    }
    case "quizSubmit": {
      const plan = computeView(state).plan;
      const card = cardById(plan?.steps.find((s) => s.activity === "task")?.cardId ?? "");
      if (!card) return bad("There is no AI quiz in this plan.");
      const g = gradeQuiz(card, Array.isArray(body.flagged) ? body.flagged.map(String) : []);
      const prev = state.pathway.quiz;
      state = { ...state, pathway: { ...state.pathway, quiz: { attempts: (prev?.attempts ?? 0) + 1, passed: !!prev?.passed || g.passed, found: g.found, wrong: g.wrong } } };
      break;
    }
    case "claimBadge": {
      // Every step done, the advisor meeting included: the badge is logged and issued straight away.
      const r = issueBadge(state, computeView(state).plan, new Date().toISOString(), crypto.randomBytes(9).toString("base64url"));
      if (typeof r === "string") return bad(r);
      await logEvent("badge_issued", sid, r.record);
      state = r.state;
      break;
    }
    default:
      return bad("Unknown action.");
  }
  if (!state.clock) state = { ...state, clock: { t0: new Date().toISOString() } };
  await saveState(sid, state);
  return respond(state);
}
