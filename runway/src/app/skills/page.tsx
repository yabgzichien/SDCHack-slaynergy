"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { ExpiryAxis, ExpiryLegend, ExpiryTrack } from "@/components/ExpiryTrack";
import { Btn, Card, Chip, Estimate, More, NextRow, PageTitle, Skeleton, SourceChip } from "@/components/ui";

// One question: which of my skills will last?
export default function SkillsPage() {
  const { view, state } = useApp();
  if (!view || !state) return <Skeleton lines={6} />;
  if (!state.profile) {
    return (
      <div>
        <PageTitle title="Which of your skills will last?">Answer a few questions first, and Jobbery gives each of your skills a shelf life.</PageTitle>
        <Btn href="/start">Get started</Btn>
      </div>
    );
  }
  const mine = view.profileSkills;
  const fading = mine.filter((s) => !s.expiry.durable && s.expiry.expectedYear < 2031);
  const lasting = mine.filter((s) => s.expiry.durable || s.expiry.expectedYear >= 2034);
  const shelf = (s: (typeof mine)[number]) => (s.expiry.durable || s.expiry.expectedYear >= 2034 ? { t: "Lasting", tone: "rise" as const } : s.expiry.expectedYear < 2031 ? { t: "Fading soon", tone: "fall" as const } : { t: "Holding up", tone: "neutral" as const });
  const src = view.radar.sources;

  return (
    <div>
      <PageTitle title={fading.length ? `${fading.length} of your ${mine.length} skills fade before 2031.` : `None of your ${mine.length} skills fades before 2031.`}>
        The date is when AI is likely to do most of that skill&apos;s work. {lasting.length ? `Your longest-lasting: ${lasting.slice(0, 2).map((s) => s.name.toLowerCase()).join(" and ")}.` : ""} That is a reason to plan, not to worry.
      </PageTitle>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Your skills, soonest to fade first</h2>
          <ExpiryLegend />
        </div>
        <ul className="space-y-2">
          {mine.map((s) => {
            const sh = shelf(s);
            return (
              <li key={s.skillId} className="rounded-2xl bg-raised px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{s.name}</p>
                  <div className="flex items-center gap-3">
                    <Chip tone={sh.tone}>{sh.t}</Chip>
                    <span className="num w-24 text-right">{s.expiry.durable ? "after 2040" : s.expiry.expected}</span>
                  </div>
                </div>
                <div className="mt-2"><ExpiryTrack byFuture={s.expiry.byFuture} expected={s.expiry.expected} durable={s.expiry.durable} axis={false} /></div>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 px-4"><ExpiryAxis /></div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {src.slice(0, 2).map((x) => <SourceChip key={x.name} name={x.name} date={x.date} url={x.url} />)}
        </div>
        <div className="mt-2"><Estimate /></div>
        <More summary="Why three dots?">
          <p>Nobody knows how fast AI will improve, so each dot is one possible future: slow, medium or fast. The bar ends at the most likely date. <Link href="/forecast" className="underline decoration-control underline-offset-2 hover:text-ink">How likely is each future?</Link></p>
          <p>The dates come from how much of each skill&apos;s work AI can already do (ILO 2025 and the Anthropic Economic Index) and how fast AI test scores are rising.</p>
        </More>
      </Card>

      <NextRow back="/start" next="/forecast" nextLabel="Next: the forecast" />
    </div>
  );
}
