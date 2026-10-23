"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Binoculars, BookOpen, Compass, RotateCcw } from "lucide-react";
import { useApp } from "./AppProvider";
import { useT } from "./I18nProvider";
import { LandingSdgAnimation } from "./LandingSdgAnimation";
import { LandingForecast } from "./LandingForecast";
import { AiCapabilityChart, aiCapability } from "./AiTrendCharts";
import { sourceById } from "@/lib/engine/data";

// The intro plays once per visit: coming back to the home page or reloading it does not replay it ("Replay intro" does).
const INTRO_SEEN = "jobbery-intro-seen";
const noSubscribe = () => () => {};
const readSeen = () => { try { return sessionStorage.getItem(INTRO_SEEN) === "1"; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(INTRO_SEEN, "1"); } catch { /* private mode: it may play again */ } };

export function LandingIntro() {
  const { busy, catalog, view } = useApp();
  const { t } = useT();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setSceneActive] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const seen = useSyncExternalStore(noSubscribe, readSeen, () => false);
  const sceneActive = playing && (!seen || replayKey > 0);
  const birdRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const ai = view ? aiCapability(view.world.asOfQuarter) : null;
  // Data-driven cards mount after the first render; re-observe them once the view arrives.
  const ready = !!view;
  const demo = () => router.push("/start?sample=1");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!sceneActive) return;
    const timer = window.setTimeout(() => { markSeen(); setSceneActive(false); }, reduced ? 0 : 2700);
    return () => window.clearTimeout(timer);
  }, [replayKey, sceneActive]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>(".landing-reveal");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }
    root.classList.add("is-motion-ready");
    if (sceneActive) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [sceneActive, ready]);

  useEffect(() => {
    const root = rootRef.current;
    const scene = sceneRef.current;
    const bird = birdRef.current;
    if (!root || !scene || !bird) return;
    let frame = 0;
    const positionBird = () => {
      frame = 0;
      const rootBox = root.getBoundingClientRect();
      const sceneBox = scene.getBoundingClientRect();
      const birdWidth = bird.offsetWidth;
      const birdHeight = bird.offsetHeight;
      const x = sceneBox.left - rootBox.left + sceneBox.width * 0.5 - birdWidth * 0.5;
      const y = sceneBox.top - rootBox.top + sceneBox.height * 0.39 - birdHeight * 0.91 + 30;
      bird.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      bird.classList.add("is-positioned");
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(positionBird); };
    const observer = new ResizeObserver(schedule);
    observer.observe(scene);
    window.addEventListener("resize", schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", schedule); };
  }, []);

  return (
    <div ref={rootRef} className={`landing-page landing-content${sceneActive ? "" : " is-scene-active"}`}>
      {sceneActive && <div key={replayKey} className="intro-overlay"><div className="intro-overlay-inner" aria-hidden="true"><span className="intro-word">Jobbery<span className="intro-word-dot">.</span></span><Image src="/cockatiel-running.png" alt="" width={1254} height={1254} className="intro-mascot" priority /><span className="intro-speed intro-speed-one" /><span className="intro-speed intro-speed-two" /></div><button className="intro-skip" onClick={() => { markSeen(); setSceneActive(false); }}>{t("Skip intro")} <ArrowRight size={16} /></button></div>}
      <div ref={birdRef} className="landing-travel-bird" aria-hidden="true"><Image key={replayKey} src="/landing-cockatiel-flight.png" alt="" width={1353} height={1163} priority /></div>
      <div>
        <section className="landing-intro" aria-labelledby="landing-title">
          <div className="landing-hero-landscape" aria-hidden="true" />
          <div ref={sceneRef} className="landing-bird-flight"><LandingSdgAnimation replayKey={replayKey} /></div>
          <div className="landing-intro-heading">
            <h1 id="landing-title" className="landing-reveal">{t("Work is changing.")}<br />{t("Keep growing with it.")}</h1>
            <p className="landing-intro-subtitle landing-reveal">{t("See which jobs AI is changing, find one that fits you, and get a week-by-week plan to get there.")}</p>
            <div className="landing-hero-actions landing-reveal"><Link href="/start" className="landing-primary">{t("Get started")} <ArrowRight size={18} aria-hidden /></Link><button onClick={demo} disabled={busy || !catalog} className="landing-secondary">{t("Try a sample")}</button></div>
          </div>
          <div className="landing-wave" aria-hidden="true" />
        </section>

        <section id="about" className="landing-about" aria-labelledby="about-title">
          <div className="landing-about-heading landing-reveal"><h2 id="about-title">{t("What is Jobbery?")}</h2><p>{t("Jobbery helps you explore career paths, understand how work is changing, and find learning opportunities to build a brighter, more inclusive future.")}</p></div>
          <div className="landing-about-cards">
            <Link href="/start" className="landing-about-card landing-reveal"><span className="landing-about-icon"><Compass size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>{t("Career help")}</strong><span>{t("Discover careers that match your interests, strengths and values, with guidance for different education pathways.")}</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
            <Link href="/forecast" className="landing-about-card landing-reveal"><span className="landing-about-icon"><Binoculars size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>{t("Future forecasts")}</strong><span>{t("See how AI and other trends may shape jobs and skills, so you can make informed decisions about your next step.")}</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
            <Link href="/courses" className="landing-about-card landing-reveal"><span className="landing-about-icon"><BookOpen size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>{t("Courses to grow")}</strong><span>{t("Find curated courses and learning resources to build skills in demand and open new opportunities.")}</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
          </div>
        </section>

        <section id="journey" className="landing-journey" aria-labelledby="journey-title">
          <div className="landing-section-heading landing-reveal"><span className="landing-section-label">{t("YOUR PATH FORWARD")}</span><h2 id="journey-title">{t("Three steps")}<span className="landing-period">.</span></h2><p>{t("Start where you are. Move at your own pace.")}</p></div>
          <div className="landing-steps">
            <article className="landing-step landing-reveal"><span className="landing-step-number">01</span><h3>{t("Show us where you are")}</h3><p>{t("Use your CV to save time or answer a few short questions. You can check everything before continuing.")}</p></article>
            <span className="landing-step-arrow landing-reveal" aria-hidden="true">→</span>
            <article className="landing-step landing-reveal"><span className="landing-step-number">02</span><h3>{t("See what fits")}</h3><p>{t("Explore roles your skills could lead to, with job data and different AI forecasts in view.")}</p></article>
            <span className="landing-step-arrow landing-reveal" aria-hidden="true">→</span>
            <article className="landing-step landing-reveal"><span className="landing-step-number">03</span><h3>{t("Make a plan")}</h3><p>{t("Turn a role you choose into a week by week path you can review with a counsellor.")}</p></article>
          </div>
        </section>

        <section id="statistics" className="landing-statistics" aria-labelledby="statistics-title">
          <div className="landing-stats-top landing-reveal"><div><span className="landing-section-label">{t("INFORMATION & INSIGHT")}</span><h2 id="statistics-title">{t("A changing world of work")}<span className="landing-period">.</span></h2><p>{t("A few real numbers from public government and research data. Each one says where it came from.")}</p></div><Link href="/trends" className="landing-text-link landing-stats-all">{t("See all statistics")} <ArrowRight size={16} aria-hidden /></Link></div>
          {view && ai && (
            <div className="landing-data-grid">
              <article className="landing-chart-card landing-reveal">
                <div className="landing-data-heading"><div><span className="landing-card-index">{t("AI TEST SCORES")}</span><h3>{t("How quickly is AI getting better?")}</h3></div><span className="landing-sample-badge landing-real-badge">{t("Real data")}</span></div>
                {ai.headline && <div className="landing-stat-hero"><strong className="num">{ai.headline.hoursNow}<span>{t("hours")}</span></strong><p>{t("AI can now finish on its own a task that takes a person about {hours} hours. In 2024 it was about {minutes} minutes.", { hours: String(ai.headline.hoursNow), minutes: String(ai.headline.minutesThen) })}</p></div>}
                <AiCapabilityChart data={ai.data} className="landing-ai-chart" />
                <p className="landing-data-note">{t("Best score any AI got on each test, out of 100.")} <a href={sourceById.epoch.url} target="_blank" rel="noreferrer">{t("Source: Epoch AI, to {quarter}", { quarter: view.world.asOfQuarter.replace("Q", " Q") })}</a></p>
              </article>
              <article className="landing-insight-card landing-reveal">
                <span className="landing-card-index">{t("JOBS AT A GLANCE")}</span>
                <h3>{t("Where hiring is heading")}</h3>
                <p className="landing-insight-sub">{t("Growing, and hard for AI to replace")}</p>
                {view.radar.risingJobs.slice(0, 3).map((j) => <div key={j.roleId} className="landing-insight-row"><span>{j.title}</span><strong className="landing-tag-rise">{t("Growing")}</strong></div>)}
                <p className="landing-insight-sub">{t("AI can already do a lot of this work")}</p>
                {view.radar.decliningJobs.slice(0, 3).map((j) => <div key={j.occupationId} className="landing-insight-row"><span>{j.title}</span><strong className="landing-tag-fall">{t("AI-exposed by {year}", { year: j.earliest.slice(-4) })}</strong></div>)}
                <Link href="/trends" className="landing-text-link">{t("See all statistics")} <ArrowRight size={16} aria-hidden /></Link>
              </article>
            </div>
          )}
        </section>
        <LandingForecast />
      </div>
      <footer className="landing-footer landing-reveal"><span>{t("Jobbery © 2026")}</span><span>{t("Find a next step that fits.")}</span><div className="landing-footer-actions"><Link href="/trust">{t("Our approach")} <ArrowRight size={14} aria-hidden /></Link><button onClick={() => { window.scrollTo({ top: 0, behavior: "auto" }); setSceneActive(true); setReplayKey((key) => key + 1); }}><RotateCcw size={14} aria-hidden /> {t("Replay intro")}</button></div></footer>
    </div>
  );
}
