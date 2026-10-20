"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Score, whyFits } from "@/components/JobBits";
import { ChevronRight, HandHeart, MapPin } from "lucide-react";
import { MalaysiaMap } from "@/components/MalaysiaMap";
import { mapFigures, times } from "@/lib/map-figures";
import { stateById } from "@/lib/engine/geo";
import type { SectorId } from "@/lib/engine/data";
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

      <MapTeaser roleTitle={best.title} sector={best.sector as SectorId} home={p.state ?? null} />

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
          <LinkRow href="/goals" aside={<ChevronRight size={18} className="text-muted" aria-hidden />}>
            <p className="flex items-center gap-2 font-medium"><HandHeart size={18} strokeWidth={1.8} aria-hidden />Causes you care about</p>
            <p className="text-sm text-muted">{goals ? goals : "Jobs that serve them move up your list"}</p>
          </LinkRow>
        </div>
      </div>
      <NextRow back="/forecast" next="/map" nextLabel="Next: where in Malaysia" />
    </div>
  );
}

// The map, small, right under the best job: where jobs like it are, and one line comparing your state with the best one.
function MapTeaser({ roleTitle, sector, home }: { roleTitle: string; sector: SectorId; home: string | null }) {
  const fig = mapFigures(sector, "jobs");
  const ranked = [...fig.rows].sort((a, b) => b.workers - a.workers);
  const homeRow = home ? fig.rows.find((r) => r.id === home) : null;
  const top = ranked.find((r) => r.id !== home) ?? ranked[0];
  const line = homeRow && top.workers > homeRow.workers
    ? `${top.short} has ${times(top.workers / homeRow.workers)} as many jobs like this as ${homeRow.short}.`
    : `Most jobs like this are in ${ranked[0].short}, ${ranked[1].short} and ${ranked[2].short}.`;
  return (
    <Link href="/map" className="press mt-4 grid items-center gap-4 rounded-[22px] bg-surface p-4 hover:bg-surface2 sm:grid-cols-[1.4fr_1fr] sm:p-5">
      <MalaysiaMap preview values={fig.values} bins={fig.bins} ramp={fig.ramp} home={home} ariaLabel={`Small map of where jobs like ${roleTitle.toLowerCase()} are in Malaysia`} />
      <div>
        <p className="flex items-center gap-2 text-sm text-muted"><MapPin size={16} aria-hidden />Would you move for work?</p>
        <h2 className="mt-1 text-lg font-medium">{line}</h2>
        <p className="mt-1 text-sm text-muted">{homeRow ? `Compare pay and unemployment with ${stateById[home!]?.short}.` : "Tell us your state to compare it with the others."}</p>
        <span className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primaryink">Open the job map <ChevronRight size={16} aria-hidden /></span>
      </div>
    </Link>
  );
}
