"use client";
// The history timeline: pick any past DOSM release and the app shows itself as it stood that day (read-only).
// Opened only from "History" in the header. The picked release lives in this tab's memory (AppProvider).
import { useEffect, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { History as HistoryIcon, X } from "lucide-react";
import { useApp } from "./AppProvider";
import { useT } from "./I18nProvider";
import { FUTURE_COLOR, FUTURE_NAME, pct } from "./ui";
import type { Weights3 } from "@/lib/engine/futures";
import "./history.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayLabel = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const qLabel = (q: string) => q.replace("Q", " Q");
const IDS = ["slow", "medium", "fast"] as const;

export function HistoryButton({ menu = false }: { menu?: boolean }) {
  const { history: h } = useApp();
  const { t } = useT();
  const past = h.past;
  return (
    <button type="button" className={menu ? "history-menu-button" : "history-nav-button"} aria-expanded={h.open} aria-controls="history-panel"
      onClick={(e) => { h.setOpen(!h.open); (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); }}>
      <HistoryIcon size={15} aria-hidden />{t("History")}{past && <span className="history-nav-date"> · {dayLabel(past.stop.day)}</span>}
    </button>
  );
}

// "Viewing the past" banner, on every page while a release before today is picked.
export function PastBanner() {
  const { history: h } = useApp();
  const { t } = useT();
  if (!h.past) return null;
  const s = h.past.stop;
  return (
    <div className="history-banner" role="status">
      <p>
        <strong>{`Viewing the past: ${dayLabel(s.day)} (${s.label}).`}</strong>{" "}
        {t("Today's AI exposure scores (ILO, Anthropic Economic Index) are used. Figures as DOSM publishes them today. Nothing is saved.")}
      </p>
      <button type="button" onClick={h.backToToday}>{t("Back to today")}</button>
    </div>
  );
}

function Bands({ cols, picked }: { cols: { q: string; label: string; weights: Weights3; today: boolean }[]; picked: string | null }) {
  const { t } = useT();
  return (
    <div className="history-bands-wrap">
      <div className="history-bands" aria-hidden>
        {cols.map((c) => (
          <div key={c.q} className={`history-band${c.q === picked ? " is-picked" : ""}`}>
            {IDS.map((id) => <span key={id} style={{ height: `${c.weights[id] * 100}%`, background: FUTURE_COLOR[id] }} />)}
          </div>
        ))}
        <div className="history-band is-empty" />
      </div>
      <p className="history-legend">
        {IDS.map((id) => <span key={id}><i style={{ background: FUTURE_COLOR[id] }} />{t(FUTURE_NAME[id])}</span>)}
      </p>
      <details className="history-table">
        <summary>{t("Show as table")}</summary>
        <table>
          <caption>{t("How likely each AI speed was at each release")}</caption>
          <thead><tr><th scope="col">{t("Release")}</th>{IDS.map((id) => <th key={id} scope="col">{t(FUTURE_NAME[id])}</th>)}</tr></thead>
          <tbody>{cols.map((c) => <tr key={c.q}><th scope="row">{c.label}</th>{IDS.map((id) => <td key={id}>{pct(c.weights[id])}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

export function HistoryPanel() {
  const { history: h, todayView } = useApp();
  const { t } = useT();
  const panel = useRef<HTMLDivElement>(null);
  const idx = h.index;
  const todayStop = idx?.stops.find((s) => s.today) ?? null;
  const pickedQ = h.picked?.stop.q ?? h.loading ?? todayStop?.q ?? null;

  // Opening the panel shows today's release and its log first.
  const { open, picked, loading, failed, pick, setOpen } = h;
  useEffect(() => { if (open && todayStop && !picked && !loading && !failed) void pick(todayStop.q); }, [open, todayStop, picked, loading, failed, pick]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  if (!h.open) return null;

  const stops = idx?.stops ?? [];
  const cols = stops.map((s) => ({
    q: s.q, today: s.today, label: s.today ? `${t("Today")} (${s.label})` : s.label,
    weights: s.today ? todayView?.world.weights ?? null : idx!.bands.find((b) => b.q === s.q)?.weights ?? null,
  })).filter((c): c is typeof c & { weights: Weights3 } => !!c.weights);
  const move = (e: KeyboardEvent, i: number) => {
    const j = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? stops.length - 1 : -1;
    if (j < 0 || j >= stops.length || j === i) return;
    e.preventDefault();
    void h.pick(stops[j].q);
    (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
  };
  const entry = h.picked && h.picked.stop.q === pickedQ ? h.picked : null;

  return (
    <div id="history-panel" ref={panel} tabIndex={-1} className="history-panel" role="region" aria-label={t("History")}>
      <div className="history-head">
        <div>
          <h2>{t("History")}</h2>
          <p>{t("See the app as it stood on the day of each real DOSM release, using only figures published by then. Nothing is saved.")}</p>
        </div>
        <button type="button" className="history-close" onClick={() => h.setOpen(false)} aria-label={t("Close history")}><X size={18} aria-hidden /></button>
      </div>
      {!idx ? (
        <p className="history-muted">{h.failed ? t("Could not load the history. Please try again.") : t("Loading the releases…")}</p>
      ) : (
        <>
          <h3 className="history-sub">{t("How the forecast has learned")}</h3>
          <p className="history-muted">{t("Earlier releases: replayed from the answers public that day. Today: also counts open predictions, mostly from computer-made players.")}</p>
          <Bands cols={cols} picked={pickedQ} />
          <div className="history-stops" role="radiogroup" aria-label={t("Releases")}>
            {stops.map((s, i) => {
              const on = s.q === pickedQ;
              return (
                <button key={s.q} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
                  className={`history-stop${on ? " is-on" : ""}${s.today ? " is-today" : ""}`} onClick={() => void h.pick(s.q)} onKeyDown={(e) => move(e, i)}>
                  <i aria-hidden />
                  <strong>{s.today ? t("Today") : qLabel(s.q)}</strong>
                  <span>{s.today ? `${qLabel(s.q)} · ${dayLabel(s.day)}` : dayLabel(s.day)}</span>
                </button>
              );
            })}
            <div className="history-stop is-upcoming" aria-disabled>
              <i aria-hidden />
              <strong>{qLabel(idx.upcoming.q)}</strong>
              <span>{idx.upcoming.day ? `${dayLabel(idx.upcoming.day)}: ${t("not published yet")}` : t("not published yet")}</span>
            </div>
          </div>

          <section className="history-log" aria-live="polite" aria-busy={!!h.loading}>
            {!entry ? (
              <p className="history-muted">{h.failed ? t("Could not load this release. Please try again.") : t("Loading…")}</p>
            ) : (
              <>
                <h3 className="history-sub">{t("What this release changed")}</h3>
                <p className="history-log-title">{`${dayLabel(entry.stop.day)} · ${entry.stop.label} published`}</p>
                <ul>
                  {entry.changes.map((c, i) => (
                    <li key={i}>
                      <span>{c.text}</span>
                      <small>{c.why} <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.name}</a>, {c.source.date}</small>
                    </li>
                  ))}
                </ul>
                <div className="history-actions">
                  {entry.stop.today
                    ? <p className="history-muted">{t("You are looking at today. Pick an earlier release to see the app as it stood then.")}</p>
                    : <><button type="button" onClick={h.backToToday}>{t("Back to today")}</button><Link href="/jobs" onClick={() => h.setOpen(false)}>{t("See your jobs as of then")}</Link></>}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// The Forecast page while viewing the past: the questions open that day, read-only, with no answers from after it.
export function PastForecast() {
  const { history: h, view } = useApp();
  const { t } = useT();
  const past = h.past;
  if (!past || !view) return null;
  const w = view.world;
  return (
    <div className="history-past-forecast">
      <h1 className="text-2xl font-semibold">{t("The Forecast")}</h1>
      <p className="mt-2 text-sm text-muted">{`As it stood on ${dayLabel(past.stop.day)}. Predicting is turned off while viewing the past.`}</p>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t("How likely each AI speed was")}</h2>
        <ul className="history-speeds">
          {w.futures.map((f) => <li key={f.id}><i style={{ background: FUTURE_COLOR[f.id] }} aria-hidden /><span>{f.name}</span><strong>{pct(f.weight)}</strong></li>)}
        </ul>
        <p className="mt-1 text-xs text-muted">{t("Replayed from the answers public that day.")}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t("Questions open that day")}</h2>
        <p className="mt-1 text-sm text-muted">{t("Their answers came out later. Pick a later release in History to see them.")}</p>
        <ul className="history-open">
          {past.open.map((q) => (
            <li key={q.id}>
              <strong>{q.title}</strong>
              <span>{q.text}</span>
              <small>{`Answered by: ${q.settles}`} · <a href={q.source.url} target="_blank" rel="noreferrer">{q.source.name}</a></small>
            </li>
          ))}
        </ul>
      </section>
      <button type="button" className="history-back" onClick={h.backToToday}>{t("Back to today")}</button>
    </div>
  );
}
