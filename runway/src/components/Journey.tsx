"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { BriefcaseBusiness, Check, ListChecks, MapPin, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { useApp } from "./AppProvider";

// The five steps of Runway, in order. Every page of the main path belongs to one of them.
export type Step = { href: string; label: string; short: string; icon: LucideIcon; match: string[]; needsProfile: boolean };
export const STEPS: Step[] = [
  { href: "/start", label: "About you", short: "You", icon: UserRound, match: ["/start", "/resume", "/profile"], needsProfile: false },
  { href: "/skills", label: "Your skills", short: "Skills", icon: Sparkles, match: ["/skills", "/radar"], needsProfile: true },
  { href: "/jobs", label: "Jobs for you", short: "Jobs", icon: BriefcaseBusiness, match: ["/jobs", "/goals"], needsProfile: true },
  { href: "/map", label: "Job map", short: "Map", icon: MapPin, match: ["/map"], needsProfile: true },
  { href: "/plan", label: "Your plan", short: "Plan", icon: ListChecks, match: ["/plan"], needsProfile: true },
];
const RESULT_STEPS = STEPS.slice(1);

const at = (path: string, s: Step) => s.match.some((m) => path === m || path.startsWith(`${m}/`));
export const currentStep = (path: string) => STEPS.findIndex((s) => at(path, s));

// The furthest step reached, remembered in this browser only, as a tiny external store.
const KEY = "runway-furthest-step";
const EVT = "runway-furthest-step";
const readFurthest = () => { try { return Number(localStorage.getItem(KEY) ?? 0) || 0; } catch { return 0; } };
const writeFurthest = (n: number | null) => {
  try { if (n === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
};
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb); };
export const forgetProgress = () => writeFurthest(null);

// Where the person is, and which steps are done.
export function useJourney() {
  const path = usePathname();
  const { state } = useApp();
  const hasProfile = !!state?.profile;
  const approved = state?.approval.status === "approved";
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
  const isDone = (i: number) => (i === 0 ? hasProfile : i === STEPS.length - 1 ? approved : hasProfile && i < Math.max(furthest, cur));
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
  return (
    <ol className="relative" aria-label="Your steps">
      <span className="absolute bottom-5 left-[25px] top-5 w-px bg-line" aria-hidden />
      {STEPS.map((s, i) => {
        const st = status(i);
        const Icon = s.icon;
        const body = (
          <>
            <Dot i={i} st={st} done={isDone(i)} />
            <span className="min-w-0 flex-1">{s.label}</span>
            <Icon size={16} strokeWidth={1.8} className="shrink-0 opacity-50" aria-hidden />
          </>
        );
        const cls = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm";
        return (
          <li key={s.href}>
            {st === "locked" ? (
              <span className={`${cls} text-muted/60`} aria-disabled="true" title="Answer the first questions to open this">{body}</span>
            ) : (
              <Link href={s.href} onClick={onPick} aria-current={st === "current" ? "step" : undefined} aria-label={`Step ${i + 1}: ${s.label}, ${stateWord[st]}`}
                className={`press ${cls} ${st === "current" ? "bg-surface2 font-medium text-ink" : "text-ink/80 hover:bg-surface"}`}>{body}</Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Shared journey navigation for every app page.
export function StepBar() {
  const { cur, status } = useJourney();
  const resultIndex = cur - 1;
  const progressStyle = { "--result-index": Math.max(0, resultIndex) } as CSSProperties;
  return (
    <nav className="app-journey" aria-label="Your steps">
      <div className="app-journey-inner">
        <div className="app-journey-steps" style={progressStyle}>
          <div className="app-journey-track" aria-hidden="true"><span className="app-journey-fill" /></div>
          {resultIndex >= 0 && <span className="app-journey-bird" aria-hidden="true"><span key={cur} className="app-journey-bird-face" /></span>}
          <ol>
        {RESULT_STEPS.map((s, index) => {
          const i = index + 1;
          const st = status(i);
          const dot = <Dot i={index} st={st} size={28} />;
          const content = <>{dot}<span className="app-journey-label"><span className="app-journey-label-full">{s.label}</span><span className="app-journey-label-short">{s.short}</span></span></>;
          return (
            <li key={s.href}>
              {st === "locked" ? <span className="app-journey-item is-locked" aria-label={`Step ${index + 1}: ${s.label}, ${stateWord[st]}`}>{content}</span> : (
                <Link href={s.href} aria-current={st === "current" ? "step" : undefined} aria-label={`Step ${index + 1}: ${s.label}, ${stateWord[st]}`} className={`app-journey-item press${st === "current" ? " is-current" : ""}${st === "done" ? " is-done" : ""}`}>{content}</Link>
              )}
            </li>
          );
        })}
          </ol>
        </div>
        <Link href="/start" className="app-journey-edit">Back to edit my details</Link>
      </div>
      {resultIndex >= 0 && <p className="app-journey-current">Results section {resultIndex + 1} of {RESULT_STEPS.length}: {STEPS[cur].label}</p>}
    </nav>
  );
}
