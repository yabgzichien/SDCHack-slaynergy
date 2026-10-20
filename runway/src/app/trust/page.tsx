"use client";
import { useEffect, useState } from "react";
import { Card, Chip, H, PageTitle, SourceChip } from "@/components/ui";
import { useApp } from "@/components/AppProvider";

type Fair = { pairs: number; identical: number; pass: boolean };
type Log = { ok: boolean; checked: number; brokenAt: number | null; head: { seq: number; hash: string; ts: string } | null; recent: { seq: number; ts: string; type: string; hash: string }[] };

export default function TrustPage() {
  const { view } = useApp();
  const [fair, setFair] = useState<Fair | null>(null);
  const [log, setLog] = useState<Log | null>(null);
  useEffect(() => {
    fetch("/api/fairness").then((r) => r.json()).then(setFair).catch(() => {});
    fetch("/api/log").then((r) => r.json()).then(setLog).catch(() => {});
  }, [view?.world.release]);
  return (
    <div className="space-y-4">
      <PageTitle title={fair?.pass ? "Every fairness check passed." : "How we keep this honest"}>What the app checks about itself, where its data comes from, and what it does not do.</PageTitle>

      <Card tone="raised">
        <H>Fairness check</H>
        {fair ? (
          <p className="text-sm">We tested: the same skills with a different age or gender give the same results. <b className="num">{fair.identical} of {fair.pairs}</b> profile pairs gave identical rankings and scores. {fair.pass ? "Passed." : "FAILED."} Age, gender and background are never inputs to matching, and a second test gives two profiles that differ only in age and name and checks they get the same jobs and plan. Your highest qualification is used only to check a job&apos;s entry requirement. The same test runs automatically in the code repository.</p>
        ) : <p className="text-sm text-muted">Running the check…</p>}
      </Card>

      <Card>
        <H sub="Every bet, data release, plan submission and approval is added to a chain where each record includes the hash of the one before. Changing any record breaks every later hash.">Tamper-evident log</H>
        {log ? (
          <>
            <p className="text-sm"><Chip tone={log.ok ? "rise" : "fall"}>{log.ok ? "Chain verified" : `Broken at record ${log.brokenAt}`}</Chip> <span className="num">{log.checked} records checked.</span></p>
            {log.head && <p className="num mt-2 break-all rounded-2xl bg-raised p-3 text-xs">Latest fingerprint (record {log.head.seq}): {log.head.hash}</p>}
            <p className="mt-2 text-sm text-muted">The latest fingerprint is published to the public GitHub repository (<code>anchors/</code>), so no one, including us, can quietly rewrite the record. Only meaningless fingerprints leave the app; no data is stored on a blockchain.</p>
            {log.recent.length > 0 && (
              <ul className="num mt-2 space-y-0.5 text-xs text-muted">{log.recent.slice(0, 6).map((r) => <li key={r.seq}>#{r.seq} · {r.ts.slice(0, 19).replace("T", " ")} · {r.type} · {r.hash.slice(0, 12)}…</li>)}</ul>
            )}
          </>
        ) : <p className="text-sm text-muted">Loading…</p>}
      </Card>

      <Card>
        <H sub="All public, open or synthetic. Each is stored as a dated snapshot with an update script.">Data sources</H>
        <ul className="space-y-3">
          {view?.data.map((d) => (
            <li key={d.name}><p className="font-medium">{d.name}</p><p className="text-sm text-muted">Latest used: {d.detail}. Licence: {d.licence}.</p><SourceChip name="open source page" date={`retrieved ${d.date}`} url={d.url} /></li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">Made-up (synthetic) data: the demo profiles and the ~200 simulated forecasters. They are always labelled.</p>
      </Card>

      <Card>
        <H>What Jobbery does not do</H>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>It never invents jobs, courses or statistics. Roles and courses come from fixed, checked lists; scores are computed; explanations are filled from templates with a source and date.</li>
          <li>It uses no real CVs or personal data, and no paid or hosted AI model at run time.</li>
          <li>It never uses real money. Forecasters earn points, rank and influence only.</li>
          <li>It uses no language model. Matching and forecasting are statistics you can read in the code: a scoring rule, a market maker (LMSR) and the Hedge rule for influence.</li>
          <li>It never decides for you. You choose; a counsellor reviews and approves. Estimates are not predictions of certainty.</li>
        </ul>
      </Card>
    </div>
  );
}
