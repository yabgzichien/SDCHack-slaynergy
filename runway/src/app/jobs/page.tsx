"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Score, whyFits } from "@/components/JobBits";
import { ChevronRight, HandHeart, MapPin } from "lucide-react";
import { Btn, Card, Chip, LinkRow, NextRow, PageTitle, SdgTag, Skeleton, sdgName } from "@/components/ui";

// One question: which job should I aim for?
export default function JobsPage() {
  const { view, state, catalog, act, busy } = useApp();
  const router = useRouter();
  if (!view || !state || !catalog) return <Skeleton lines={6} />;
  if (!state.profile) return <div><PageTitle title="Which job should you aim for?">Answer a few questions first.</PageTitle><Btn href="/start">Get started</Btn></div>;
  const p = state.profile;
  const best = view.lasting ?? view.matches[0];
  const bridge = view.bridge;
  const others = view.matches.filter((m) => m.roleId !== best?.roleId && m.roleId !== bridge?.roleId).slice(0, 4);
  const choose = async (id: string) => { if (await act("chooseRole", { roleId: id })) router.push("/plan"); };
  const goals = [...new Set(state.goals.map(sdgName))].join(", ");

  if (!best) {
    return (
      <div>
        <PageTitle title={`No job is reachable in ${p.months} months yet.`}>With {p.hoursPerWeek} hours a week, every job here needs more time. Try more months or more weekly hours, or talk to your counsellor.</PageTitle>
        <Btn href="/start">Change my answers</Btn>
      </div>
    );
  }
  return (
    <div>
      <PageTitle title={`Aim for ${best.title.toLowerCase()}.`}>
        Of the {view.matches.length} jobs you can reach in {p.months} months, this one fits you best and its skills should last.
      </PageTitle>

      <Card tone="raised">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h2 className="text-xl font-medium">{best.title}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SdgTag target={best.sdgTarget} why={best.sdgWhy} />
              {best.sdgMatch && <Chip tone="rise">Matches your goals</Chip>}
            </div>
            <p className="mt-3">{whyFits(best)}</p>
            {best.tradeoff && <p className="mt-2 text-sm text-muted">{best.tradeoff}</p>}
          </div>
          <Score value={best.score} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Btn onClick={() => choose(best.roleId)} disabled={busy} className="min-h-12 px-6 text-base">Plan my path to this job</Btn>
          <Btn href={`/jobs/${best.roleId}`} variant="ghost" className="min-h-12">Why this score</Btn>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <h2 className="text-base font-semibold">Other good matches</h2>
          <ul className="mt-3 space-y-2">
            {others.map((m) => (
              <li key={m.roleId}>
                <LinkRow href={`/jobs/${m.roleId}`} aside={<p className="num text-xl">{Math.round(m.score * 100)}</p>}>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-muted">About {m.weeks} weeks · {sdgName(m.sdgTarget)}{m.atRisk ? " · skills may fade" : ""}</p>
                </LinkRow>
              </li>
            ))}
          </ul>
          <Link href="/jobs/all" className="mt-3 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">See all {view.matches.length} jobs by sector</Link>
        </Card>
        <div className="space-y-4 lg:col-span-5">
          {bridge && (
            <Card>
              <h2 className="text-base font-semibold">Need income sooner?</h2>
              <p className="mt-1 text-sm"><b className="font-medium">{bridge.title}</b> needs about {bridge.weeks} weeks. Its skills may fade sooner, so treat it as a bridge while you train for {best.title.toLowerCase()}.</p>
              <Link href={`/jobs/${bridge.roleId}`} className="mt-2 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">See this bridge job</Link>
            </Card>
          )}
          <Card>
            <h2 className="text-base font-semibold">Make it fit you</h2>
            <ul className="mt-3 space-y-2">
              <li><LinkRow href="/goals" aside={<ChevronRight size={18} className="text-muted" aria-hidden />}>
                <p className="flex items-center gap-2 font-medium"><HandHeart size={18} strokeWidth={1.8} aria-hidden />Causes you care about</p>
                <p className="text-sm text-muted">{goals ? goals : "Jobs that serve them move up"}</p>
              </LinkRow></li>
              <li><LinkRow href="/map" aside={<ChevronRight size={18} className="text-muted" aria-hidden />}>
                <p className="flex items-center gap-2 font-medium"><MapPin size={18} strokeWidth={1.8} aria-hidden />Would you move for work?</p>
                <p className="text-sm text-muted">Where these jobs are in Malaysia</p>
              </LinkRow></li>
            </ul>
          </Card>
        </div>
      </div>
      <NextRow back="/forecast" next="/plan" nextLabel="Next: your plan" />
    </div>
  );
}
