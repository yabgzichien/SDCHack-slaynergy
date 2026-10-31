"use client";
import { AlertTriangle, ChevronDown, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import type { Finding, ResumeAnalysis } from "@/lib/engine/resume";
import type { AiRead } from "@/lib/server/ai-resume";
import { ResumeGraphic } from "@/components/ResumeGraphic";
import { ResumeOriginal, type ResumeSource } from "@/components/ResumeOriginal";
import { ResumeBaseline, ResumeScoreExplain } from "@/components/ResumeScoreExplain";
import { ScoreRing } from "@/components/ScoreRing";
import { Btn, Card, Chip } from "@/components/ui";

export type AiStatus = "off" | "unavailable" | "used" | "failed";

const gainOf = (f: Finding) => Math.round((f.points.of - f.points.got) * 10) / 10;
// Big impact: the rules marked it "fix first", or it could add 5 points or more on its own.
const isHighImpact = (f: Finding) => f.severity === "fix" || gainOf(f) >= 5;

// The report shown straight after a scan in the onboarding: what the resume says and how it scores, the worker's own
// resume as they made it (source; null only for the made-up demo resume, drawn as a page),
// and the fixes, closed until asked for. It only reads: skills are confirmed at the skills question.
export function ResumeReport({ analysis: a, ai, aiStatus, fileName, source, onAgain, onContinue }: { analysis: ResumeAnalysis; ai: AiRead | null; aiStatus: AiStatus; fileName: string | null; source: ResumeSource | null; onAgain: () => void; onContinue: () => void }) {
  const open = a.findings.filter((f) => f.severity !== "good");
  const high = open.filter(isHighImpact).sort((x, y) => gainOf(y) - gainOf(x));
  const low = open.filter((f) => !isHighImpact(f)).sort((x, y) => gainOf(y) - gainOf(x));
  const potential = Math.min(100 - a.score, Math.round(high.reduce((x, f) => x + gainOf(f), 0)));
  const bandColor = a.band === "strong" ? "var(--rise)" : a.band === "good" ? "var(--accent)" : "var(--fall)";
  const skillCount = a.skills.length + (ai?.skills.length ?? 0);

  return (
    <div className="space-y-5">
      <Card className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto"><ScoreRing value={a.score} label="resume score" color={bandColor} /></div>
        <div>
          <Chip tone={a.band === "strong" ? "rise" : a.band === "good" ? "accent" : "fall"}>{a.band === "needs work" ? "Needs work" : a.band === "good" ? "Good start" : "Strong"}</Chip>
          <h2 className="mt-2 text-2xl font-bold">{a.headline}</h2>
          <ResumeBaseline className="mt-2" />
          <p className="mt-2 text-muted">
            {a.occupation && <>{`Reads as: ${a.occupation.title}.`}{" "}</>}
            {a.years !== null && a.years > 0 && <>{a.years === 1 ? "1 year of experience." : `${a.years} years of experience.`}{" "}</>}
            {skillCount === 1 ? "1 skill found; you confirm it next." : `${skillCount} skills found; you confirm them next.`}
          </p>
          {potential > 0 && high.length > 0 && <p className="mt-1 text-muted">Fixing the high-impact items could add up to <b className="num text-ink">{potential} points</b>.</p>}
          <p className="mt-3 text-xs text-muted">
            Scanned: {fileName}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn onClick={onContinue} className="min-h-12 px-6 text-base">Continue</Btn>
            <Btn variant="ghost" onClick={onAgain} className="min-h-12 px-6 text-base">Scan another</Btn>
            <ResumeScoreExplain resume={a} className="press min-h-12 rounded-full bg-surface2 px-6 text-base text-ink hover:bg-control/60" />
          </div>
        </div>
      </Card>

      {aiStatus === "failed" && <p className="rounded-2xl bg-surface2 p-3 text-sm text-muted">The AI reader is busy right now, so these results use the rule scan only. Try scanning again in a minute.</p>}
      {aiStatus === "unavailable" && <p className="rounded-2xl bg-surface2 p-3 text-sm text-muted">The AI reader is not available here, so these results use the rule scan only.</p>}

      <SuggestedFixes high={high} low={low} rewrites={ai?.rewrites ?? []} />

      {source ? <ResumeOriginal source={source} /> : <ResumeGraphic lines={a.lines.map((l) => l.text)} />}
      <div className="flex justify-end"><Btn onClick={onContinue} className="min-h-12 px-6 text-base">Continue</Btn></div>
    </div>
  );
}

function SuggestedFixes({ high, low, rewrites }: { high: Finding[]; low: Finding[]; rewrites: AiRead["rewrites"] }) {
  const smaller = low.length + (rewrites.length > 0 ? 1 : 0);
  return (
    <details className="group rounded-[22px] bg-surface">
      <summary className="press flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-[22px] px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-lg font-bold">Suggested fixes</span>
          {high.length > 0 && <span className="rounded-full bg-urgentsoft px-2.5 py-0.5 text-xs font-semibold text-urgentink">{high.length} high impact</span>}
          {smaller > 0 && <span className="rounded-full bg-goldsoft px-2.5 py-0.5 text-xs font-semibold text-goldink">{smaller} smaller</span>}
        </span>
        <ChevronDown size={20} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-6 px-5 pb-5">
        {high.length === 0 && smaller === 0 && <p className="text-sm text-muted">Nothing to fix. Your resume covers the basics well.</p>}
        {high.length > 0 && (
          <Group tone="high" title="High impact" sub="Change these first. They could move your score the most.">
            {high.map((f) => <FixCard key={f.id} f={f} tone="high" />)}
          </Group>
        )}
        {smaller > 0 && (
          <Group tone="low" title="Smaller improvements" sub="Worth doing when you have time.">
            {low.map((f) => <FixCard key={f.id} f={f} tone="low" />)}
            {rewrites.length > 0 && (
              <li className="rounded-2xl border-l-4 border-gold bg-goldsoft/60 p-4">
                <h5 className="font-bold leading-snug">Better wording</h5>
                <p className="mt-0.5 text-xs text-muted">Suggested by AI. Fill in the [brackets] with real figures only.</p>
                <ul className="mt-2 space-y-2">
                  {rewrites.map((w, i) => <li key={i} className="text-sm"><BeforeAfter before={w.before} after={w.after} /></li>)}
                </ul>
              </li>
            )}
          </Group>
        )}
      </div>
    </details>
  );
}

function Group({ tone, title, sub, children }: { tone: "high" | "low"; title: string; sub: string; children: ReactNode }) {
  const Icon = tone === "high" ? AlertTriangle : Lightbulb;
  return (
    <section>
      <h4 className={`flex items-center gap-2 text-base font-bold ${tone === "high" ? "text-urgentink" : "text-goldink"}`}><Icon size={18} aria-hidden />{title}</h4>
      <p className="mb-2 text-sm text-muted">{sub}</p>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function FixCard({ f, tone }: { f: Finding; tone: "high" | "low" }) {
  const gain = gainOf(f);
  return (
    <li className={`rounded-2xl border-l-4 p-4 ${tone === "high" ? "border-urgent bg-urgentsoft" : "border-gold bg-goldsoft/60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h5 className="font-bold leading-snug">{f.title}</h5>
        {gain > 0 && <span className={`num whitespace-nowrap text-sm font-semibold ${tone === "high" ? "text-urgentink" : "text-goldink"}`}>up to +{gain} points</span>}
      </div>
      <p className="mt-1 text-sm">{f.fix}</p>
      {f.example && <div className="mt-2 text-sm"><BeforeAfter before={f.example.before} after={f.example.after} /></div>}
    </li>
  );
}

function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <p className="rounded-xl bg-raised/70 p-2.5"><span className="block text-xs text-muted">Before</span><span data-no-translate>{before}</span></p>
      <p className="rounded-xl bg-raised p-2.5"><span className="block text-xs text-muted">After (fill in the brackets)</span><b data-no-translate className="font-medium">{after}</b></p>
    </div>
  );
}
