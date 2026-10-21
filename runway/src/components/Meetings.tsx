"use client";
import { useCallback, useEffect, useState } from "react";
import { Btn, Chip, H } from "@/components/ui";
import { topicLabel, upcoming, whenLabel, type Meeting, type Slot } from "@/lib/engine/meetings";

export type MeetingsPayload = { now: string; hasProfile: boolean; free: Slot[]; mine: Meeting[]; hasUpcoming: boolean };

// The worker's meetings and free slots, from /api/meetings. Shared by the advisor page and the Plan page card.
export function useMeetings() {
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
      return true;
    } catch { setError("Network problem. Please try again."); return false; } finally { setBusy(false); }
  }, [load]);
  return { data, busy, error, send };
}

export const STATUS_CHIP: Record<Meeting["status"], { label: string; tone: "accent" | "rise" | "neutral" }> = {
  booked: { label: "Booked", tone: "accent" },
  advised: { label: "Advice given", tone: "rise" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

// One meeting as the worker sees it: when, with whom, what about, and any advice or cancellation.
export function MeetingItem({ m, now, onCancel, busy }: { m: Meeting; now: string; onCancel?: () => void; busy?: boolean }) {
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
      {onCancel && upcoming(m, now) && <div className="mt-3"><Btn variant="quiet" onClick={onCancel} disabled={busy}>Cancel this meeting</Btn></div>}
    </div>
  );
}

// On the Plan page: the next meeting, the latest advice, and a way to book. Nothing on the plan waits on it.
export function AdvisorCard() {
  const { data } = useMeetings();
  const next = data?.mine.find((m) => upcoming(m, data.now)) ?? null;
  const advice = data?.mine.filter((m) => m.notes).sort((a, b) => (b.notesAt ?? "").localeCompare(a.notesAt ?? ""))[0] ?? null;
  return (
    <div>
      <H>Talk it over with an advisor</H>
      {!data ? <p className="text-sm text-muted">Loading…</p> : (
        <>
          {advice?.notes && (
            <div className="mb-3 rounded-2xl bg-risesoft p-3 text-sm">
              <p className="font-medium">Advice from {advice.advisor.name}</p>
              <p className="mt-1 whitespace-pre-wrap">{advice.notes}</p>
              <p className="mt-2 text-xs text-muted">A suggestion, not a decision. You choose what to change.</p>
            </div>
          )}
          {next ? (
            <p className="text-sm">You meet <b>{next.advisor.name}</b> on <b>{whenLabel(next.start)}</b> about {topicLabel(next.topic).toLowerCase()}.</p>
          ) : (
            <p className="text-sm">Not sure about the job, a course or the timeline? Book 30 minutes with an advisor, such as an employment officer. They see what Jobbery suggested and why. It is optional; your plan does not wait on it.</p>
          )}
          <p className="mt-1 text-xs text-muted">No partnership with any agency is implied.</p>
          <div className="mt-3"><Btn href="/advisor" variant={next ? "ghost" : "primary"}>{next ? "See your booking" : "Meet an advisor"}</Btn></div>
        </>
      )}
    </div>
  );
}
