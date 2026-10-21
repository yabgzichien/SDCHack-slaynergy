"use client";
import { useState } from "react";
import Link from "next/link";
import { Gauge, Rabbit, Snail } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ExpiryAxis, ExpiryTrack } from "@/components/ExpiryTrack";
import { Btn, Card, Chip, Estimate, FUTURE_COLOR, More, NextRow, PageTitle, Skeleton, SourceChip, pct } from "@/components/ui";

const SPEED: Record<string, { name: string; icon: typeof Gauge }> = {
  slow: { name: "Slow", icon: Snail },
  medium: { name: "Medium", icon: Gauge },
  fast: { name: "Fast", icon: Rabbit },
};
const months = (m: number) => (m >= 10 ? Math.round(m) : Math.round(m * 2) / 2).toString();

// One question: which of my skills will last, and how does that change with the speed of AI?
export default function SkillsPage() {
  const { view, state } = useApp();
  const [chosen, setChosen] = useState<string | null>(null);
  if (!view || !state) return <Skeleton lines={6} />;
  if (!state.profile) {
    return (
      <div>
        <PageTitle title="Which of your skills will last?">Answer a few questions first, and Runway gives each of your skills a date.</PageTitle>
        <Btn href="/start">Get started</Btn>
      </div>
    );
  }
  const pace = view.pace;
  const likely = [...pace.futures].sort((a, b) => b.weight - a.weight)[0].id;
  const speed = chosen ?? likely;
  const sp = pace.futures.find((f) => f.id === speed)!;

  // dates under the chosen speed; a skill with no date before 2040 lasts
  const yearOf = (s: (typeof view.profileSkills)[number]) => s.expiry.byFutureYear[speed] ?? Infinity;
  const mine = [...view.profileSkills].sort((a, b) => yearOf(a) - yearOf(b));
  const fading = mine.filter((s) => yearOf(s) < 2031);
  const lasting = mine.filter((s) => yearOf(s) >= 2034);
  const shelf = (y: number) => (y >= 2034 ? { t: "Lasting", tone: "rise" as const } : y < 2031 ? { t: "Fading soon", tone: "fall" as const } : { t: "Holding up", tone: "neutral" as const });

  return (
    <div>
      <PageTitle title={fading.length ? `${fading.length} of your ${mine.length} skills fade before 2031.` : `None of your ${mine.length} skills fades before 2031.`}>
        Each date is when AI is likely to do most of that skill&apos;s work{speed === likely ? ", at the most likely speed of AI progress" : `, if AI progress is ${SPEED[speed].name.toLowerCase()}`}. {lasting.length ? `Your longest-lasting: ${lasting.slice(0, 2).map((s) => s.name.toLowerCase()).join(" and ")}.` : ""}
      </PageTitle>

      <Card tone="raised">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">How fast is AI getting better?</h2>
          <SourceChip name={pace.source.name} date={`to ${pace.asOf.replace("Q", " Q")}`} url={pace.source.url} />
        </div>
        <p className="mt-1 text-sm text-muted">Measured by how long a task AI can finish on its own. Pick a speed to see your dates change.</p>
        <div role="radiogroup" aria-label="Speed of AI progress" className="mt-4 grid gap-2 sm:grid-cols-3">
          {pace.futures.map((f) => {
            const on = f.id === speed;
            const Icon = SPEED[f.id].icon;
            return (
              <button key={f.id} role="radio" aria-checked={on} onClick={() => setChosen(f.id)}
                className={`press flex items-center gap-3 rounded-2xl p-4 text-left sm:flex-col sm:items-start sm:gap-2 ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: on ? "rgb(255 255 255 / 0.15)" : FUTURE_COLOR[f.id], color: on ? undefined : "#fff" }}>
                  <Icon size={20} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{SPEED[f.id].name}</span>
                    <span className={`num text-sm ${on ? "opacity-80" : "text-muted"}`}>{pct(f.weight)} chance</span>
                  </span>
                  <span className="mt-0.5 block text-sm"><span className="num text-lg font-medium">Doubles every {months(f.doublingMonths)} months</span></span>
                </span>
              </button>
            );
          })}
        </div>
        <More summary="Where do these speeds and chances come from?">
          <p>The speeds come from the recent pace of the METR time-horizon test (Epoch AI): over the last four quarters, the task length AI can finish doubled about every {months(pace.futures.find((f) => f.id === "medium")!.doublingMonths)} months. &quot;Slow&quot; assumes 60% of that pace, &quot;Fast&quot; 160%. Faster AI also means companies adopt it sooner and clerical job ads shrink faster ({pace.futures.map((f) => `${SPEED[f.id].name.toLowerCase()}: ${Math.abs(f.clericalPerYear).toFixed(1)} points a year`).join(", ")}).</p>
          <p>The chances come from real data releases and from a crowd of forecasters who bet points on the next figures; the most accurate get the most say. <Link href="/market" className="underline decoration-control underline-offset-2 hover:text-ink">See the market and how it is scored</Link>.</p>
        </More>
      </Card>

      <Card className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Your skills, soonest to fade first</h2>
          <p className="text-xs text-muted">At {SPEED[speed].name.toLowerCase()} speed: what AI can do doubles every {months(sp.doublingMonths)} months</p>
        </div>
        <ul className="space-y-2">
          {mine.map((s) => {
            const y = yearOf(s);
            const sh = shelf(y);
            return (
              <li key={s.skillId} className="rounded-2xl bg-raised px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{s.name}</p>
                  <div className="flex items-center gap-3">
                    <Chip tone={sh.tone}>{sh.t}</Chip>
                    <span className="num w-24 text-right">{s.expiry.byFuture[speed]}</span>
                  </div>
                </div>
                <div className="mt-2"><ExpiryTrack byFuture={s.expiry.byFuture} expected={s.expiry.expected} durable={s.expiry.durable} pick={speed} axis={false} /></div>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 px-4"><ExpiryAxis /></div>
        <p className="mt-3 text-xs text-muted">Big dot: the speed you picked. Small dots: the other two speeds.</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {view.radar.sources.slice(0, 2).map((x) => <SourceChip key={x.name} name={x.name} date={x.date} url={x.url} />)}
        </div>
        <div className="mt-2"><Estimate /></div>
      </Card>

      <NextRow back="/start" next="/jobs" nextLabel="Next: jobs for you" />
    </div>
  );
}
