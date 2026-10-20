import type { Weights3 } from "./futures";
import type { ResumeSummary } from "./resume";
import type { Order } from "./tape";
import type { Education } from "./data";

export type Profile = {
  personaId?: string;
  name: string;
  occupationId: string;
  education: Education;
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
export type Clock = { t0: string; t1?: string };
export type SessionState = {
  v: 1;
  profile: Profile | null;
  release: 0 | 1;
  orders: Order[];
  clock: Clock | null;
  goals: string[];
  override: Weights3 | null;
  chosenRoleId: string | null;
  approval: Approval;
  progress: Record<string, boolean>;
  resume: ResumeSummary | null;
};

export const initialState = (): SessionState => ({
  v: 1, profile: null, release: 0, orders: [], clock: null, goals: [], override: null, chosenRoleId: null,
  approval: { status: "draft" }, progress: {}, resume: null,
});
