"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Score, whyFits } from "@/components/JobBits";
import { Bar, Btn, Card, Chip, Estimate, H, PageTitle, SdgTag, Skeleton, SourceChip } from "@/components/ui";

// One question: why does this job score what it does, and what am I missing?
export default function JobDetailPage() {
  const { view, state, act, busy } = useApp();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  if (!view || !state) return <Skeleton lines={6} />;
  const m = view.matches.find((x) => x.roleId === id);
  const blocked = view.unreachable.find((x) => x.roleId === id);
  if (!m) {
    return (
      <div>
        <Link href="/jobs/all" className="mb-4 inline-block text-sm text-muted underline decoration-control underline-offset-2">All jobs</Link>
        <PageTitle title={blocked ? `${blocked.title} is a longer-term path.` : "This job is not on your list."}>
          {blocked ? (blocked.reason === "qualification" ? `${blocked.need}. Ask your counsellor about part-time study, recognition of prior learning, or funding.` : `It needs ${blocked.need.replace("≈ ", "about ")} of training, more than the time you have.`) : "Go back to your jobs."}
        </PageTitle>
      </div>
    );
  }
  const chosen = view.chosen?.roleId === m.roleId;
  const choose = async () => { if (await act("chooseRole", { roleId: m.roleId })) router.push("/plan"); };
  return (
    <div>
      <Link href="/jobs" className="mb-4 inline-block text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">Jobs</Link>
      <PageTitle title={m.title} aside={<Score value={m.score} />}>{whyFits(m)}</PageTitle>
      <div className="mb-6 flex flex-wrap gap-2">
        <Btn onClick={choose} disabled={busy || chosen} className="min-h-12 px-6 text-base">{chosen ? "This is your plan's job" : "Plan my path to this job"}</Btn>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <H sub="Five parts, each from 0 to 100, weighted and added up.">Why this score</H>
          <ul className="space-y-3">
            {m.parts.map((p) => (
              <li key={p.key}>
                <div className="flex justify-between text-sm"><span>{p.label} <span className="text-muted">· weight {Math.round(p.weight * 100)}%</span></span><span className="num">{Math.round(p.value * 100)}</span></div>
                <div className="mt-1"><Bar value={p.value} label={`${p.label} ${Math.round(p.value * 100)} out of 100`} /></div>
              </li>
            ))}
          </ul>
          {m.penalty > 0.001 && <p className="num mt-3 text-sm">Minus {(m.penalty * 100).toFixed(1)} points because some of its skills fade soon.</p>}
          {m.sdgMatch && <p className="num mt-1 text-sm">Plus 12 points because it serves a goal you picked.</p>}
          <p className="mt-3 text-sm text-muted">Job demand: {m.demand.label.toLowerCase()} were {m.demand.recent.toFixed(1)}% of online job ads in {m.demand.latest.replace("Q", " Q")}, {m.demand.trend >= 0 ? "up" : "down"} {Math.abs(m.demand.trend * 100).toFixed(0)}% on their average for {m.demand.period.replace(/Q/g, " Q")} (adjusted for the few quarters available).</p>
          <div className="mt-1"><SourceChip name="DOSM Job Market Insights" date={`to ${view.world.asOfQuarter.replace("Q", " Q")}`} url="https://www.dosm.gov.my/portal-main/release-content/big-data-analytics-job-market-insights-q22026" /></div>
        </Card>

        <Card>
          <H sub={m.gaps.length ? `${m.gaps.length} to learn, ${m.have.length} you already have` : "You already have every skill this job lists."}>What you are missing</H>
          <ul className="space-y-2">
            {m.gaps.map((g) => (
              <li key={g.skillId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-3 text-sm">
                <span>{g.name}</span>
                <span className="flex items-center gap-2"><SdgTag target={g.sdgTarget} /><span className={`num ${g.expiry.durable ? "text-rise" : "text-fall"}`}>{g.expiry.durable ? "lasts past 2040" : `fades ${g.expiry.expected}`}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5"><SdgTag target={m.sdgTarget} why={m.sdgWhy} /><Chip>About {m.weeks} weeks to get ready</Chip>{m.atRisk && <Chip tone="fall">Some skills fade soon</Chip>}</div>
          <p className="mt-2 text-sm">{m.sdgWhy}</p>
          {m.tradeoff && <p className="mt-2 text-sm text-muted">{m.tradeoff}</p>}
          <p className="mt-3 text-xs text-muted">O*NET-SOC {m.onet}{m.closest ? " (closest match to this title)" : ""}, as listed in the Anthropic Economic Index.</p>
        </Card>
      </div>
      <div className="mt-4"><Estimate /></div>
    </div>
  );
}
