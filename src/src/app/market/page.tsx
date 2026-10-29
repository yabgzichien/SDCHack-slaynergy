"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Coins, Sparkles, Trophy, Vote } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { PageTitle, Skeleton } from "@/components/ui";
import { AnsweredBadge, LiveBadge, MarketCard } from "@/components/MarketCards";
import { ForecastDetails } from "@/components/ForecastDetails";
import { MarketTabs } from "@/components/MarketTabs";
import { ForecastNav } from "@/components/ForecastNav";
import "./market.css";
import { nextAnswersLine } from "@/components/ui";
import { PastForecast } from "@/components/History";

const HOW = [
  { icon: Vote, title: "Choose a question", text: "Explore the questions below. Pick an answer, then forecast Yes or No." },
  { icon: Coins, title: "Back your prediction", text: "Put free points on your answer. A correct prediction on a less likely answer wins more." },
  { icon: Trophy, title: "See the result", text: "When official figures arrive, correct predictions earn points and a bigger vote in the forecast." },
];

// One question: what can I forecast right now? Layout from the home-page branch; the cards keep the LIVE / Answered styling.
export default function MarketPage() {
  const { view, refresh, history } = useApp();
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000); return () => window.clearInterval(id); }, [refresh]);
  if (!view) return <Skeleton lines={5} />;
  if (history.past) return <PastForecast />;
  const w = view.world;
  const released = w.release === 1;
  const showResults = released && w.settledEvents.length > 0;
  return (
    <div className="forecast-page">
      <MarketTabs />
      <PageTitle title={<span className="statistics-headline-highlight">The Forecast</span>}>
        Free points, never money. The better your predictions, the more your vote counts in Jobbery&apos;s forecast of how fast AI changes jobs.
      </PageTitle>
      <p className="mb-6 text-sm text-muted">We automatically check for new releases and update these figures when new data is available.</p>

      <div className="forecast-layout">
        <ForecastNav showResults={showResults} />
        <div className="forecast-content">
          <section id="forecast-guide" className="forecast-guide forecast-section" aria-labelledby="forecast-guide-title">
            <div className="forecast-guide-heading">
              <h2 id="forecast-guide-title"><Sparkles size={17} aria-hidden />How to forecast</h2>
              <div className="forecast-points-box">
                <Coins className="forecast-points-coin" size={23} aria-hidden />
                <div>
                  <p className="forecast-points-balance">You have <span className="num">{w.user.balance.toFixed(0)}</span> points</p>
                  <p className="forecast-points-influence">Your vote counts {w.you.influence.toFixed(1)}×</p>
                </div>
              </div>
            </div>
            <ol className="forecast-steps">
              {HOW.map((h, i) => (
                <li key={h.title} className={`forecast-step forecast-step-${i + 1}`}>
                  <div className="forecast-step-heading">
                    <span className="forecast-step-number" aria-hidden>{i + 1}</span>
                    <h3>{h.title}</h3>
                    <h.icon className="forecast-step-icon" size={21} aria-hidden />
                  </div>
                  <p className="forecast-step-copy">{h.text}</p>
                  {i < HOW.length - 1 && <span className="forecast-step-arrow" aria-hidden><ArrowRight size={16} /></span>}
                </li>
              ))}
            </ol>
          </section>

          <section id="open-questions" className="forecast-section" aria-labelledby="open-questions-title">
            <div className="forecast-section-heading">
              <h2 id="open-questions-title" className="flex items-center gap-3">Open questions <LiveBadge /></h2>
              <span className="forecast-demo-badge">Demo mode</span>
            </div>
            <p className="forecast-section-description">{released ? `Make your prediction before the next release. ${nextAnswersLine(w.nextAnswers)}` : "Choose a question about Malaysian jobs or AI progress and make your prediction."} The ones outlined in amber are waiting for your prediction.</p>
            <ul className="grid gap-4 md:grid-cols-2">{w.events.map((e) => <li key={e.id}><MarketCard e={e} /></li>)}</ul>
            <p className="mt-3 text-sm text-muted">About 200 computer-made players predict alongside you, so the % moves while you watch. <Link href="/leaderboard" className="underline decoration-control underline-offset-2 hover:text-ink">See who predicts best</Link>.</p>
          </section>

          {showResults && (
            <section id="past-results" className="forecast-section forecast-results" aria-labelledby="past-results-title">
              <div className="forecast-section-heading"><h2 id="past-results-title" className="flex items-center gap-3">Past results <AnsweredBadge /></h2></div>
              <p className="forecast-section-description">These questions have closed. See how the predictions compare with the official Apr–Jun 2026 figures.</p>
              <ul className="grid gap-4 md:grid-cols-2">{w.settledEvents.map((e) => <li key={e.id}><MarketCard e={e} /></li>)}</ul>
            </section>
          )}
          <ForecastDetails />
        </div>
      </div>
    </div>
  );
}
