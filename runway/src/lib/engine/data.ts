import seriesJson from "../../../data/series.json";
import skillsJson from "../../../data/skills.json";
import rolesJson from "../../../data/roles.json";
import coursesJson from "../../../data/courses.json";
import occupationsJson from "../../../data/occupations.json";
import personasJson from "../../../data/personas.json";
import sdgJson from "../../../data/sdg.json";

export type DosmQuarter = {
  q: string; total: number; managers: number; professionals: number; technicians: number;
  clerical: number; service: number; craft: number; operators: number; elementary: number; clerical_share: number;
};
export type EpochSeries = { name: string; unit: string; short: string; replayOnly?: boolean; frontier: { q: string; v: number }[] };
export type Source = { id: string; name: string; url: string; retrieved: string; latest: string; licence: string; next?: string };

export type Skill = { id: string; name: string; ilo: string | null; onet: string[]; sdg: { target: string; why: string }; complement: boolean };
// A person's highest qualification. Jobs only ever require spm, diploma or degree; the other levels map onto those three
// for the entry check (a master's or PhD meets a degree requirement). Qualification is never a ranking input.
export type Education = "spm" | "skm" | "stpm" | "diploma" | "degree" | "master" | "phd";
export const EDUCATION_RANK: Record<Education, number> = { spm: 0, skm: 0, stpm: 0, diploma: 1, degree: 2, master: 2, phd: 2 };
export const EDUCATION_LABEL: Record<Education, string> = {
  spm: "SPM", skm: "Skills certificate (SKM)", stpm: "STPM, Matriculation or Foundation", diploma: "Diploma",
  degree: "Bachelor's degree", master: "Master's degree", phd: "PhD",
};
export const isEducation = (x: unknown): x is Education => typeof x === "string" && x in EDUCATION_RANK;
// What a person studied, for diploma level and above. "other" means a field outside this app's sectors.
export type StudyField = SectorId | "other";
export type SectorId = "finance" | "business" | "computing" | "engineering" | "science" | "health" | "service" | "logistics" | "trades" | "education";
export const SECTORS: { id: SectorId; label: string; blurb: string }[] = [
  { id: "computing", label: "Computing and IT", blurb: "Software, testing, networks, data" },
  { id: "engineering", label: "Engineering", blurb: "Civil, mechanical, electrical, quality" },
  { id: "science", label: "Science and laboratory", blurb: "Chemistry, biology, food, environment" },
  { id: "finance", label: "Finance and accounting", blurb: "Accounts, credit, compliance, claims" },
  { id: "business", label: "Business and administration", blurb: "Management, HR, legal, communications" },
  { id: "service", label: "Sales and service", blurb: "Retail, sales, hospitality, customer care" },
  { id: "logistics", label: "Logistics and operations", blurb: "Supply chain, warehouse, planning" },
  { id: "health", label: "Health and care", blurb: "Lab, pharmacy, patient support, outreach" },
  { id: "trades", label: "Skilled trades and technical", blurb: "Electrical, HVAC, machining, maintenance" },
  { id: "education", label: "Education and training", blurb: "Teaching support, curriculum, training" },
];
export const isStudyField = (x: unknown): x is StudyField => x === "other" || SECTORS.some((s) => s.id === x);
// Degree jobs that need a degree in their own field (professional registration, such as BEM for engineers or MIA for
// accountants). A degree in another field does not open them.
const FIELD_LOCKED_SECTORS: SectorId[] = ["engineering", "science", "health"];
const FIELD_LOCKED_ROLES = ["accountant", "auditor"];
export const fieldLocked = (r: { id: string; sector: SectorId; requires: Education }) =>
  r.requires === "degree" && (FIELD_LOCKED_SECTORS.includes(r.sector) || FIELD_LOCKED_ROLES.includes(r.id));
export type Role = {
  id: string; title: string; onet: string; group: GroupKey; skills: Record<string, number>;
  sdg: { target: string; why: string }; tags: string[]; minWeeks: number;
  sector: SectorId; requires: Education; closest: boolean;
};
export type Course = {
  id: string; title: string; provider: string; url: string; hours: number; cost: string; funding: string;
  skills: string[]; checked: string; linkStatus: string;
  // "ai" or "people": taught in every plan's AI-at-work or people-skills strand, so gap matching leaves it out.
  strand?: "ai" | "people";
};
// evolved: the target role that is this same job as it is changing (more AI review and design, less routine work), if one exists.
export type Occupation = { id: string; title: string; isco: string; iscoTitle: string; skills: string[]; education: Education; sector: SectorId; evolved?: string };
export type Persona = {
  id: string; name: string; label: string; age: number; occupation: string; years: number; months: number;
  hoursPerWeek: number; interests: string[]; synthetic: boolean; education: Education; state?: string;
};
export const INTERESTS: { id: string; label: string }[] = [
  { id: "numbers", label: "Numbers and analysis" }, { id: "people", label: "Working with people" },
  { id: "technology", label: "Technology" }, { id: "sustainability", label: "Sustainability" },
  { id: "health", label: "Health" }, { id: "justice", label: "Fairness and justice" }, { id: "teaching", label: "Teaching others" },
  { id: "building", label: "Building and fixing things" }, { id: "science", label: "Science and lab work" },
];
export type GroupKey = "managers" | "professionals" | "technicians" | "clerical" | "service" | "craft" | "operators";

const s = seriesJson as unknown as {
  generatedAt: string;
  sources: Source[];
  dosm: { publishedAt: Record<string, string>; quarters: DosmQuarter[] };
  epoch: Record<string, EpochSeries>;
  aei: Record<string, { title: string; tasks: number; coverage: number; usage: number }>;
  ilo: Record<string, { title: string; score: number; gradient: string | null }>;
};

export const series = s;
export const skills = skillsJson as unknown as Skill[];
export const roles = rolesJson as unknown as Role[];
export const courses = coursesJson as unknown as Course[];
export const occupations = occupationsJson as unknown as Occupation[];
export const personas = personasJson as unknown as Persona[];
export const sdg = sdgJson as unknown as Record<string, { goal: string; text: string; source: string }>;

export const skillById = Object.fromEntries(skills.map((x) => [x.id, x]));
export const roleById = Object.fromEntries(roles.map((x) => [x.id, x]));
export const courseById = Object.fromEntries(courses.map((x) => [x.id, x]));
export const occupationById = Object.fromEntries(occupations.map((x) => [x.id, x]));
export const sourceById = Object.fromEntries(s.sources.map((x) => [x.id, x]));

export const GROUP_LABEL: Record<GroupKey, string> = {
  managers: "Managers", professionals: "Professionals", technicians: "Technicians and associate professionals",
  clerical: "Clerical support workers", service: "Service and sales workers",
  craft: "Craft and related trades workers", operators: "Plant and machine operators and assemblers",
};

export const quarterIndex = (q: string) => Number(q.slice(0, 4)) * 4 + Number(q[5]) - 1;
export const prevQuarter = (q: string) => { let y = +q.slice(0, 4), n = +q[5] - 1; if (n === 0) { n = 4; y--; } return `${y}Q${n}`; };
export const nextQuarter = (q: string) => { let y = +q.slice(0, 4), n = +q[5] + 1; if (n === 5) { n = 1; y++; } return `${y}Q${n}`; };

// Quarter end as a readable date for "settles on" labels.
export const quarterLabel = (q: string) => `${q.slice(0, 4)} Q${q[5]}`;
