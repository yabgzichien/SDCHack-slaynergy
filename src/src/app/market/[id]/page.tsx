"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { MarketBoard } from "@/components/MarketBoard";
import { AnsweredBadge } from "@/components/MarketCards";
import { Btn, PageTitle, Skeleton } from "@/components/ui";

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
      <PageTitle title={ev.text} titleAction={<details className="group relative"><summary className="grid size-8 cursor-pointer list-none place-items-center rounded-full border border-control text-muted hover:bg-surface focus-visible:outline-2 [&::-webkit-details-marker]:hidden" aria-label="About these predictions" title="About these predictions"><CircleAlert size={18} aria-hidden /></summary><span className="absolute right-0 z-30 mt-2 block w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-raised p-4 text-left text-sm font-normal leading-6 text-ink shadow-lg">Most activity here is simulated by computer players. Official releases—not player predictions—determine the answer.</span></details>} wide />
      {ev.settled ? (
        <div className="-mt-4 mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#cfd6df] bg-[#eef1f5] px-4 py-3 text-sm text-[#3c4655]">
          <AnsweredBadge />
          <span>This is a <b>past question</b>. The {ev.settles} answered it{ev.fact ? `: ${ev.fact}` : "."}</span>
          {ev.practice && ev.strikes.some((x) => x.executions.length > 0) && <span>Your predictions here are practice: the numbers were already out when you made them, so they are not scored.</span>}
        </div>
      ) : null}
      <MarketBoard key={`${ev.id}-${ev.settled}`} event={ev} />
    </div>
  );
}
