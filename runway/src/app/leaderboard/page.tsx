"use client";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, DemoLabel, H, More, PageTitle, Skeleton } from "@/components/ui";
import type { Leaderboard, LeaderRow } from "@/lib/engine/world";
import { MarketTabs } from "@/components/MarketTabs";
import { ChevronRight, Trophy, UserRound } from "lucide-react";

// One colour per kind of player, shared by the chart, the table and the filter chips.
const KIND_TONE: Record<string, string> = { expert: "#3f7fc4", sceptic: "#6a5fc1", chaser: "#d08a1e", optimist: "#c4614a", noisy: "#8a94a3" };
const KIND_DASH: Record<string, string | undefined> = {};
const MEDAL = ["#e0a92e", "#9aa6b2", "#c07a45"];
const kindKey = (lb: Leaderboard, label: string) => lb.kinds.find((k) => k.label === label)?.kind ?? "";
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

  const podium = lb.rows.filter((r) => r.rank !== null && !r.you).slice(0, 3);

  return (
    <div className="leaderboard-page">
      <MarketTabs rank={you.rank ? `#${you.rank}` : null} />
      <PageTitle title={you.rank ? `You are ${ord(you.rank)} of ${ranked} players` : "Who predicts best?"} aside={<DemoLabel />}>
        Players who are right more often get a bigger vote in Jobbery&apos;s forecast.
      </PageTitle>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card tone="raised" className="ring-2 ring-cue">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-cueink"><span className="grid size-7 place-items-center rounded-full bg-cue text-white"><UserRound size={15} aria-hidden /></span>Your score</p>
          {you.brier === null ? (
            <>
              <p className="text-2xl font-semibold leading-tight">Not scored yet</p>
              <p className="mt-2 text-sm text-muted">You start with a normal vote (1×). Your predictions are scored when the real numbers come out: DOSM on 17 Nov 2026, Epoch AI in Jan 2027. A question you skip counts as a 50/50 prediction.</p>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-cuesoft p-3"><p className="num text-2xl font-bold text-cueink">#{you.rank}</p><p className="text-xs text-muted">of {ranked}</p></div>
              <div className="rounded-2xl bg-lanelearnsoft p-3"><p className="num text-2xl font-bold text-lanelearnink">{you.brier.toFixed(3)}</p><p className="text-xs text-muted">error score</p></div>
              <div className="rounded-2xl bg-risesoft p-3"><p className="num text-2xl font-bold text-rise">{you.influence.toFixed(2)}×</p><p className="text-xs text-muted">your vote</p></div>
            </div>
          )}
          {you.brier !== null && <p className="num mt-3 text-sm text-muted">You made predictions on {view.world.you.traded} of {you.questions} questions · up to {view.world.you.maxOrder} points per prediction.</p>}
          <div className="mt-4"><Btn href="/market#open-questions">Make a prediction <ChevronRight size={16} aria-hidden /></Btn></div>
        </Card>

        <Card>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Trophy size={18} aria-hidden className="text-gold" />Top 3</p>
          <ol className="grid grid-cols-3 items-end gap-2">
            {[1, 0, 2].map((i) => {
              const r = podium[i];
              if (!r) return <li key={i} />;
              return (
                <li key={r.id} className="flex flex-col items-center text-center">
                  <span className="grid size-12 place-items-center rounded-full text-lg font-bold text-white shadow-[0_3px_10px_rgb(0_0_0/0.18)]" style={{ background: MEDAL[i] }}>{i + 1}</span>
                  <p className="mt-2 text-sm font-medium">Player {r.id.slice(1)}</p>
                  <p className="text-xs font-medium" style={{ color: KIND_TONE[kindKey(lb, r.kind)] }}>{r.kind}</p>
                  <div className="mt-2 w-full rounded-t-xl px-2 pt-2 text-white" style={{ background: MEDAL[i], height: [96, 72, 56][i] }}>
                    <p className="num text-sm font-bold">{r.influence.toFixed(2)}×</p>
                    <p className="text-[10px] opacity-90">vote</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <Card className="mt-4 min-w-0">
        <h2 className="mb-3 text-base font-semibold">{all ? "Every player, best first" : "Top 10"}</h2>
        <div className="scroll-x -mx-1 mb-3 flex gap-1.5 px-1 pb-1" role="group" aria-label="Filter by type">
          {[{ id: "all", label: "Everyone", tone: "" }, { id: "you", label: "You", tone: "var(--cue)" }, ...lb.kinds.map((k) => ({ id: k.kind, label: `${k.label}s`, tone: KIND_TONE[k.kind] }))].map((f) => (
            <button key={f.id} onClick={() => { setKind(f.id); setAll(false); }} aria-pressed={kind === f.id}
              className={`press inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm ${kind === f.id ? "bg-ink text-white" : "bg-surface2 hover:bg-control/60"}`}>
              {f.tone && <span className="size-2.5 rounded-full" style={{ background: f.tone }} aria-hidden />}{f.label}
            </button>
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
              {shown.map((r) => <RowView key={r.id} r={r} released={lb.released} max={lb.influenceMax} tone={KIND_TONE[kindKey(lb, r.kind)]} />)}
              {pinYou && <RowView r={you} released={lb.released} max={lb.influenceMax} tone="var(--cue)" />}
            </tbody>
          </table>
        </div>
        {rows.length > 10 && <div className="mt-3"><Btn variant="quiet" onClick={() => setAll(!all)}>{all ? "Show the top 10" : `Show all ${rows.length}`}</Btn></div>}
        <p className="mt-3 text-sm text-muted">Error score: how far predictions were from what really happened. 0 is perfect; always predicting 50/50 scores 0.25. Computer-made players earned their record on {lb.track.questions} real past releases, {quarter(lb.track.from)} to {quarterEnd(lb.track.to)}{lb.released ? ", plus the Apr to Jun 2026 numbers" : ""}.</p>
      </Card>

      <Card className="mt-4">
        <H sub={`Everyone started at 1×. After ${lb.track.quarters} quarters of real releases: ${best.label}s count ${best.influence.toFixed(1)}×, ${worst.label}s ${worst.influence.toFixed(2)}×.`}>Which kind of player wins</H>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="h-64 min-w-0" role="img" aria-label="Line chart: how much each type of player's vote counted, quarter by quarter">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="q" tick={{ fontSize: 11, fill: "var(--muted)" }} interval="preserveStartEnd" minTickGap={24} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)}×`, lb.kinds.find((k) => k.kind === n)?.label ?? String(n)]} contentStyle={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 12 }} />
                {lb.kinds.map((k) => <Line key={k.kind} dataKey={k.kind} type="monotone" stroke={KIND_TONE[k.kind]} strokeDasharray={KIND_DASH[k.kind]} strokeWidth={k.kind === best.kind ? 3 : 1.8} dot={false} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 self-center text-sm">
            {[...lb.kinds].sort((a, b) => b.influence - a.influence).map((k) => (
              <li key={k.kind} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: `${KIND_TONE[k.kind]}18` }}>
                <span className="inline-flex items-center gap-2 font-medium" style={{ color: KIND_TONE[k.kind] }}><span className="size-2.5 rounded-full" style={{ background: KIND_TONE[k.kind] }} aria-hidden />{k.label}s <span className="font-normal text-muted">({k.count})</span></span>
                <span className="num font-semibold">{k.influence.toFixed(2)}×</span>
              </li>
            ))}
          </ul>
        </div>
        <More summary="Why do careful experts win?">
          <p>Each type reads the same public data in its own way. Careful experts were built to know one extra thing: AI test scores close to 100% cannot keep rising at the old pace. Nobody told the scoring rule which type that was. It found them from their results alone, which is the check that the rule works.</p>
          <p>The other players are computer-made for this demo. In real use, advisors, HR teams and job seekers would take their place and earn their vote the same way.</p>
        </More>
      </Card>

      <Card className="mt-4" tone="accent">
        <H>How the vote works</H>
        <ol className="grid gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-2xl bg-white/70 p-3"><b className="text-lanelearnink">1. Predict.</b> Put points on Yes or No before the real numbers come out.</li>
          <li className="rounded-2xl bg-white/70 p-3"><b className="text-laneaiink">2. Get scored.</b> Sure and right keeps your vote; sure and wrong loses most of it.</li>
          <li className="rounded-2xl bg-white/70 p-3"><b className="text-rise">3. Count more.</b> A bigger vote means more points per prediction, up to {lb.influenceMax}× a normal vote.</li>
        </ol>
        <More summary="For experts: the formula">
          <p>Each forecaster&apos;s influence is multiplied by e<sup>−{lb.eta}×Brier</sup> when a question settles. One common scale is then chosen so the crowd averages 1 with every forecaster between 0.05× and {lb.influenceMax}×. This is the Hedge rule, an online-learning method for combining forecasters.</p>
          <p>Brier score: the average squared gap between the chance given and what happened. 0 is perfect; always saying 50% scores 0.25.</p>
        </More>
      </Card>
    </div>
  );
}

function RowView({ r, released, max, tone }: { r: LeaderRow; released: boolean; max: number; tone?: string }) {
  const d = r.influence - r.influenceBefore;
  const medal = r.rank !== null && r.rank <= 3 && !r.you ? MEDAL[r.rank - 1] : null;
  return (
    <tr className={`border-t border-line ${r.you ? "bg-cuesoft font-medium" : ""}`}>
      <td className="num py-2.5 pr-2">{medal ? <span className="grid size-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: medal }}>{r.rank}</span> : r.rank ?? "–"}</td>
      <td className="py-2.5 pr-2">
        <p className="flex items-center gap-2">{tone && <span className="size-2.5 shrink-0 rounded-full" style={{ background: tone }} aria-hidden />}{r.you ? "You" : `Player ${r.id.slice(1)}`}</p>
        <p className="text-xs" style={{ color: r.you ? undefined : tone }}>{r.you ? "Skipped questions count as 50/50" : r.kind}</p>
      </td>
      <td className="num py-2.5 pr-2 text-right">{r.brier === null ? "–" : r.brier.toFixed(3)}</td>
      <td className="num hidden py-2.5 pr-2 text-right sm:table-cell">{r.questions}</td>
      <td className="py-2.5 pr-2">
        <div className="flex items-center gap-2">
          <div className="hidden h-1.5 w-20 rounded-full bg-surface2 sm:block" aria-hidden><div className="h-full rounded-full" style={{ width: `${Math.min(1, r.influence / max) * 100}%`, background: tone ?? "var(--accent)" }} /></div>
          <span className="num">{r.influence.toFixed(2)}×</span>
        </div>
      </td>
      {released && <td className={`num hidden py-2.5 text-right sm:table-cell ${Math.abs(d) < 0.005 ? "text-muted" : d > 0 ? "text-rise" : "text-fall"}`}>{Math.abs(d) < 0.005 ? "0.00" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}`}</td>}
    </tr>
  );
}
