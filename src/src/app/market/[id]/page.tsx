"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { MarketBoard } from "@/components/MarketBoard";
import { AnsweredBadge, EventIcon, OpenBadge, topicOf } from "@/components/MarketCards";
import { Btn, PageTitle, Skeleton } from "@/components/ui";
import { PastForecast } from "@/components/History";

// One question: should I buy Yes or No on this release?
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // Malaysian calendar day

export default function MarketEventPage() {
  const { view, history } = useApp();
  const { id } = useParams<{ id: string }>();
  if (!view) return <Skeleton lines={6} />;
  if (history.past) return <PastForecast />;
  const key = decodeURIComponent(id);
  const ev = view.world.events.find((e) => e.id === key) ?? view.world.settledEvents.find((e) => e.id === key);
  if (!ev) {
    return (
      <div>
        <PageTitle title="This question is closed.">It was probably answered when the new numbers came out.</PageTitle>
        <Btn href="/market">All questions</Btn>
      </div>
    );
  }
  return (
    <div>
      <Link href="/market" className="mb-4 inline-block text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">All questions</Link>
      <div className="mb-2 flex items-center gap-3"><EventIcon eventId={ev.id} size={44} /><p className="text-sm text-muted"><span className="font-medium uppercase tracking-wide">{topicOf(ev.id).tag}</span><br />{ev.title}</p></div>
      <PageTitle title={ev.text} />
      {ev.settled ? (
        <div className="-mt-4 mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#cfd6df] bg-[#eef1f5] px-4 py-3 text-sm text-[#3c4655]">
          <AnsweredBadge />
          <span>This is a <b>past question</b>. The {ev.settles} answered it{ev.fact ? `: ${ev.fact}` : "."}</span>
          {ev.practice && ev.strikes.some((x) => x.executions.length > 0) && <span>Your predictions here are practice: the numbers were already out when you made them, so they are not scored.</span>}
        </div>
      ) : (
        <div className="-mt-4 mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-risesoft px-4 py-3 text-sm">
          <OpenBadge event={ev} />
          <span>{ev.closesAt && today() > ev.closesAt ? `Closed for new predictions on ${day(ev.closesAt)}.` : ev.closesAt ? `Open for predictions until ${day(ev.closesAt)}.` : "Open for predictions."} The answer comes from the {ev.settles}.</span>
        </div>
      )}
      <MarketBoard key={`${ev.id}-${ev.settled}`} event={ev} />
    </div>
  );
}
