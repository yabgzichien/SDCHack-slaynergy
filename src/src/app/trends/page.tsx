"use client";
import { useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { ReleaseInfo } from "@/components/ReleaseInfo";
import { useApp } from "@/components/AppProvider";
import { useSpeed } from "@/components/useSpeed";
import { AiCapability, JobGroupShares } from "@/components/AiTrendCharts";
import { Card, H, SdgTag, Skeleton, SourceChip } from "@/components/ui";
import { SourceDisclosure } from "@/components/SourceDisclosure";
import { ReleasePicker } from "@/components/History";
import { SourceDownNote } from "@/components/SourceDown";
import { SdgFocus } from "@/components/SdgFocus";
import { sdgColor } from "@/components/SdgIcon";
import { focusGoals, goalOf, goalTint, orderByGoals, targetsByGoal, toggleGoal } from "@/lib/sdgFocus";

const ads = (trend: number) => (Math.abs(trend) < 0.03 ? "steady" : `${trend > 0 ? "▲" : "▼"}${Math.round(Math.abs(trend) * 100)}%`);

// One question: what is changing in the job market? Written for someone who has never read a chart like this.
export default function TrendsPage() {
  const { view, state, catalog, act, busy, history } = useApp();
  const { speed } = useSpeed();
  const pageRef = useRef<HTMLDivElement>(null);
  const ready = Boolean(view);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!ready || !page || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const items = page.querySelectorAll<HTMLElement>(".statistics-job-list > li, .statistics-skill-list > li");
    items.forEach((item) => item.classList.add("statistics-reveal-item"));
    const sections = page.querySelectorAll<HTMLElement>(".statistics-reveal, .statistics-reveal-item");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -24px 0px", threshold: 0 });

    page.classList.add("statistics-motion-ready");
    sections.forEach((section, index) => {
      section.style.setProperty("--statistics-reveal-delay", `${section.classList.contains("statistics-reveal-item") ? index % 6 * 45 : index % 2 * 60}ms`);
      observer.observe(section);
    });

    return () => {
      observer.disconnect();
      page.classList.remove("statistics-motion-ready");
      sections.forEach((section) => {
        section.classList.remove("is-visible");
        section.classList.remove("statistics-reveal-item");
        section.style.removeProperty("--statistics-reveal-delay");
      });
    };
  }, [ready]);

  if (!view) return <Skeleton lines={6} />;
  // The charts are today's; the job and skill lists below follow the release picked above them.
  const w = view.world, r = (history.past?.view ?? view).radar;
  const chosen = focusGoals(state?.goals ?? []);
  const byGoal = targetsByGoal((catalog?.goals ?? []).map((g) => g.target));
  const serving = new Map<number, number>();
  for (const x of [...r.risingJobs, ...r.rising, ...r.declining]) serving.set(goalOf(x.sdgTarget), (serving.get(goalOf(x.sdgTarget)) ?? 0) + 1);
  const first = <T extends { sdgTarget: string }>(items: T[]) => orderByGoals(items, (x) => goalOf(x.sdgTarget), chosen);
  const hit = (x: { sdgTarget: string }) => chosen.has(goalOf(x.sdgTarget));
  const tint = (x: { sdgTarget: string }) => (hit(x) ? goalTint(sdgColor(goalOf(x.sdgTarget))) : undefined);
  const saveGoals = (goals: string[]) => act("goals", { goals });
  return (
    <div className="statistics-page statistics-trends-page" ref={pageRef}>
      <header className="statistics-hero statistics-reveal">
        <div className="statistics-trends-heading">
          <h1 className="statistics-hero-title"><span className="statistics-headline-highlight">How AI is changing jobs in Malaysia</span></h1>
          <ReleaseInfo label="How these figures are updated">We automatically check for new releases and update these figures when new data is available.</ReleaseInfo>
        </div>
        <div className="statistics-hero-banner">
          <span className="statistics-hero-icon" aria-hidden="true"><ChartNoAxesColumnIncreasing size={30} strokeWidth={3} /></span>
          <p>Which jobs are being hired more, which are being hired less, and how quickly AI is getting better. All numbers come from public government and research data. Each one says where it came from.</p>
          <div className="statistics-hero-art" aria-hidden="true">
            <Image src="/cockatiel-statistics-header.png" alt="" width={420} height={315} className="statistics-hero-mascot" priority />
          </div>
        </div>
        <SourceDownNote className="mt-1" />
      </header>

      <div className="mt-4 statistics-reveal"><JobGroupShares asOfQuarter={w.asOfQuarter} /></div>
      <div className="mt-4 statistics-reveal"><AiCapability asOfQuarter={w.asOfQuarter} /></div>

      <div className="mt-8 statistics-reveal"><ReleasePicker label="Job lists as of" /></div>
      {state && catalog && (
        <Card className="mb-4 statistics-reveal">
          <h2 className="text-base font-semibold">Which UN goals do you want to build your working life around?</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Pick the goals you care about. The jobs and skills below that serve them move to the top of their list, in the goal&apos;s colour. Each UN goal tag links to the UN&apos;s own page for that goal.</p>
          <SdgFocus chosen={chosen} available={new Set(byGoal.keys())} serving={serving} busy={busy} count="page" showPlan={!!state.profile}
            onToggle={(g) => saveGoals(toggleGoal(state.goals, g, byGoal.get(g) ?? []))}
            onClear={() => saveGoals([])} />
        </Card>
      )}
      <div className="grid gap-y-4 gap-x-8 lg:grid-cols-2">
        <Card className="statistics-opportunities statistics-reveal">
          <div className="statistics-opportunities-heading">
            <H sub="Hiring is growing and AI cannot easily replace these jobs.">Good jobs to aim for</H>
            <Image src="/cockatiel-welcome.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="statistics-job-list space-y-1.5">
            {first(r.risingJobs).slice(0, 6).map((j) => (
              <li key={j.roleId} className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-2.5" style={tint(j)}>
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num mt-1 text-xs text-muted">Ads {ads(j.trend)}</p></div>
                <SdgTag target={j.sdgTarget} highlight={hit(j)} />
              </li>
            ))}
          </ul>
          <SourceDisclosure>
            <SourceChip {...r.sources[2]} />
            <SourceChip name="UN Sustainable Development Goals icons" date="Goal numbers and pictograms" url="https://open-sdg.org/translations-un-sdg/" />
            <p className="text-xs text-muted">The content of this publication has not been approved by the United Nations and does not reflect the views of the United Nations or its officials or Member States.</p>
          </SourceDisclosure>
        </Card>
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-risk-heading">
            <H sub="AI can already do a lot of the work in these jobs.">Jobs most at risk from AI</H>
            <Image src="/cockatiel-dejected.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="statistics-job-list space-y-1.5">
            {r.decliningJobs.map((j) => (
              <li key={j.occupationId} className="flex items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num mt-1 text-xs text-muted">AI exposure {j.exposure.toFixed(2)}{j.trend !== null ? ` · Ads ${ads(j.trend)}` : ""}</p></div>
                <p className="num shrink-0 text-xs text-fall">starts changing {j.earliest}</p>
              </li>
            ))}
          </ul>
          <SourceDisclosure>{r.sources.map((s) => <SourceChip key={s.name} name={s.name} date={s.date} url={s.url} />)}</SourceDisclosure>
        </Card>
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-learning-heading">
            <H sub="Employers want these and AI cannot easily do them.">Skills worth learning</H>
            <Image src="/cockatiel-reading.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="statistics-skill-list">{first(r.rising).map((s) => <li key={s.skillId} className="statistics-skill-row" style={tint(s)}><span className="min-w-0"><span className="block">{s.name}</span><span className="num mt-0.5 block text-xs text-muted">{s.durable ? "Safe past 2040" : `AI shift ${s.byFuture[speed]}`}</span></span><SdgTag target={s.sdgTarget} highlight={hit(s)} /></li>)}</ul>
          <SourceDisclosure>
            {r.sources.map((s) => <SourceChip key={s.name} name={s.name} date={s.date} url={s.url} />)}
            <SourceChip name="UN Sustainable Development Goals icons" date="Goal numbers and pictograms" url="https://open-sdg.org/sdg-translations/icons/" />
            <p className="text-xs text-muted">The content of this publication has not been approved by the United Nations and does not reflect the views of the United Nations or its officials or Member States.</p>
          </SourceDisclosure>
        </Card>
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-fading-heading">
            <H sub="The date AI is expected to do most of this work.">Skills AI will take over first</H>
            <Image src="/cockatiel-sunglasses.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="statistics-skill-list">{first(r.declining).map((s) => <li key={s.skillId} className="statistics-skill-row" style={tint(s)}><span className="min-w-0">{s.name}</span><span className="flex shrink-0 items-center gap-2"><SdgTag target={s.sdgTarget} highlight={hit(s)} /><span className="num text-fall">{s.byFuture[speed]}</span></span></li>)}</ul>
          <SourceDisclosure>{[r.sources[0], r.sources[1], r.sources[3]].map((s) => <SourceChip key={s.name} name={s.name} date={s.date} url={s.url} />)}</SourceDisclosure>
        </Card>
      </div>
    </div>
  );
}
