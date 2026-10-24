"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, ViewTransition } from "react";
import Image from "next/image";
import { BriefcaseBusiness, Check, ListChecks, MapPin, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { useApp } from "./AppProvider";
import { useT } from "./I18nProvider";
import "./journey-bar.css";
import { readStored, removeStored } from "@/lib/legacy";

// The five steps of Jobbery, in order. Every page of the main path belongs to one of them.
export type Step = { href: string; label: string; short: string; icon: LucideIcon; match: string[]; needsProfile: boolean };
export const STEPS: Step[] = [
  { href: "/start", label: "About you", short: "You", icon: UserRound, match: ["/start", "/resume", "/profile"], needsProfile: false },
  { href: "/skills", label: "Your skills", short: "Skills", icon: Sparkles, match: ["/skills", "/radar"], needsProfile: true },
  { href: "/jobs", label: "Suggested jobs", short: "Jobs", icon: BriefcaseBusiness, match: ["/jobs", "/goals"], needsProfile: true },
  { href: "/map", label: "Job map", short: "Map", icon: MapPin, match: ["/map"], needsProfile: true },
  { href: "/plan", label: "Your plan", short: "Plan", icon: ListChecks, match: ["/plan"], needsProfile: true },
];

const at = (path: string, s: Step) => s.match.some((m) => path === m || path.startsWith(`${m}/`));
export const currentStep = (path: string) => STEPS.findIndex((s) => at(path, s));

// The furthest step reached, remembered in this browser only, as a tiny external store.
const KEY = "jobbery-furthest-step";
const EVT = "jobbery-furthest-step";
const readFurthest = () => { try { return Number(readStored(localStorage, KEY) ?? 0) || 0; } catch { return 0; } };
const writeFurthest = (n: number | null) => {
  try { if (n === null) removeStored(localStorage, KEY); else localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
};
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb); };
export const forgetProgress = () => writeFurthest(null);

// Where the person is, and which steps are done.
export function useJourney() {
  const path = usePathname();
  const { state } = useApp();
  const hasProfile = !!state?.profile;
  const planned = !!state?.chosenRoleId;
  const cur = currentStep(path);
  const stored = useSyncExternalStore(subscribe, readFurthest, () => 0);
  useEffect(() => { if (hasProfile && cur > readFurthest()) writeFurthest(cur); }, [cur, hasProfile]);
  const furthest = hasProfile ? stored : 0;
  const status = (i: number): "done" | "current" | "todo" | "locked" => {
    if (i === cur) return "current";
    if (STEPS[i].needsProfile && !hasProfile) return "locked";
    if (isDone(i)) return "done";
    return "todo";
  };
  const isDone = (i: number) => (i === 0 ? hasProfile : i === STEPS.length - 1 ? planned : hasProfile && i < Math.max(furthest, cur));
  return { cur, status, isDone, hasProfile };
}

function Dot({ i, st, done, size = 28 }: { i: number; st: ReturnType<ReturnType<typeof useJourney>["status"]>; done?: boolean; size?: number }) {
  const cls = st === "current" ? "bg-primary text-primaryink" : st === "done" ? "bg-accent text-white" : "bg-surface2 text-muted";
  return (
    <span className={`num relative z-10 inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold ${cls}`} style={{ width: size, height: size }} aria-hidden>
      {st === "done" || done ? <Check size={14} strokeWidth={2.6} /> : i + 1}
    </span>
  );
}

const stateWord = { done: "done", current: "you are here", todo: "not started", locked: "answer the first questions to open" };

// Desktop sidebar: the five steps as a vertical track.
export function StepRail({ onPick }: { onPick?: () => void }) {
  const { status, isDone } = useJourney();
  const { t } = useT();
  return (
    <ol className="relative" aria-label={t("Your steps")}>
      <span className="absolute bottom-5 left-[25px] top-5 w-px bg-line" aria-hidden />
      {STEPS.map((s, i) => {
        const st = status(i);
        const Icon = s.icon;
        const body = (
          <>
            <Dot i={i} st={st} done={isDone(i)} />
            <span className="min-w-0 flex-1">{t(s.label)}</span>
            <Icon size={16} strokeWidth={1.8} className="shrink-0 opacity-50" aria-hidden />
          </>
        );
        const cls = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm";
        return (
          <li key={s.href}>
            {st === "locked" ? (
              <span className={`${cls} text-muted/60`} aria-disabled="true" title={t("Answer the first questions to open this")}>{body}</span>
            ) : (
              <Link href={s.href} onClick={onPick} aria-current={st === "current" ? "step" : undefined} aria-label={t("Step {n}: {label}, {state}", { n: i + 1, label: t(s.label), state: t(stateWord[st]) })}
                className={`press ${cls} ${st === "current" ? "bg-surface2 font-medium text-ink" : "text-ink/80 hover:bg-surface"}`}>{body}</Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// The questions inside step 1, shown as ticks within the "About you" pill while someone answers them on /start.
export type SubSteps = {
  labels: string[];
  icons: LucideIcon[];
  index: number;
  state: (k: number) => "done" | "current" | "upcoming";
  reachable: (k: number) => boolean;
  onPick: (k: number) => void;
};

// Where the bird stood on the last bar, as a share of the bar's width, so a new bar can walk it on from there.
let lastBird: number | null = null;

// The bird walks along the bar to whatever element is marked as its target.
// It eases towards the target every frame, so it also follows pills as they grow and shrink.
function useBird(key: string) {
  const row = useRef<HTMLDivElement>(null);
  const bird = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const r = row.current, b = bird.current;
    if (!r || !b) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = () => {
      const el = r.querySelector<HTMLElement>("[data-bird-target]");
      if (!el) return null;
      const a = r.getBoundingClientRect(), e = el.getBoundingClientRect();
      return e.left - a.left + e.width / 2;
    };
    const first = target();
    if (first === null) return;
    let x = !still && lastBird !== null ? lastBird * r.clientWidth : first;
    let raf = 0, frames = 0;
    const place = (walking: boolean, back: boolean) => {
      b.style.transform = `translateX(${x}px) translateX(-50%)`;
      b.classList.toggle("is-walking", walking);
      if (walking) b.classList.toggle("is-returning", back);
    };
    const tick = () => {
      const t = target() ?? x;
      const d = t - x;
      if (still || Math.abs(d) < 0.5) { x = t; place(false, false); } else { x += Math.sign(d) * Math.min(Math.abs(d), Math.max(1.2, Math.abs(d) * 0.09)); place(true, d < 0); }
      lastBird = r.clientWidth ? x / r.clientWidth : null;
      // Keep watching a little after arriving, while pills finish resizing.
      frames = Math.abs(d) < 0.5 ? frames + 1 : 0;
      if (frames < 40) raf = requestAnimationFrame(tick);
    };
    place(false, false);
    raf = requestAnimationFrame(tick);
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); frames = 0; raf = requestAnimationFrame(tick); });
    ro.observe(r);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [row, bird, key]);
  return { row, bird };
}

// The journey bar: five segmented pills, filled from the left as steps are done, with the bird walking above.
// It sits under the header on every journey page, and inline on /start where step 1 opens up into its questions.
// Each pill shares a view-transition name with its dashboard card, so the cards morph into the bar and back.
export function StepBar({ sub, inline }: { sub?: SubSteps; inline?: boolean }) {
  const { cur, status } = useJourney();
  const { t } = useT();
  const { row, bird } = useBird(`${cur}:${sub?.index ?? ""}`);
  return (
    <nav className={`jbar${inline ? " is-inline" : ""}`} aria-label={t("Your steps")}>
      <div className="jbar-inner">
        <div className="jbar-row" ref={row}>
          <div className="jbar-bird" ref={bird} aria-hidden="true">
            <Image className="jbar-bird-frame jbar-bird-a" src="/cockatiel-walk-step-a.png" alt="" width={1254} height={1254} priority />
            <Image className="jbar-bird-frame jbar-bird-b" src="/cockatiel-walk-step-b.png" alt="" width={1254} height={1254} priority />
            <span className="jbar-bird-shadow" />
          </div>
          <ol className="jbar-pills">
            {STEPS.map((s, i) => {
              const st = status(i);
              const done = st === "done";
              const Icon = done ? Check : s.icon;
              const open = !!sub && i === 0;
              const label = t("Step {n}: {label}, {state}", { n: i + 1, label: t(s.label), state: t(stateWord[st]) });
              const body = (
                <>
                  <Icon size={15} strokeWidth={done ? 2.6 : 1.9} className="jbar-icon" aria-hidden />
                  <span className="jbar-label">{t(s.label)}</span>
                </>
              );
              return (
                <li key={s.href} className={`jbar-slot${open ? " is-open" : ""}`} data-state={st}>
                  <ViewTransition name={`jstep-${i}`} share="morph" default="none">
                    {open ? (
                      <div className="jbar-pill" data-state="current" aria-current="step">
                        <span className="jbar-pill-head">{body}</span>
                        <span className="jbar-ticks" role="list" aria-label={t("Questions")}>
                          {sub.labels.map((q, k) => {
                            const qs = sub.state(k);
                            const QIcon = qs === "done" ? Check : sub.icons[k];
                            return (
                              <span role="listitem" key={q}>
                                <button type="button" className="jbar-tick" data-state={qs} disabled={!sub.reachable(k)} onClick={() => sub.onPick(k)}
                                  aria-current={qs === "current" ? "step" : undefined} title={t(q)}
                                  aria-label={`${t(q)}${qs === "current" ? `, ${t("current question")}` : qs === "done" ? `, ${t("answered")}` : ""}`}
                                  {...(qs === "current" ? { "data-bird-target": "" } : {})}>
                                  <QIcon size={11} strokeWidth={qs === "done" ? 2.8 : 2} aria-hidden />
                                </button>
                              </span>
                            );
                          })}
                        </span>
                      </div>
                    ) : st === "locked" ? (
                      <span className="jbar-pill" data-state="locked" aria-label={label} title={t("Answer the first questions to open this")}>{body}</span>
                    ) : (
                      <Link href={s.href} className="jbar-pill press" data-state={st} aria-label={label} aria-current={st === "current" ? "step" : undefined}
                        {...(st === "current" ? { "data-bird-target": "" } : {})}>{body}</Link>
                    )}
                  </ViewTransition>
                </li>
              );
            })}
          </ol>
        </div>
        {sub ? (
          <p className="jbar-caption">{t("Question {n} of {total}: {label}", { n: sub.index + 1, total: sub.labels.length, label: t(sub.labels[sub.index]) })}</p>
        ) : cur >= 0 && (
          <p className="jbar-caption is-mobile">{t("Step {n} of {total}: {label}", { n: cur + 1, total: STEPS.length, label: t(STEPS[cur].label) })}</p>
        )}
      </div>
    </nav>
  );
}
