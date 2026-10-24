import { BookOpen, Bot, Trophy, Users, type LucideIcon } from "lucide-react";

// One colour per plan strand, used by the plan list, the timeline strip and the badges, so a colour always means the
// same thing: blue job skills, amber AI at work, purple people skills, gold milestones. Green stays "done".
export type StrandKey = "job" | "ai" | "people" | "milestone";
export const STRAND_STYLE: Record<StrandKey, { label: string; icon: LucideIcon; bar: string; soft: string; ink: string; solid: string }> = {
  job: { label: "Job skills", icon: BookOpen, bar: "border-l-lanelearn", soft: "bg-lanelearnsoft", ink: "text-lanelearnink", solid: "bg-lanelearn" },
  ai: { label: "AI at work", icon: Bot, bar: "border-l-laneai", soft: "bg-laneaisoft", ink: "text-laneaiink", solid: "bg-laneai" },
  people: { label: "People skills", icon: Users, bar: "border-l-laneresume", soft: "bg-laneresumesoft", ink: "text-laneresumeink", solid: "bg-laneresume" },
  milestone: { label: "Milestone", icon: Trophy, bar: "border-l-gold", soft: "bg-goldsoft", ink: "text-laneaiink", solid: "bg-gold" },
};
