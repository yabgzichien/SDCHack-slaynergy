"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { MarketBoard } from "@/components/MarketBoard";
import { Btn, PageTitle, Skeleton, questionPlain } from "@/components/ui";

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
        <PageTitle title="This question is no longer open.">It may have settled when the new data was released.</PageTitle>
        <Btn href="/market">All questions</Btn>
      </div>
    );
  }
  return (
    <div>
      <Link href="/market" className="mb-4 inline-block text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">All questions</Link>
      <PageTitle title={ev.title}>{questionPlain(ev.id) ? `${questionPlain(ev.id)}. ` : ""}{ev.text}</PageTitle>
      <MarketBoard key={`${ev.id}-${ev.settled}`} event={ev} />
    </div>
  );
}
