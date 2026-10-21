"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { MarketBoard } from "@/components/MarketBoard";
import { EventIcon, topicOf } from "@/components/MarketCards";
import { Btn, PageTitle, Skeleton } from "@/components/ui";

// One question: should I buy Yes or No on this release?
export default function MarketEventPage() {
  const { view } = useApp();
  const { id } = useParams<{ id: string }>();
  if (!view) return <Skeleton lines={6} />;
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
      <MarketBoard key={`${ev.id}-${ev.settled}`} event={ev} />
    </div>
  );
}
