"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/AppProvider";
import { Card, H, PageTitle, SdgTag, Skeleton, SourceChip } from "@/components/ui";

// One question: what is changing in the job market? (the Future Skills Radar)
export default function TrendsPage() {
  const { view } = useApp();
  if (!view) return <Skeleton lines={6} />;
  const r = view.radar, w = view.world;
  const hist = w.clericalHistory.map((d) => ({ q: d.q.replace("Q", " Q"), share: d.share }));
  const last = hist[hist.length - 1];
  return (
    <div>
      <PageTitle title={`Clerical jobs were ${last.share.toFixed(1)}% of online job ads in ${last.q}.`}>
        What is growing and what is under pressure, from Malaysian online job ads (DOSM) and AI exposure research (ILO, Anthropic Economic Index). Each list shows its source and date.
      </PageTitle>

      <Card tone="raised">
        <H sub={w.release ? "Real DOSM figures, including the 2026 Q2 release." : "Real DOSM figures. The 2026 Q2 release is held back."}>Clerical support&apos;s share of online job ads (%)</H>
        <div className="h-56" role="img" aria-label="Line chart of the clerical support share of online job ads by quarter">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hist} margin={{ left: -16, right: 16, top: 8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="q" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} domain={["auto", "auto"]} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, "Clerical share"]} contentStyle={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 12 }} />
              <ReferenceLine x="2025 Q3" stroke="var(--control)" label={{ value: "coverage change", fill: "var(--muted)", fontSize: 11, position: "insideTopLeft" }} />
              <Line type="monotone" dataKey="share" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-sm text-muted">DOSM changed what its job-ad series covers from 2025 Q3 and gave no reason, so Jobbery compares job demand only with quarters since then.</p>
        <div className="mt-1"><SourceChip name="DOSM Job Market Insights" date={w.release ? "2026 Q2 release, 18 Aug 2026" : "to 2026 Q1"} url={r.sources.find((s) => s.name.startsWith("DOSM"))?.url} /></div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <H sub="Lasting skills and growing job ads together.">Jobs on the rise</H>
          <ul className="space-y-1.5">
            {r.risingJobs.slice(0, 6).map((j) => (
              <li key={j.roleId} className="flex items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num text-xs text-muted">{j.group}: {j.share.toFixed(1)}% of ads</p></div>
                <SdgTag target={j.sdgTarget} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <H sub="Back-office jobs whose tasks are most exposed to generative AI.">Jobs under pressure</H>
          <ul className="space-y-1.5">
            {r.decliningJobs.map((j) => (
              <li key={j.occupationId} className="flex items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num text-xs text-muted">ILO exposure {j.exposure.toFixed(2)}</p></div>
                <p className="num shrink-0 text-sm text-fall">first skill fades {j.earliest}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <H>Skills fading soonest</H>
          <ul className="space-y-1 text-sm">{r.declining.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><span className="num text-fall">{s.expected}</span></li>)}</ul>
        </Card>
        <Card>
          <H>Skills that last and are wanted</H>
          <ul className="space-y-1 text-sm">{r.rising.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><SdgTag target={s.sdgTarget} /></li>)}</ul>
        </Card>
      </div>
      <div className="mt-4 flex flex-col gap-1">{r.sources.map((s) => <SourceChip key={s.name} name={s.name} date={s.date} url={s.url} />)}</div>
    </div>
  );
}
