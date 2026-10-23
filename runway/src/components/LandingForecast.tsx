"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useApp } from "./AppProvider";
import { FUTURE_COLOR, FUTURE_PLAIN, FutureBar, pct } from "./ui";

// "Humanity's Last Exam: AI on very hard expert exam questions, Oct to Dec 2026" -> "AI on very hard expert exam questions"
const plainName = (title: string) => {
  const head = title.split(/, [A-Z][a-z]{2} to /)[0];
  return (head.includes(": ") ? head.split(": ")[1] : head).replace(/\s*\(METR\)/, "");
};
const period = (title: string) => title.match(/[A-Z][a-z]{2} to [A-Z][a-z]{2} \d{4}$/)?.[0] ?? "";

// Landing preview of the prediction market: the crowd's split across the three AI speeds leads,
// and the open AI-ability questions that feed it sit beside it. Refreshes like /market so the % moves.
export function LandingForecast() {
  const { view, refresh } = useApp();
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000);
    return () => window.clearInterval(id);
  }, [refresh]);
  if (!view) return null;
  const w = view.world;
  const aiQuestions = w.events.filter((e) => !e.id.startsWith("dosm")).slice(0, 3);
  const lead = [...w.futures].sort((a, b) => b.weight - a.weight)[0];

  return (
    <section id="forecast" className="landing-statistics landing-forecast" aria-labelledby="forecast-title">
      <div className="landing-stats-top landing-reveal">
        <div>
          <span className="landing-section-label">CROWD FORECAST</span>
          <h2 id="forecast-title">Where is AI heading next<span className="landing-period">?</span></h2>
          <p>People guess what the next official AI test results will show. Their guesses add up to one forecast of how fast AI will change jobs.</p>
        </div>
        <Link href="/market#how" className="landing-text-link landing-stats-all">How this forecast works <ArrowRight size={16} aria-hidden /></Link>
      </div>

      <div className="landing-data-grid landing-forecast-grid">
        <article className="landing-chart-card landing-reveal">
          <div className="landing-data-heading"><div><span className="landing-card-index">BEST GUESS</span><h3>How fast will AI change jobs?</h3></div><span className="landing-sample-badge">Demo crowd</span></div>
          <p className="landing-forecast-lead"><span>Most likely:</span> <b>{lead.name}</b></p>
          <div className="landing-forecast-bar"><FutureBar futures={w.futures} height={16} /></div>
          <div className="landing-speeds">
            {w.futures.map((f) => (
              <div key={f.id} className="landing-speed">
                <strong>{pct(f.weight)}</strong>
                <span className="landing-speed-name"><i style={{ background: FUTURE_COLOR[f.id] }} aria-hidden />{f.name}</span>
                <small>{FUTURE_PLAIN[f.id]}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="landing-insight-card landing-reveal">
          <div className="landing-data-heading"><div><span className="landing-card-index">OPEN QUESTIONS</span><h3>What the crowd expects AI to do next</h3></div><span className="landing-live-badge"><i aria-hidden />Live</span></div>
          <ul className="landing-question-list">
            {aiQuestions.map((e) => (
              <li key={e.id}>
                <Link href={`/market/${encodeURIComponent(e.id)}`} className="landing-question">
                  <span className="landing-question-text"><strong>{plainName(e.title)}</strong><span><span>{e.strikes[1].label}</span>{period(e.title) && <span> · {period(e.title)}</span>}</span></span>
                  <span className="landing-question-odds"><b>{Math.round(e.strikes[1].price * 100)}%</b><span>chance</span></span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="landing-data-note">Guesses mostly come from about 200 computer-made players. Free points, never money. Epoch AI&apos;s real results settle each question.</p>
          <Link href="/market" className="landing-primary landing-forecast-cta">Make a guess <ArrowRight size={17} aria-hidden /></Link>
        </article>
      </div>
    </section>
  );
}
