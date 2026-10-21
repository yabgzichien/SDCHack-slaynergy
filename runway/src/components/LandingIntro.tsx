"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useApp } from "./AppProvider";

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
  const { act, busy, catalog } = useApp();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [sceneActive, setSceneActive] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const [birdLeaving, setBirdLeaving] = useState(false);
  const [period, setPeriod] = useState(2);
  const sample = samplePeriods[period];
  const demo = async () => { if (await act("startPersona", { personaId: "hafiz" })) router.push("/skills"); };

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
    const onScroll = () => {
      const introBottom = rootRef.current?.querySelector<HTMLElement>(".landing-intro")?.getBoundingClientRect().bottom ?? 0;
      setBirdLeaving(introBottom < window.innerHeight * 0.65);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const frame = requestAnimationFrame(onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  return (
    <div ref={rootRef} className="landing-page landing-content">
      {sceneActive && <div key={replayKey} className="intro-overlay"><div className="intro-overlay-inner" aria-hidden="true"><span className="intro-word">Jobbery<span className="intro-word-dot">.</span></span><Image src="/cockatiel-running.png" alt="" width={1254} height={1254} className="intro-mascot" priority /><span className="intro-speed intro-speed-one" /><span className="intro-speed intro-speed-two" /></div><button className="intro-skip" onClick={() => setSceneActive(false)}>Skip intro <ArrowRight size={16} /></button></div>}
      <div>
        <section className="landing-intro" aria-labelledby="landing-title">
          <div className="landing-intro-heading"><p className="landing-eyebrow landing-reveal">A clearer path in your career</p><h1 id="landing-title" className="landing-reveal">The quick cockatiel jumps over <em>AI corp dominion</em></h1><p className="landing-intro-subtitle landing-reveal">Explore what you can do next, with your skills, job market context, and room to choose your own path.</p></div>
          <div id="about" className="landing-about-grid">
            <div className={`landing-bird-flight${birdLeaving ? " is-leaving" : ""}`}><Image src="/cockatiel-welcome.png" alt="Jobbery cockatiel mascot" width={1254} height={1254} className="landing-bird" priority /></div>
            <article className="landing-about-item landing-reveal"><h2>What is Jobbery?</h2><div className="landing-info-card"><p>Jobbery helps people in Malaysia make sense of their skills and find a realistic next role as work changes. We connect your experience to opportunities and show the thinking behind each suggestion.</p></div></article>
            <article className="landing-about-item landing-reveal"><h2>What we offer</h2><div className="landing-info-card landing-offer-card"><p>Explore roles that fit, compare AI futures, and shape a week by week plan you can review with a counsellor. Your choices stay yours.</p></div></article>
          </div>
        </section>

        <section id="journey" className="landing-journey" aria-labelledby="journey-title">
          <div className="landing-section-heading landing-reveal"><span className="landing-section-label">YOUR PATH FORWARD</span><h2 id="journey-title">Three steps<span className="landing-period">.</span></h2><p>Start where you are. Move at your own pace.</p></div>
          <div className="landing-steps">
            <article className="landing-step landing-reveal"><span className="landing-step-number">01</span><h3>Show us where you are</h3><p>Use your CV to save time or answer a few short questions. You can check everything before continuing.</p><div className="landing-step-actions"><Link href="/start" className="landing-primary">Get started <ArrowRight size={17} aria-hidden /></Link><button onClick={demo} disabled={busy || !catalog} className="landing-secondary">Try a sample</button></div></article>
            <span className="landing-step-arrow landing-reveal" aria-hidden="true">→</span>
            <article className="landing-step landing-reveal"><span className="landing-step-number">02</span><h3>See what fits</h3><p>Explore roles your skills could lead to, with job data and different AI forecasts in view.</p></article>
            <span className="landing-step-arrow landing-reveal" aria-hidden="true">→</span>
            <article className="landing-step landing-reveal"><span className="landing-step-number">03</span><h3>Make a plan</h3><p>Turn a role you choose into a week by week path you can review with a counsellor.</p></article>
          </div>
        </section>

        <section id="statistics" className="landing-statistics" aria-labelledby="statistics-title">
          <div className="landing-stats-top landing-reveal"><div><span className="landing-section-label">INFORMATION & INSIGHT</span><h2 id="statistics-title">A changing world of work<span className="landing-period">.</span></h2><p>Explore the kind of signals Jobbery can help you make sense of.</p></div><div className="landing-sample-control"><label htmlFor="sample-period">Illustrative sample data · period</label><select id="sample-period" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>{samplePeriods.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select></div></div>
          <div className="landing-metrics"><div className="landing-reveal"><AnimatedNumber key={`roles-${period}`} value={sample.roles} suffix="+" /><span>potential roles explored</span></div><div className="landing-reveal"><AnimatedNumber key={`skills-${period}`} value={sample.skills} suffix="%" /><span>skills with transfer potential</span></div><div className="landing-reveal"><AnimatedNumber key={`paths-${period}`} value={sample.paths} suffix="+" /><span>learning paths mapped</span></div></div>
          <div className="landing-data-grid"><article className="landing-chart-card landing-reveal"><div className="landing-data-heading"><div><span className="landing-card-index">SAMPLE TREND</span><h3>Opportunity signals over time</h3></div><span className="landing-sample-badge">Illustrative data</span></div><div className="landing-chart" role="img" aria-label={`Illustrative opportunity signal values for ${sample.label}: ${sample.trend.join(", ")}`}><div className="landing-chart-grid" />{sample.trend.map((value, index) => <div className="landing-chart-column" key={index}><span className="landing-chart-bar" style={{ height: `${value}%` }} /><span>{["Jan", "Mar", "May", "Jul", "Sep", "Nov"][index]}</span></div>)}</div><p className="landing-data-note">Example values show how a live trend could change when new data is available.</p></article><article className="landing-insight-card landing-reveal"><span className="landing-card-index">AT A GLANCE</span><h3>From data to a decision</h3><p>Market signals are only one part of the picture. Jobbery also considers your experience, time, and preferred direction.</p><div className="landing-insight-row"><span>Growing opportunity</span><strong>{sample.growing}%</strong></div><div className="landing-insight-row"><span>Skills overlap</span><strong>{sample.overlap}%</strong></div><Link href="/trends" className="landing-text-link">View real job market trends <ArrowRight size={16} aria-hidden /></Link></article></div>
        </section>
      </div>
      <footer className="landing-footer landing-reveal"><span>Jobbery © 2026</span><span>Find a next step that fits.</span><div className="landing-footer-actions"><Link href="/trust">Our approach <ArrowRight size={14} aria-hidden /></Link><button onClick={() => { setReplayKey((key) => key + 1); setSceneActive(true); }}><RotateCcw size={14} aria-hidden /> Replay intro</button></div></footer>
    </div>
  );
}
