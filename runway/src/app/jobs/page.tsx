"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { useT } from "@/components/I18nProvider";
import { useSpeed } from "@/components/useSpeed";
import { useSelectJob } from "@/components/useSelectJob";
import { BriefWhy } from "@/components/JobBits";
import { JobBadge } from "@/components/JobIcon";
import { JobsNav } from "@/components/JobsNav";
import { ArrowDown, ChevronRight, HandHeart, MapPin, TrendingDown, TrendingUp } from "lucide-react";
const MalaysiaMap = dynamic(() => import("@/components/MalaysiaMap").then((m) => m.MalaysiaMap), { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-2xl bg-surface2" aria-hidden /> });
import { mapFigures, times } from "@/lib/map-figures";
import { stateById } from "@/lib/engine/geo";
import { roleById, type GroupKey, type SectorId } from "@/lib/engine/data";
import type { StayView, RoleMatchView } from "@/lib/engine/view";
import { STAY_ID } from "@/lib/engine/state";
import { suggestedJobs } from "@/lib/suggested";
import { Btn, Card, Chip, LinkRow, More, NextRow, PageTitle, SdgTag, Skeleton, Stop, sdgName } from "@/components/ui";
import "./jobs.css";

const LOWERCASE_TITLE_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "per", "the", "to", "via"]);

function titleCaseJob(title: string) {
  return title.split(" ").map((word, index) => {
    if (index > 0 && LOWERCASE_TITLE_WORDS.has(word.toLowerCase())) return word.toLowerCase();
    if (word.length > 1 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

// One question: which job should I aim for?
export default function JobsPage() {
  const { view, state, catalog, busy } = useApp();
  const { lang, t } = useT();
  const selectJob = useSelectJob();
  const { speed } = useSpeed(view);
  if (!view || !state || !catalog) return <Skeleton lines={6} />;
  if (!state.profile) return <div><PageTitle title="Which job should you aim for?">Answer a few questions first.</PageTitle><Btn href="/start">Get started</Btn></div>;
  const p = state.profile;
  const [best, ...others] = suggestedJobs(view);
  const bridge = view.bridge;
  // Selecting a job saves it and moves on to the next step, the job map, which then shows that job.
  const select = (id: string) => selectJob(id);
  const selectedId = state.chosenRoleId && state.chosenRoleId !== STAY_ID ? state.chosenRoleId : null;
  const mapJob = (selectedId && view.matches.find((m) => m.roleId === selectedId)) || best;
  const goals = [...new Set(state.goals.map(sdgName))].join(", ");
  const jobTitle = (title: string) => lang === "en" ? titleCaseJob(title) : t(title);

  const stayCard = view.stay && <StayCard stay={view.stay} speed={speed} bridge={bridge} chosen={state.chosenRoleId === STAY_ID} busy={busy} onChoose={() => select(STAY_ID)} />;
  if (!best) {
    return (
      <div>
        <PageTitle title={`No new job is reachable in ${p.months} months yet.`}>With {p.hoursPerWeek} hours a week, every other job here needs more time. {view.stay ? "You can stay in your job and keep it up to date, or try" : "Try"} more months or weekly hours.</PageTitle>
        {stayCard}
        <div className="mt-4"><Btn href="/start" variant="ghost">Change my answers</Btn></div>
      </div>
    );
  }
  return (
    <div className="jobs-page">
      <PageTitle
        title={
          <span className="inline-flex items-baseline gap-4 whitespace-nowrap">
            <span className="shrink-0 text-lg tracking-normal sm:text-xl">Aim for:</span>
            <span data-no-translate className="inline-block rounded-lg bg-cuesoft px-3 py-1 font-extrabold leading-none text-cueink">{jobTitle(best.title)}</span>
          </span>
        }
      >
        Of the {view.matches.length} jobs you can reach in {p.months} months, this one fits you best. Start here, then compare the others.
      </PageTitle>

      <div className="jobs-layout">
        <JobsNav showOthers={others.length > 0} />
        <div className="jobs-content space-y-10">
        <Stop n={1} id="best-job" title="Your best job" current>
          <Card tone="raised" className="ring-2 ring-cue">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <div className="min-w-0">
                <div className="flex items-start gap-4">
                  <JobBadge name={best.why.icon} size="lg" tone="cue" />
                  <div className="min-w-0">
                    <h3 data-no-translate className="text-xl font-extrabold">{jobTitle(best.title)}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {selectedId === best.roleId && <Chip tone="cue">Selected</Chip>}
                      <SdgTag target={best.sdgTarget} why={best.sdgWhy} />
                      {best.sdgMatch && <Chip tone="rise">Matches your goals</Chip>}
                      <BriefWhy m={best} />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">About {best.weeks} weeks to get ready.</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <Btn onClick={() => select(best.roleId)} disabled={busy} className="min-h-12 px-6 text-base">Select job <ChevronRight size={18} aria-hidden /></Btn>
                <Btn href={`/jobs/${best.roleId}`} variant="ghost" className="min-h-12">See why <ChevronRight size={16} aria-hidden /></Btn>
              </div>
            </div>
          </Card>
          {others.length > 0 && (
            <a href="#others" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-cuesoft px-4 text-sm font-medium text-cueink hover:underline">
              <ArrowDown size={16} aria-hidden className="motion-safe:animate-bounce" />Next: compare {others.length} other jobs
            </a>
          )}
        </Stop>

        {others.length > 0 && (
          <Stop n={2} id="others" title="Other good matches" sub="Same three reasons, so you can compare them with your best job.">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((m) => (
                <li key={m.roleId} className={`flex h-full flex-col rounded-[22px] bg-surface p-4 ${selectedId === m.roleId ? "ring-2 ring-cue" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <JobBadge name={m.why.icon} size="sm" />
                    {selectedId === m.roleId && <Chip tone="cue">Selected</Chip>}
                  </div>
                  <Link data-no-translate href={`/jobs/${m.roleId}`} className="job-card-title mt-3 underline-offset-2 hover:underline"><strong>{jobTitle(m.title)}</strong></Link>
                  <div className="mt-2"><BriefWhy m={m} stack /></div>
                  <p className="mt-3 text-sm text-muted">About {m.weeks} weeks{m.fewNearby ? " · few near you" : ""}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
                    <Btn onClick={() => select(m.roleId)} disabled={busy} variant="ghost">Select job</Btn>
                    <Link href={`/jobs/${m.roleId}`} className="text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">See why</Link>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/jobs/all" className="mt-3 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">See all {view.matches.length} jobs by sector</Link>
          </Stop>
        )}

        <Stop n={others.length > 0 ? 3 : 2} id="where" title="Where in Malaysia" sub={`Select a job to see where it is. Showing: ${mapJob.title}.`}>
          <MapTeaser roleTitle={mapJob.title} sector={mapJob.sector as SectorId} group={roleById[mapJob.roleId]?.group} home={p.state ?? null} />
        </Stop>

        <section id="keep-job">
          <h2 className="mb-4 text-xl font-bold sm:text-2xl">Or keep your job for now</h2>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">{stayCard}</div>
            <div className="space-y-4 lg:col-span-4">
              {bridge && view.stay?.status !== "fast" && (
                <Card>
                  <h3 className="text-base font-semibold">Need income sooner?</h3>
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
        </section>
        </div>
      </div>
      <NextRow back="/skills" next="/map" nextLabel="Next: where in Malaysia" />
    </div>
  );
}

const an = (t: string) => (/^[aeiou]/i.test(t) ? "an" : "a");

// Staying in the job you have. Labelled by how exposed it is (ILO 2025), with what fades and what grows in it.
function StayCard({ stay, speed, bridge, chosen, busy, onChoose }: { stay: StayView; speed: string; bridge: RoleMatchView | null; chosen: boolean; busy: boolean; onChoose: () => void }) {
  const job = stay.title.toLowerCase();
  const exposed = stay.ilo ? `A UN study (ILO) found AI could do about ${Math.round(stay.ilo.score * 100)}% of this job's tasks` : "AI could do many of this job's tasks";
  const toward = stay.toward;
  const head = stay.status === "fast" ? `Stay ${an(job)} ${job}, for now` : `Stay ${an(job)} ${job}`;
  const text = stay.status === "fast"
    ? `${exposed}, one of the highest of any job.${stay.fadeYear[speed] ? ` AI could do most of its skills by ${stay.fadeYear[speed]}.` : ""} ${toward ? "Keep it for income while you train for the job above." : "No lasting job is reachable in your time yet, so add the skills below while you keep working."}`
    : stay.status === "changing"
      ? `This job is changing, not disappearing. ${exposed}, so some of your work will move to AI. It should last if you add the skills growing in it.`
      : "A UN study (ILO) found AI can do little of this job. Keeping your skills fresh and learning to use AI tools should be enough.";
  const action = stay.status === "fast" && toward ? "Select: keep my job while I train" : "Select: keep my job";
  return (
    <Card tone={stay.status === "fast" ? "fall" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {stay.status === "fast" ? <Chip tone="negative">Shrinking fast</Chip> : stay.status === "changing" ? <Chip tone="fall">Changing because of AI</Chip> : <Chip tone="rise">Steady</Chip>}
            {chosen && <Chip tone="accent">Your current plan</Chip>}
          </div>
          <h2 className="mt-2 text-lg font-medium">{head}</h2>
          <p className="mt-1 text-sm">{text}</p>
        </div>
        <Btn onClick={onChoose} disabled={busy} variant="ghost" className="shrink-0">{action}</Btn>
      </div>
      {(stay.fading.length > 0 || stay.growing.length > 0) && (
        <More summary={stay.status === "fast" ? "What AI is taking over in this job" : "What is changing in this job"}>
          <div className="grid gap-3 text-ink sm:grid-cols-2">
            {stay.fading.length > 0 && (
              <div className="rounded-2xl bg-raised p-4">
                <p className="flex items-center gap-2 text-sm font-medium"><TrendingDown size={16} aria-hidden className="text-fall" />AI is taking over in this job</p>
                <ul className="mt-2 space-y-1 text-sm">{stay.fading.map((f) => <li key={f.skillId} className="flex justify-between gap-3"><span>{f.name}</span><span className="num shrink-0 whitespace-nowrap text-muted">by {f.byFuture[speed]}</span></li>)}</ul>
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
            <p className="text-sm">Need a different job sooner? <Link href={`/jobs/${bridge.roleId}`} className="underline decoration-control underline-offset-2 hover:text-ink">{bridge.title}</Link> takes about {bridge.weeks} weeks.</p>
          )}
        </More>
      )}
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
    <Link href="/map" className="press grid items-center gap-4 rounded-[22px] bg-surface p-4 hover:bg-surface2 sm:grid-cols-[1.4fr_1fr] sm:p-5">
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
