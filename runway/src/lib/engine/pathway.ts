import cardsJson from "../../../data/task-cards.json";
import type { SectorId } from "./data";
import type { Plan, PlanStep } from "./plan";
import type { PathwayWork, SessionState, Signer } from "./state";

// The pathway beyond courses: a short AI quiz after the AI courses (plus an optional portfolio piece) and the people strand (resume rewrite, then existing interview and communication courses).
// Everything here is pre-written and hand-checked. Nothing calls an AI model; the "AI answer" is a labelled sample.

export type TaskCard = {
  id: string; sector: SectorId; title: string; intro: string;
  onet: { code: string; occupation: string; task: string; url: string; checked: string };
  dataTitle: string;
  rows: { line: string; budget: number; actual: number; note: string }[];
  promptGuide: { id: string; text: string; keywords: string[] }[];
  sampleAnswer: { id: string; text: string; mistake?: { kind: string; why: string } }[];
  sheetHeadings: { id: string; label: string; hint: string }[];
};
export const taskCards = cardsJson as unknown as TaskCard[];
export const cardForSector = (sector: SectorId | undefined | null) => taskCards.find((c) => c.sector === sector) ?? null;
export const cardById = (id: string) => taskCards.find((c) => c.id === id) ?? null;

// Limits for saved text, so a session can't grow without bound.
export const MAX_TEXT = 2000;
export const SHEET_MIN_CHARS = 15;

// Which prompt-writing tips the prompt covers. Keyword checks only.
export function promptChecklist(card: TaskCard, prompt: string): string[] {
  const p = prompt.toLowerCase();
  return card.promptGuide.filter((g) => g.keywords.some((k) => p.includes(k))).map((g) => g.id);
}

// Pass: every planted mistake found, with at most one sentence wrongly flagged.
export const MAX_WRONG = 1;
export function gradeQuiz(card: TaskCard, flagged: string[]) {
  const ids = new Set(card.sampleAnswer.map((a) => a.id));
  const picks = [...new Set(flagged)].filter((id) => ids.has(id));
  const mistakes = card.sampleAnswer.filter((a) => a.mistake).map((a) => a.id);
  const found = picks.filter((id) => mistakes.includes(id));
  const wrong = picks.filter((id) => !mistakes.includes(id));
  return { found, wrong, total: mistakes.length, passed: found.length === mistakes.length && wrong.length <= MAX_WRONG };
}

const filled = (r: Record<string, string> | undefined, keys: string[], min: number) => !!r && keys.every((k) => (r[k] ?? "").trim().length >= min);
export const sheetDone = (card: TaskCard, w: PathwayWork) => filled(w.sheet, card.sheetHeadings.map((h) => h.id), SHEET_MIN_CHARS);
// The quiz is the required part; the reusable prompt and the how-I-do-it sheet are an optional portfolio piece.
export const taskDone = (card: TaskCard | null, w: PathwayWork) => !!card && !!w.quiz?.passed;

// Steps with an activity are done when the work is saved, not when the box is ticked.
export function stepDone(step: PlanStep, state: SessionState): boolean {
  const w = state.pathway ?? {};
  switch (step.activity) {
    case "task": return taskDone(step.cardId ? cardById(step.cardId) : null, w);
    case "resume": return !!w.resumeApplied;
    case "meeting": return !!w.advisorMet || !!w.meetingBooked;
    default: return !!state.progress[step.id];
  }
}
export const doneMap = (plan: Plan, state: SessionState) => Object.fromEntries(plan.steps.map((s) => [s.id, stepDone(s, state)]));

// Motivation badges: earned as the worker goes, one per finished step plus a few milestones. They are self-reported progress
// (a ticked course is the worker's word), so they are labelled as such. The pathway badge, logged when every step is done, is the shareable one.
export type Achievement = { id: string; title: string; detail: string; kind: "skill" | "ai" | "people" | "milestone"; earned: boolean };
export function achievements(plan: Plan | null, state: SessionState): Achievement[] {
  if (!plan) return [];
  const out: Achievement[] = [];
  let finished = 0;
  for (const s of plan.steps) {
    const earned = stepDone(s, state);
    if (earned) finished++;
    if (s.activity === "task") out.push({ id: `${s.id}-ai`, title: "AI checker", detail: "Found every planted mistake in an AI-written answer.", kind: "ai", earned });
    else if (s.activity === "meeting") out.push({ id: `${s.id}-met`, title: state.pathway?.advisorMet ? "Met an advisor" : "Advisor meeting booked", detail: state.pathway?.advisorMet ? "Had a session with an advisor and got their advice." : "Booked a session with an advisor.", kind: "people", earned });
    else if (s.activity === "resume") out.push({ id: `${s.id}-resume`, title: "Resume updated", detail: "Updated your resume with your new skills and fixes.", kind: "people", earned });
    else if (s.strand === "ai") out.push({ id: `${s.id}-ai`, title: s.title, detail: "Finished an AI-at-work step.", kind: "ai", earned });
    else if (s.kind === "apply" || s.kind === "adapt") out.push({ id: `${s.id}-skill`, title: s.kind === "apply" ? "Applied for jobs" : "Put it to work", detail: `Finished: ${s.title}`, kind: "skill", earned });
    else if (s.strand === "job") {
      const names = s.skills.map((k) => k.name);
      out.push({ id: `${s.id}-skill`, title: names.length ? names.join(" + ") : "Job skill", detail: `Finished: ${s.title}`, kind: "skill", earned });
    } else out.push({ id: `${s.id}-people`, title: s.title, detail: "Finished a people-skills step.", kind: "people", earned });
  }
  const n = plan.steps.length;
  out.push({ id: "m-first", title: "First step", detail: "Finished your first step.", kind: "milestone", earned: finished >= 1 });
  out.push({ id: "m-half", title: "Halfway", detail: "Finished half of your plan.", kind: "milestone", earned: n > 0 && finished * 2 >= n });
  out.push({ id: "m-all", title: "Every step done", detail: "Finished all steps. Your pathway badge is ready.", kind: "milestone", earned: n > 0 && finished === n });
  return out;
}

// What still stands between the worker and a badge.
export function completionGate(plan: Plan | null, state: SessionState): { ok: boolean; missing: string[] } {
  if (!plan) return { ok: false, missing: ["Choose a job and make a plan."] };
  const missing: string[] = [];
  const left = plan.steps.filter((s) => !stepDone(s, state));
  if (left.length) missing.push(`Finish ${left.length} more step${left.length === 1 ? "" : "s"}.`);
  const task = plan.steps.find((s) => s.activity === "task");
  if (task && !state.pathway?.quiz?.passed) missing.push("Pass the short AI quiz.");
  if (plan.steps.some((s) => s.activity === "meeting") && !state.pathway?.advisorMet) missing.push("Meet an advisor and get their advice.");
  return { ok: missing.length === 0, missing };
}

export type BadgeRecord = {
  id: string; v: 1; title: string; role: string; strands: string[]; issued: string;
  holder: string; synthetic: boolean;
  steps: { title: string; strand: string; url?: string; provider?: string }[];
  quiz: { card: string; attempts: number } | null;
  portfolio: { card: string; template: string; sheet: Record<string, string> } | null;
  // The advisor meeting that is part of every plan. Badges issued before it existed carry "counsellor" instead.
  met?: { advisor: Signer; at: string; topic: string };
  // Older badges only: an advisor confirmed completion (and, earlier still, approved the plan).
  counsellor?: { approvedPlanAt?: string; confirmedAt: string; approvedBy?: Signer; confirmedBy?: Signer };
};

// The public badge record. The name and the portfolio appear only if the worker opted in.
export function badgeRecord(plan: Plan, state: SessionState, id: string, now: string): BadgeRecord {
  const w = state.pathway ?? {};
  const task = plan.steps.find((s) => s.activity === "task");
  const card = task?.cardId ? cardById(task.cardId) : null;
  const strands = ["AI at work", "Interview-ready"];
  const role = plan.kind === "reshape" ? plan.title.replace(/^staying in your job as /, "") : plan.title;
  return {
    id, v: 1,
    title: `Jobbery pathway completed · ${role}`,
    role, strands, issued: now,
    holder: w.showName && state.profile ? state.profile.name : "A Jobbery learner",
    synthetic: !!state.profile?.synthetic,
    steps: plan.steps.map((s) => ({ title: s.title, strand: s.strand, url: s.url, provider: s.provider })),
    quiz: card && w.quiz ? { card: card.title, attempts: w.quiz.attempts } : null,
    portfolio: w.publishPortfolio && card && w.template?.trim() && w.sheet && sheetDone(card, w) ? { card: card.title, template: w.template, sheet: w.sheet } : null,
    met: w.advisorMet ? { advisor: w.advisorMet.by, at: w.advisorMet.at, topic: w.advisorMet.topic } : undefined,
  };
}

// LinkedIn's "Add licence or certification" link, pre-filled.
export function linkedinAddUrl(b: Pick<BadgeRecord, "title" | "id" | "issued">, badgeUrl: string) {
  const d = new Date(b.issued);
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME", name: b.title, organizationName: "Jobbery",
    issueYear: String(d.getUTCFullYear()), issueMonth: String(d.getUTCMonth() + 1), certUrl: badgeUrl, certId: b.id,
  });
  return `https://www.linkedin.com/profile/add?${q}`;
}
export const linkedinShareUrl = (badgeUrl: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(badgeUrl)}`;
