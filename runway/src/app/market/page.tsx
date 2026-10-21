"use client";
import { useEffect } from "react";
import { useApp } from "@/components/AppProvider";
import { Card, Chip, DemoLabel, LinkRow, PageTitle, Skeleton, questionPlain } from "@/components/ui";
import type { EventView } from "@/lib/engine/world";
import { ForecastDetails } from "@/components/ForecastDetails";

// One question: what can I forecast right now?
export default function MarketPage() {
  const { view, refresh } = useApp();
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000); return () => window.clearInterval(id); }, [refresh]);
  if (!view) return <Skeleton lines={5} />;
  const w = view.world;
  const released = w.release === 1;
  return (
    <div>
      <PageTitle title={`${w.events.length} questions, answered by the next official figures.`}
        aside={<div className="num text-right text-sm"><p>{w.user.balance.toFixed(0)} points</p><p className="text-muted">your say: {w.you.influence.toFixed(2)}×</p></div>}>
        Bet Yes or No with points, never money. Each share pays 1 point if you are right. The more accurate you are, the more say you get in the forecast.
      </PageTitle>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{released ? "Open, answered by the July to September 2026 figures" : "Open, answered by the April to June 2026 figures"}</h2>
          <DemoLabel />
        </div>
        <ul className="space-y-2">{w.events.map((e) => <li key={e.id}><EventRow e={e} /></li>)}</ul>
        <p className="mt-4 text-sm text-muted">About 200 simulated forecasters bet alongside you, so the chances move while you watch.</p>
      </Card>

      {released && w.settledEvents.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-3 text-base font-semibold">Answered by the April to June 2026 figures</h2>
          <ul className="space-y-2">{w.settledEvents.map((e) => <li key={e.id}><EventRow e={e} /></li>)}</ul>
        </Card>
      )}
      <ForecastDetails />
    </div>
  );
}

function EventRow({ e }: { e: EventView }) {
  const head = e.strikes.find((s) => s.base)!;
  const held = e.strikes.some((s) => s.position.yes > 1e-6 || s.position.no > 1e-6);
  return (
    <LinkRow href={`/market/${encodeURIComponent(e.id)}`}
      aside={e.settled
        ? <Chip tone={head.settled?.outcome ? "rise" : "fall"}>{head.settled?.outcome ? "Yes" : "No"}</Chip>
        : <><p className="num text-xl leading-none">{Math.round(head.price * 100)}%</p><p className="text-xs text-muted">chance of Yes</p></>}>
      <p className="font-medium">{e.title}</p>
      {questionPlain(e.id) && <p className="text-sm">{questionPlain(e.id)}</p>}
      <p className="text-sm text-muted">{head.label}{held ? " · you have a position" : ""}</p>
      {e.fact && <p className="num text-sm text-muted">{e.fact}</p>}
    </LinkRow>
  );
}
