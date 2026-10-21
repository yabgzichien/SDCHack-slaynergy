"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Score, whyFits } from "@/components/JobBits";
import { ChevronRight, HandHeart, MapPin, TrendingDown, TrendingUp } from "lucide-react";
import { MalaysiaMap } from "@/components/MalaysiaMap";
import { mapFigures, times } from "@/lib/map-figures";
import { stateById } from "@/lib/engine/geo";
import { roleById, type GroupKey, type SectorId } from "@/lib/engine/data";
import type { StayView, RoleMatchView } from "@/lib/engine/view";
import { STAY_ID } from "@/lib/engine/state";
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

  const stayCard = view.stay && <StayCard stay={view.stay} bridge={bridge} chosen={state.chosenRoleId === STAY_ID} busy={busy} onChoose={() => choose(STAY_ID)} />;
  if (!best) {
    return (
      <div>
        <PageTitle title={`No new job is reachable in ${p.months} months yet.`}>With {p.hoursPerWeek} hours a week, every other job here needs more time. You can stay in your job and keep it up to date, or try more months or weekly hours.</PageTitle>
        {stayCard}
        <div className="mt-4"><Btn href="/start" variant="ghost">Change my answers</Btn></div>
      </div>
    );
  }
  return (
    <div>
      <PageTitle title={`Aim for ${best.title.toLowerCase()}.`}>
        Of the {view.matches.length} jobs you can reach in {p.months} months, this one fits you best, and AI is unlikely to take it over soon.
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

      <div className="mt-4">{stayCard}</div>

      <MapTeaser roleTitle={best.title} sector={best.sector as SectorId} group={roleById[best.roleId]?.group} home={p.state ?? null} />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <h2 className="text-base font-semibold">Other good matches</h2>
          <ul className="mt-3 space-y-2">
            {others.map((m) => (
              <li key={m.roleId}>
                <LinkRow href={`/jobs/${m.roleId}`} aside={<p className="num text-xl">{Math.round(m.score * 100)}</p>}>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-muted">About {m.weeks} weeks · {sdgName(m.sdgTarget)}{m.atRisk ? " · AI may take over some skills" : ""}</p>
                </LinkRow>
              </li>
            ))}
          </ul>
          <Link href="/jobs/all" className="mt-3 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">See all {view.matches.length} jobs by sector</Link>
        </Card>
        <div className="space-y-4 lg:col-span-5">
          {bridge && view.stay?.status !== "fast" && (
            <Card>
              <h2 className="text-base font-semibold">Need income sooner?</h2>
              <p className="mt-1 text-sm"><b className="font-medium">{bridge.title}</b> needs about {bridge.weeks} weeks. AI may take over its skills sooner, so use it to earn money while you train for {best.title.toLowerCase()}.</p>
              <Link href={`/jobs/${bridge.roleId}`} className="mt-2 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">See this short-term job</Link>
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

const an = (t: string) => (/^[aeiou]/i.test(t) ? "an" : "a");

// Staying in the job you have. Labelled by how exposed it is (ILO 2025), with what fades and what grows in it.
function StayCard({ stay, bridge, chosen, busy, onChoose }: { stay: StayView; bridge: RoleMatchView | null; chosen: boolean; busy: boolean; onChoose: () => void }) {
  const job = stay.title.toLowerCase();
  const exposed = stay.ilo ? `A UN study (ILO) found AI could do about ${Math.round(stay.ilo.score * 100)}% of this job's tasks` : "AI could do many of this job's tasks";
  const toward = stay.toward;
  const head = stay.status === "fast" ? `Stay ${an(job)} ${job}, for now` : `Stay ${an(job)} ${job}`;
  const text = stay.status === "fast"
    ? `${exposed}, one of the highest of any job.${stay.fadeYear ? ` AI could do most of its skills by ${stay.fadeYear}.` : ""} ${toward ? `Keep it for income while you train for ${toward.title.toLowerCase()}, a job AI is unlikely to take over.` : "No lasting job is reachable in your time yet, so add the skills below while you keep working."}`
    : stay.status === "changing"
      ? `This job is changing, not disappearing. ${exposed}, so some of your work will move to AI. It should last if you add the skills growing in it.`
      : "A UN study (ILO) found AI can do little of this job. Keeping your skills fresh and learning to use AI tools should be enough.";
  const action = stay.status === "fast" && toward ? `Keep my job and train for ${toward.title.toLowerCase()}` : stay.status === "steady" ? "Plan to keep my job up to date" : "Plan to reshape my job";
  return (
    <Card tone={stay.status === "fast" ? "fall" : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        {stay.status === "fast" ? <Chip tone="negative">Shrinking fast</Chip> : stay.status === "changing" ? <Chip tone="fall">Changing because of AI</Chip> : <Chip tone="rise">Steady</Chip>}
        {chosen && <Chip tone="accent">Your current plan</Chip>}
      </div>
      <h2 className="mt-2 text-xl font-medium">{head}</h2>
      <p className="mt-2 max-w-2xl">{text}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {stay.fading.length > 0 && (
          <div className="rounded-2xl bg-raised p-4">
            <p className="flex items-center gap-2 text-sm font-medium"><TrendingDown size={16} aria-hidden className="text-fall" />AI is taking over in this job</p>
            <ul className="mt-2 space-y-1 text-sm">{stay.fading.map((f) => <li key={f.skillId} className="flex justify-between gap-3"><span>{f.name}</span><span className="num shrink-0 whitespace-nowrap text-muted">by {f.expected}</span></li>)}</ul>
          </div>
        )}
        {stay.growing.length > 0 && (
          <div className="rounded-2xl bg-raised p-4">
            <p className="flex items-center gap-2 text-sm font-medium"><TrendingUp size={16} aria-hidden className="text-rise" />{stay.status === "fast" ? "Skills that keep you useful meanwhile" : "Growing in this job"}</p>
            <ul className="mt-2 space-y-1 text-sm">{stay.growing.map((g) => <li key={g.skillId}>{g.name}</li>)}</ul>
          </div>
        )}
      </div>
      {stay.status === "fast" && bridge && bridge.roleId !== toward?.roleId && (
        <p className="mt-3 text-sm text-muted">Need a different job sooner? <Link href={`/jobs/${bridge.roleId}`} className="underline decoration-control underline-offset-2 hover:text-ink">{bridge.title}</Link> takes about {bridge.weeks} weeks.</p>
      )}
      <div className="mt-4"><Btn onClick={onChoose} disabled={busy} variant={stay.status === "fast" ? undefined : "ghost"} className="min-h-12">{action}</Btn></div>
    </Card>
  );
}

// The map, small, right under the best job: where jobs like it are, and one line comparing your state with the best one.
function MapTeaser({ roleTitle, sector, group, home }: { roleTitle: string; sector: SectorId; group?: GroupKey; home: string | null }) {
  const fig = mapFigures(sector, "jobs", group);
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
