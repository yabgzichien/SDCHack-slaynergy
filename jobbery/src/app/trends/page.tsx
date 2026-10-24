"use client";
import { useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { useSpeed } from "@/components/useSpeed";
import { AiCapability, JobGroupShares } from "@/components/AiTrendCharts";
import { Card, H, SdgTag, Skeleton, SourceChip } from "@/components/ui";
import { SourceDisclosure } from "@/components/SourceDisclosure";

// One question: what is changing in the job market? Written for someone who has never read a chart like this.
export default function TrendsPage() {
  const { view } = useApp();
  const { speed } = useSpeed(view);
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
  const r = view.radar, w = view.world;
  return (
    <div className="statistics-page" ref={pageRef}>
      <header className="statistics-hero statistics-reveal">
        <h1 className="statistics-hero-title"><span className="statistics-headline-highlight">How AI is changing jobs in Malaysia</span></h1>
        <div className="statistics-hero-banner">
          <span className="statistics-hero-icon" aria-hidden="true"><ChartNoAxesColumnIncreasing size={30} strokeWidth={3} /></span>
          <p>Which jobs are being hired more, which are being hired less, and how quickly AI is getting better. All numbers come from public government and research data. Each one says where it came from.</p>
        </div>
        <p className="mt-4 text-sm text-muted">We automatically check for new releases and update these figures when new data is available.</p>
        <div className="statistics-hero-art" aria-hidden="true">
          <Image src="/cockatiel-statistics-header.png" alt="" width={420} height={315} className="statistics-hero-mascot" priority />
        </div>
      </header>

      <div className="mt-4 statistics-reveal"><JobGroupShares asOfQuarter={w.asOfQuarter} /></div>
      <div className="mt-4 statistics-reveal"><AiCapability asOfQuarter={w.asOfQuarter} /></div>

      <div className="mt-4 grid gap-y-4 gap-x-8 lg:grid-cols-2">
        <Card className="statistics-opportunities statistics-reveal">
          <div className="statistics-opportunities-heading">
            <H sub="Hiring is growing and AI cannot easily replace these jobs.">Good jobs to aim for</H>
            <Image src="/cockatiel-welcome.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="space-y-1.5">
            {r.risingJobs.slice(0, 6).map((j) => (
              <li key={j.roleId} className="flex items-center justify-between gap-2 rounded-2xl bg-raised px-4 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num text-xs text-muted">Job type: {j.group}</p></div>
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
                <div className="min-w-0"><p className="text-sm font-medium">{j.title}</p><p className="num text-xs text-muted">AI can do {j.exposure >= 0.45 ? "a lot" : j.exposure >= 0.3 ? "some" : "a little"} of this job</p></div>
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
          <ul className="space-y-1 text-sm">{r.rising.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><SdgTag target={s.sdgTarget} /></li>)}</ul>
        </Card>
        <Card className="statistics-reveal">
          <div className="statistics-opportunities-heading statistics-fading-heading">
            <H sub="The date AI is expected to do most of this work.">Skills AI will take over first</H>
            <Image src="/cockatiel-sunglasses.png" alt="" width={96} height={96} className="statistics-opportunities-bird" />
          </div>
          <ul className="space-y-1 text-sm">{r.declining.map((s) => <li key={s.skillId} className="flex justify-between gap-2"><span>{s.name}</span><span className="num text-fall">{s.byFuture[speed]}</span></li>)}</ul>
        </Card>
      </div>
      <div className="statistics-reveal"><SourceDisclosure>{r.sources.map((s) => <SourceChip key={s.name} name={s.name} date={s.date} url={s.url} />)}</SourceDisclosure></div>
    </div>
  );
}
