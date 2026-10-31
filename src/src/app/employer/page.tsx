"use client";
import { useState } from "react";
import { Check, Database } from "lucide-react";

// Employer / HR view (finalist guide, good-to-have #1): a team skills-gap heatmap and a reskilling plan per team.
// Demo data only: the company, team sizes, usage shares, risk factors and match scores below are illustrative.
// Courses, roles and SDG targets come from data/courses.json, data/roles.json and data/skills.json.
// TODO: compute risk from the skill-expiry engine and team usage from an uploaded staff CSV instead of these tables.

type Scen = "slow" | "medium" | "fast";
const SCENARIOS: { id: Scen; label: string }[] = [
  { id: "slow", label: "Slow AI" },
  { id: "medium", label: "Medium AI" },
  { id: "fast", label: "Fast AI" },
];

type Skill = { short: string; name: string; ilo: string; sdg: string; why: string; risk: Record<Scen, number>; months: Record<Scen, number> };
const SKILLS: Skill[] = [
  { short: "Data entry", name: "Data entry", ilo: "4132", sdg: "8.5", why: "Reskilling away from routine work protects jobs.", risk: { slow: 0.45, medium: 0.75, fast: 0.95 }, months: { slow: 18, medium: 10, fast: 6 } },
  { short: "Book­keeping", name: "Bookkeeping", ilo: "4311", sdg: "8.5", why: "Core back-office skill in finance.", risk: { slow: 0.25, medium: 0.5, fast: 0.8 }, months: { slow: 30, medium: 18, fast: 10 } },
  { short: "Billing", name: "Billing and invoicing", ilo: "4312", sdg: "8.5", why: "Core back-office skill in finance.", risk: { slow: 0.3, medium: 0.6, fast: 0.85 }, months: { slow: 26, medium: 14, fast: 8 } },
  { short: "Customer service", name: "Customer service", ilo: "4222", sdg: "8.5", why: "Customer-facing skill for formal work.", risk: { slow: 0.15, medium: 0.35, fast: 0.6 }, months: { slow: 40, medium: 24, fast: 14 } },
  { short: "Office admin", name: "Office admin", ilo: "4110", sdg: "8.5", why: "General office skill.", risk: { slow: 0.2, medium: 0.45, fast: 0.7 }, months: { slow: 34, medium: 20, fast: 12 } },
  { short: "Spread­sheets", name: "Spreadsheets", ilo: "3313", sdg: "4.4", why: "Digital skill for employment.", risk: { slow: 0.05, medium: 0.15, fast: 0.35 }, months: { slow: 60, medium: 40, fast: 24 } },
  { short: "Commun­ication", name: "Communication", ilo: "3341", sdg: "8.5", why: "People skills carry across jobs.", risk: { slow: 0, medium: 0, fast: 0.05 }, months: { slow: 0, medium: 0, fast: 72 } },
  { short: "AI tools", name: "Working with AI tools", ilo: "", sdg: "8.2", why: "Working alongside AI upgrades productivity.", risk: { slow: 0, medium: 0, fast: 0 }, months: { slow: 0, medium: 0, fast: 0 } },
];

type TeamId = "fin" | "cs" | "ops" | "hr" | "proc";
// use = % of the team that relies on each skill above, in the same order.
const TEAMS: { id: TeamId; name: string; size: number; use: number[] }[] = [
  { id: "fin", name: "Finance", size: 8, use: [75, 100, 88, 13, 25, 100, 63, 25] },
  { id: "cs", name: "Customer Service", size: 10, use: [90, 0, 30, 100, 40, 30, 80, 10] },
  { id: "ops", name: "Operations", size: 9, use: [67, 0, 11, 33, 89, 56, 56, 11] },
  { id: "hr", name: "HR & Admin", size: 6, use: [83, 17, 0, 33, 100, 67, 83, 17] },
  { id: "proc", name: "Procurement", size: 7, use: [71, 14, 57, 14, 43, 86, 71, 14] },
];
const STAFF = TEAMS.reduce((a, t) => a + t.size, 0);

type Plan = { role: string; sdg: string; sdgWhy: string; parts: number[]; raise: string; steps: [title: string, provider: string, hours: number][] };
// parts follow the match-score weights: skill overlap 25, outlook 30, demand 20, reachable 15, interests 10.
const PLANS: Record<TeamId, Plan> = {
  fin: { role: "BI analyst", sdg: "8.2", sdgWhy: "Data skills drive tech upgrading.", parts: [19, 24, 15, 10, 6], raise: "Finish SQL (+4).", steps: [
    ["Excel video training", "Microsoft Support", 6], ["Get started with Power BI", "Microsoft Learn", 4], ["Intro to SQL", "Kaggle Learn", 3], ["Data Visualization", "Kaggle Learn", 4], ["AI Fluency", "Anthropic Academy", 3]] },
  cs: { role: "IT user support", sdg: "8.2", sdgWhy: "Helps others use tech productively.", parts: [15, 23, 14, 10, 6], raise: "Finish IT Essentials (+6).", steps: [
    ["AI Fluency", "Anthropic Academy", 3], ["Work smarter with AI", "Microsoft Learn", 1], ["Introduction to Cybersecurity", "Cisco", 6], ["IT Essentials", "Cisco", 40], ["Improving Communication Skills", "Coursera (Wharton)", 10]] },
  ops: { role: "Logistics analyst", sdg: "8.2", sdgWhy: "Better logistics, higher productivity.", parts: [18, 24, 16, 12, 7], raise: "Add Power BI for 4 staff (+3).", steps: [
    ["Supply Chain Logistics", "Coursera (Rutgers)", 10], ["Excel video training", "Microsoft Support", 6], ["Operations and Process Management", "Coursera (Illinois Tech)", 10], ["Get started with Power BI", "Microsoft Learn", 4], ["Work smarter with AI", "Microsoft Learn", 1]] },
  hr: { role: "Training specialist", sdg: "4.4", sdgWhy: "Training others builds skills directly.", parts: [17, 22, 13, 12, 7], raise: "Run one internal AI workshop (+3).", steps: [
    ["Preparing to Manage HR", "Coursera (Minnesota)", 10], ["Khan Academy for educators", "Khan Academy", 10], ["Managing Employee Compensation", "Coursera (Minnesota)", 12], ["AI Fluency", "Anthropic Academy", 3]] },
  proc: { role: "Procurement officer", sdg: "8.2", sdgWhy: "Keeps supply chains productive.", parts: [22, 22, 16, 14, 8], raise: "Already strong. GRI adds green sourcing.", steps: [
    ["Sourcing, Purchasing, and Procurement", "Alison", 4], ["Supply Chain Logistics", "Coursera (Rutgers)", 10], ["Intro to SQL", "Kaggle Learn", 3], ["GRI Standards", "Global Reporting Initiative", 10], ["AI Fluency", "Anthropic Academy", 3]] },
};
const PARTS: [string, number][] = [["Skill overlap", 25], ["Future outlook", 30], ["Local demand", 20], ["Reachable", 15], ["Interests", 10]];

const SDGS = [
  { target: "8.2", name: "Tech-driven productivity", staff: 34, color: "bg-[#a21942]", why: "4 of 5 target roles." },
  { target: "4.4", name: "Skills for decent jobs", staff: 40, color: "bg-[#c5192d]", why: "Every plan adds a digital skill." },
  { target: "8.5", name: "Full employment", staff: 40, color: "bg-[#a21942]", why: "Reskill, not replace." },
  { target: "12.6", name: "Sustainability reporting", staff: 7, color: "bg-[#bf8b2e]", why: "GRI course in Procurement." },
];

// Amber risk bands, so "at risk" never reads as Jobbery's green "good".
const BANDS = [
  { cls: "bg-surface text-ink", label: "<10%" },
  { cls: "bg-[#fdeccc] text-ink", label: "10–29%" },
  { cls: "bg-[#f7cf8f] text-ink", label: "30–49%" },
  { cls: "bg-[#e3a352] text-ink", label: "50–69%" },
  { cls: "bg-[#8f4f14] text-white", label: "70%+" },
];
const band = (v: number | null) => (v === null ? -1 : v < 10 ? 0 : v < 30 ? 1 : v < 50 ? 2 : v < 70 ? 3 : 4);
const bandCls = (v: number | null) => (v === null ? "bg-raised text-muted border border-dashed border-line" : BANDS[band(v)].cls);

// "New data" simulates a fresher trend snapshot that raises every risk factor by 15%.
const NEW_DATA_BOOST = 1.15;

function cellValue(teamUse: number, skill: Skill, scen: Scen, boost: number): number | null {
  if (!teamUse) return null;
  return Math.round(teamUse * Math.min(1, skill.risk[scen] * boost));
}

export default function EmployerDesk() {
  const [scen, setScen] = useState<Scen>("medium");
  const [teamId, setTeamId] = useState<TeamId>("cs");
  const [skillIx, setSkillIx] = useState(0);
  const [newData, setNewData] = useState(false);

  const boost = newData ? NEW_DATA_BOOST : 1;
  const scenLabel = SCENARIOS.find((s) => s.id === scen)!.label;
  const snapshot = newData ? "[new date]" : "[date]";
  const months = (s: Skill) => Math.round(s.months[scen] / boost);

  const grid = TEAMS.map((t) => SKILLS.map((s, i) => cellValue(t.use[i], s, scen, boost)));
  const changed = newData
    ? TEAMS.reduce((n, t, ti) => n + SKILLS.filter((s, i) => band(grid[ti][i]) > band(cellValue(t.use[i], s, scen, 1))).length, 0)
    : 0;
  const teamMax = TEAMS.map((_, ti) => {
    let max = 0, at = 0;
    grid[ti].forEach((v, i) => { if (v !== null && v > max) { max = v; at = i; } });
    return { max, at };
  });
  const atRisk = TEAMS.reduce((a, t, ti) => a + Math.round((t.size * teamMax[ti].max) / 100), 0);
  const earliest = Math.min(...TEAMS.flatMap((t) => SKILLS.filter((s, i) => t.use[i] && s.risk[scen] > 0).map(months)));
  const hoursOf = (p: Plan) => p.steps.reduce((a, s) => a + s[2], 0);
  const avgHours = Math.round(TEAMS.reduce((a, t) => a + t.size * hoursOf(PLANS[t.id]), 0) / STAFF);

  const ti = TEAMS.findIndex((t) => t.id === teamId);
  const team = TEAMS[ti];
  const skill = SKILLS[skillIx];
  const value = grid[ti][skillIx];
  const users = Math.round((team.size * team.use[skillIx]) / 100);

  const ranked = TEAMS.map((t, i) => ({ t, max: teamMax[i].max })).sort((a, b) => b.max - a.max);
  const plan = PLANS[teamId];
  const hours = hoursOf(plan);
  const weeks = Math.ceil(hours / 4);
  const topSkill = SKILLS[teamMax[ti].at];
  const topMonths = months(topSkill);
  const tight = Math.round(topMonths * 4.3) - weeks < 8;
  const score = plan.parts.reduce((a, b) => a + b, 0);

  const kpis = [
    { label: "Staff", value: String(STAFF), note: `${TEAMS.length} teams` },
    { label: "At risk in 12 mo", value: String(atRisk), note: scenLabel },
    { label: "Earliest expiry", value: `~${earliest} mo`, note: "Data entry" },
    { label: "Learning each", value: `${avgHours} h`, note: "All free" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-7 text-ink sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">Employer desk</span>
        <div className="flex items-center gap-2.5 text-sm">
          <span className="font-semibold">Contoh Logistik Sdn Bhd</span>
          <span className="rounded-full bg-[#fff0d8] px-2.5 py-0.5 text-xs font-semibold text-cueink">Demo data</span>
        </div>
      </div>

      <section id="radar" aria-labelledby="radar-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="radar-h" className="text-3xl font-bold tracking-tight sm:text-4xl">Skills radar</h1>
            <p className="mt-1.5 text-muted">Estimates, not forecasts.</p>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <span id="scen-l" className="text-xs font-semibold uppercase tracking-wider text-muted">AI scenario</span>
            <div role="group" aria-labelledby="scen-l" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
              {SCENARIOS.map((s) => (
                <button key={s.id} type="button" aria-pressed={s.id === scen} onClick={() => setScen(s.id)}
                  className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${s.id === scen ? "bg-ink text-white" : "text-ink"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1.5">
            <Database size={14} aria-hidden /> ILO × Anthropic Economic Index · {snapshot}
          </span>
          <button type="button" onClick={() => setNewData(!newData)}
            className="min-h-10 rounded-full border border-cue bg-raised px-3.5 text-sm font-semibold text-cueink">
            {newData ? "Undo" : "New data"}
          </button>
        </div>

        {newData && (
          <div role="status" className="rounded-xl bg-cuesoft px-3.5 py-2.5 text-sm text-cueink">
            <strong>Re-planned.</strong> {changed} cells moved up a risk band.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-line bg-raised p-4">
              <div className="text-sm text-muted">{k.label}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{k.value}</div>
              <div className="mt-0.5 text-sm text-muted">{k.note}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-[999_1_600px] rounded-2xl border border-line bg-raised p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">Skills-gap heatmap</h2>
              <span className="text-sm text-muted">% of team at risk within 12 months</span>
            </div>
            <div className="mt-3.5 overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th scope="col" className="px-1.5 py-1 text-left text-xs font-semibold text-muted">Team</th>
                    {SKILLS.map((s) => (
                      <th key={s.name} scope="col" className="w-[9%] px-0.5 py-1 align-bottom text-xs font-semibold text-muted">{s.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEAMS.map((t, r) => (
                    <tr key={t.id}>
                      <th scope="row" className="p-0 text-left">
                        <button type="button" onClick={() => setTeamId(t.id)}
                          className={`min-h-13 w-full min-w-36 rounded-lg px-2.5 py-1.5 text-left ${t.id === teamId ? "bg-surface shadow-[inset_3px_0_0_var(--accent)]" : ""}`}>
                          <span className="block text-sm font-semibold">{t.name}</span>
                          <span className="block text-xs text-muted">{t.size} staff</span>
                        </button>
                      </th>
                      {SKILLS.map((s, c) => {
                        const v = grid[r][c];
                        const sel = t.id === teamId && c === skillIx;
                        return (
                          <td key={s.name} className="p-0">
                            <button type="button" aria-pressed={sel}
                              aria-label={`${t.name}, ${s.name}: ${v === null ? "not used" : `${v}% at risk`}`}
                              onClick={() => { setTeamId(t.id); setSkillIx(c); }}
                              className={`h-13 w-full min-w-16 rounded-lg text-[15px] font-semibold tabular-nums ${bandCls(v)} ${sel ? "outline-3 -outline-offset-3 outline-ink" : ""}`}>
                              {v === null ? "—" : `${v}%`}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs text-muted">
              {BANDS.map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`inline-block size-3.5 rounded-sm border border-line ${b.cls}`} />{b.label}
                </span>
              ))}
              <span>— not used</span>
            </div>
          </div>

          <aside aria-labelledby="cell-h" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Why this cell</div>
              <h2 id="cell-h" className="mt-1 text-lg font-bold leading-snug">{team.name} · {skill.name}</h2>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums">{value === null ? "—" : `${value}%`}</span>
              <span className="text-sm text-muted">{value === null ? "not used" : "at risk"}</span>
            </div>
            <ul className="flex list-disc flex-col gap-1 pl-4.5 text-sm">
              <li>{users} of {team.size} staff use it</li>
              <li>{skill.risk[scen] > 0 ? `Automated in ~${months(skill)} mo (${scenLabel})` : "Safe in this window: grow it"}</li>
            </ul>
            <div>
              <div className="mb-1.5 text-sm font-semibold">By scenario</div>
              <div className="grid grid-cols-3 gap-1.5">
                {SCENARIOS.map((s) => {
                  const v = cellValue(team.use[skillIx], skill, s.id, boost);
                  return (
                    <div key={s.id} className={`rounded-lg p-2 text-center ${bandCls(v)} ${s.id === scen ? "outline-2 outline-ink" : ""}`}>
                      <div className="text-xs">{s.label}</div>
                      <div className="text-lg font-bold">{v === null ? "—" : `${v}%`}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl bg-raised p-3 text-sm leading-relaxed">
              <div><strong>Source:</strong> {skill.ilo ? `ILO ISCO ${skill.ilo} × ` : ""}Anthropic Economic Index, {snapshot}</div>
              <div><strong>SDG {skill.sdg}:</strong> {skill.why}</div>
            </div>
            <a href="#plan" className="flex min-h-11 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-white no-underline">View plan</a>
          </aside>
        </div>
      </section>

      <section id="plan" aria-labelledby="plan-h" className="flex flex-col gap-4">
        <div>
          <h2 id="plan-h" className="text-2xl font-bold">Reskilling plan</h2>
          <p className="mt-1.5 text-muted">Ranked by risk. For L&amp;D review, not staffing decisions.</p>
        </div>
        <div role="tablist" aria-label="Teams" className="flex flex-wrap gap-2">
          {ranked.map(({ t }, i) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === teamId} onClick={() => setTeamId(t.id)}
              className={`min-h-11 rounded-full border px-3.5 text-sm ${t.id === teamId ? "border-ink bg-ink text-white" : "border-line bg-raised text-ink"}`}>
              <span className="mr-1.5 font-bold">#{i + 1}</span>{t.name}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 rounded-2xl border border-line bg-raised p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Target role</div>
              <div className="mt-1 text-2xl font-bold">{plan.role}</div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{score}</span>
              <span className="text-sm text-muted">/ 100 match</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {plan.parts.map((v, i) => (
                <div key={PARTS[i][0]}>
                  <div className="flex justify-between text-sm"><span>{PARTS[i][0]}</span><span className="tabular-nums">{v} / {PARTS[i][1]}</span></div>
                  <div className="mt-1 h-2 rounded bg-surface"><div className="h-2 rounded bg-accent" style={{ width: `${Math.round((v / PARTS[i][1]) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-cuesoft px-3 py-2.5 text-sm text-cueink"><strong>To raise it:</strong> {plan.raise}</div>
            <div className="text-sm text-muted">SDG {plan.sdg}: {plan.sdgWhy}</div>
          </div>

          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5 rounded-2xl border border-line bg-raised p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2.5">
              {[["Staff", String(team.size)], ["Hours each", `${hours} h`], ["At 4 h/week", `${weeks} wk`], ["Fees", "RM 0"]].map(([l, v]) => (
                <div key={l}><div className="text-xs text-muted">{l}</div><div className="text-xl font-bold">{v}</div></div>
              ))}
            </div>
            <div className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${tight ? "bg-cuesoft text-cueink" : "bg-surface text-accentink"}`}>
              {tight ? `Start now: ${topSkill.name.toLowerCase()} may go in ~${topMonths} mo.` : `On track: ~${topMonths} mo before skills expire.`}
            </div>
            <ol className="flex flex-col gap-2">
              {[...plan.steps.map(([title, provider, h]) => ({ title, provider, hours: `${h} h`, funding: "Free", hrd: false })),
                { title: "Claimable programme on e-LATiH", provider: "HRD Corp", hours: "Optional", funding: "HRD Corp", hrd: true }].map((s, i) => (
                <li key={s.title + i} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                  <span className="flex size-6.5 flex-none items-center justify-center rounded-full bg-surface text-sm font-bold">{i + 1}</span>
                  <div className="min-w-0 flex-auto">
                    <div className="font-semibold">{s.title}</div>
                    <div className="text-sm text-muted">{s.provider}</div>
                  </div>
                  <div className="flex-none text-right text-sm">
                    <div className="font-semibold">{s.hours}</div>
                    <div className={s.hrd ? "font-semibold text-cueink" : "text-accentink"}>{s.funding}</div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="text-xs text-muted">Courses from Jobbery&apos;s checked list.</div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-stretch gap-5">
        <section id="sdg" aria-labelledby="sdg-h" className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5 rounded-2xl border border-line bg-raised p-4">
          <div>
            <h2 id="sdg-h" className="text-xl font-bold">SDG contribution</h2>
            <p className="mt-1 text-sm text-muted">Summed from every team plan.</p>
          </div>
          {SDGS.map((g) => (
            <div key={g.target} className="flex items-start gap-3">
              <span className={`min-w-13 flex-none rounded-lg px-2 py-1.5 text-center text-sm font-bold text-white ${g.color}`}>{g.target}</span>
              <div className="min-w-0 flex-auto">
                <div className="flex justify-between gap-2 text-sm"><strong>{g.name}</strong><span className="tabular-nums">{g.staff} staff</span></div>
                <div className="my-1.5 h-2 rounded bg-surface"><div className="h-2 rounded bg-accent" style={{ width: `${Math.round((g.staff / STAFF) * 100)}%` }} /></div>
                <div className="text-sm text-muted">{g.why}</div>
              </div>
            </div>
          ))}
        </section>

        <section id="trust" aria-labelledby="trust-h" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 id="trust-h" className="text-xl font-bold">Privacy and fairness</h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            {["Team totals only, no names", "Teams under 5 hidden (PDPA)", "No age or gender inputs", "For training, never layoffs", "Every plan logged"].map((x) => (
              <li key={x} className="flex gap-2.5"><Check size={18} className="flex-none text-accentink" aria-hidden />{x}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
