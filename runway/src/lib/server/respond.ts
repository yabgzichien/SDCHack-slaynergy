import { NextResponse } from "next/server";
import { EDUCATION_LABEL, SECTORS, occupations, personas, roles, sdg, skills } from "../engine/data";
import type { SessionState } from "../engine/state";
import { computeView } from "../engine/view";

const GOAL_LABEL: Record<string, string> = {
  "1.3": "Social protection for all",
  "3.8": "Health care and protection from health costs",
  "4.4": "Skills for decent jobs",
  "8.2": "Productivity through technology",
  "8.5": "Decent work for everyone",
  "8.10": "Access to financial services",
  "12.6": "Companies that report on sustainability",
  "16.4": "Fighting illicit money flows",
  "16.5": "Less corruption and bribery",
  "16.6": "Accountable institutions",
  "2.1": "Safe and sufficient food",
  "3.3": "Fighting communicable disease",
  "3.9": "Less harm from pollution and chemicals",
  "4.1": "Quality schooling for all",
  "6.3": "Clean water",
  "7.2": "Renewable energy",
  "7.3": "Energy efficiency",
  "8.8": "Safe workplaces",
  "8.9": "Sustainable tourism",
  "9.1": "Resilient infrastructure",
  "9.4": "Cleaner, efficient industry",
  "16.3": "Access to justice",
};

export const catalog = () => ({
  skills: skills.map((s) => ({ id: s.id, name: s.name, sdg: s.sdg })),
  occupations: occupations.map((o) => ({ id: o.id, title: o.title, skills: o.skills, education: o.education, sector: o.sector })),
  sectors: SECTORS,
  education: Object.entries(EDUCATION_LABEL).map(([id, label]) => ({ id, label })),
  personas: personas.map((p) => ({ id: p.id, name: p.name, label: p.label })),
  goals: [...new Set(roles.map((r) => r.sdg.target))]
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .map((t) => ({ target: t, label: GOAL_LABEL[t] ?? sdg[t].goal, goal: sdg[t].goal, text: sdg[t].text })),
  interests: [
    { id: "numbers", label: "Numbers and analysis" }, { id: "people", label: "Working with people" },
    { id: "technology", label: "Technology" }, { id: "sustainability", label: "Sustainability" },
    { id: "health", label: "Health" }, { id: "justice", label: "Fairness and justice" }, { id: "teaching", label: "Teaching others" },
    { id: "building", label: "Building and fixing things" }, { id: "science", label: "Science and lab work" },
  ],
});

export const respond = (state: SessionState) => NextResponse.json({ state, view: computeView(state), catalog: catalog() });
