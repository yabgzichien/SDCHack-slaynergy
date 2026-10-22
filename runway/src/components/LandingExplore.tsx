"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BriefcaseBusiness, Check, FileText, GraduationCap } from "lucide-react";
import { useApp } from "./AppProvider";

function chartPoints(values: number[]) {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.5);
  return values.map((value, index) => `${18 + index * 484 / (values.length - 1)},${154 - (value - min) * 122 / span}`).join(" ");
}

function chancePoints(values: number[]) {
  if (values.length < 2) return "";
  return values.map((value, index) => `${18 + index * 484 / (values.length - 1)},${154 - value * 122}`).join(" ");
}

type MarketFeed = { event: string; strikes: { series: [number, number, number][] }[] };

export function LandingExplore() {
  const { view, refresh } = useApp();
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [feed, setFeed] = useState<MarketFeed | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "180px" });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const pull = () => { if (document.visibilityState === "visible") void refresh(); };
    pull();
    const interval = window.setInterval(pull, 8000);
    return () => window.clearInterval(interval);
  }, [refresh, visible]);

  const history = view?.world.clericalHistory ?? [];
  const last = history.at(-1);
  const market = view?.world.events.find((event) => !event.settled);
  const chance = market?.strikes[1] ? Math.round(market.strikes[1].price * 100) : null;
  const marketId = market?.id;
  const rising = view?.radar.rising.slice(0, 2) ?? [];
  const changing = view?.radar.declining.slice(0, 2) ?? [];

  useEffect(() => {
    if (!visible || !marketId) return;
    let active = true;
    const pull = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/market?event=${encodeURIComponent(marketId)}`, { cache: "no-store" })
        .then((response) => response.ok ? response.json() as Promise<MarketFeed> : null)
        .then((data) => { if (active && data?.event === marketId) setFeed(data); })
        .catch(() => {});
    };
    pull();
    const interval = window.setInterval(pull, 8000);
    return () => { active = false; window.clearInterval(interval); };
  }, [marketId, visible]);

  const chanceHistory = feed?.event === marketId ? (feed?.strikes[1]?.series ?? []).slice(-55).map((point) => point[1]) : [];

  return (
    <section ref={rootRef} className="landing-explore" aria-labelledby="explore-title">
      <div className="landing-explore-heading">
        <span className="landing-section-label">CHOOSE WHERE TO BEGIN</span>
        <h2 id="explore-title">What would you like to explore?</h2>
        <p>Tell us about yourself to find a path that fits. Or explore how jobs and skills are changing.</p>
      </div>

      <div className="landing-explore-grid">
        <article className="landing-explore-card landing-explore-career">
          <div className="landing-explore-card-heading">
            <span className="landing-explore-icon"><FileText size={25} aria-hidden="true" /></span>
            <div><h3>Find my next path</h3><p>Use your experience to find career options that fit you.</p></div>
          </div>

          <ol className="landing-explore-path" aria-label="Three steps to find your next path">
            <li className="landing-explore-path-card">
              <span className="landing-explore-path-number">01</span>
              <div className="landing-explore-path-copy"><h4>Show us where you are</h4><p>Upload your CV or answer a few questions.</p></div>
              <div className="landing-explore-path-art" aria-hidden="true"><div className="landing-explore-mini-sheet"><strong><FileText size={13} /> My CV</strong><span><BriefcaseBusiness size={11} /> Experience</span><i /><span><GraduationCap size={11} /> Education</span><i /></div><div className="landing-explore-mini-question"><strong>A few questions</strong><span>What interests you?</span><small>Solving problems <Check size={10} /></small></div></div>
              <span className="landing-explore-path-connector" aria-hidden="true"><ArrowDown size={22} strokeWidth={2.8} /></span>
            </li>
            <li className="landing-explore-path-card">
              <span className="landing-explore-path-number">02</span>
              <div className="landing-explore-path-copy"><h4>See what fits</h4><p>Compare roles that match your skills.</p></div>
              <div className="landing-explore-path-art landing-explore-mini-roles" aria-hidden="true"><span><BarChart3 size={15} /><strong>Data Analyst</strong><small>92% fit</small></span><span><BriefcaseBusiness size={15} /><strong>Product Manager</strong><small>78% fit</small></span></div>
              <span className="landing-explore-path-connector" aria-hidden="true"><ArrowDown size={22} strokeWidth={2.8} /></span>
            </li>
            <li className="landing-explore-path-card">
              <span className="landing-explore-path-number">03</span>
              <div className="landing-explore-path-copy"><h4>Make a plan</h4><p>Turn a choice into manageable next steps.</p></div>
              <div className="landing-explore-path-art landing-explore-mini-plan" aria-hidden="true"><strong>Your plan <small>Week 1</small></strong><span><Check size={11} /> Update CV</span><span><Check size={11} /> Explore roles</span><span><i /> Learn key skills</span></div>
            </li>
          </ol>
          <Link href="/start" className="landing-explore-cta">Explore my career <ArrowRight size={19} aria-hidden="true" /></Link>
        </article>

        <article className="landing-explore-card landing-explore-forecast">
          <div className="landing-explore-card-heading">
            <span className="landing-explore-icon"><BarChart3 size={26} aria-hidden="true" /></span>
            <div><h3>Forecast changing skills</h3><p>See published job data and what players think could happen next.</p></div>
          </div>

          <div className="landing-explore-data-row">
            <div className="landing-explore-signal">
              <div className="landing-explore-signal-head"><div><span className="landing-explore-preview-label">OFFICIAL JOB DATA</span><h4>Office admin job ads</h4><p>Share of Malaysian ads</p></div><strong>{last ? `${last.share.toFixed(1)} in 100` : "Loading…"}</strong></div>
              <div className="landing-explore-chart" role="img" aria-label={history.length ? `Office admin share of Malaysian job ads from ${history[0].q} to ${last?.q}: ${history.map((point) => point.share.toFixed(1)).join(", ")} in every 100 ads` : "Loading job ad history"}>
                <svg viewBox="0 0 520 176" preserveAspectRatio="none" aria-hidden="true"><path d="M18 32H502 M18 72H502 M18 113H502 M18 154H502" className="landing-explore-gridlines" />{history.length > 1 && <polyline points={chartPoints(history.map((point) => point.share))} className="landing-explore-line" />}</svg>
              </div>
              <div className="landing-explore-chart-axis"><span>{history[0]?.q.replace("Q", " Q") ?? ""}</span><span>{last?.q.replace("Q", " Q") ?? ""}</span></div>
              <p className="landing-explore-source">DOSM Job Market Insights · latest loaded release {last?.q.replace("Q", " Q") ?? ""} · <Link href="/trends">View source and method</Link></p>
            </div>
            <div className="landing-explore-signals">
              <div><span className="landing-explore-signal-icon up"><ArrowUpRight size={17} aria-hidden="true" /></span><span><strong>Skills worth learning</strong><small>{rising[0]?.name ?? "Loading skill signals…"}</small></span></div>
              <div><span className="landing-explore-signal-icon down"><ArrowDownRight size={17} aria-hidden="true" /></span><span><strong>Skills at risk from AI</strong><small>{changing[0]?.name ?? "Loading skill signals…"}</small></span></div>
            </div>
          </div>

          <div className="landing-explore-market"><span className="landing-explore-preview-label">PLAYER FORECAST</span><div><span><strong>{market?.text ?? "What will the next numbers show?"}</strong><small>Chance players say Yes · updates as they use free points</small></span><strong className="landing-explore-chance">{chance === null ? "…" : `${chance}%`}</strong></div>{chanceHistory.length > 1 && <div className="landing-explore-market-chart" role="img" aria-label="Recent changes in the player forecast"><svg viewBox="0 0 520 176" preserveAspectRatio="none" aria-hidden="true"><polyline points={chancePoints(chanceHistory)} /></svg></div>}<span className="landing-explore-meter"><i style={{ width: `${chance ?? 50}%` }} /></span><p>You have {view ? Math.floor(view.world.user.balance) : "…"} free points to make your own forecast.</p></div>
          <Link href="/market" className="landing-explore-cta">Explore forecasts and take part <ArrowRight size={19} aria-hidden="true" /></Link>
        </article>
      </div>
    </section>
  );
}
