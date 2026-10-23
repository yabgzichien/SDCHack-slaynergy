"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { Card, PageTitle, Skeleton, SourceChip, questionPlain } from "@/components/ui";
import { MarketTabs } from "@/components/MarketTabs";
import { EventIcon, topicOf } from "@/components/MarketCards";
import { Briefcase, CalendarClock, ChevronRight, Cpu } from "lucide-react";
import { series, sourceById } from "@/lib/engine/data";
import type { EventView } from "@/lib/engine/world";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const quarterSpan = (q: string) => { const i = Number(q[5]) - 1; return `${MONTHS[i * 3]} to ${MONTHS[i * 3 + 2]} ${q.slice(0, 4)}`; };
const quarterEnd = (q: string) => `${MONTHS[Number(q[5]) * 3 - 1]} ${q.slice(0, 4)}`;
const seriesOf = (e: EventView) => e.id.split("-")[0];

// Who made each benchmark the open AI questions settle on, and what it tests. Epoch AI collects the results.
const BENCHMARK: Record<string, { maker: string; what: string }> = {
  metr: { maker: "METR (Model Evaluation & Threat Research), an independent non-profit research group", what: "How long a task, measured in the time a skilled person would need, the best AI can finish on its own half of the time." },
  swe: { maker: "researchers at Princeton University; the Verified set of 500 problems was checked by software engineers with OpenAI", what: "Real bugs reported on GitHub in popular Python projects. The AI must change the code so the project's own tests pass." },
  hle: { maker: "the Center for AI Safety and Scale AI", what: "About 2,500 very hard questions written by experts in many subjects, chosen because AI got them wrong when they were written." },
  tbench: { maker: "researchers at Stanford University and the Laude Institute", what: "Practical jobs done by typing commands into a computer terminal, such as setting up software or cleaning up files." },
};

function latestEpoch(id: string) {
  const e = series.epoch[id];
  const last = e.frontier[e.frontier.length - 1];
  if (e.unit.startsWith("doubl")) {
    const minutes = 2 ** last.v;
    return { value: minutes >= 90 ? `about ${Math.round(minutes / 60)} hours` : `about ${Math.round(minutes)} minutes`, q: last.q };
  }
  return { value: `${last.v.toFixed(1)}%`, q: last.q };
}

const DOSM_TINT = "#0ea5e9", EPOCH_TINT = "#8b5cf6";
const daysUntil = (iso: string) => Math.ceil((new Date(`${iso.slice(0, 10)}T00:00:00+08:00`).getTime() - Date.now()) / 86400000);

// One question: where do the answers to the prediction questions come from, and can I check them myself?
export default function SourcesPage() {
  const { view } = useApp();
  if (!view) return <Skeleton lines={6} />;
  const open = view.world.events;
  const dosmOpen = open.filter((e) => seriesOf(e) === "dosm");
  const epochOpen = open.filter((e) => seriesOf(e) !== "dosm");
  const epochIds = [...new Set(epochOpen.map(seriesOf))];
  const dosm = sourceById.dosm, epoch = sourceById.epoch;
  const qs = series.dosm.quarters;
  const now = qs[qs.length - 1], before = qs[qs.length - 2];
  const published = series.dosm.publishedAt[now.q];
  const change = now.clerical_share - before.clerical_share;
  const dosmDays = dosm.next ? daysUntil(dosm.next) : null;

  return (
    <div>
      <MarketTabs />
      <PageTitle title="Where the answers come from">
        Official public releases settle every question. Not us, and not the players.
      </PageTitle>

      <section aria-labelledby="calendar" className="rise-in mb-6">
        <h2 id="calendar" className="mb-3 flex items-center gap-2 text-base font-semibold"><CalendarClock size={18} aria-hidden className="text-cue" />When the next answers come out</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          <li className="lift flex items-center gap-4 rounded-[22px] p-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_22px_rgb(14_165_233/0.28)]" style={{ background: `linear-gradient(135deg, ${DOSM_TINT}, #0369a1)` }}>
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20"><Briefcase size={26} aria-hidden /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Malaysia jobs · DOSM</p>
              <p className="num text-2xl font-semibold tracking-[-0.02em]">{dosm.next ? day(dosm.next) : "Next quarter"}</p>
              <p className="text-sm opacity-90">{dosmDays !== null && dosmDays > 0 ? `In ${dosmDays} days · settles ${dosmOpen.length} question${dosmOpen.length === 1 ? "" : "s"}` : `Settles ${dosmOpen.length} question${dosmOpen.length === 1 ? "" : "s"}`}</p>
            </div>
          </li>
          <li className="lift flex items-center gap-4 rounded-[22px] p-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_22px_rgb(139_92_246/0.28)]" style={{ background: `linear-gradient(135deg, ${EPOCH_TINT}, #5b21b6)` }}>
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20"><Cpu size={26} aria-hidden /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-90">AI ability · Epoch AI</p>
              <p className="num text-2xl font-semibold tracking-[-0.02em]">Jan 2027</p>
              <p className="text-sm opacity-90">Best score by 31 Dec vs by 30 Sep · settles {epochOpen.length} questions</p>
            </div>
          </li>
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card tone="raised" className="rise-in [animation-delay:80ms]">
          <div className="-mt-1 mb-3 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${DOSM_TINT}, ${DOSM_TINT}00)` }} aria-hidden />
          <div className="flex items-start gap-3">
            <EventIcon eventId="dosm-" size={44} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: DOSM_TINT }}>Malaysia jobs questions</p>
              <h2 className="text-xl font-semibold tracking-[-0.015em]">Department of Statistics Malaysia</h2>
              <p className="text-sm text-muted">Jabatan Perangkaan Malaysia (DOSM), the government&apos;s official statistics agency.</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.8)]" style={{ background: `linear-gradient(180deg, ${DOSM_TINT}1f, ${DOSM_TINT}0d)` }}>
            <p className="text-sm text-muted">Office admin jobs, out of every 100 online job ads ({quarterSpan(now.q)})</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3"><span className="num text-5xl font-semibold leading-none tracking-[-0.03em]">{now.clerical_share.toFixed(1)}</span><span className={`num text-sm font-semibold ${change < 0 ? "text-fall" : change > 0 ? "text-rise" : "text-muted"}`}>{change === 0 ? "same as" : `${change < 0 ? "▼" : "▲"} ${Math.abs(change).toFixed(1)} from`} {before.clerical_share.toFixed(1)} the quarter before</span></p>
          </div>
          <p className="mt-3 text-sm">Every quarter, DOSM counts the job ads posted online in Malaysia and sorts them into job groups. We use one number: how many of every 100 ads are for office admin jobs (clerks, data entry, receptionists).</p>

          <dl className="num mt-3 grid grid-cols-2 gap-2 text-sm">
            {published && <div className="rounded-xl bg-surface2/60 px-3 py-2"><dt className="text-xs text-muted">Last published</dt><dd className="font-medium">{day(published)}</dd></div>}
            {dosm.next && <div className="rounded-xl px-3 py-2 ring-2 ring-cue" style={{ background: "var(--cue-soft)" }}><dt className="text-xs text-cueink">Next release</dt><dd className="font-semibold text-cueink">{day(dosm.next)}</dd></div>}
          </dl>

          {dosmOpen.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Open questions it will settle</p>
              <ul className="space-y-1.5 text-sm">{dosmOpen.map((e) => <li key={e.id}><Link href={`/market/${encodeURIComponent(e.id)}`} className="press flex min-h-11 items-center justify-between gap-2 rounded-xl bg-surface2/60 px-3 py-2 hover:bg-surface2"><span>{e.title}</span><ChevronRight size={16} aria-hidden className="shrink-0 text-muted" /></Link></li>)}</ul>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SourceChip name="DOSM Job Market Insights" date={`retrieved ${day(dosm.retrieved)}`} url={dosm.url} />
            <span className="text-xs text-muted">Licence: {dosm.licence}</span>
          </div>
        </Card>

        <Card tone="raised" className="rise-in [animation-delay:160ms]">
          <div className="-mt-1 mb-3 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${EPOCH_TINT}, ${EPOCH_TINT}00)` }} aria-hidden />
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${EPOCH_TINT}, ${EPOCH_TINT}bb)` }} aria-hidden><Cpu size={22} /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: EPOCH_TINT }}>AI ability questions</p>
              <h2 className="text-xl font-semibold tracking-[-0.015em]">Epoch AI</h2>
              <p className="text-sm text-muted">An independent research group that tracks how fast AI is improving and publishes the results openly.</p>
            </div>
          </div>
          <p className="mt-4 text-sm">Epoch AI collects AI models&apos; scores on public tests, called benchmarks, made by other research groups. Each question uses the best score any model has reached on one benchmark.</p>

          <p className="mb-2 mt-4 text-sm font-semibold">The benchmarks behind the open questions</p>
          <ul className="space-y-2 text-sm">
            {epochIds.map((id) => {
              const b = BENCHMARK[id], l = latestEpoch(id), tint = topicOf(`${id}-`).tint;
              return (
                <li key={id} className="lift rounded-2xl px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.85)]" style={{ background: `linear-gradient(180deg, ${tint}1c, ${tint}0a)`, boxShadow: `inset 0 0 0 1px ${tint}26, inset 0 1px 0 rgb(255 255 255 / 0.85)` }}>
                  <div className="flex items-start gap-3">
                    <EventIcon eventId={`${id}-`} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{series.epoch[id].name}</p>
                      {questionPlain(`${id}-`) && <p className="text-muted">{questionPlain(`${id}-`)}</p>}
                    </div>
                    <div className="shrink-0 text-right"><p className="num text-lg font-semibold tracking-[-0.02em]" style={{ color: tint }}>{l.value}</p><p className="text-xs text-muted">best by {quarterEnd(l.q)}</p></div>
                  </div>
                  {b && <><p className="mt-2">{b.what}</p><p className="mt-1 text-xs text-muted">Made by {b.maker}.</p></>}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SourceChip name="Epoch AI Benchmarking Hub" date={`retrieved ${day(epoch.retrieved)}`} url={epoch.url} />
            <span className="text-xs text-muted">Licence: {epoch.licence}</span>
          </div>
        </Card>
      </div>

      <p className="mt-6 rounded-2xl bg-surface px-4 py-3 text-sm text-muted">Other data the app uses, such as the ILO&apos;s AI exposure scores and the Anthropic Economic Index, does not settle questions. It is listed under <Link href="/trust" className="underline decoration-control underline-offset-2 hover:text-ink">Our approach</Link>.</p>
    </div>
  );
}
