import { headers } from "next/headers";
import Link from "next/link";
import { findBadge } from "@/lib/server/store";
import { linkedinAddUrl, linkedinShareUrl, type BadgeRecord } from "@/lib/engine/pathway";
import { topicLabel } from "@/lib/engine/meetings";
import { Btn, Card, Chip, H, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" }) : "");
// Named advisor and their id as recorded in the log; older badges recorded no name.
const signer = (s?: { id: string; name: string }) => (s ? `by ${s.name} (${s.id}) on ` : "by an advisor on ");
const STRAND: Record<string, string> = { job: "Job skills", ai: "AI at work", people: "People skills" };

// Public verification page for a pathway badge. Everything shown is read from the badge's entry in the tamper-evident log.
export default async function BadgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await findBadge(id);
  if (!entry) return <div><PageTitle title="Badge not found">This badge id is not in Jobbery&apos;s log. Check the link.</PageTitle><Btn href="/">Go to Jobbery</Btn></div>;
  const b = JSON.parse(entry.payload) as BadgeRecord;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/badge/${b.id}`;
  return (
    <div>
      <PageTitle title={b.title}>{b.met ? `${b.holder} completed this pathway on Jobbery on ${day(b.issued)}, including a session with advisor ${b.met.advisor.name}.` : `${b.holder} completed this pathway on Jobbery, confirmed by ${b.counsellor?.confirmedBy ? `counsellor ${b.counsellor.confirmedBy.name}` : "an employment counsellor"} on ${day(b.counsellor?.confirmedAt ?? b.issued)}.`}</PageTitle>
      <div className="-mt-2 mb-4 flex flex-wrap gap-2">
        {b.strands.map((s) => <Chip key={s} tone="accent">{s}</Chip>)}
        {b.synthetic && <Chip tone="demo">Made-up demo profile</Chip>}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5" tone="raised">
          <BadgeArt title={b.role} date={day(b.issued)} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn href={linkedinAddUrl(b, url)}>Add to LinkedIn profile</Btn>
            <Btn href={linkedinShareUrl(url)} variant="ghost">Share a post</Btn>
          </div>
          <p className="mt-3 text-xs text-muted">This badge says the pathway was completed. It is not a qualification or a licence, and no employer or agency partnership is implied.</p>
        </Card>
        <Card className="lg:col-span-7">
          <H sub="Courses link to their providers, many of which issue their own certificates.">What was completed</H>
          <ol className="space-y-1.5 text-sm">
            {b.steps.map((s, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-raised px-4 py-2">
                <span>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-control underline-offset-2">{s.title}</a> : s.title}{s.provider ? <span className="text-muted"> · {s.provider}</span> : null}</span>
                <span className="text-xs text-muted">{STRAND[s.strand] ?? ""}</span>
              </li>
            ))}
          </ol>
          {b.quiz && <p className="mt-3 text-sm">Passed the AI quiz on &ldquo;{b.quiz.card}&rdquo;: found every planted mistake in an AI-written answer ({b.quiz.attempts} {b.quiz.attempts === 1 ? "try" : "tries"}).</p>}
        </Card>
      </div>

      {b.portfolio && (
        <Card className="mt-4">
          <H sub={`Shared by the holder · from the AI quiz on "${b.portfolio.card}"`}>Portfolio piece</H>
          <p className="text-sm font-medium">Reusable prompt</p>
          <p className="mt-1 whitespace-pre-wrap rounded-2xl bg-raised p-3 text-sm">{b.portfolio.template}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(b.portfolio.sheet).map(([k, v]) => <div key={k} className="rounded-2xl bg-raised p-3"><dt className="text-sm font-medium capitalize">{k}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{v}</dd></div>)}
          </dl>
        </Card>
      )}

      <Card className="mt-4">
        <H sub="Each log record includes the hash of the one before, so changing this badge would break every later record.">Check it is genuine</H>
        <p className="num break-all text-sm">Log record {entry.seq} · {day(entry.ts)} · hash {entry.hash}</p>
        <p className="mt-2 text-sm">{b.met ? <>{`Advisor session (${topicLabel(b.met.topic).toLowerCase()}) with ${b.met.advisor.name} (${b.met.advisor.id}) on ${day(b.met.at)}. Badge issued ${day(b.issued)}, when every step was done.`} </> : b.counsellor && <>{b.counsellor.approvedPlanAt && <>Plan approved {signer(b.counsellor.approvedBy)}{day(b.counsellor.approvedPlanAt)}; </>}Completion confirmed {signer(b.counsellor.confirmedBy)}{day(b.counsellor.confirmedAt)}. </>}<Link href="/trust" className="underline decoration-control underline-offset-2">Verify the whole log</Link></p>
      </Card>
    </div>
  );
}

function BadgeArt({ title, date }: { title: string; date: string }) {
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={`Jobbery pathway badge: ${title}, ${date}`} className="w-full rounded-2xl">
      <rect width="320" height="200" rx="20" fill="var(--accent)" />
      <rect x="20" y="132" width="280" height="10" rx="5" fill="var(--surface)" opacity="0.35" />
      <rect x="20" y="132" width="280" height="10" rx="5" fill="var(--surface)" opacity="0.9" />
      <text x="24" y="44" fill="var(--surface)" fontSize="14" fontWeight="600" letterSpacing="2">RUNWAY · PATHWAY COMPLETED</text>
      <text x="24" y="88" fill="var(--surface)" fontSize={title.length > 22 ? 20 : 26} fontWeight="600">{title}</text>
      <text x="24" y="114" fill="var(--surface)" fontSize="13" opacity="0.9">AI at work · Interview-ready</text>
      <text x="24" y="172" fill="var(--surface)" fontSize="12" opacity="0.9">Includes an advisor session · {date}</text>
    </svg>
  );
}
