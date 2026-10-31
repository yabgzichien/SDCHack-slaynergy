"use client";
import { useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { useSpeed } from "@/components/useSpeed";
import { AiCapability, JobGroupShares } from "@/components/AiTrendCharts";
import { Card, H, SdgTag, Skeleton, SourceChip } from "@/components/ui";
import { SourceDisclosure } from "@/components/SourceDisclosure";
import { ReleasePicker } from "@/components/History";
import { SourceDownNote } from "@/components/SourceDown";

// Each row's number and where it came from, so every line of the Future Skills Radar carries its source and date.
function Cite({ children }: { children: string }) {
  return <span className="num mt-0.5 block text-[11px] leading-snug text-muted">{children}</span>;
}
const ads = (trend: number) => (Math.abs(trend) < 0.03 ? "steady" : `${trend > 0 ? "▲" : "▼"}${Math.round(Math.abs(trend) * 100)}%`);

// One question: what is changing in the job market? Written for someone who has never read a chart like this.
export default function TrendsPage() {
  const { view, history } = useApp();
  const { speed } = useSpeed();
  const pageRef = useRef<HTMLDivElement>(null);
  const ready = Boolean(view);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!ready || !page || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const sections = page.querySelectorAll<HTMLElement>(".statistics-reveal");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -24px 0px", threshold: 0 });

    page.classList.add("statistics-motion-ready");
    sections.forEach((section, index) => {
      section.style.setProperty("--statistics-reveal-delay", `${index % 2 * 60}ms`);
      observer.observe(section);
    });

    return () => {
      observer.disconnect();
      page.classList.remove("statistics-motion-ready");
      sections.forEach((section) => {
        section.classList.remove("is-visible");
        section.style.removeProperty("--statistics-reveal-delay");
      });
    };
  }, [ready]);

  if (!view) return <Skeleton lines={6} />;
  // The charts are today's; the job and skill lists below follow the release picked above them.
  const w = view.world, r = (history.past?.view ?? view).radar;
  return (
    <div className="statistics-page" ref={pageRef}>
      <header className="statistics-hero statistics-reveal">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accentink">Future Skills Radar</p>
        <h1 className="statistics-hero-title"><span className="statistics-headline-highlight">How AI is changing jobs in Malaysia</span></h1>
        <div className="statistics-hero-banner">
          <span className="statistics-hero-icon" aria-hidden="true"><ChartNoAxesColumnIncreasing size={30} strokeWidth={3} /></span>
          <p>Which jobs are being hired more, which are being hired less, and how quickly AI is getting better. All numbers come from public government and research data. Each one says where it came from.</p>
        </div>
        <p className="mt-4 text-sm text-muted">We automatically check for new releases and update these figures when new data is available.</p>
        <SourceDownNote className="mt-1" />
        <div className="statistics-hero-art" aria-hidden="true">
          <Image src="/cockatiel-statistics-header.png" alt="" width={420} height={315} className="statistics-hero-mascot" priority />
        </div>
      </header>

      <div className="mt-4 statistics-reveal"><JobGroupShares asOfQuarter={w.asOfQuarter} /></div>
      <div className="mt-4 statistics-reveal"><AiCapability asOfQuarter={w.asOfQuarter} /></div>

      <div className="mt-8 statistics-reveal"><ReleasePicker label="Job lists as of" /></div>
      <div className="grid gap-y-4 gap-x-8 lg:grid-cols-2">
        <Card className="statistics-opportunities statistics-reveal">
          <div className="statistics-opportunities-heading">
            <H sub="Hiring is growing and AI cannot easily replace these jobs.">Good jobs to aim for</H>
            <Image src="/cockatiel-welcome.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="space-y-1.5">
            {r.risingJobs.slice(0, 6).map((j) => (
              <li key={j.roleId} className="flex items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num text-xs text-muted">Job type: {j.group}</p><Cite>{`Ads ${ads(j.trend)} · ${r.cite.dosm}`}</Cite></div>
                <SdgTag target={j.sdgTarget} />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-risk-heading">
            <H sub="AI can already do a lot of the work in these jobs.">Jobs most at risk from AI</H>
            <Image src="/cockatiel-dejected.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="space-y-1.5">
            {r.decliningJobs.map((j) => (
              <li key={j.occupationId} className="flex items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num text-xs text-muted">AI can do {j.exposure >= 0.45 ? "a lot" : j.exposure >= 0.3 ? "some" : "a little"} of this job</p><Cite>{`AI exposure ${j.exposure.toFixed(2)} · ${r.cite.ilo}${j.trend !== null ? ` · ads ${ads(j.trend)} · ${r.cite.dosm}` : ""}`}</Cite></div>
                <p className="num shrink-0 text-xs text-fall">starts changing {j.earliest}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-learning-heading">
            <H sub="Employers want these and AI cannot easily do them.">Skills worth learning</H>
            <Image src="/cockatiel-reading.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="space-y-1.5 text-sm">{r.rising.map((s) => <li key={s.skillId} className="flex items-start justify-between gap-2"><span className="min-w-0">{s.name}<Cite>{`${s.durable ? "Safe past 2040" : `AI could do most of it by ${s.byFuture[speed]}`} · ${r.cite.ilo}, ${r.cite.aei} · ${r.cite.dosm}`}</Cite></span><SdgTag target={s.sdgTarget} /></li>)}</ul>
        </Card>
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-fading-heading">
            <H sub="The date AI is expected to do most of this work.">Skills AI will take over first</H>
            <Image src="/cockatiel-sunglasses.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="space-y-1.5 text-sm">{r.declining.map((s) => <li key={s.skillId} className="flex items-start justify-between gap-2"><span className="min-w-0">{s.name}<Cite>{`${r.cite.ilo}, ${r.cite.aei}`}</Cite></span><span className="num shrink-0 text-fall">{s.byFuture[speed]}</span></li>)}</ul>
        </Card>
      </div>
      <div className="statistics-reveal"><SourceDisclosure>{r.sources.map((s) => <SourceChip key={s.name} name={s.name} date={s.date} url={s.url} />)}</SourceDisclosure></div>
      <footer className="statistics-reveal mt-6 rounded-2xl bg-surface p-4 text-sm sm:p-5">
        <h2 className="font-semibold">Why SDGs matter</h2>
        <p className="mt-1 text-muted">The Sustainable Development Goals (SDGs) are important because they provide a shared global framework for addressing the most pressing challenges humanity faces, from poverty and climate change to inequality and lack of access to education.{" "}
          <a href="https://waitro.org/blog/why-are-the-sustainable-development-goals-important/" target="_blank" rel="noreferrer" className="text-ink underline decoration-control underline-offset-2">Read more</a>
        </p>
      </footer>
    </div>
  );
}
