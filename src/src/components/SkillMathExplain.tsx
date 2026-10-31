"use client";
import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FORECAST, SPEEDS } from "@/lib/speed";
import { useApp } from "@/components/AppProvider";
import { useT } from "@/components/I18nProvider";
import { useSpeed } from "@/components/useSpeed";
import { Btn, Card, Chip, Estimate, More, NextRow, PageTitle, Skeleton, SourceChip } from "@/components/ui";
import { M, bar, frac, fn, gap, n, o, sub, sum, sup, txt, v } from "@/components/mathml";
import { SM } from "@/components/skill-math-text";
import { fmtYear, isCounted, readiness } from "@/lib/engine/expiry-math";
import type { SkillMath, SkillMathRow } from "@/lib/engine/expiry-math";
import type { FutureId } from "@/lib/engine/futures-def";

// Why the Skills page says "AI could do most of N of your M skills before 2031". Every number comes from view.skillMath, which
// engine/skill-math.ts builds from the same functions and data that make the dates (expiry-math.ts, expiry.ts, futures.ts).
// Formulas are MathML. The words are in skill-math-text.ts.

const f2 = (x: number) => x.toFixed(2);
const f4 = (x: number) => x.toFixed(4);
const trim = (x: number, d: number) => String(+x.toFixed(d)); // 0.6640 -> "0.664"
const yr = (x: number) => x.toFixed(2);

type Key = "forecast" | FutureId;
const dateOf = (r: SkillMathRow, k: Key) => (k === FORECAST ? r.forecast : r.dates[k as FutureId]);
// The same rule as the Skills page: a skill with no date never counts.
const counted = (r: SkillMathRow, k: Key) => isCounted(dateOf(r, k));

function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink">{children}</p>;
}
function Legend({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}
function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mt-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-2 space-y-2 text-sm text-muted">{children}</div>
    </Card>
  );
}
const th = "px-2 py-1.5 text-left font-medium";
const td = "px-2 py-1.5";

// Readiness over time for one skill, under each speed, against the flag line. Drawn from expiry-math's own readiness().
const LINE: Record<FutureId, { color: string; dash?: string }> = {
  slow: { color: "#7fb77a", dash: "7 4" },
  medium: { color: "#4f8f58" },
  fast: { color: "#2f5d45" },
};
function ReadinessChart({ row, sm, speedName }: { row: SkillMathRow; sm: SkillMath; speedName: (id: FutureId) => string }) {
  const { t } = useT();
  const c = sm.consts;
  const W = 480, H = 260, L = 40, R = 12, T = 12, B = 30;
  const E = row.exposure.value;
  const yMax = Math.max(0.8, Math.ceil((E + 0.05) * 10) / 10);
  const X = (y: number) => L + ((y - c.now) / (c.horizon - c.now)) * (W - L - R);
  const Y = (val: number) => T + (1 - val / yMax) * (H - T - B);
  const path = (mult: number) => {
    const pts: string[] = [];
    for (let k = 0; k <= 132; k++) { const years = (k / 132) * (c.horizon - c.now); pts.push(`${X(c.now + years).toFixed(1)},${Y(readiness(E, row.rate, mult, years)).toFixed(1)}`); }
    return `M${pts.join("L")}`;
  };
  const showE = Math.abs(E - c.threshold) > 0.05;
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" aria-hidden data-no-translate>
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--line)" />
        {[0, 0.2, 0.6].map((g) => <text key={g} x={L - 6} y={Y(g) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">{g}</text>)}
        {[2030, 2035, 2040].map((g) => <text key={g} x={X(g)} y={H - 10} textAnchor={g === c.horizon ? "end" : "middle"} fontSize="12" fill="var(--muted)">{g}</text>)}
        <text x={L} y={H - 10} textAnchor="start" fontSize="12" fill="var(--muted)">{fmtYear(c.now)}</text>
        <line x1={X(c.headlineYear)} x2={X(c.headlineYear)} y1={T} y2={Y(0)} stroke="var(--fall)" strokeDasharray="3 3" />
        <text x={X(c.headlineYear) + 4} y={T + 10} fontSize="12" fill="var(--fall)">{c.headlineYear}</text>
        {showE && <line x1={L} x2={W - R} y1={Y(E)} y2={Y(E)} stroke="var(--muted)" strokeDasharray="1 4" strokeLinecap="round" />}
        {showE && <text x={W - R - 2} y={Y(E) - 5} textAnchor="end" fontSize="12" fill="var(--muted)">E = {f2(E)}</text>}
        <line x1={L} x2={W - R} y1={Y(c.threshold)} y2={Y(c.threshold)} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="6 4" />
        <text x={L + 4} y={Y(c.threshold) - 5} fontSize="12" fontWeight="600" fill="var(--ink)">{c.threshold}</text>
        {sm.futures.map((f) => <path key={f.id} d={path(f.mult)} fill="none" stroke={LINE[f.id].color} strokeWidth="2.5" strokeDasharray={LINE[f.id].dash} />)}
        {sm.futures.map((f) => { const d = row.dates[f.id]; return d !== null && d <= c.horizon ? <circle key={f.id} cx={X(d)} cy={Y(c.threshold)} r="5" fill={LINE[f.id].color} stroke="var(--raised)" strokeWidth="2" /> : null; })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {sm.futures.map((f) => (
          <li key={f.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-5 rounded" style={{ background: LINE[f.id].color }} />
            <span>{speedName(f.id)}</span>
            <span className="num text-ink">{row.dates[f.id] === null ? t(SM.never) : fmtYear(row.dates[f.id]!)}</span>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-ink" />{t(SM.chartLine, { x: c.threshold })}</li>
      </ul>
    </div>
  );
}

export function SkillMathExplain() {
  const { view, state } = useApp();
  const { t, lang } = useT();
  const { speed } = useSpeed();
  const [pick, setPick] = useState<string | null>(null);
  if (!view || !state) return <Skeleton lines={6} />;
  if (!state.profile) {
    return (
      <div>
        <PageTitle title={t(SM.title)}>{t(SM.noProfile)}</PageTitle>
        <Btn href="/start">Get started</Btn>
      </div>
    );
  }
  const sm = view.skillMath, c = sm.consts, rows = sm.skills, total = rows.length;
  const speedName = (id: FutureId) => sm.futures.find((f) => f.id === id)!.name;
  const label = (k: Key) => (k === FORECAST ? t("Our forecast") : t(speedName(k as FutureId)));
  const countFor = (k: Key) => rows.filter((r) => counted(r, k)).length;
  const shown: Key = speed;
  const N = countFor(shown);
  const row = rows.find((r) => r.skillId === pick) ?? rows.find((r) => r.forecast !== null) ?? rows[0];
  const E = row.exposure.value, K = row.coverage.value, r = row.rate;
  const flagged = row.need !== null;
  const mult = Object.fromEntries(sm.futures.map((f) => [f.id, f.mult])) as Record<FutureId, number>;
  const headline = N
    ? `AI could do most of ${N} of your ${total} skills before ${c.headlineYear}.`
    : `AI is unlikely to take over any of your ${total} skills before ${c.headlineYear}.`;
  const rest = 1 - sm.futures.length * c.floor; // what is left after the three floors
  const world = view.world;
  const ratio = (a: number) => (a * 100).toFixed(0);
  const cap = Object.fromEntries(world.futures.map((f) => [f.id, f.capMult])) as Record<FutureId, number>;

  return (
    <div className="skills-page">
      <Link href="/skills" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink"><ArrowLeft size={14} aria-hidden />{t(SM.back)}</Link>
      <PageTitle title={<span className="skills-title">{lang === "en" ? <>How we worked out <mark>your skill dates</mark></> : t(SM.title)}</span>}>{t(SM.intro)}</PageTitle>

      <Card tone="raised">
        <h2 className="text-base font-semibold">{t(SM.countH)}</h2>
        <p className="mt-2 text-lg font-medium text-ink">{headline}</p>
        <p className="mt-1 text-sm text-muted">{t(SM.countRule, { y: c.headlineYear })}</p>
        <h3 className="mt-4 text-sm font-semibold">{t(SM.countByH)}</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {(SPEEDS as readonly Key[]).map((k) => (
            <div key={k} className={`rounded-2xl px-4 py-3 ${k === shown ? "bg-primary text-primaryink" : "bg-surface"}`}>
              <p className="text-sm font-medium">{label(k)}</p>
              <p data-no-translate className="num text-lg font-medium">{t(SM.countOf, { n: countFor(k), total })}</p>
              {k === shown && <p className="text-xs opacity-80">{t(SM.countNow)}</p>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t(SM.countBySpeed)}</p>
      </Card>

      <Card className="mt-4">
        <h2 className="text-base font-semibold">{t(SM.glanceH)}</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-5">
          {[[SM.g1t, SM.g1d], [SM.g2t, SM.g2d], [SM.g3t, SM.g3d], [SM.g4t, SM.g4d], [SM.g5t, SM.g5d]].map(([title, body], i) => (
            <li key={i} className="rounded-2xl bg-raised p-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs text-primaryink">{i + 1}</span>{t(title)}</p>
              <p className="mt-1 text-xs text-muted">{t(body, { x: c.threshold, y: c.headlineYear })}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4">
        <h2 className="text-base font-semibold">{t(SM.tableH)}</h2>
        <p className="mt-1 text-sm text-muted">{t(SM.tableSub, { x: c.threshold })}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className={th}>{t(SM.thSkill)}</th><th className={th}>{t(SM.thExposure)}</th><th className={th}>{t(SM.thCoverage)}</th>
                {(["slow", "medium", "fast", FORECAST] as Key[]).map((k) => <th key={k} className={`${th} ${k === shown ? "text-ink underline decoration-fall decoration-2 underline-offset-4" : ""}`}>{label(k)}</th>)}
                <th className={th}>{t(SM.thCounted, { y: c.headlineYear })}</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {rows.map((s) => (
                <tr key={s.skillId} className="border-t border-black/5">
                  <td className={td}>{s.name}</td>
                  <td data-no-translate className={`${td} num`}>{f2(s.exposure.value)}</td>
                  <td data-no-translate className={`${td} num`}>{trim(s.coverage.value, 3)}</td>
                  {(["slow", "medium", "fast", FORECAST] as Key[]).map((k) => {
                    const d = dateOf(s, k);
                    return <td key={k} className={`${td} num ${k === shown ? "bg-fallsoft/60" : ""}`}>{d === null ? t(SM.never) : fmtYear(d)}</td>;
                  })}
                  <td className={td}>{counted(s, shown) ? <Chip tone="fall">{t("Yes")}</Chip> : <Chip>{t("No")}</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">{t(SM.tableNote)}</p>
      </Card>

      <h2 className="mt-8 text-xl font-bold">{t(SM.workedH)}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor="skill-pick" className="text-sm font-medium">{t(SM.workedPick)}</label>
        <select id="skill-pick" value={row.skillId} onChange={(e) => setPick(e.target.value)} className="min-h-11 max-w-full rounded-full bg-surface2 px-4 text-sm text-ink">
          {rows.map((s) => <option key={s.skillId} value={s.skillId}>{s.name}</option>)}
        </select>
      </div>
      <p className="mt-2 text-xs text-muted">{t(SM.workedNote)}</p>

      <Step title={t(SM.h1)}>
        <p>{t(SM.s1a)}</p>
        <p>{t(SM.s1b)}</p>
        <Caption>{t(SM.c1)}</Caption>
        <M><mrow>{v("E")}{o("=")}{v("ILO")}{o("(")}{v("j")}{o(")")}</mrow></M>
        <Legend>{t(SM.l1)}</Legend>
        <p>{t(SM.withNumbers)}</p>
        {row.exposure.basis === "ilo" && (
          <>
            <M><mrow>{v("E")}{o("=")}{v("ILO")}{o("(")}{txt(row.exposure.code ?? "")}{o(")")}{o("=")}{n(f2(E))}</mrow></M>
            <p data-no-translate className="text-ink"><span className="text-muted">{t(SM.occ1)}:</span> {row.exposure.code} · {row.exposure.title}{row.exposure.gradient ? ` · ${row.exposure.gradient}` : ""}</p>
          </>
        )}
        {row.exposure.basis !== "ilo" && (
          <>
            <M><mrow>{v("E")}{o("=")}{n(f2(E))}</mrow></M>
            <p>{t(row.exposure.basis === "none" ? SM.n1none : SM.n1missing, { x: E })}</p>
          </>
        )}
      </Step>

      <Step title={t(SM.h2)}>
        <p>{t(SM.s2a)}</p>
        <p>{t(SM.s2b)}</p>
        <Caption>{t(SM.c2)}</Caption>
        <M><mrow>{v("c")}{o("=")}{frac(v("U"), v("N"))}</mrow></M>
        <M><mrow>{v("K")}{o("=")}{frac(n(1), v("n"))}{sum(<>{v("i")}{o("=")}{n(1)}</>, v("n"))}{sub(v("c"), v("i"))}</mrow></M>
        <Legend>{t(SM.l2)}</Legend>
        <p>{t(SM.withNumbers)}</p>
        {row.coverage.basis === "aei" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-left text-sm">
                <thead className="text-muted"><tr><th className={th}>{t(SM.thOcc)}</th><th className={th}>{t(SM.thTasks)}</th><th className={th}>{t(SM.thCov)}</th></tr></thead>
                <tbody data-no-translate className="text-ink">
                  {row.coverage.occupations.map((x) => <tr key={x.code} className="border-t border-black/5"><td className={td}>{x.code} · {x.title}</td><td className={`${td} num`}>{x.tasks}</td><td className={`${td} num`}>{trim(x.coverage, 3)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <M><mrow>{v("K")}{o("=")}{frac(n(1), n(row.coverage.occupations.length))}{o("(")}{row.coverage.occupations.map((x, i) => <Fragment key={x.code}>{i > 0 && o("+")}{n(trim(x.coverage, 3))}</Fragment>)}{o(")")}{o("=")}{n(trim(K, 4))}</mrow></M>
          </>
        ) : (
          <>
            <M><mrow>{v("K")}{o("=")}{n(trim(K, 4))}</mrow></M>
            <p>{t(SM.n2none, { x: K })}</p>
          </>
        )}
      </Step>

      <Step title={t(SM.h3)}>
        <p>{t(SM.s3a)}</p>
        <Caption>{t(SM.c3)}</Caption>
        <M><mrow>{v("r")}{o("=")}{n(c.rateBase)}{o("+")}{n(c.ratePerCoverage)}{o("×")}{v("K")}</mrow></M>
        <Legend>{t(SM.l3, { a: c.rateBase, b: c.ratePerCoverage })}</Legend>
        <p>{t(SM.withNumbers)}</p>
        <M><mrow>{v("r")}{o("=")}{n(c.rateBase)}{o("+")}{n(c.ratePerCoverage)}{o("×")}{n(trim(K, 4))}{o("=")}{n(f4(r))}</mrow></M>
      </Step>

      <Step title={t(SM.h4)}>
        <p>{t(SM.s4a)}</p>
        <p>{t(SM.s4b)}</p>
        <Caption>{t(SM.c4)}</Caption>
        <M><mrow>{sub(v("A"), v("f"))}{o("(")}{v("t")}{o(")")}{o("=")}{n(1)}{o("−")}{sup(v("e"), <>{o("−")}{v("r")}{sub(v("m"), v("f"))}{v("t")}</>)}</mrow></M>
        <Legend>{t(SM.l4, { x: fmtYear(c.now) })}</Legend>
        <p>{t(SM.mults, { a: mult.slow, b: mult.medium, c: mult.fast })}</p>
        <p>{t(SM.withNumbers)}</p>
        {sm.futures.map((f) => (
          <M key={f.id}><mrow>{sub(v("A"), txt(f.id))}{o("(")}{v("t")}{o(")")}{o("=")}{n(1)}{o("−")}{sup(v("e"), <>{o("−")}{n(f4(r))}{o("×")}{n(f.mult)}{o("×")}{v("t")}</>)}</mrow></M>
        ))}
      </Step>

      <Step title={t(SM.h5, { x: c.threshold })}>
        <p>{t(SM.s5a)}</p>
        <p>{t(SM.s5b, { x: c.threshold })}</p>
        <p>{t(SM.s5c, { x: c.threshold })}</p>
        <Caption>{t(SM.c5)}</Caption>
        <M><mrow>{sub(v("R"), v("f"))}{o("(")}{v("t")}{o(")")}{o("=")}{v("E")}{o("×")}{sub(v("A"), v("f"))}{o("(")}{v("t")}{o(")")}</mrow></M>
        <Legend>{t(SM.l5)}</Legend>
        <p>{t(SM.chartCap, { y: c.headlineYear })}</p>
        <ReadinessChart row={row} sm={sm} speedName={(id) => t(speedName(id))} />
        {!flagged && <p>{t(SM.chartNever)}</p>}
      </Step>

      <Step title={t(SM.h6)}>
        <p>{t(SM.s6a, { x: c.threshold })}</p>
        <M><mrow>{v("E")}{o("×")}{o("(")}{n(1)}{o("−")}{sup(v("e"), <>{o("−")}{v("r")}{sub(v("m"), v("f"))}{v("t")}</>)}{o(")")}{o("=")}{n(c.threshold)}</mrow></M>
        <M><mrow>{sup(v("e"), <>{o("−")}{v("r")}{sub(v("m"), v("f"))}{v("t")}</>)}{o("=")}{n(1)}{o("−")}{v("a")}</mrow></M>
        <Caption>{t(SM.c6a)}</Caption>
        <M><mrow>{v("a")}{o("=")}{frac(n(c.threshold), v("E"))}</mrow></M>
        <Legend>{t(SM.l6a, { x: c.threshold })}</Legend>
        <Caption>{t(SM.c6)}</Caption>
        <M><mrow>{sub(v("t"), v("f"))}{o("=")}{frac(fn("ln", frac(n(1), <>{n(1)}{o("−")}{v("a")}</>)), <>{v("r")}{o("×")}{sub(v("m"), v("f"))}</>)}</mrow></M>
        <M><mrow>{sub(v("T"), v("f"))}{o("=")}{n(c.now)}{o("+")}{sub(v("t"), v("f"))}</mrow></M>
        <Legend>{t(SM.l6, { x: c.now })}</Legend>
        <p>{t(SM.withNumbers)}</p>
        {flagged ? (
          <>
            <p>{t(SM.needLine)}</p>
            <M><mrow>{v("a")}{o("=")}{frac(n(c.threshold), n(f2(E)))}{o("=")}{n(f4(row.need!))}</mrow></M>
            <M><mrow>{fn("ln", frac(n(1), <>{n(1)}{o("−")}{n(f4(row.need!))}</>))}{o("=")}{n(f4(Math.log(1 / (1 - row.need!))))}</mrow></M>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[19rem] text-left text-sm">
                <thead className="text-muted"><tr><th className={th}>{t(SM.thSpeed)}</th><th className={th}>{t(SM.thRM)}</th><th className={th}>{t(SM.thYears)}</th><th className={th}>{t(SM.g4t)}</th></tr></thead>
                <tbody className="text-ink">
                  {sm.futures.map((f) => (
                    <tr key={f.id} className="border-t border-black/5">
                      <td className={td}>{t(f.name)}</td>
                      <td data-no-translate className={`${td} num`}>{f4(r * f.mult)}</td>
                      <td data-no-translate className={`${td} num`}>{yr(row.years[f.id]!)}</td>
                      <td data-no-translate className={`${td} num`}>{yr(row.dates[f.id]!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <M><mrow>{sub(v("T"), txt("medium"))}{o("=")}{n(c.now)}{o("+")}{frac(n(f4(Math.log(1 / (1 - row.need!)))), <>{n(f4(r))}{o("×")}{n(mult.medium)}</>)}{o("=")}{n(yr(row.dates.medium!))}</mrow></M>
          </>
        ) : (
          <>
            <M><mrow>{v("E")}{o("=")}{n(f2(E))}{o("≤")}{n(c.threshold)}</mrow></M>
            <p>{t(SM.noDate)}</p>
          </>
        )}
      </Step>

      <Step title={t(SM.h7)}>
        <p>{t(SM.s7a)}</p>
        <p>{t(SM.s7b, { x: c.horizon })}</p>
        <Caption>{t(SM.c7)}</Caption>
        <M><mrow>{v("T")}{o("=")}{sum(v("f"))}{sub(v("w"), v("f"))}{o("×")}{fn("min", <>{sub(v("T"), v("f"))}{o(",")}{n(c.horizon)}</>)}</mrow></M>
        <Legend>{t(SM.l7)}</Legend>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[30rem] text-left text-sm">
            <thead className="text-muted"><tr><th className={th}>{t(SM.thSpeed)}</th><th className={th}>{t(SM.thMult)}</th><th className={th}>{t(SM.thLikely)}</th><th className={th}>{t(SM.thDate)}</th><th className={th}>{t(SM.thCountedAs)}</th></tr></thead>
            <tbody className="text-ink">
              {sm.futures.map((f) => {
                const d = row.dates[f.id];
                return (
                  <tr key={f.id} className="border-t border-black/5">
                    <td className={td}>{t(f.name)}</td>
                    <td data-no-translate className={`${td} num`}>{f.mult}</td>
                    <td data-no-translate className={`${td} num`}>{f4(f.weight)}</td>
                    <td data-no-translate className={`${td} num`}>{d === null ? "–" : yr(d)}</td>
                    <td data-no-translate className={`${td} num`}>{d === null ? "–" : yr(Math.min(d, c.horizon))}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-black/5 font-medium">
                <td className={td}>{t(SM.blendTotal)}</td><td className={td} /><td data-no-translate className={`${td} num`}>{f4(sm.futures.reduce((a, f) => a + f.weight, 0))}</td>
                <td className={td} /><td data-no-translate className={`${td} num`}>{row.forecast === null ? "–" : yr(row.forecast)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>{t(SM.withNumbers)}</p>
        {row.forecast !== null ? (
          <M><mrow>{v("T")}{o("=")}{sm.futures.map((f, i) => <Fragment key={f.id}>{i > 0 && o("+")}{n(f4(f.weight))}{o("×")}{n(yr(Math.min(row.dates[f.id]!, c.horizon)))}</Fragment>)}{o("=")}{n(yr(row.forecast))}{o("→")}{txt(fmtYear(row.forecast))}</mrow></M>
        ) : <p>{t(SM.noDate)}</p>}
      </Step>

      <Step title={t(SM.h8)}>
        <p>{t(SM.s8a, { y: c.headlineYear })}</p>
        <Caption>{t(SM.c8)}</Caption>
        <M><mrow>{v("N")}{o("=")}{o("|")}{o("{")}{v("s")}{o(":")}{sub(v("T"), v("s"))}{o("<")}{n(c.headlineYear)}{o("}")}{o("|")}</mrow></M>
        <Legend>{t(SM.l8)}</Legend>
        <p>{t(SM.withNumbers)}</p>
        <M><mrow>{v("N")}{o("=")}{n(N)}{gap}{txt(`(${label(shown)}, ${total})`)}</mrow></M>
        <p>{headline}</p>
      </Step>

      <Step title={t(SM.h9)}>
        <p>{t(SM.s9a)}</p>
        <p>{t(SM.s9b, { x: ratio(1 - c.fade) })}</p>
        <Caption>{t(SM.c9a)}</Caption>
        <M><mrow>{sub(v("s"), v("f"))}{o("←")}{n(c.fade)}{o("×")}{sub(v("s"), v("f"))}{o("+")}{n(c.update)}{o("×")}{sum(v("q"))}{fn("ln", sub(v("ℓ"), <>{v("f")}{o(",")}{v("q")}</>))}</mrow></M>
        <Legend>{t(SM.l9a)}</Legend>
        <p>{t(SM.s9c)}</p>
        <Caption>{t(SM.c9b)}</Caption>
        <M><mrow>{sub(v("τ"), v("f"))}{o("=")}{n(c.crowdTilt * c.update)}{o("×")}{sum(txt("open"))}{o("[")}{v("P")}{o("×")}{fn("ln", sub(v("p"), v("f")))}{o("+")}{o("(")}{n(1)}{o("−")}{v("P")}{o(")")}{o("×")}{fn("ln", <>{n(1)}{o("−")}{sub(v("p"), v("f"))}</>)}{o("]")}</mrow></M>
        <Legend>{t(SM.l9b, { x: c.crowdTilt * c.update, a: c.crowdTilt, b: c.update })}</Legend>
        <p>{t(SM.s9d)}</p>
        <Caption>{t(SM.c9c)}</Caption>
        <M><mrow>{sub(v("w"), v("f"))}{o("=")}{n(c.floor)}{o("+")}{n(trim(rest, 4))}{o("×")}{frac(sup(v("e"), <>{sub(v("s"), v("f"))}{o("+")}{sub(v("τ"), v("f"))}</>), <>{sum(v("k"))}{sup(v("e"), <>{sub(v("s"), v("k"))}{o("+")}{sub(v("τ"), v("k"))}</>)}</>)}</mrow></M>
        <Legend>{t(SM.l9c, { a: ratio(c.floor), b: ratio(rest) })}</Legend>
        <p>{t(SM.withNumbers)}</p>
        <div className="overflow-x-auto">
          <table className="mt-1 w-full min-w-[34rem] text-left text-sm">
            <thead className="text-muted"><tr><th className={th}>{t(SM.thSpeed)}</th><th className={th}>{t(SM.thScore)}</th><th className={th}>{t(SM.thTilt)}</th><th className={th}>{t(SM.thSum)}</th><th className={th}>{t(SM.thShare)}</th><th className={th}>{t(SM.thLikely)}</th></tr></thead>
            <tbody className="text-ink">
              {sm.futures.map((f) => {
                const s = world.scores[f.id], tau = world.crowdTilt[f.id];
                return (
                  <tr key={f.id} className="border-t border-black/5">
                    <td className={td}>{t(f.name)}</td>
                    <td data-no-translate className={`${td} num`}>{f2(s)}</td>
                    <td data-no-translate className={`${td} num`}>{f2(tau)}</td>
                    <td data-no-translate className={`${td} num`}>{f2(s + tau)}</td>
                    <td data-no-translate className={`${td} num`}>{f4((f.weight - c.floor) / rest)}</td>
                    <td data-no-translate className={`${td} num`}>{f4(f.weight)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>{t(SM.negNote)}</p>
        <p>{t(SM.fromQuestions, { n: world.replay.questions })}</p>
        <More summary={t(SM.pDetailH)}>
          <p>{t(SM.s9e)}</p>
          <Caption>{t(SM.c9d)}</Caption>
          <M><mrow>{sub(v("p"), v("f"))}{o("=")}{n(1)}{o("−")}{v("Φ")}{o("(")}{frac(<>{v("T")}{o("−")}{sub(v("c"), v("f"))}{o("×")}{bar(v("g"))}</>, v("σ"))}{o(")")}</mrow></M>
          <Legend>{t(SM.l9d, { a: cap.slow, b: cap.medium, c: cap.fast, lo: c.pMin, hi: c.pMax })}</Legend>
          <p>{t(SM.s9f)}</p>
          <Caption>{t(SM.c9e)}</Caption>
          <M><mrow>{sub(v("p"), v("f"))}{o("=")}{v("Φ")}{o("(")}{frac(<>{v("T")}{o("−")}{sub(v("δ"), v("f"))}</>, v("σ"))}{o(")")}</mrow></M>
          <Legend>{t(SM.l9e, { a: world.futures[0].drift, b: world.futures[1].drift, c: world.futures[2].drift, s: c.dosmSigmaMin, lo: c.pMin, hi: c.pMax })}</Legend>
        </More>
      </Step>

      <Step title={t(SM.h10)}>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>{t(SM.k1)}</li>
          <li>{t(SM.k2)}</li>
          <li>{t(SM.k3, { x: c.threshold, y: c.horizon })}</li>
          <li>{t(SM.k4, { x: c.horizon })}</li>
          <li>{t(SM.k5, { x: fmtYear(c.now) })}</li>
          <li>{t(SM.k6)}</li>
          <li>{t(SM.k7)}</li>
          <li>{t(SM.k8)}</li>
        </ul>
        <p className="pt-1 font-medium text-ink">{t(SM.sources)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {view.radar.sources.slice(0, 2).map((x) => <SourceChip key={x.name} name={x.name} date={x.date} url={x.url} />)}
        </div>
        <Estimate />
      </Step>

      <NextRow back="/skills" />
    </div>
  );
}
