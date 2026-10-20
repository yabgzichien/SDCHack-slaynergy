"use client";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, DemoLabel, H, PageTitle, Skeleton } from "@/components/ui";
import type { Leaderboard, LeaderRow } from "@/lib/engine/world";

const KIND_TONE: Record<string, string> = { expert: "var(--accent)", sceptic: "var(--ink)", chaser: "var(--muted)", optimist: "var(--control)", noisy: "var(--control)" };
const KIND_DASH: Record<string, string | undefined> = { optimist: "4 3", chaser: "1 3" };
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

// One question: whose forecasts count most, and why?
export default function LeaderboardPage() {
  const { view } = useApp();
  const [lb, setLb] = useState<Leaderboard | null>(null);
  const [kind, setKind] = useState<string>("all");
  const [all, setAll] = useState(false);
  const release = view?.world.release;
  const orders = view?.world.user.orders;
  useEffect(() => {
    let on = true;
    fetch("/api/leaderboard", { cache: "no-store" }).then((r) => r.json()).then((d) => on && setLb(d)).catch(() => {});
    return () => { on = false; };
  }, [release, orders]);

  const rows = useMemo(() => (lb ? lb.rows.filter((r) => kind === "all" || r.kind === lb.kinds.find((k) => k.kind === kind)?.label || (kind === "you" && r.you)) : []), [lb, kind]);
  if (!lb || !view) return <Skeleton lines={8} />;
  const you = lb.rows.find((r) => r.you)!;
  const ranked = lb.rows.filter((r) => r.rank !== null).length;
  const best = [...lb.kinds].sort((a, b) => b.influence - a.influence)[0];
  const worst = [...lb.kinds].sort((a, b) => a.influence - b.influence)[0];
  const shown = all ? rows : rows.slice(0, 25);
  const history = lb.history.map((h) => ({ q: h.q === "start" ? "Start" : h.q.replace("Q", " Q"), ...h.byKind }));

  return (
    <div>
      <PageTitle title={you.rank ? `You rank ${ord(you.rank)} of ${ranked} forecasters.` : `${best.label[0].toUpperCase()}${best.label.slice(1)}s hold ${best.influence.toFixed(1)}× the average influence.`}>
        The more accurate a forecaster has been, the more weight their trades carry. {worst.label[0].toUpperCase()}{worst.label.slice(1)}s, the least accurate, are down to {worst.influence.toFixed(2)}×.
      </PageTitle>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Ranked by accuracy</h2>
            <DemoLabel />
          </div>
          <div className="scroll-x -mx-1 mb-3 flex gap-1.5 px-1 pb-1" role="group" aria-label="Filter by type">
            {[{ id: "all", label: "Everyone" }, { id: "you", label: "You" }, ...lb.kinds.map((k) => ({ id: k.kind, label: `${k.label}s` }))].map((f) => (
              <button key={f.id} onClick={() => { setKind(f.id); setAll(false); }} aria-pressed={kind === f.id}
                className={`press min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-sm ${kind === f.id ? "bg-primary text-primaryink" : "bg-surface2 hover:bg-control/60"}`}>{f.label}</button>
            ))}
          </div>
          <div className="scroll-x">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Forecasters ranked by Brier score, lowest first</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-2 pr-2 font-normal">Rank</th>
                  <th className="py-2 pr-2 font-normal">Forecaster</th>
                  <th className="py-2 pr-2 text-right font-normal">Accuracy (Brier)</th>
                  <th className="py-2 pr-2 text-right font-normal">Questions</th>
                  <th className="py-2 pr-2 font-normal">Influence</th>
                  {lb.released && <th className="py-2 text-right font-normal">Change</th>}
                </tr>
              </thead>
              <tbody>
                {kind === "all" && !shown.includes(you) && <RowView r={you} released={lb.released} max={6} />}
                {shown.map((r) => <RowView key={r.id} r={r} released={lb.released} max={6} />)}
              </tbody>
            </table>
          </div>
          {rows.length > 25 && <div className="mt-3"><Btn variant="quiet" onClick={() => setAll(!all)}>{all ? "Show the top 25" : `Show all ${rows.length}`}</Btn></div>}
          <p className="mt-3 text-sm text-muted">Brier score: the average squared gap between the chance given and what happened (0 is perfect; always saying 50% scores 0.25). Simulated forecasters are scored on {lb.rows[0]?.questions ?? 0} questions, replayed from real past releases{lb.released ? " plus the 2026 Q2 release" : ""}.</p>
        </Card>

        <div className="space-y-4 lg:col-span-4">
          <Card>
            <H>How influence works</H>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Everyone starts with influence 1.</li>
              <li>When a question settles, each forecaster&apos;s influence is multiplied by e<sup>−{lb.eta}×Brier</sup>: a confident right answer keeps almost all of it, a confident wrong one loses most.</li>
              <li>Influences are rescaled so the crowd averages 1, and extreme values are capped so no one forecaster can dominate.</li>
              <li>Influence is the budget a forecaster trades with, so accurate forecasters move prices more.</li>
            </ol>
            <p className="mt-3 text-sm text-muted">This is the Hedge rule, an online-learning method for combining forecasters.</p>
          </Card>
          <Card tone={you.rank ? "accent" : undefined}>
            <H>You</H>
            {you.brier === null ? (
              <p className="text-sm">Your forecasts are scored when the new data is released. Your forecast on a question is the chance you leave its headline line at after your last trade. A question you do not trade counts as 50%.</p>
            ) : (
              <dl className="num space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Accuracy (Brier)</dt><dd>{you.brier.toFixed(3)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Questions you traded</dt><dd>{view.world.you.traded} of {you.questions}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Influence</dt><dd>{you.influence.toFixed(2)}×</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Largest order allowed</dt><dd>{view.world.you.maxOrder} points</dd></div>
              </dl>
            )}
            <div className="mt-3"><Btn href="/market" variant="ghost">Make a forecast</Btn></div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <H sub="Average influence of each type after every replayed quarter. Everyone starts at 1.">Influence follows accuracy over time</H>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="h-64 min-w-0" role="img" aria-label="Line chart of average influence by forecaster type over the replayed quarters">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="q" tick={{ fontSize: 11, fill: "var(--muted)" }} interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)}×`, lb.kinds.find((k) => k.kind === n)?.label ?? String(n)]} contentStyle={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 12 }} />
                {lb.kinds.map((k) => <Line key={k.kind} dataKey={k.kind} type="monotone" stroke={KIND_TONE[k.kind]} strokeDasharray={KIND_DASH[k.kind]} strokeWidth={k.kind === best.kind ? 2.5 : 1.5} dot={false} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <table className="num self-center text-sm">
            <caption className="sr-only">Average Brier score and influence by type</caption>
            <thead><tr className="text-left text-xs text-muted"><th className="pb-1 font-normal">Type</th><th className="pb-1 text-right font-normal">Brier</th><th className="pb-1 text-right font-normal">Influence</th></tr></thead>
            <tbody>
              {[...lb.kinds].sort((a, b) => a.brier - b.brier).map((k) => (
                <tr key={k.kind}>
                  <td className="py-1 pr-3"><span className="inline-flex items-center gap-2"><svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={KIND_TONE[k.kind]} strokeWidth={k.kind === best.kind ? 2.5 : 1.5} strokeDasharray={KIND_DASH[k.kind]} /></svg>{k.label}s</span></td>
                  <td className="py-1 pr-3 text-right">{k.brier.toFixed(3)}</td>
                  <td className="py-1 text-right">{k.influence.toFixed(2)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function RowView({ r, released, max }: { r: LeaderRow; released: boolean; max: number }) {
  const d = r.influence - r.influenceBefore;
  return (
    <tr className={`border-t border-line ${r.you ? "bg-accentsoft" : ""}`}>
      <td className="num py-2.5 pr-2">{r.rank ?? "–"}</td>
      <td className="py-2.5 pr-2">
        <p className={r.you ? "font-medium" : ""}>{r.you ? "You" : `Forecaster ${r.id.slice(1)}`}</p>
        <p className="text-xs text-muted">{r.you ? "Untraded questions count as 50%" : r.kind}</p>
      </td>
      <td className="num py-2.5 pr-2 text-right">{r.brier === null ? "–" : r.brier.toFixed(3)}</td>
      <td className="num py-2.5 pr-2 text-right">{r.questions}</td>
      <td className="py-2.5 pr-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-surface2" aria-hidden><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(1, r.influence / max) * 100}%` }} /></div>
          <span className="num">{r.influence.toFixed(2)}×</span>
        </div>
      </td>
      {released && <td className={`num py-2.5 text-right ${Math.abs(d) < 0.005 ? "text-muted" : d > 0 ? "text-rise" : "text-fall"}`}>{Math.abs(d) < 0.005 ? "0.00" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}`}</td>}
    </tr>
  );
}
