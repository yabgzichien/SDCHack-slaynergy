"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardPenLine, Coins, Sparkles, Trophy } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Skeleton } from "@/components/ui";
import { AnsweredBadge, MarketCard } from "@/components/MarketCards";
import { ForecastDetails } from "@/components/ForecastDetails";
import { MarketTabs } from "@/components/MarketTabs";
import { ForecastNav } from "@/components/ForecastNav";
import { ReleaseInfo } from "@/components/ReleaseInfo";
import { YourPredictions } from "@/components/YourPredictions";
import "./market.css";
import { nextAnswersLine } from "@/components/ui";
import { PastQuestionCard, ReleasePicker, dayLabel } from "@/components/History";

const HOW = [
  { icon: ClipboardPenLine, title: "Choose a question", text: "Explore the questions below and pick one that interests you." },
  { icon: Coins, title: "Back your prediction", text: "Put free points on your answer." },
  { icon: Trophy, title: "See the result", text: "When official figures arrive, earn points and a bigger vote." },
];

// One question: what can I forecast right now? Layout from the home-page branch; the cards keep the Open / Answered styling.
export default function MarketPage() {
  const { view, refresh, history } = useApp();
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000); return () => window.clearInterval(id); }, [refresh]);
  if (!view) return <Skeleton lines={5} />;
  const w = view.world;
  const released = w.release === 1;
  const past = history.past;
  const showResults = released && w.settledEvents.length > 0 && !past;
  return (
    <div className="forecast-page">
      <div className="forecast-hero">
        <div className="forecast-hero-inner">
          <div className="forecast-tabs-row">
            <MarketTabs />
            <ReleaseInfo label="How the forecast is updated">We automatically check for new releases and update these figures when new data is available. Open questions move the forecast slightly, based on current predictions.</ReleaseInfo>
          </div>
          <header className="forecast-hero-title">
            <h1>The Forecast</h1>
            <p>Free points, never money. The better your predictions, the more your vote counts in Jobbery&apos;s forecast of how fast AI changes jobs.</p>
          </header>
          <section id="forecast-guide" className="forecast-guide" aria-labelledby="forecast-guide-title">
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
                  <h.icon className="forecast-step-icon" size={40} aria-hidden />
                  <div className="forecast-step-body">
                    <h3>{h.title}</h3>
                    <p className="forecast-step-copy">{h.text}</p>
                  </div>
                  {i < HOW.length - 1 && <span className="forecast-step-arrow" aria-hidden><ArrowRight size={16} /></span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <div className="forecast-layout">
        <ForecastNav showResults={showResults} showYours={!past} />
        <div className="forecast-content">

          {!past && <YourPredictions events={w.events} settled={w.settledEvents} />}

          <section id="open-questions" className="forecast-section" aria-labelledby="open-questions-title">
            <div className="forecast-section-heading">
              <h2 id="open-questions-title" className="flex items-center gap-3">{past ? `Questions open on ${dayLabel(past.stop.day)}` : "Open questions"}</h2>
              <span className="forecast-demo-badge">{past ? "Past release" : "Demo mode"}</span>
            </div>
            <ReleasePicker label="Questions as of" />
            {past ? (
              <>
                <p className="forecast-section-description">These were open on the day DOSM published its {past.stop.label.replace(/^DOSM /, "")} figures. The data has changed since, and every one of them is now settled with the real figures. Predicting is turned off for past releases.</p>
                <ul className="grid gap-4 md:grid-cols-2">{past.open.map((q) => <li key={q.id}><PastQuestionCard q={q} /></li>)}</ul>
              </>
            ) : (
              <>
                <p className="forecast-section-description">{released ? `Make your prediction before the next release. ${nextAnswersLine(w.nextAnswers)}` : "Choose a question about Malaysian jobs or AI progress and make your prediction."} The ones outlined in amber are waiting for your prediction.</p>
                <ul className="grid gap-4 md:grid-cols-2">{w.events.map((e) => <li key={e.id}><MarketCard e={e} /></li>)}</ul>
                <p className="mt-3 text-sm text-muted">The % updates as predictions are made. <Link href="/leaderboard" className="underline decoration-control underline-offset-2 hover:text-ink">See who predicts best</Link>.</p>
              </>
            )}
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
