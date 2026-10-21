"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/AppProvider";
import { AiCapability, JobGroupShares } from "@/components/AiTrendCharts";
import { Card, H, PageTitle, SdgTag, Skeleton, SourceChip } from "@/components/ui";

// One question: what is changing in the job market? Written for someone who has never read a chart like this.
export default function TrendsPage() {
  const { view } = useApp();
  if (!view) return <Skeleton lines={6} />;
  const r = view.radar, w = view.world;
  const hist = w.clericalHistory.map((d) => ({ q: d.q.replace("Q", " Q"), share: d.share }));
  const last = hist[hist.length - 1];
  return (
    <div>
      <PageTitle title="How AI is changing jobs in Malaysia">
        Which jobs are being hired more, which are being hired less, and how quickly AI is getting better. All numbers come from public government and research data. Each one says where it came from.
      </PageTitle>

      <Card tone="raised">
        <H sub={`In ${last.q}, about ${Math.round(last.share)} out of every 100 job ads in Malaysia were for office admin jobs (clerks, data entry, receptionists). These are the jobs AI can do the most of, so we watch them closely.`}>Office admin jobs: how many job ads are for them?</H>
        <div className="h-56" role="img" aria-label="Line chart: out of every 100 job ads, how many were for office admin jobs, each quarter">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hist} margin={{ left: -16, right: 16, top: 8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="q" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} domain={["auto", "auto"]} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} in every 100 ads`, "Office admin jobs"] as [string, string]} contentStyle={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 12 }} />
              <ReferenceLine x="2025 Q3" stroke="var(--control)" label={{ value: "counting method changed", fill: "var(--muted)", fontSize: 11, position: "insideTopLeft" }} />
              <Line type="monotone" dataKey="share" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-sm text-muted">Line going down means fewer job ads are for office admin. DOSM changed what this series covers from 2025 Q3, so Jobbery compares demand only with quarters since then.</p>
        <div className="mt-1"><SourceChip name="DOSM Job Market Insights" date={w.release ? "2026 Q2 release, 18 Aug 2026" : "to 2026 Q1"} url={r.sources.find((s) => s.name.startsWith("DOSM"))?.url} /></div>
      </Card>

      <div className="mt-4"><JobGroupShares asOfQuarter={w.asOfQuarter} /></div>
      <div className="mt-4"><AiCapability asOfQuarter={w.asOfQuarter} /></div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <H sub="Hiring is growing and AI cannot easily replace these jobs.">Good jobs to aim for</H>
          <ul className="space-y-1.5">
            {r.risingJobs.slice(0, 6).map((j) => (
              <li key={j.roleId} className="flex items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num text-xs text-muted">Job type: {j.group}</p></div>
                <SdgTag target={j.sdgTarget} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <H sub="AI can already do a lot of the work in these jobs.">Jobs most at risk from AI</H>
          <ul className="space-y-1.5">
            {r.decliningJobs.map((j) => (
              <li key={j.occupationId} className="flex items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num text-xs text-muted">AI can do {j.exposure >= 0.45 ? "a lot" : j.exposure >= 0.3 ? "some" : "a little"} of this job</p></div>
                <p className="num shrink-0 text-sm text-fall">starts changing {j.earliest}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <H sub="The date AI is expected to do most of this work.">Skills AI will take over first</H>
          <ul className="space-y-1 text-sm">{r.declining.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><span className="num text-fall">{s.expected}</span></li>)}</ul>
        </Card>
        <Card>
          <H sub="Employers want these and AI cannot easily do them.">Skills worth learning</H>
          <ul className="space-y-1 text-sm">{r.rising.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><SdgTag target={s.sdgTarget} /></li>)}</ul>
        </Card>
      </div>
      <div className="mt-4 flex flex-col gap-1">{r.sources.map((s) => <SourceChip key={s.name} name={s.name} date={s.date} url={s.url} />)}</div>
    </div>
  );
}
