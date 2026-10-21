"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { series, sourceById, type DosmQuarter } from "@/lib/engine/data";
import { Card, H, SourceChip } from "@/components/ui";

// DOSM job groups are ISCO-08 major groups, so each group's exposure is the mean ILO score of its 4-digit occupations.
const GROUPS: { key: keyof DosmQuarter; label: string; isco: string }[] = [
  { key: "managers", label: "Managers and bosses", isco: "1" },
  { key: "professionals", label: "Professionals (engineers, accountants, teachers)", isco: "2" },
  { key: "technicians", label: "Technicians and assistants", isco: "3" },
  { key: "clerical", label: "Office admin (clerks, data entry)", isco: "4" },
  { key: "service", label: "Shop, sales and service", isco: "5" },
  { key: "craft", label: "Builders and tradespeople", isco: "7" },
  { key: "operators", label: "Factory and machine operators", isco: "8" },
  { key: "elementary", label: "Cleaners and labourers", isco: "9" },
];
const iloGroupMean = (isco: string) => {
  const v = Object.entries(series.ilo).filter(([k]) => k.startsWith(isco)).map(([, x]) => x.score);
  return v.reduce((a, b) => a + b, 0) / v.length;
};
const band = (e: number) => (e >= 0.45 ? { color: "var(--fall)", label: "AI can do a lot of this work" } : e >= 0.3 ? { color: "var(--medium)", label: "AI can do some of this work" } : { color: "var(--rise)", label: "AI can do little of this work" });
const tick = { fontSize: 11, fill: "var(--muted)" };
const tooltipStyle = { background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 12 };
const qLabel = (q: string) => q.replace("Q", " Q");

// Chart 1: each job group's share of Malaysian online job ads, one small chart per group, most AI-exposed first.
export function JobGroupShares({ asOfQuarter }: { asOfQuarter: string }) {
  const qs = series.dosm.quarters.filter((d) => d.q >= "2023Q1" && d.q <= asOfQuarter);
  const groups = GROUPS.map((g) => ({
    ...g, exposure: iloGroupMean(g.isco),
    data: qs.map((d) => ({ q: qLabel(d.q), share: (100 * (d[g.key] as number)) / d.total })),
  })).sort((a, b) => b.exposure - a.exposure);
  return (
    <Card>
      <H sub="Out of every 100 job ads in Malaysia, how many are for each type of job. Line going up = more hiring for that job type. Red means AI can do a lot of this work, amber some, green little.">
        Which types of jobs are being hired more, and which less?
      </H>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => {
          const b = band(g.exposure);
          const first = g.data[0].share, last = g.data[g.data.length - 1].share;
          return (
            <div key={g.key} className="rounded-2xl bg-raised px-3 pb-2 pt-3">
              <p className="text-sm font-medium leading-tight">{g.label}</p>
              <p className="num text-xs text-muted">
                <span style={{ color: b.color }}>{b.label}</span><br />Now {last.toFixed(1)} in every 100 ads · {Math.abs(last - first) < 0.3 ? "about the same as 2023" : `${last > first ? "up" : "down"} ${Math.abs(last - first).toFixed(1)} since 2023`}
              </p>
              <div className="h-24" role="img" aria-label={`${g.label}: went from ${first.toFixed(1)} to ${last.toFixed(1)} in every 100 job ads`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={g.data} margin={{ left: -28, right: 4, top: 6, bottom: 0 }}>
                    <XAxis dataKey="q" hide />
                    <YAxis tick={tick} domain={["auto", "auto"]} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${Number(v).toFixed(0)}`} />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} in every 100 ads`, "Job ads"]} contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="share" stroke={b.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted">From 2023 to {qLabel(asOfQuarter)}. The government changed how it counts job ads in 2025 Q3, so a sudden jump there may not be real. &quot;AI can do&quot; is based on a 2025 UN study (ILO) of what AI is able to do in each job, not what companies have actually done yet.</p>
      <div className="mt-1 flex flex-col gap-1">
        <SourceChip name="DOSM Job Market Insights" date={`to ${qLabel(asOfQuarter)}`} url={sourceById.dosm.url} />
        <SourceChip name="ILO (UN labour agency) study of AI and jobs" date="2025 scores" url={sourceById.ilo.url} />
      </div>
    </Card>
  );
}

// Chart 2: the best AI result on three public benchmarks each quarter (Epoch AI). Not split by sector.
const BENCH = [
  { id: "swe", color: "var(--accent)", name: "Fixing real software bugs" },
  { id: "tbench", color: "var(--fast)", name: "Doing tasks on a computer" },
  { id: "hle", color: "var(--slow)", name: "Very hard expert exam questions" },
];
export function AiCapability({ asOfQuarter }: { asOfQuarter: string }) {
  const qs = [...new Set(BENCH.flatMap((b) => series.epoch[b.id].frontier.map((x) => x.q)))].filter((q) => q >= "2024Q3" && q <= asOfQuarter).sort();
  const data = qs.map((q) => {
    const row: Record<string, number | string> = { q: qLabel(q) };
    for (const b of BENCH) {
      const v = series.epoch[b.id].frontier.find((x) => x.q === q)?.v;
      if (v !== undefined) row[b.id] = v;
    }
    return row;
  });
  const metr = series.epoch.metr.frontier.filter((x) => x.q <= asOfQuarter);
  const hours = (v: number) => 2 ** v / 60;
  const mNow = metr[metr.length - 1], mThen = metr.find((x) => x.q === "2024Q3");
  return (
    <Card>
      <H sub="AI is tested on hard tasks every few months. This shows the best score any AI got on each test. Higher = AI can do more. This is AI in general, not one type of job.">
        How quickly is AI getting better?
      </H>
      <div className="h-56" role="img" aria-label="Line chart: best AI test scores out of 100, each quarter">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -16, right: 16, top: 8 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="q" tick={tick} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={tick} domain={[0, 100]} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, name) => [`${Number(v).toFixed(0)} out of 100`, name]} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {BENCH.map((b) => (
              <Line key={b.id} type="monotone" dataKey={b.id} name={b.name} stroke={b.color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-sm text-muted">
        {mThen && <>In 2024, AI could finish a task that takes a person about {Math.round(hours(mThen.v) * 60)} minutes. By {qLabel(mNow.q)}, it could finish tasks that take a person about {hours(mNow.v).toFixed(0)} hours. </>}
        Scores are out of 100.
      </p>
      <div className="mt-1"><SourceChip name="Epoch AI (AI test results)" date={`to ${qLabel(asOfQuarter)}`} url={sourceById.epoch.url} /></div>
    </Card>
  );
}
