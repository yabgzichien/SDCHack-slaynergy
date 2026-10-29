"use client";
// The release picker: a small segmented control on Statistics (at the job lists) and the Forecast page (at the
// questions). Picking an earlier DOSM release shows that part of the page as it stood on the day of that release,
// read-only. The picked release lives in this tab's memory (AppProvider), and other pages always show today.
import { useEffect, useRef, type KeyboardEvent } from "react";
import { useApp } from "./AppProvider";
import { useT } from "./I18nProvider";
import { AnsweredBadge, AnswerStamp, EventIcon, topicOf } from "./MarketCards";
import type { OpenThen } from "@/lib/engine/history";
import "./history.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayLabel = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const qLabel = (q: string) => q.replace("Q", " Q");

export function ReleasePicker({ label }: { label: string }) {
  const { history: h } = useApp();
  const { t } = useT();
  const group = useRef<HTMLDivElement>(null);
  const { index, loadIndex, past, loading } = h;
  useEffect(() => { loadIndex(); }, [loadIndex]);
  if (!index) return null;

  const stops = index.stops;
  const current = loading ?? past?.stop.q ?? stops.find((s) => s.today)?.q;
  const move = (e: KeyboardEvent, i: number) => {
    const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? stops.length - 1 : -1;
    if (j < 0 || j >= stops.length || j === i) return;
    e.preventDefault();
    void h.pick(stops[j].q);
    (group.current?.children[j] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="release-picker">
      <div className="release-picker-row">
        <span className="release-picker-label" id="release-picker-label">{t(label)}</span>
        <div className="release-segments" role="radiogroup" aria-labelledby="release-picker-label" ref={group}>
          {stops.map((s, i) => {
            const on = s.q === current;
            return (
              <button key={s.q} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
                title={`${s.label}, published ${dayLabel(s.day)}`}
                className={`release-segment${on ? " is-on" : ""}`} onClick={() => void h.pick(s.q)} onKeyDown={(e) => move(e, i)}>
                {s.today ? t("Today") : qLabel(s.q)}
              </button>
            );
          })}
        </div>
        {index.upcoming.day && <span className="release-picker-next">{`Next: ${dayLabel(index.upcoming.day)}`}</span>}
      </div>
      <PastNote />
    </div>
  );
}

// One quiet line while a past release is picked, and what that release changed, folded away.
function PastNote() {
  const { history: h } = useApp();
  const { t } = useT();
  if (h.failed) return <p className="release-note" role="status">{t("Could not load this release. Please try again.")}</p>;
  const p = h.past;
  if (!p) return null;
  return (
    <div className="release-note" role="status">
      <p>
        <span>{`Past release: ${p.stop.label}, published ${dayLabel(p.stop.day)}.`}</span>{" "}
        <span className="release-note-muted">{t("Only figures public that day are used. Nothing is saved.")}</span>{" "}
        <button type="button" className="release-note-back" onClick={h.backToToday}>{t("Back to today")}</button>
      </p>
      <details className="release-changes">
        <summary>{`What this release changed (${p.changes.length})`}</summary>
        <ul>
          {p.changes.map((c, i) => (
            <li key={i}>
              {c.text}
              <small>{c.why} <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.name}</a>, {c.source.date}</small>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// A question that was open on the picked day, shown the way the Forecast page shows any answered question.
export function PastQuestionCard({ q }: { q: OpenThen }) {
  return (
    <div className="flex h-full flex-col rounded-[22px] border border-[#cfd6df] bg-[#eef1f5] p-5 text-[#3c4655]">
      <div className="flex items-center justify-between gap-2"><AnsweredBadge /><span className="text-xs text-[#6b7686]">{topicOf(q.id).tag}</span></div>
      <div className="mt-3 flex items-start gap-3">
        <span className="grayscale"><EventIcon eventId={q.id} size={36} /></span>
        <p className="min-w-0 font-medium leading-snug">{q.title}</p>
      </div>
      <p className="mt-2 text-sm">{q.text}</p>
      {q.answer && <div className="mt-3"><AnswerStamp yes={q.answer.outcome} /></div>}
      <p className="mt-auto pt-4 text-xs text-[#6b7686]">{q.answer ? `Settled ${dayLabel(q.answer.day)} with the real figures.` : "Not answered yet."}</p>
    </div>
  );
}
