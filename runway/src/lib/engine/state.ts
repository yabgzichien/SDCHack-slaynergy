import type { Weights3 } from "./futures";
import type { ResumeSummary } from "./resume";
import type { Order } from "./tape";
import type { Education, StudyField } from "./data";

export type Profile = {
  personaId?: string;
  name: string;
  // Optional. Shown to the counsellor only; never an input to matching (see pickInputs and the fairness test).
  age?: number | null;
  // Optional home state (ISO 3166-2:MY code, e.g. "MY-02"). With move, it tells matching where they can work.
  state?: string | null;
  // Where they would work: their state only, nearby states (their region) or anywhere. Older sessions lack it (anywhere).
  move?: "stay" | "region" | "pick" | "anywhere" | null;
  // With move "pick": the other states they would move to.
  moveTo?: string[];
  // Working (or between jobs), or studying for a diploma or higher. Older sessions lack it (working).
  // Students may have no job yet (occupationId ""), and months counts to graduation instead of to a job deadline.
  status?: "working" | "studying";
  occupationId: string; // "" for a student with no job or internship yet
  education: Education;
  // What they studied (diploma and above). Only checks entry to field-locked degree jobs. Older sessions lack it.
  study?: StudyField | null;
  years: number;
  skills: string[];
  interests: string[];
  months: number;
  hoursPerWeek: number;
  budget: "free" | "low" | "flexible";
  synthetic: boolean;
};
export type Signer = { id: string; name: string };
// The worker's own pathway work: the AI quiz, the optional portfolio piece and the resume step. Kept in the session only.
export type PathwayWork = {
  prompt?: string;
  quiz?: { attempts: number; passed: boolean; found: string[]; wrong: string[] };
  template?: string;
  sheet?: Record<string, string>;
  resumeApplied?: boolean;
  // Set when the worker books an advisor meeting (cleared if they cancel); it ticks the plan's meeting step.
  meetingBooked?: { meetingId: string; start: string; at: string };
  // Set when an advisor sends advice after a meeting with this worker; it completes the plan's meeting step.
  advisorMet?: { at: string; by: Signer; meetingId: string; topic: string };
  // Shown on the public badge page only if the worker opts in.
  showName?: boolean;
  publishPortfolio?: boolean;
};
export type Completion = {
  status: "none" | "requested" | "confirmed";
  requestedAt?: string;
  confirmedAt?: string;
  note?: string;
  badgeId?: string;
  by?: Signer;
};
export type Clock = { t0: string; t1?: string };
export type SessionState = {
  v: 1;
  profile: Profile | null;
  // 1: the latest real figures (DOSM 2026 Q2, Epoch AI to Jun 2026) are loaded and every open question is about the
  // future. 0 is the view one release earlier; the app only builds it to list what the latest release changed.
  release: 0 | 1;
  orders: Order[];
  clock: Clock | null;
  goals: string[];
  override: Weights3 | null;
  // A role id, or STAY_ID for staying in (or bridging from) the current job.
  chosenRoleId: string | null;
  progress: Record<string, boolean>;
  resume: ResumeSummary | null;
  pathway: PathwayWork;
  completion: Completion;
  // Courses the worker chose instead of the suggested one, by the gap skills a plan step covers ("a+b" -> course id).
  courseSwaps?: Record<string, string>;
};

export const STAY_ID = "stay";
export const initialState = (): SessionState => ({
  v: 1, profile: null, release: 1, orders: [], clock: null, goals: [], override: null, chosenRoleId: null,
  progress: {}, resume: null,
  pathway: {}, completion: { status: "none" },
});
