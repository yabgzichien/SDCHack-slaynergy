"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Coins, Trophy, Vote } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { DemoLabel, PageTitle, Skeleton } from "@/components/ui";
import { FeaturedMarkets, MarketCard } from "@/components/MarketCards";
import { ForecastDetails } from "@/components/ForecastDetails";
import { MarketTabs } from "@/components/MarketTabs";

const HOW = [
  { icon: Vote, text: "Pick a question and an answer, then guess Yes or No." },
  { icon: Coins, text: "Put free points on it. The less likely your answer looks, the more you win." },
  { icon: Trophy, text: "When the real numbers come out, right guesses win points and a bigger vote." },
];

// One question: what can I forecast right now?
export default function MarketPage() {
  const { view, refresh } = useApp();
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000); return () => window.clearInterval(id); }, [refresh]);
  if (!view) return <Skeleton lines={5} />;
  const w = view.world;
  const released = w.release === 1;
  return (
    <div>
      <MarketTabs />
      <PageTitle title="Guess what the next official numbers will show"
        aside={<div className="num text-right text-sm"><p>You have {w.user.balance.toFixed(0)} points</p><p className="text-muted">Your vote counts {w.you.influence.toFixed(1)}×</p></div>}>
        Free points, never money. The better your guesses, the more your vote counts in Jobbery&apos;s forecast of how fast AI changes jobs.
      </PageTitle>

      <ol className="mb-5 grid gap-2 sm:grid-cols-3">
        {HOW.map((h, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-sm">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accentsoft text-accent"><h.icon size={16} aria-hidden /></span>
            <span><span className="num text-muted">{i + 1}. </span>{h.text}</span>
          </li>
        ))}
      </ol>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{released ? "Still open: DOSM answers the job question on 17 Nov 2026, Epoch AI the AI questions in Jan 2027" : "Open questions"}</h2>
        <DemoLabel />
      </div>
      <FeaturedMarkets events={w.events} />
      <ul className="mt-4 grid gap-4 md:grid-cols-2">{w.events.map((e) => <li key={e.id}><MarketCard e={e} /></li>)}</ul>
      <p className="mt-3 text-sm text-muted">About 200 computer-made players guess alongside you, so the % moves while you watch. <Link href="/leaderboard" className="underline decoration-control underline-offset-2 hover:text-ink">See who guesses best</Link>.</p>

      {released && w.settledEvents.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-base font-semibold">Already answered by the Apr to Jun 2026 numbers</h2>
          <ul className="grid gap-4 md:grid-cols-2">{w.settledEvents.map((e) => <li key={e.id}><MarketCard e={e} /></li>)}</ul>
        </>
      )}
      <ForecastDetails />
    </div>
  );
}
