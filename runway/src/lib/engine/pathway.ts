import cardsJson from "../../../data/task-cards.json";
import interviewJson from "../../../data/interview.json";
import type { SectorId } from "./data";
import type { Plan, PlanStep } from "./plan";
import type { PathwayWork, SessionState } from "./state";

// The pathway beyond courses: a short AI quiz after the AI courses (plus an optional portfolio piece) and the people strand (resume, story, STAR, rehearsal).
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
export type Interview = {
  story: { fields: { id: string; label: string; hint: string; example: string }[]; maxWords: number };
  star: {
    source: { name: string; url: string; checked: string };
    parts: { id: string; label: string; hint: string }[];
    questions: { id: string; text: string; hint?: string; fromSource: boolean }[];
  };
  rehearsal: { id: string; text: string }[];
  practiceTool: { name: string; provider: string; url: string; cost: string; checked: string };
};

export const taskCards = cardsJson as unknown as TaskCard[];
export const interview = interviewJson as unknown as Interview;
export const cardForSector = (sector: SectorId | undefined | null) => taskCards.find((c) => c.sector === sector) ?? null;
export const cardById = (id: string) => taskCards.find((c) => c.id === id) ?? null;

// Limits for saved text, so a session can't grow without bound.
export const MAX_TEXT = 2000;
export const SHEET_MIN_CHARS = 15;
export const STAR_MIN_CHARS = 10;

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
export const storyDone = (w: PathwayWork) => filled(w.story, interview.story.fields.map((f) => f.id), 10);
export const starDone = (w: PathwayWork) => interview.star.questions.every((q) => filled(w.star?.[q.id], interview.star.parts.map((p) => p.id), STAR_MIN_CHARS));
export const rehearsalDone = (w: PathwayWork) => interview.rehearsal.every((r) => w.rehearsal?.includes(r.id));

// Steps with an activity are done when the work is saved, not when the box is ticked.
export function stepDone(step: PlanStep, state: SessionState): boolean {
  const w = state.pathway ?? {};
  switch (step.activity) {
    case "task": return taskDone(step.cardId ? cardById(step.cardId) : null, w);
    case "story": return storyDone(w);
    case "star": return starDone(w);
    case "rehearse": return rehearsalDone(w);
    case "resume": return !!state.resume && !!w.resumeApplied;
    default: return !!state.progress[step.id];
  }
}
export const doneMap = (plan: Plan, state: SessionState) => Object.fromEntries(plan.steps.map((s) => [s.id, stepDone(s, state)]));

// What still stands between the worker and a badge.
export function completionGate(plan: Plan | null, state: SessionState): { ok: boolean; missing: string[] } {
  if (!plan) return { ok: false, missing: ["Choose a job and make a plan."] };
  const missing: string[] = [];
  if (state.approval.status !== "approved") missing.push("Your counsellor approves the plan.");
  const left = plan.steps.filter((s) => !stepDone(s, state));
  if (left.length) missing.push(`Finish ${left.length} more step${left.length === 1 ? "" : "s"}.`);
  const task = plan.steps.find((s) => s.activity === "task");
  if (task && !state.pathway?.quiz?.passed) missing.push("Pass the short AI quiz.");
  return { ok: missing.length === 0, missing };
}

export type BadgeRecord = {
  id: string; v: 1; title: string; role: string; strands: string[]; issued: string;
  holder: string; synthetic: boolean;
  steps: { title: string; strand: string; url?: string; provider?: string }[];
  quiz: { card: string; attempts: number } | null;
  portfolio: { card: string; template: string; sheet: Record<string, string> } | null;
  counsellor: { approvedPlanAt?: string; confirmedAt: string };
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
    title: `Runway pathway completed · ${role}`,
    role, strands, issued: now,
    holder: w.showName && state.profile ? state.profile.name : "A Runway learner",
    synthetic: !!state.profile?.synthetic,
    steps: plan.steps.map((s) => ({ title: s.title, strand: s.strand, url: s.url, provider: s.provider })),
    quiz: card && w.quiz ? { card: card.title, attempts: w.quiz.attempts } : null,
    portfolio: w.publishPortfolio && card && w.template?.trim() && w.sheet && sheetDone(card, w) ? { card: card.title, template: w.template, sheet: w.sheet } : null,
    counsellor: { approvedPlanAt: state.approval.approvedAt, confirmedAt: now },
  };
}

// LinkedIn's "Add licence or certification" link, pre-filled.
export function linkedinAddUrl(b: Pick<BadgeRecord, "title" | "id" | "issued">, badgeUrl: string) {
  const d = new Date(b.issued);
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME", name: b.title, organizationName: "Runway",
    issueYear: String(d.getUTCFullYear()), issueMonth: String(d.getUTCMonth() + 1), certUrl: badgeUrl, certId: b.id,
  });
  return `https://www.linkedin.com/profile/add?${q}`;
}
export const linkedinShareUrl = (badgeUrl: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(badgeUrl)}`;
