"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Btn, Card, LinkRow, PageTitle, Skeleton, sdgName } from "@/components/ui";
import { ScoreBadge } from "@/components/JobBits";

// One question: what else could I do, sector by sector?
export default function AllJobsPage() {
  const { view, state } = useApp();
  const [sector, setSector] = useState("all");
  if (!view || !state) return <Skeleton lines={6} />;
  if (!state.profile) return <div><PageTitle title="All jobs">Answer a few questions first.</PageTitle><Btn href="/start">Get started</Btn></div>;
  const list = view.matches.filter((m) => sector === "all" || m.sector === sector);
  const later = view.unreachable.filter((u) => sector === "all" || u.sector === sector);
  const label = (id: string) => view.sectors.find((s) => s.id === id)?.label ?? id;
  return (
    <div>
      <Link href="/jobs" className="mb-4 inline-block text-sm text-muted underline decoration-control underline-offset-2 hover:text-ink">Jobs</Link>
      <PageTitle title={`${view.matches.length} jobs you can reach in ${state.profile.months} months.`}>Ranked by match score. Pick a sector to narrow the list.</PageTitle>
      <div className="scroll-x -mx-1 mb-4 flex gap-1.5 px-1 pb-1" role="group" aria-label="Sector">
        {[{ id: "all", label: "All sectors", n: view.matches.length }, ...view.sectors.map((s) => ({ id: s.id, label: s.label, n: s.reachable }))].map((s) => (
          <button key={s.id} onClick={() => setSector(s.id)} aria-pressed={sector === s.id}
            className={`press min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm ${sector === s.id ? "bg-primary text-primaryink" : "bg-surface hover:bg-surface2"}`}>{s.label} <span className="num opacity-70">{s.n}</span></button>
        ))}
      </div>
      <Card>
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.roleId}>
              <LinkRow href={`/jobs/${m.roleId}`} aside={<ScoreBadge value={m.score} />}>
                <p className="font-medium">{m.title}</p>
                <p className="text-sm text-muted">{label(m.sector)} · about {m.weeks} weeks · {sdgName(m.sdgTarget)}{m.atRisk ? " · skills may fade" : ""}</p>
              </LinkRow>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="text-sm text-muted">No job in this sector is reachable in your time yet.</p>}
      </Card>
      {later.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-base font-semibold">Longer-term paths</h2>
          <p className="mt-1 text-sm text-muted">These need more time or a higher qualification than you have now.</p>
          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {later.map((u) => <li key={u.roleId} className="flex justify-between gap-2 rounded-2xl bg-raised px-4 py-2.5"><span>{u.title}</span><span className="num text-muted">{u.need}</span></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
