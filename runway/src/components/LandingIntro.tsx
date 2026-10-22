"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Binoculars, BookOpen, Check, Compass, RotateCcw } from "lucide-react";
import { LandingExplore } from "./LandingExplore";
import { LandingSdgAnimation } from "./LandingSdgAnimation";

const samplePeriods = [
  { label: "2024", roles: 18, skills: 42, paths: 9, growing: 36, overlap: 48, trend: [34, 42, 39, 51, 47, 54] },
  { label: "2025", roles: 24, skills: 57, paths: 13, growing: 48, overlap: 59, trend: [42, 45, 54, 51, 62, 67] },
  { label: "2026", roles: 32, skills: 68, paths: 16, growing: 61, overlap: 72, trend: [45, 53, 49, 65, 70, 78] },
];

function AnimatedNumber({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 900, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <strong>{display}{suffix}</strong>;
}

export function LandingIntro() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [sceneActive, setSceneActive] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const birdRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState(2);
  const sample = samplePeriods[period];

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setSceneActive(false), reduced ? 0 : 2700);
    return () => window.clearTimeout(timer);
  }, [replayKey]);

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
  }, [sceneActive]);

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
      {sceneActive && <div key={replayKey} className="intro-overlay"><div className="intro-overlay-inner" aria-hidden="true"><span className="intro-word">Jobbery<span className="intro-word-dot">.</span></span><Image src="/cockatiel-running.png" alt="" width={1254} height={1254} className="intro-mascot" priority /><span className="intro-speed intro-speed-one" /><span className="intro-speed intro-speed-two" /></div><button className="intro-skip" onClick={() => setSceneActive(false)}>Skip intro <ArrowRight size={16} /></button></div>}
      <div ref={birdRef} className="landing-travel-bird" aria-hidden="true"><Image key={replayKey} src="/landing-cockatiel-flight.png" alt="" width={1353} height={1163} priority /></div>
      <div>
        <section className="landing-intro" aria-labelledby="landing-title">
          <div className="landing-hero-landscape" aria-hidden="true" />
          <div ref={sceneRef} className="landing-bird-flight"><LandingSdgAnimation replayKey={replayKey} /></div>
          <div className="landing-intro-heading">
            <h1 id="landing-title" className="landing-reveal">Work is changing.<br />Keep growing with it.</h1>
            <p className="landing-intro-subtitle landing-reveal">AI is changing the way work gets done. Some tasks will be automated, new skills will be in demand, and new opportunities will emerge. With the right guidance and continuous learning, you can find new paths, build skills for the future and create a meaningful career in Malaysia and beyond.</p>
            <div className="landing-hero-benefits landing-reveal" aria-label="What Jobbery offers"><span><Check size={15} aria-hidden="true" />Career guidance</span><span><Check size={15} aria-hidden="true" />Insights for the future</span><span><Check size={15} aria-hidden="true" />Curated learning</span></div>
          </div>
          <div className="landing-wave" aria-hidden="true" />
        </section>

        <section id="about" className="landing-about" aria-labelledby="about-title">
          <div className="landing-about-heading landing-reveal"><h2 id="about-title">What is Jobbery?</h2><p>“Jobbery” plays on the fear that AI is “robbing” people of jobs, then turns that worry into a place to discover what comes next. Jobbery helps you explore career paths, understand how work is changing, and find learning opportunities to build a brighter, more inclusive future.</p></div>
          <div className="landing-about-cards">
            <Link href="/start" className="landing-about-card landing-reveal"><span className="landing-about-icon"><Compass size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>Career help</strong><span>Discover careers that match your interests, strengths and values, with guidance for different education pathways.</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
            <Link href="/forecast" className="landing-about-card landing-reveal"><span className="landing-about-icon"><Binoculars size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>Future forecasts</strong><span>See how AI and other trends may shape jobs and skills, so you can make informed decisions about your next step.</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
            <Link href="/courses" className="landing-about-card landing-reveal"><span className="landing-about-icon"><BookOpen size={66} strokeWidth={1.4} aria-hidden="true" /></span><span className="landing-about-copy"><strong>Courses to grow</strong><span>Find curated courses and learning resources to build skills in demand and open new opportunities.</span></span><span className="landing-about-arrow"><ArrowRight size={20} aria-hidden="true" /></span></Link>
          </div>
        </section>

        <LandingExplore />

        <section id="statistics" className="landing-statistics" aria-labelledby="statistics-title">
          <div className="landing-stats-top landing-reveal"><div><span className="landing-section-label">INFORMATION & INSIGHT</span><h2 id="statistics-title">A changing world of work<span className="landing-period">.</span></h2><p>Explore the kind of signals Jobbery can help you make sense of.</p></div><div className="landing-sample-control"><label htmlFor="sample-period">Illustrative sample data · period</label><select id="sample-period" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>{samplePeriods.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select></div></div>
          <div className="landing-metrics"><div className="landing-reveal"><AnimatedNumber key={`roles-${period}`} value={sample.roles} suffix="+" /><span>potential roles explored</span></div><div className="landing-reveal"><AnimatedNumber key={`skills-${period}`} value={sample.skills} suffix="%" /><span>skills with transfer potential</span></div><div className="landing-reveal"><AnimatedNumber key={`paths-${period}`} value={sample.paths} suffix="+" /><span>learning paths mapped</span></div></div>
          <div className="landing-data-grid"><article className="landing-chart-card landing-reveal"><div className="landing-data-heading"><div><span className="landing-card-index">SAMPLE TREND</span><h3>Opportunity signals over time</h3></div><span className="landing-sample-badge">Illustrative data</span></div><div className="landing-chart" role="img" aria-label={`Illustrative opportunity signal values for ${sample.label}: ${sample.trend.join(", ")}`}><div className="landing-chart-grid" />{sample.trend.map((value, index) => <div className="landing-chart-column" key={index}><span className="landing-chart-bar" style={{ height: `${value}%` }} /><span>{["Jan", "Mar", "May", "Jul", "Sep", "Nov"][index]}</span></div>)}</div><p className="landing-data-note">Example values show how a live trend could change when new data is available.</p></article><article className="landing-insight-card landing-reveal"><span className="landing-card-index">AT A GLANCE</span><h3>From data to a decision</h3><p>Market signals are only one part of the picture. Jobbery also considers your experience, time, and preferred direction.</p><div className="landing-insight-row"><span>Growing opportunity</span><strong>{sample.growing}%</strong></div><div className="landing-insight-row"><span>Skills overlap</span><strong>{sample.overlap}%</strong></div><Link href="/trends" className="landing-text-link">View real job market trends <ArrowRight size={16} aria-hidden /></Link></article></div>
        </section>
      </div>
      <footer className="landing-footer landing-reveal"><span>Jobbery © 2026</span><span>Find a next step that fits.</span><div className="landing-footer-actions"><Link href="/trust">Our approach <ArrowRight size={14} aria-hidden /></Link><button onClick={() => { window.scrollTo({ top: 0, behavior: "auto" }); setSceneActive(true); setReplayKey((key) => key + 1); }}><RotateCcw size={14} aria-hidden /> Replay intro</button></div></footer>
    </div>
  );
}
