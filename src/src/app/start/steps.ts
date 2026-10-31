import { BriefcaseBusiness, CalendarClock, FileText, GraduationCap, HeartPulse, Sparkles, UserRound, type LucideIcon } from "lucide-react";

// The seven questions of step 1 ("About you"), shared by the wizard and the summary of its answers.
export const STEPS = ["name", "resume", "job", "education", "skills", "time", "interests"] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABEL: Record<Step, string> = { name: "You", resume: "Resume", job: "Last job", education: "Qualification", skills: "Skills", time: "Time", interests: "Interests" };
export const STEP_ICON: Record<Step, LucideIcon> = { name: UserRound, resume: FileText, job: BriefcaseBusiness, education: GraduationCap, skills: Sparkles, time: CalendarClock, interests: HeartPulse };

// Levels that have a field of study. Below these (SPM, SKM, STPM) the study question is not asked.
export const HAS_FIELD = ["diploma", "degree", "master", "phd"];
