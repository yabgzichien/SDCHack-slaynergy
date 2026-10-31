"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Binoculars, BookOpen, Briefcase, Compass, Gauge, ListChecks, MapPin, RotateCcw, UserRound } from "lucide-react";
import { useApp } from "./AppProvider";
import { useT } from "./I18nProvider";
import { LandingSdgAnimation } from "./LandingSdgAnimation";
import { LandingForecast } from "./LandingForecast";
import { LandingMap } from "./LandingMap";
import { AiCapabilityChart, aiCapability } from "./AiTrendCharts";
import { sourceById } from "@/lib/engine/data";

// The guide follows the step bar inside the app, so a first-time visitor recognises each step later.
const GUIDE = [
  { icon: UserRound, color: "#4f86c6", title: "Tell us about you", does: "Scan your resume or answer a few short questions.", gets: "Your skills, ready to check" },
  { icon: Gauge, color: "#6a5fc1", title: "See your skills", does: "Each skill gets a date when AI may do most of it.", gets: "Which skills last" },
  { icon: Briefcase, color: "#d08a1e", title: "Pick a job", does: "Jobs you can reach in time, and why each one fits.", gets: "Your best job" },
  { icon: MapPin, color: "#c4614a", title: "See where the jobs are", does: "A map of jobs, pay and unemployment, organised by state.", gets: "Where to look" },
  { icon: ListChecks, color: "#3f8a52", title: "Follow your plan", does: "Free courses, AI quizzes and advice, week after week.", gets: "A badge for LinkedIn" },
];

export function LandingIntro() {
  const { view } = useApp();
  const { t } = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setSceneActive] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const sceneActive = playing;
  const birdRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const ai = view ? aiCapability(view.world.asOfQuarter) : null;
  // Data-driven cards mount after the first render; re-observe them once the view arrives.
  const ready = !!view;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!sceneActive) return;
    const timer = window.setTimeout(() => setSceneActive(false), reduced ? 0 : 3000);
    return () => window.clearTimeout(timer);
  }, [replayKey, sceneActive]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>(".landing-reveal, .landing-section-reveal");
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
      {sceneActive && <div key={replayKey} className="intro-overlay"><div className="intro-overlay-inner" aria-hidden="true"><span className="intro-word">Jobbery</span><Image src="/cockatiel-running.png" alt="" width={1254} height={1254} className="intro-mascot" priority /><span className="intro-speed intro-speed-one" /><span className="intro-speed intro-speed-two" /></div><button className="intro-skip" onClick={() => setSceneActive(false)}>{t("Skip intro")} <ArrowRight size={16} /></button></div>}
      <div ref={birdRef} className="landing-travel-bird" aria-hidden="true"><Image key={replayKey} src="/landing-cockatiel-flight.png" alt="" width={1353} height={1163} priority /></div>
      <div>
        <section className="landing-intro landing-section-reveal" aria-labelledby="landing-title">
          <div className="landing-hero-landscape" aria-hidden="true" />
          <div ref={sceneRef} className="landing-bird-flight"><LandingSdgAnimation replayKey={replayKey} /></div>
          <div className="landing-intro-heading">
            <h1 id="landing-title" className="landing-reveal">{t("Find a job that AI won't replace.")}</h1>
            <p className="landing-intro-subtitle landing-reveal">{t("See which of your skills AI may take over, which jobs are projected to remain safe in the near future, and learn how to future-proof yourself, completely for free.")}</p>
            <div className="landing-hero-actions landing-reveal"><a href="#journey" className="landing-secondary">{t("See how it works")} <ArrowDown size={18} aria-hidden /></a></div>
          </div>
          <div className="landing-wave" aria-hidden="true" />
        </section>

        <section id="about" className="landing-about" aria-labelledby="about-title">
          <div className="landing-about-heading landing-reveal"><h2 id="about-title">{t("What is Jobbery?")}</h2><p>{t("A free tool for people who have lost their job, or worry that AI will change it. Jobbery uses Malaysian public data and AI research, while showing where every number comes from.")}</p></div>
          <div className="landing-about-cards">
            <Link href="/start" className="landing-about-card landing-reveal"><span className="landing-about-icon"><Compass size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>{t("Find jobs that fit you")}</strong><span>{t("Jobs that match your skills and interests, which you can learn to keep ahead of AI restructuring.")}</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
            <Link href="/forecast" className="landing-about-card landing-reveal"><span className="landing-about-icon"><Binoculars size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>{t("See how AI is changing jobs")}</strong><span>{t("Which skills AI may take over, and when, based on publicly available data.")}</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
            <Link href="/courses" className="landing-about-card landing-reveal"><span className="landing-about-icon"><BookOpen size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>{t("Learn with free courses")}</strong><span>{t("Hand-checked courses for the skills you are missing, laid out week by week.")}</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
          </div>
        </section>

        <div className="landing-section-reveal">
          <section id="journey" className="landing-journey scroll-mt-24" aria-labelledby="journey-title">
            <div className="landing-section-heading landing-reveal"><span className="landing-section-label">{t("Just 5 steps")}</span><h2 id="journey-title">{t("How it works")}<span className="landing-period">.</span></h2><p>{t("Learn how to outlast AI, in just 5 simple steps.")}</p></div>
            <ol className="relative mt-8 grid gap-3 md:grid-cols-5">
              <span aria-hidden className="absolute left-[10%] right-[10%] top-7 hidden h-1 rounded-full bg-gradient-to-r from-[#4f86c6] via-[#d08a1e] to-[#3f8a52] md:block" />
              {GUIDE.map((g, i) => (
                <li key={g.title} className="landing-reveal relative flex flex-col rounded-[20px] border bg-white p-5" style={{ borderColor: `${g.color}55` }}>
                  <span className="relative z-10 grid size-14 place-items-center rounded-2xl text-white shadow-[0_4px_12px_rgb(0_0_0/0.15)]" style={{ background: g.color }}><g.icon size={26} aria-hidden /></span>
                  <span className="mt-4 text-xs font-bold uppercase tracking-wide" style={{ color: g.color }}>{t("Step {n}", { n: String(i + 1) })}</span>
                  <h3 className="mt-1 text-lg leading-snug">{t(g.title)}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{t(g.does)}</p>
                  <p className="mt-auto pt-3 text-sm font-semibold" style={{ color: g.color }}>→ {t(g.gets)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="landing-start-cta landing-reveal text-center text-white" aria-labelledby="cta-title">
            <h2 id="cta-title" className="text-[clamp(26px,3vw,36px)] leading-tight">{t("Ready to find your next job?")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-white/90">{t("Start with your resume or a few questions. You can check and change anything.")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/start" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f8c982] px-6 text-base font-semibold text-[#203b2b] transition-transform hover:-translate-y-0.5">{t("Start now")} <ArrowRight size={18} aria-hidden /></Link>
            </div>
          </section>
        </div>

        <section id="statistics" className="landing-statistics landing-section-reveal" aria-labelledby="statistics-title">
          <div className="landing-stats-top landing-reveal"><div><span className="landing-section-label">{t("THE DATA")}</span><h2 id="statistics-title">{t("How AI is changing your work")}<span className="landing-period">.</span></h2><p>{t("Supported by real numbers from public government and research data, with sources attached accordingly.")}</p></div><Link href="/trends" className="landing-text-link landing-stats-all">{t("See all statistics")} <ArrowRight size={16} aria-hidden /></Link></div>
          {view && ai && (
            <div className="landing-data-grid">
              <article className="landing-chart-card landing-reveal">
                <div className="landing-data-heading"><div><span className="landing-card-index">{t("AI TEST SCORES")}</span><h3>{t("How fast is AI improving?")}</h3></div><span className="landing-sample-badge landing-real-badge">{t("Real data")}</span></div>
                {ai.headline && <div className="landing-stat-hero"><strong className="num">{ai.headline.hoursNow}<span>{t("hours")}</span></strong><p>{t("AI can now finish on its own a task that takes a person about {hours} hours. In 2024 it was about {minutes} minutes.", { hours: String(ai.headline.hoursNow), minutes: String(ai.headline.minutesThen) })}</p></div>}
                <AiCapabilityChart data={ai.data} className="landing-ai-chart" />
                <p className="landing-data-note">{t("Best score any AI got on each test, out of 100.")} <a href={sourceById.epoch.url} target="_blank" rel="noreferrer">{t("Source: Epoch AI, to {quarter}", { quarter: view.world.asOfQuarter.replace("Q", " Q") })}</a></p>
              </article>
              <article className="landing-insight-card landing-reveal">
                <span className="landing-card-index">{t("JOBS AT A GLANCE")}</span>
                <h3>{t("Which jobs are growing")}</h3>
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
        <LandingMap />
      </div>
      <footer className="landing-footer landing-reveal"><span>{t("Jobbery © 2026")}</span><span>{t("Find a next step that fits.")}</span><div className="landing-footer-actions"><Link href="/trust">{t("Our approach")} <ArrowRight size={14} aria-hidden /></Link><button onClick={() => { window.scrollTo({ top: 0, behavior: "auto" }); setSceneActive(true); setReplayKey((key) => key + 1); }}><RotateCcw size={14} aria-hidden /> {t("Replay intro")}</button></div></footer>
    </div>
  );
}
