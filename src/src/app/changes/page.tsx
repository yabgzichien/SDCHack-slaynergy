"use client";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, PageTitle, Skeleton, SourceChip } from "@/components/ui";

const KIND: Record<string, string> = { market: "Questions answered", futures: "How fast AI is moving", forecasters: "Players", skills: "Your skills", jobs: "Your jobs", plan: "Your plan", demand: "Job demand" };
const ORDER = ["plan", "jobs", "skills", "futures", "market", "forecasters", "demand"];

// One question: what did the new data change for me, and why?
export default function ChangesPage() {
  const { view } = useApp();
  if (!view) return <Skeleton lines={6} />;
  const changes = view.changes;
  if (!changes) {
    return (
      <div>
        <PageTitle title="Nothing has changed yet.">When you load the new numbers from the menu, this page shows everything that changed.</PageTitle>
        <Btn href="/skills" variant="ghost">See your skills</Btn>
      </div>
    );
  }
  const plan = changes.find((c) => c.kind === "plan");
  const groups = ORDER.map((k) => ({ k, items: changes.filter((c) => c.kind === k) })).filter((g) => g.items.length);
  return (
    <div>
      <PageTitle title={plan ? plan.text.replace(/\.$/, ".") : "The new data is in."}>
        {`New job-ad figures for ${view.world.latestLabel}${view.world.asOfLabel.includes("published") ? ` (${view.world.asOfLabel.replace(/^.*\((published [^)]*)\).*$/, "$1")})` : ""} and new AI test scores answered ${view.world.settledEvents.length} questions. Here is what moved, starting with what matters most to you.`}
      </PageTitle>
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.k}>
            <h2 className="text-base font-semibold">{KIND[g.k]}</h2>
            <ul className="mt-3 space-y-2">
              {g.items.map((c, i) => (
                <li key={i} className="rounded-2xl bg-raised px-4 py-3">
                  <p className="num font-medium">{c.text}</p>
                  <p className="mt-0.5 text-sm text-muted">{c.why}</p>
                  <div className="mt-1"><SourceChip name={c.source.name} date={c.source.date} url={c.source.url} /></div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2"><Btn href="/plan">Open my plan</Btn><Btn href="/leaderboard" variant="ghost">See who forecast best</Btn></div>
    </div>
  );
}
