"use client";
import { useEffect, useState } from "react";
import { Card, Chip, H, PageTitle, SourceChip } from "@/components/ui";
import { useApp } from "@/components/AppProvider";
import { useT } from "@/components/I18nProvider";

type Fair = { pairs: number; identical: number; pass: boolean };
type Log = { ok: boolean; checked: number; brokenAt: number | null; head: { seq: number; hash: string; ts: string } | null; recent: { seq: number; ts: string; type: string; hash: string }[] };

export default function TrustPage() {
  const { view } = useApp();
  const { t } = useT();
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
        <p className="text-sm">{t("To ensure fairness, Jobbery bases job recommendations and learning plans on your skills, job preferences, available study time, qualifications, field of study and previous job field. Age, gender and race play no part in the jobs, plans or skills suggested. Your highest qualification is used only to check a job's entry requirement.")}</p>
      </Card>

      <Card>
        <H sub="Every prediction, data update, piece of advice and badge is saved in a chain. Each record is locked to the one before it, so nobody can secretly change one.">A record nobody can secretly change</H>
        {log ? (
          <>
            <p className="text-sm"><Chip tone={log.ok ? "rise" : "fall"}>{log.ok ? "Chain verified" : `Broken at record ${log.brokenAt}`}</Chip> <span className="num">{log.checked} records checked.</span></p>
            {log.head && <p className="num mt-2 break-all rounded-2xl bg-raised p-3 text-xs">Latest fingerprint (record {log.head.seq}): {log.head.hash}</p>}
            <p className="mt-2 text-sm text-muted">The latest fingerprint is published to the public GitHub repository (<code>anchors/</code>), so no one, including us, can quietly rewrite the record. Only meaningless fingerprints leave the app; no data is stored on a blockchain.</p>
            <p className="mt-2 text-sm text-muted">The crowd&apos;s forecasts for the questions still open are also saved in <code>anchors/</code> before the numbers come out, so anyone can check them afterwards.</p>
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
        <p className="mt-3 text-sm text-muted">Made-up (synthetic) data: the demo profiles and the ~200 computer-made players in the prediction game. They are always labelled.</p>
      </Card>

      <Card>
        <H>What Jobbery does not do</H>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>It never invents jobs, courses or statistics. Roles and courses come from fixed, checked lists; scores are computed; explanations are filled from templates with a source and date.</li>
          <li>Its demo uses no real CVs or personal data. The only AI model is the optional resume reader, and it only suggests.</li>
          <li>It never uses real money. Players only win points and a bigger vote.</li>
          <li>It uses no AI chatbot. Matching and forecasting are plain maths you can read in the code.</li>
          <li>It never decides for you. You choose, and can book an advisor for a second opinion. Every plan includes one meeting with an advisor, and the badge is issued only after it. Estimates are not predictions of certainty.</li>
        </ul>
      </Card>
    </div>
  );
}
