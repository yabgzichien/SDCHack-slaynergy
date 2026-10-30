import { BriefcaseBusiness, CalendarClock, FileText, GraduationCap, HeartPulse, MapPin, Sparkles, UserRound, type LucideIcon } from "lucide-react";

// The eight questions of step 1 ("About you"), shared by the wizard and the summary of its answers.
export const STEPS = ["name", "resume", "job", "education", "skills", "time", "interests", "where"] as const;
export type Step = (typeof STEPS)[number];
export const STEP_LABEL: Record<Step, string> = { name: "You", resume: "Resume", job: "Last job", education: "Qualification", skills: "Skills", time: "Time", interests: "Interests", where: "Where" };
export const STEP_ICON: Record<Step, LucideIcon> = { name: UserRound, resume: FileText, job: BriefcaseBusiness, education: GraduationCap, skills: Sparkles, time: CalendarClock, interests: HeartPulse, where: MapPin };

// Levels that have a field of study. Below these (SPM, SKM, STPM) the study question is not asked.
export const HAS_FIELD = ["diploma", "degree", "master", "phd"];
