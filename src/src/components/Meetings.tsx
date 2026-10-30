"use client";
import { useApp } from "@/components/AppProvider";
import { useCallback, useEffect, useState } from "react";
import { Compass, MessagesSquare, Mic, Quote, Wallet } from "lucide-react";
import { Btn, Chip } from "@/components/ui";
import { topicLabel, upcoming, whenLabel, type Meeting, type Slot } from "@/lib/engine/meetings";

export type MeetingsPayload = { now: string; hasProfile: boolean; free: Slot[]; mine: Meeting[]; hasUpcoming: boolean };

// The worker's meetings and free slots, from /api/meetings. Shared by the advisor page and the Plan page card.
export function useMeetings() {
  const { refresh } = useApp();
  const [data, setData] = useState<MeetingsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => fetch("/api/meetings").then((r) => r.json()).then(setData).catch(() => setError("Could not load the calendar. Please refresh.")), []);
  useEffect(() => { load(); }, [load]);
  const send = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/meetings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Something went wrong."); if (r.status === 409) load(); return false; }
      setData(d);
      // Booking, cancelling and demo advice change the worker's plan (the meeting step), so reload the app state too.
      await refresh();
      return true;
    } catch { setError("Network problem. Please try again."); return false; } finally { setBusy(false); }
  }, [load, refresh]);
  return { data, busy, error, send };
}

export const STATUS_CHIP: Record<Meeting["status"], { label: string; tone: "accent" | "rise" | "neutral" }> = {
  booked: { label: "Booked", tone: "accent" },
  advised: { label: "Advice given", tone: "rise" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

// One meeting as the worker sees it: when, with whom, what about, and any advice or cancellation.
export function MeetingItem({ m, now, onCancel, onDemo, busy }: { m: Meeting; now: string; onCancel?: () => void; onDemo?: () => void; busy?: boolean }) {
  return (
    <div className="rounded-2xl bg-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{whenLabel(m.start)}</p>
        <Chip tone={STATUS_CHIP[m.status].tone}>{STATUS_CHIP[m.status].label}</Chip>
      </div>
      <p className="mt-1 text-sm text-muted">With {m.advisor.name} · 30 minutes · {topicLabel(m.topic)}</p>
      {m.question && <p className="mt-2 text-sm">You asked: &ldquo;{m.question}&rdquo;</p>}
      {m.status === "cancelled" && <p className="mt-2 text-sm text-fall">{m.cancelledBy === "advisor" ? `${m.advisor.name} cancelled: “${m.reason}”. Please pick another time.` : "You cancelled this meeting."}</p>}
      {m.notes && (
        <div className="mt-3 rounded-2xl bg-risesoft p-3 text-sm">
          <p className="font-medium">Advice from {m.advisor.name}</p>
          <p className="mt-1 whitespace-pre-wrap">{m.notes}</p>
          <p className="mt-2 text-xs text-muted">A suggestion, not a decision. You choose what to do with it.</p>
        </div>
      )}
      {((onCancel && upcoming(m, now)) || onDemo) && m.status === "booked" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onCancel && upcoming(m, now) && <Btn variant="quiet" onClick={onCancel} disabled={busy}>Cancel this meeting</Btn>}
          {onDemo && <button onClick={onDemo} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-cue px-3 text-xs font-medium text-cueink hover:bg-cuesoft">Demo: mark this meeting as finished (sample advice)</button>}
        </div>
      )}
    </div>
  );
}

// On the Plan page: the next meeting, the latest advice, and a way to book. Nothing on the plan waits on it.
export function AdvisorCard() {
  const { data } = useMeetings();
  const next = data?.mine.find((m) => upcoming(m, data.now)) ?? null;
  const advice = data?.mine.filter((m) => m.notes).sort((a, b) => (b.notesAt ?? "").localeCompare(a.notesAt ?? ""))[0] ?? null;
  const initials = (n: string) => n.replace(/\(.*?\)/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const d = next ? new Date(next.start) : null;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-laneresume text-white shadow-[0_2px_8px_rgb(0_0_0/0.15)]"><MessagesSquare size={22} /></span>
        <div>
          <h2 className="section-heading text-base font-semibold">Talk it over with an advisor</h2>
          <p className="text-sm text-muted">30 minutes with an employment officer. Optional; your plan never waits on it.</p>
        </div>
      </div>
      {!data ? <p className="text-sm text-muted">Loading…</p> : (
        <div className="space-y-3">
          {advice?.notes && (
            <figure className="flex gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-laneresumesoft text-sm font-bold text-laneresumeink ring-2 ring-laneresume">{initials(advice.advisor.name) || "A"}</span>
              <div className="relative min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-laneresumesoft p-4 text-sm">
                <Quote size={18} aria-hidden className="absolute right-3 top-3 text-laneresume/50" />
                <figcaption className="text-xs font-semibold uppercase tracking-wide text-laneresumeink">Advice from {advice.advisor.name}</figcaption>
                <blockquote className="mt-1.5 whitespace-pre-wrap pr-6 leading-relaxed">{advice.notes}</blockquote>
                <p className="mt-2 text-xs text-muted">A suggestion, not a decision. You choose what to change.</p>
              </div>
            </figure>
          )}
          {next && d ? (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-laneresume/40 bg-raised p-3">
              <div aria-hidden className="w-14 shrink-0 overflow-hidden rounded-xl text-center shadow-[0_1px_4px_rgb(0_0_0/0.12)]">
                <p className="bg-laneresume py-0.5 text-[11px] font-semibold uppercase text-white">{d.toLocaleDateString("en-MY", { month: "short" })}</p>
                <p className="num bg-white py-1 text-xl font-bold leading-none text-ink">{d.getDate()}</p>
              </div>
              <div className="min-w-0 text-sm">
                <p className="font-medium">{next.status === "advised" ? "Met" : "Meeting"} {next.advisor.name}</p>
                <p className="text-muted">{whenLabel(next.start)} · {topicLabel(next.topic)}</p>
              </div>
              <Chip tone={STATUS_CHIP[next.status].tone}>{STATUS_CHIP[next.status].label}</Chip>
            </div>
          ) : !advice && (
            <ul className="grid gap-2 text-sm sm:grid-cols-3">
              {[["A mock interview", Mic], ["Which job to aim for", Compass], ["Courses and cost", Wallet]].map(([t, I]) => {
                const Icon = I as typeof Mic;
                return <li key={t as string} className="flex items-center gap-2 rounded-xl bg-laneresumesoft px-3 py-2 text-laneresumeink"><Icon size={16} aria-hidden />{t as string}</li>;
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Btn href="/advisor" variant={next ? "ghost" : "primary"}>{next ? "See your booking" : "Book a meeting"}</Btn>
            <span className="text-xs text-muted">No partnership with any agency is implied.</span>
          </div>
        </div>
      )}
    </div>
  );
}
