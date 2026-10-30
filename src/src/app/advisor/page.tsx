"use client";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Btn, Card, Chip, H, NextRow, PageTitle, Skeleton } from "@/components/ui";
import { MeetingItem, useMeetings } from "@/components/Meetings";
import { dayLabel, MAX_QUESTION, myDay, myTime, TOPICS, upcoming, weekday, windowDays, type Slot, type TopicId } from "@/lib/engine/meetings";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Meet an advisor: an optional half hour with a person, booked on the worker's own terms.
export default function AdvisorPage() {
  const { data, busy, error, send } = useMeetings();
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [question, setQuestion] = useState("");

  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of data?.free ?? []) m.set(myDay(s.start), [...(m.get(myDay(s.start)) ?? []), s]);
    return m;
  }, [data]);

  if (!data) return <Skeleton lines={6} />;
  const days = windowDays(data.now);
  const pickedDay = day ?? days.find((d) => byDay.has(d)) ?? days[0];
  const next = data.mine.filter((m) => upcoming(m, data.now));
  const earlier = data.mine.filter((m) => !upcoming(m, data.now));
  const lead = weekday(days[0]);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];

  const book = async () => {
    if (!slot || !topic) return;
    if (await send({ type: "book", slotId: slot.id, topic, question })) { setSlot(null); setTopic(null); setQuestion(""); }
  };

  return (
    <div>
      <Btn href="/plan" variant="quiet" className="mb-3 -ml-1"><ArrowLeft size={16} aria-hidden />Back to your plan</Btn>
      <PageTitle title="Meet an advisor">
        Jobbery suggests and you decide. If you want a second opinion, book 30 minutes with an advisor, such as an employment officer. They see your profile, the jobs Jobbery suggested and why, and your plan, so you can start from there. Booking is your choice; nothing waits on it.
      </PageTitle>

      {error && <p role="alert" className="mb-4 rounded-2xl bg-fallsoft p-3 text-sm text-negative">{error}</p>}

      {!data.hasProfile ? (
        <Card><p className="text-sm">Tell us about yourself first, so the advisor knows who they are meeting.</p><div className="mt-3"><Btn href="/start">Get started</Btn></div></Card>
      ) : (
        <>
          {next.length > 0 && (
            <Card className="mb-4" tone="accent">
              <H sub="One booking at a time. To pick a different time, cancel this one first.">Your next meeting</H>
              <div className="space-y-2">{next.map((m) => <MeetingItem key={m.id} m={m} now={data.now} busy={busy} onCancel={() => send({ type: "cancel", meetingId: m.id })} onDemo={() => send({ type: "demoAdvise", meetingId: m.id })} />)}</div>
            </Card>
          )}

          {!data.hasUpcoming && (
            <div className="grid gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-7" tone="raised">
                <H sub="Next two weeks, Malaysia time. The number is how many half hours are free that day.">1. Pick a day</H>
                <div className="grid grid-cols-7 gap-1.5 text-center" role="grid" aria-label="Next two weeks">
                  {WEEK.map((w) => <div key={w} className="pb-1 text-xs font-medium text-muted" role="columnheader">{w}</div>)}
                  {cells.map((d, i) => {
                    if (!d) return <div key={`x${i}`} aria-hidden />;
                    const n = byDay.get(d)?.length ?? 0;
                    const on = d === pickedDay;
                    return (
                      <button key={d} type="button" disabled={!n} onClick={() => { setDay(d); setSlot(null); }} aria-pressed={on}
                        aria-label={`${dayLabel(d, { weekday: "long", day: "numeric", month: "long" })}, ${n} free`}
                        className={`press flex min-h-16 flex-col items-center justify-center rounded-2xl px-1 py-2 text-sm ${on ? "bg-primary text-primaryink" : n ? "bg-surface hover:bg-surface2" : "bg-surface text-muted opacity-50"}`}>
                        <span className="num text-base font-semibold">{dayLabel(d, { day: "numeric" })}</span>
                        <span className="text-[11px]">{dayLabel(d, { month: "short" })}</span>
                        <span className={`num mt-0.5 text-[11px] ${on ? "" : n ? "text-accent" : ""}`}>{n ? `${n} free` : "—"}</span>
                      </button>
                    );
                  })}
                </div>

                <h3 className="mt-6 mb-2 text-base font-semibold">2. Pick a time on {dayLabel(pickedDay, { weekday: "long", day: "numeric", month: "long" })}</h3>
                {(byDay.get(pickedDay) ?? []).length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {byDay.get(pickedDay)!.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => setSlot(s)} aria-pressed={slot?.id === s.id}
                          className={`press flex w-full flex-col items-start rounded-2xl px-4 py-2.5 text-left ${slot?.id === s.id ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
                          <span className="num font-semibold">{myTime(s.start)}</span>
                          <span className="text-xs">{s.advisor.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted">No free times that day. Pick another day.</p>}
              </Card>

              <Card className="lg:col-span-5">
                <H sub="So the advisor can prepare.">3. What would you like to talk about?</H>
                {!slot ? <p className="text-sm text-muted">Pick a time first.</p> : (
                  <form onSubmit={(e) => { e.preventDefault(); book(); }}>
                    <p className="mb-3 text-sm"><b>{dayLabel(myDay(slot.start), { weekday: "long", day: "numeric", month: "long" })}, {myTime(slot.start)}</b> with {slot.advisor.name}{slot.demo && <> <Chip tone="demo">Made-up</Chip></>}</p>
                    <fieldset className="space-y-1.5">
                      <legend className="sr-only">Topic</legend>
                      {TOPICS.map((t) => (
                        <label key={t.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 ${topic === t.id ? "bg-accentsoft" : "bg-raised"}`}>
                          <input type="radio" name="topic" value={t.id} checked={topic === t.id} onChange={() => setTopic(t.id)} className="h-4 w-4 accent-[var(--accent)]" />
                          <span className="text-sm">{t.label}</span>
                        </label>
                      ))}
                    </fieldset>
                    <label className="mt-3 block text-sm font-medium">Your question (optional)
                      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={MAX_QUESTION} rows={3} className="mt-1 w-full rounded-2xl border border-control bg-raised p-3" placeholder="For example: I can only study in the evenings. Which course should I do first?" />
                    </label>
                    <div className="mt-3"><Btn type="submit" disabled={busy || !topic}>Book this time</Btn></div>
                  </form>
                )}
              </Card>
            </div>
          )}

          {earlier.length > 0 && (
            <Card className="mt-4">
              <H>Earlier meetings and advice</H>
              <div className="space-y-2">{earlier.map((m) => <MeetingItem key={m.id} m={m} now={data.now} />)}</div>
            </Card>
          )}
        </>
      )}
      <NextRow back="/plan" />
    </div>
  );
}
