"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { ExpiryLegend, ExpiryTrack } from "@/components/ExpiryTrack";
import { Btn, Card, Chip, Estimate, NextRow, PageTitle, Skeleton, SourceChip } from "@/components/ui";

// One question: which of my skills will last?
export default function SkillsPage() {
  const { view, state } = useApp();
  if (!view || !state) return <Skeleton lines={6} />;
  if (!state.profile) {
    return (
      <div>
        <PageTitle title="Which of your skills will last?">Answer a few questions first, and Runway gives each of your skills a shelf life.</PageTitle>
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
        A skill&apos;s date is when AI is expected to do most of that work and be in common use for it. {lasting.length ? `Your longest-lasting: ${lasting.slice(0, 2).map((s) => s.name.toLowerCase()).join(" and ")}.` : ""} That is a reason to plan, not to worry.
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
                <div className="mt-2"><ExpiryTrack byFuture={s.expiry.byFuture} expected={s.expiry.expected} durable={s.expiry.durable} /></div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {src.slice(0, 2).map((x) => <SourceChip key={x.name} name={x.name} date={x.date} url={x.url} />)}
        </div>
        <div className="mt-2"><Estimate /></div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Why do the dates spread out?</h2>
          <p className="mt-1 text-sm">Each dot is one possible future: slow, medium or fast AI progress. The bar ends at the date weighted by how likely each future is. Those weights come from a prediction market tested on real data releases.</p>
          <Link href="/forecast" className="mt-3 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">See the forecast</Link>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">What is changing in the job market?</h2>
          <p className="mt-1 text-sm">Which jobs are growing in Malaysian online job ads, and which back-office jobs are most exposed to AI.</p>
          <Link href="/trends" className="mt-3 inline-block text-sm underline decoration-control underline-offset-2 hover:text-ink">See job market trends</Link>
        </Card>
      </div>
      <NextRow back="/start" next="/forecast" nextLabel="Next: how sure are we?" />
    </div>
  );
}
