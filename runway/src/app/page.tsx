"use client";
import { StartOptions } from "@/components/StartOptions";
import { Card, Chip } from "@/components/ui";

const HOW = [
  { n: 1, t: "Tell us about you", d: "Scan your resume or answer a few questions." },
  { n: 2, t: "See which skills last", d: "A shelf life for each of your skills, from public data." },
  { n: 3, t: "Get matched", d: "Jobs you can reach in time, with a clear reason for each." },
  { n: 4, t: "Follow a plan", d: "Week by week, with free courses. A counsellor approves it." },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="pt-4 text-center sm:pt-10">
        <Chip tone="accent">For young office workers in their first week after a layoff</Chip>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold sm:text-6xl">Find a job that lasts, before your time runs out.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Runway shows which of your skills will last, matches you to jobs you can reach in time, and builds a week-by-week plan your counsellor can approve.
        </p>
      </section>

      <section aria-label="Get started"><StartOptions /></section>

      <section aria-labelledby="how">
        <h2 id="how" className="mb-4 text-center text-2xl font-bold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((s) => (
            <li key={s.n} className="rounded-3xl bg-surface2 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-bg">{s.n}</span>
              <p className="mt-3 font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card tone="demo">
          <p className="font-bold text-demo">Why the forecasts are different</p>
          <p className="mt-2 text-sm">Most &quot;AI job risk&quot; tools give one fixed score. Runway keeps <b>three possible futures</b> and lets a prediction market decide how likely each is. Forecasters bet <b>points, never money</b> on what the next real data release will show.</p>
          <p className="mt-2 text-sm">Press <b>New data released</b> at the top at any time to watch real figures change your results.</p>
        </Card>
        <Card>
          <p className="font-bold">You stay in charge</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Your resume is read in memory and never saved.</li>
            <li>Age, gender and background are never used. We test this.</li>
            <li>Every number shows its source and date. Nothing is invented.</li>
            <li>You choose. A counsellor reviews and approves.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
