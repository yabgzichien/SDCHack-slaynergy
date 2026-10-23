"use client";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, DemoLabel, H, More, PageTitle, Skeleton } from "@/components/ui";
import type { Leaderboard, LeaderRow } from "@/lib/engine/world";
import { MarketTabs } from "@/components/MarketTabs";

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
  const history = lb.history.map((h) => ({ q: h.q === "start" ? "Start" : h.q.replace("Q", " Q"), ...h.byKind }));

  const quarter = (q: string) => `${["Jan", "Apr", "Jul", "Oct"][Number(q[5]) - 1]} ${q.slice(0, 4)}`;
  const quarterEnd = (q: string) => `${["Mar", "Jun", "Sep", "Dec"][Number(q[5]) - 1]} ${q.slice(0, 4)}`;
  const top = rows.slice(0, 10);
  const shown = all ? rows : top;
  const pinYou = kind === "all" && !shown.includes(you);

  return (
    <div>
      <MarketTabs rank={you.rank ? `#${you.rank}` : null} />
      <PageTitle title={you.rank ? `You are ${ord(you.rank)} out of ${ranked} players.` : "Who forecasts best?"}
        aside={<DemoLabel />}>
        Players who were right more often get a bigger vote in Jobbery&apos;s forecast. Every computer-made player earned its record on {lb.track.questions} real past releases, {quarter(lb.track.from)} to {quarterEnd(lb.track.to)}, scored in order before you arrived.
      </PageTitle>

      <Card>
        <H sub={`Everyone started with a normal vote (1×). After ${lb.track.quarters} quarters of real releases: ${best.label}s count ${best.influence.toFixed(1)}×, ${worst.label}s ${worst.influence.toFixed(2)}×.`}>Which kind of player earned the vote</H>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="h-64 min-w-0" role="img" aria-label="Line chart: how much each type of player's vote counted, quarter by quarter">
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
            <thead><tr className="text-left text-xs text-muted"><th className="pb-1 font-normal">Type</th><th className="pb-1 text-right font-normal">Error score</th><th className="pb-1 text-right font-normal">Vote</th></tr></thead>
            <tbody>
              {[...lb.kinds].sort((a, b) => a.brier - b.brier).map((k) => (
                <tr key={k.kind}>
                  <td className="py-1 pr-3"><span className="inline-flex items-center gap-2"><svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={KIND_TONE[k.kind]} strokeWidth={k.kind === best.kind ? 2.5 : 1.5} strokeDasharray={KIND_DASH[k.kind]} /></svg>{k.label}s ({k.count})</span></td>
                  <td className="py-1 pr-3 text-right">{k.brier.toFixed(3)}</td>
                  <td className="py-1 text-right">{k.influence.toFixed(2)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <More summary="Why do careful experts win?">
          <p>Each type reads the same public data in its own way. Careful experts were built to know one extra thing: AI test scores close to 100% cannot keep rising at the old pace. Nobody told the scoring rule which type that was. It found them from their results alone, which is the check that the rule works.</p>
          <p>The other players are computer-made for this demo. In real use, advisors, HR teams and job seekers would take their place and earn their vote the same way.</p>
        </More>
      </Card>

      <div className="my-4 grid gap-4 lg:grid-cols-2">
        <Card tone={you.rank ? "accent" : undefined}>
          <H>You</H>
          {you.brier === null ? (
            <p className="text-sm">You start with a normal vote (1×). Your guesses are scored when the real numbers come out: DOSM on 17 Nov 2026 for the job question, Epoch AI in Jan 2027 for the AI questions. An open question you skip counts as a 50/50 guess.</p>
          ) : (
            <dl className="num space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Rank</dt><dd>{you.rank} of {ranked}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Error score (0 is perfect)</dt><dd>{you.brier.toFixed(3)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Questions you guessed on</dt><dd>{view.world.you.traded} of {you.questions}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Your vote counts</dt><dd>{you.influence.toFixed(2)}×</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Most points per guess</dt><dd>{view.world.you.maxOrder} points</dd></div>
            </dl>
          )}
          <div className="mt-3"><Btn href="/market" variant="ghost">Make a guess</Btn></div>
        </Card>
        <Card>
          <H>How the vote works</H>
          <p className="text-sm">Each time real numbers come out, players who were sure and right keep their vote, and players who were sure and wrong lose most of it. A bigger vote means more points to guess with, so good players move the Yes % more. No one can count more than {lb.influenceMax}× a normal vote.</p>
          <More summary="For experts: the formula">
            <p>Each forecaster&apos;s influence is multiplied by e<sup>−{lb.eta}×Brier</sup> when a question settles. One common scale is then chosen so the crowd averages 1 with every forecaster between 0.05× and {lb.influenceMax}×. This is the Hedge rule, an online-learning method for combining forecasters.</p>
            <p>Brier score: the average squared gap between the chance given and what happened. 0 is perfect; always saying 50% scores 0.25.</p>
          </More>
        </Card>
      </div>

      <Card className="min-w-0">
        <h2 className="mb-3 text-base font-semibold">{all ? "Every player, best first" : "Top 10"}</h2>
        <div className="scroll-x -mx-1 mb-3 flex gap-1.5 px-1 pb-1" role="group" aria-label="Filter by type">
          {[{ id: "all", label: "Everyone" }, { id: "you", label: "You" }, ...lb.kinds.map((k) => ({ id: k.kind, label: `${k.label}s` }))].map((f) => (
            <button key={f.id} onClick={() => { setKind(f.id); setAll(false); }} aria-pressed={kind === f.id}
              className={`press min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-sm ${kind === f.id ? "bg-primary text-primaryink" : "bg-surface2 hover:bg-control/60"}`}>{f.label}</button>
          ))}
        </div>
        <div className="scroll-x">
          <table className="w-full text-sm">
            <caption className="sr-only">Forecasters ranked by Brier score, lowest first</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 pr-2 font-normal">Rank</th>
                <th className="py-2 pr-2 font-normal">Player</th>
                <th className="py-2 pr-2 text-right font-normal">Error score</th>
                <th className="hidden py-2 pr-2 text-right font-normal sm:table-cell">Questions</th>
                <th className="py-2 pr-2 font-normal">Vote counts</th>
                {lb.released && <th className="hidden py-2 text-right font-normal sm:table-cell">Change</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => <RowView key={r.id} r={r} released={lb.released} max={lb.influenceMax} />)}
              {pinYou && <RowView r={you} released={lb.released} max={lb.influenceMax} />}
            </tbody>
          </table>
        </div>
        {rows.length > 10 && <div className="mt-3"><Btn variant="quiet" onClick={() => setAll(!all)}>{all ? "Show the top 10" : `Show all ${rows.length}`}</Btn></div>}
        <p className="mt-3 text-sm text-muted">Error score: how far a player&apos;s guesses were from what really happened. 0 is perfect; always guessing 50/50 scores 0.25. Computer-made players are scored on {lb.track.questions} past questions with real answers{lb.released ? ", plus the Apr to Jun 2026 numbers" : ""}.</p>
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
        <p className={r.you ? "font-medium" : ""}>{r.you ? "You" : `Player ${r.id.slice(1)}`}</p>
        <p className="text-xs text-muted">{r.you ? "Skipped questions count as 50/50" : r.kind}</p>
      </td>
      <td className="num py-2.5 pr-2 text-right">{r.brier === null ? "–" : r.brier.toFixed(3)}</td>
      <td className="num hidden py-2.5 pr-2 text-right sm:table-cell">{r.questions}</td>
      <td className="py-2.5 pr-2">
        <div className="flex items-center gap-2">
          <div className="hidden h-1.5 w-20 rounded-full bg-surface2 sm:block" aria-hidden><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(1, r.influence / max) * 100}%` }} /></div>
          <span className="num">{r.influence.toFixed(2)}×</span>
        </div>
      </td>
      {released && <td className={`num hidden py-2.5 text-right sm:table-cell ${Math.abs(d) < 0.005 ? "text-muted" : d > 0 ? "text-rise" : "text-fall"}`}>{Math.abs(d) < 0.005 ? "0.00" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}`}</td>}
    </tr>
  );
}
