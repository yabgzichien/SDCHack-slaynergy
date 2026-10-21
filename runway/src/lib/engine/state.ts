import type { Weights3 } from "./futures";
import type { ResumeSummary } from "./resume";
import type { Order } from "./tape";
import type { Education, StudyField } from "./data";

export type Profile = {
  personaId?: string;
  name: string;
  // Optional. Shown to the counsellor only; never an input to matching (see pickInputs and the fairness test).
  age?: number | null;
  // Optional home state (ISO 3166-2:MY code, e.g. "MY-02"). Used only by the job map; never an input to matching.
  state?: string | null;
  occupationId: string;
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
export type Approval = {
  status: "draft" | "submitted" | "approved";
  submittedAt?: string;
  approvedAt?: string;
  note?: string;
  planRoleId?: string;
};
// The worker's own pathway work: the AI quiz, the optional portfolio piece and the resume step. Kept in the session only.
export type PathwayWork = {
  prompt?: string;
  quiz?: { attempts: number; passed: boolean; found: string[]; wrong: string[] };
  template?: string;
  sheet?: Record<string, string>;
  resumeApplied?: boolean;
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
};
export type Clock = { t0: string; t1?: string };
export type SessionState = {
  v: 1;
  profile: Profile | null;
  release: 0 | 1;
  orders: Order[];
  clock: Clock | null;
  goals: string[];
  override: Weights3 | null;
  // A role id, or STAY_ID for staying in (or bridging from) the current job.
  chosenRoleId: string | null;
  approval: Approval;
  progress: Record<string, boolean>;
  resume: ResumeSummary | null;
  pathway: PathwayWork;
  completion: Completion;
};

export const STAY_ID = "stay";
export const initialState = (): SessionState => ({
  v: 1, profile: null, release: 0, orders: [], clock: null, goals: [], override: null, chosenRoleId: null,
  approval: { status: "draft" }, progress: {}, resume: null,
  pathway: {}, completion: { status: "none" },
});
