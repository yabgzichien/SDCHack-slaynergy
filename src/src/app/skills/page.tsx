"use client";
import Link from "next/link";
import { Gauge, Layers, Rabbit, Snail } from "lucide-react";
import { FORECAST, type Speed } from "@/lib/speed";
import { useApp } from "@/components/AppProvider";
import { useT } from "@/components/I18nProvider";
import { useSpeed } from "@/components/useSpeed";
import { ExpiryAxis, ExpiryTrack } from "@/components/ExpiryTrack";
import { Btn, Card, Chip, Estimate, FUTURE_COLOR, More, NextRow, PageTitle, Skeleton, SourceChip, sdgName } from "@/components/ui";
import { SdgFocus } from "@/components/SdgFocus";
import { ReleaseInfo } from "@/components/ReleaseInfo";
import { SourceDisclosure } from "@/components/SourceDisclosure";
import { SdgIcon, sdgColor, sdgUrl } from "@/components/SdgIcon";
import { sdg as SDG_TARGETS } from "@/lib/engine/data";
import { focusGoals, goalOf, goalTint, orderByGoals, targetsByGoal, toggleGoal } from "@/lib/sdgFocus";

const SPEED: Record<string, { name: string; icon: typeof Gauge }> = {
  [FORECAST]: { name: "Our forecast", icon: Layers },
  slow: { name: "Slow", icon: Snail },
  medium: { name: "Medium", icon: Gauge },
  fast: { name: "Fast", icon: Rabbit },
};
const months = (m: number) => (m >= 10 ? Math.round(m) : Math.round(m * 2) / 2).toString();

// One question: which of my skills will last, and how does that change with the speed of AI?
export default function SkillsPage() {
  const { view, state, catalog, act, busy } = useApp();
  const { lang, t } = useT();
  const { speed, previewing, setSpeed: setChosen } = useSpeed();
  if (!view || !state || !catalog) return <Skeleton lines={6} />;
  if (!state.profile) {
    return (
      <div>
        <PageTitle title="Which of your skills will last?">Answer a few questions first, and Jobbery gives each of your skills a shelf life.</PageTitle>
        <Btn href="/start">Get started</Btn>
      </div>
    );
  }
  const pace = view.pace;
  // Our forecast first (the default), then each speed taken as certain.
  const mostly = [...pace.futures].sort((a, b) => b.weight - a.weight)[0];
  const options = [
    { id: FORECAST as Speed, likely: t("mostly {x}", { x: t(SPEED[mostly.id].name) }), doublingMonths: pace.expectedMonths },
    ...pace.futures.map((f) => ({ id: f.id as Speed, likely: t("{p}% likely", { p: Math.round(f.weight * 100) }), doublingMonths: f.doublingMonths })),
  ];
  const sp = options.find((o) => o.id === speed)!;

  // dates under the chosen speed; a skill with no date before 2040 lasts
  const yearOf = (s: (typeof view.profileSkills)[number]) => s.expiry.byFutureYear[speed] ?? Infinity;
  const mine = [...view.profileSkills].sort((a, b) => yearOf(a) - yearOf(b));
  const fading = mine.filter((s) => yearOf(s) < 2031);
  const lasting = mine.filter((s) => yearOf(s) >= 2034);

  // The UN goals the person chose to build their working life around (saved with the Goals page's list of targets).
  const skillSdg = Object.fromEntries(catalog.skills.map((k) => [k.id, k.sdg]));
  const goalFor = (s: (typeof mine)[number]) => goalOf(skillSdg[s.skillId].target);
  const byGoal = targetsByGoal(catalog.goals.map((g) => g.target));
  const chosen = focusGoals(state.goals);
  const serving = new Map<number, number>();
  for (const s of mine) serving.set(goalFor(s), (serving.get(goalFor(s)) ?? 0) + 1);
  const ordered = orderByGoals(mine, goalFor, chosen);
  const saveGoals = (goals: string[]) => act("goals", { goals });
  const shelf = (y: number) => (y >= 2034 ? { t: "Safe for years", tone: "rise" as const } : y < 2031 ? { t: "AI may take over soon", tone: "fall" as const } : { t: "Safe for now", tone: "neutral" as const });

  return (
    <div className="skills-page">
      <PageTitle title={<span className="skills-title">{fading.length
        ? (lang === "en" ? <>AI could do most of <mark>{fading.length} of your {mine.length} skills</mark> before 2031.</> : `AI could do most of ${fading.length} of your ${mine.length} skills before 2031.`)
        : (lang === "en" ? <>AI is unlikely to take over <mark>any of your {mine.length} skills</mark> before 2031.</> : `AI is unlikely to take over any of your ${mine.length} skills before 2031.`)}</span>}
        titleAction={<ReleaseInfo label="About these skill dates">Each date below is roughly when AI could do most of the work for that skill{previewing ? `, if AI improves ${SPEED[speed].name.toLowerCase()}` : ""}. After that date, the skill alone is less likely to get you hired.</ReleaseInfo>}>
        {lasting.length ? <>Your safest skills: {lasting.slice(0, 2).map((s, i) => <span key={s.skillId}>{i > 0 && " and "}<mark className="skills-safe-highlight">{s.name}</mark></span>)}.</> : null}
      </PageTitle>

      <Card tone="raised">
        <h2 className="text-xl font-bold sm:text-2xl">How fast is AI getting better?</h2>
        <p className="mt-1 text-sm text-muted">We measure this by how long a task AI can finish without help. Nobody knows the future speed: Our forecast blends the three, or pick one to see how your dates change. Your pick also re-ranks your jobs.</p>
        <div role="radiogroup" aria-label="Speed of AI progress" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {options.map((f) => {
            const on = f.id === speed;
            const Icon = SPEED[f.id].icon;
            return (
              <button key={f.id} role="radio" aria-checked={on} onClick={() => setChosen(f.id)}
                className={`press flex items-center gap-3 rounded-2xl p-4 text-left sm:flex-col sm:items-start sm:gap-2 ${on ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: on ? "rgb(255 255 255 / 0.15)" : FUTURE_COLOR[f.id] ?? "var(--surface-2)", color: on || f.id === FORECAST ? undefined : "#fff" }}>
                  <Icon size={20} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  {/* translated here: the page translator would read the name and "44% likely" as one sentence */}
                  <span className="flex items-baseline justify-between gap-2" data-no-translate>
                    <span className="text-lg font-bold">{t(SPEED[f.id].name)}</span>
                    <span className={`num text-sm ${on ? "opacity-80" : "text-muted"}`}>{f.likely}</span>
                  </span>
                  <span className="mt-0.5 block text-sm"><span className="num text-lg font-medium">AI gets twice as capable every {months(f.doublingMonths)} months</span></span>
                </span>
              </button>
            );
          })}
        </div>
        <More summary="Where do these numbers come from?">
          <p>The speeds come from a test by the research group METR (data from Epoch AI). Over the last year, the length of task AI can finish on its own doubled about every {months(pace.futures.find((f) => f.id === "medium")!.doublingMonths)} months. &quot;Slow&quot; assumes 60% of that pace, &quot;Fast&quot; 160%. Faster AI also means companies start using it sooner and office admin job ads shrink faster ({pace.futures.map((f) => `${SPEED[f.id].name.toLowerCase()}: ${Math.abs(f.clericalPerYear).toFixed(1)} fewer in every 100 ads each year`).join(", ")}).</p>
          <p>How likely each speed is comes from real published numbers and from a prediction game where players predict the next numbers; players who predict well count more. <Link href="/market" className="underline decoration-control underline-offset-2 hover:text-ink">Try the prediction game</Link>.</p>
        </More>
      </Card>

      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">Which UN goals do you want to build your working life around?</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Pick none, one or several. The number on a tile is how many of your skills serve that goal.</p>
          </div>
          <ReleaseInfo label="How UN goals affect your results">Each skill serves one of the UN Sustainable Development Goals. Pick the goals you care about and the skills that serve them move to the top of your list, in the goal&apos;s colour. Jobs that serve them move up too.</ReleaseInfo>
        </div>
        <SdgFocus chosen={chosen} available={new Set(byGoal.keys())} serving={serving} busy={busy}
          showInstruction={false}
          onToggle={(g) => saveGoals(toggleGoal(state.goals, g, byGoal.get(g) ?? []))}
          onClear={() => saveGoals([])} />
      </Card>

      <Card className="mt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{chosen.size ? "Your skills: the ones that serve your goals come first, then the ones AI could take over soonest" : "Your skills: the ones AI could take over soonest are at the top"}</h2>
          <p className="text-xs text-muted">{previewing ? `Speed picked: ${SPEED[speed].name.toLowerCase()}` : "Our forecast"} (AI twice as capable every {months(sp.doublingMonths)} months)</p>
        </div>
        <ul className="space-y-2">
          {ordered.map((s) => {
            const y = yearOf(s);
            const sh = shelf(y);
            const target = skillSdg[s.skillId];
            const goal = goalOf(target.target);
            const hit = chosen.has(goal);
            const color = sdgColor(goal);
            return (
              <li key={s.skillId} className="rounded-2xl bg-raised px-4 py-3" style={hit ? goalTint(color) : undefined}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium">
                    <a href={sdgUrl(goal)} target="_blank" rel="noreferrer" aria-label={`UN Sustainable Development Goal ${goal}, target ${target.target}. ${target.why}`} title={`UN Sustainable Development Goal ${goal}, target ${target.target}. ${target.why}`} className="shrink-0 rounded-lg hover:opacity-80"><SdgIcon goal={goal} size={28} /></a>
                    {s.name}</p>
                  <div className="flex items-center gap-3">
                    <Chip tone={sh.tone}>{sh.t}</Chip>
                    <span className="num w-24 text-right">{s.expiry.byFuture[speed]}</span>
                  </div>
                </div>
                <div className="mt-2"><ExpiryTrack byFuture={s.expiry.byFuture} expected={s.expiry.expected} durable={s.expiry.durable} pick={speed} axis={false} /></div>
                <More summary={t("How this serves UN goal {goal}: {name}", { goal, name: t(sdgName(target.target)) })}>
                  <p><span className="num font-medium text-ink">{t("Target {target}", { target: target.target })}:</span> {SDG_TARGETS[target.target]?.text}</p>
                  <p>{target.why}</p>
                  <p><Link href="/plan#sdg-path" className="underline decoration-control underline-offset-2 hover:text-ink">See your whole plan&apos;s contribution to the UN goals</Link></p>
                </More>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 px-4"><ExpiryAxis /></div>
        <p className="mt-3 text-xs text-muted">{previewing ? "The date on the right: when AI could do most of this skill. Big dot: the speed you picked. Small dots: the other two speeds." : "The date on the right: when AI could do most of this skill under Our forecast. Dots: the three speeds."}</p>
        <div className="mt-2"><Estimate /></div>
      </Card>

      <SourceDisclosure>
        <SourceChip name={pace.source.name} date={`to ${pace.asOf.replace("Q", " Q")}`} url={pace.source.url} />
        {view.radar.sources.slice(0, 2).map((x) => <SourceChip key={x.name} name={x.name} date={x.date} url={x.url} />)}
      </SourceDisclosure>

      <NextRow back="/start" next="/jobs" nextLabel="Next: jobs for you" />
    </div>
  );
}
