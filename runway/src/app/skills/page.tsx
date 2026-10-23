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
        <PageTitle title="Which of your skills will last?">Answer a few questions first, and Jobbery gives each of your skills a shelf life.</PageTitle>
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
  const shelf = (y: number) => (y >= 2034 ? { t: "Safe for years", tone: "rise" as const } : y < 2031 ? { t: "AI may take over soon", tone: "fall" as const } : { t: "Safe for now", tone: "neutral" as const });

  return (
    <div>
      <PageTitle wide title={fading.length ? <>AI could do most of <span className="skills-count-highlight">{fading.length} of your {mine.length} skills</span> before 2031.</> : `AI is unlikely to take over any of your ${mine.length} skills before 2031.`}>
        <p>Each date below is roughly when AI could do most of the work for that skill{speed === likely ? "" : `, if AI improves ${SPEED[speed].name.toLowerCase()}`}. After that date, the skill alone is less likely to get you hired. {lasting.length ? `Your safest skills: ${lasting.slice(0, 2).map((s) => s.name.toLowerCase()).join(" and ")}.` : ""}</p>
      </PageTitle>

      <Card tone="raised">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">How fast is AI getting better?</h2>
          <SourceChip name={pace.source.name} date={`to ${pace.asOf.replace("Q", " Q")}`} url={pace.source.url} />
        </div>
        <p className="mt-1 text-sm text-muted">We measure this by how long a task AI can finish without help. Nobody knows the future speed, so pick one to see how your dates change.</p>
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
                    <span className={`num text-sm ${on ? "opacity-80" : "text-muted"}`}>{pct(f.weight)} likely</span>
                  </span>
                  <span className="mt-0.5 block text-sm"><span className="num text-lg font-medium">AI gets twice as capable every {months(f.doublingMonths)} months</span></span>
                </span>
              </button>
            );
          })}
        </div>
        <More summary="Where do these numbers come from?">
          <p>The speeds come from a test by the research group METR (data from Epoch AI). Over the last year, the length of task AI can finish on its own doubled about every {months(pace.futures.find((f) => f.id === "medium")!.doublingMonths)} months. &quot;Slow&quot; assumes 60% of that pace, &quot;Fast&quot; 160%. Faster AI also means companies start using it sooner and office admin job ads shrink faster ({pace.futures.map((f) => `${SPEED[f.id].name.toLowerCase()}: ${Math.abs(f.clericalPerYear).toFixed(1)} fewer in every 100 ads each year`).join(", ")}).</p>
          <p>How likely each speed is comes from real published numbers and from a guessing game where players predict the next numbers; players who guess well count more. <Link href="/market" className="underline decoration-control underline-offset-2 hover:text-ink">Try the guessing game</Link>.</p>
        </More>
      </Card>

      <Card className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Your skills: the ones AI could take over soonest are at the top</h2>
          <p className="text-xs text-muted">Speed picked: {SPEED[speed].name.toLowerCase()} (AI twice as capable every {months(sp.doublingMonths)} months)</p>
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
        <p className="mt-3 text-xs text-muted">The date on the right: when AI could do most of this skill. Big dot: the speed you picked. Small dots: the other two speeds.</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {view.radar.sources.slice(0, 2).map((x) => <SourceChip key={x.name} name={x.name} date={x.date} url={x.url} />)}
        </div>
        <div className="mt-2"><Estimate /></div>
      </Card>

      <NextRow back="/start" next="/forecast" nextLabel="Next: the forecast" />
    </div>
  );
}
