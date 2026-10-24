import { headers } from "next/headers";
import Link from "next/link";
import { findBadge } from "@/lib/server/store";
import { linkedinAddUrl, linkedinShareUrl, type BadgeRecord } from "@/lib/engine/pathway";
import { topicLabel } from "@/lib/engine/meetings";
import { Btn, Card, Chip, H, PageTitle } from "@/components/ui";
import { STRAND_STYLE } from "@/components/strands";
import { Award, BriefcaseBusiness, Check, Share2, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" }) : "");
// Named advisor and their id as recorded in the log; older badges recorded no name.
const signer = (s?: { id: string; name: string }) => (s ? `by ${s.name} (${s.id}) on ` : "by an advisor on ");

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
  const groups = (["job", "ai", "people"] as const).map((k) => ({ k, st: STRAND_STYLE[k], steps: b.steps.filter((s) => s.strand === k) })).filter((g) => g.steps.length);
  const courses = b.steps.filter((s) => s.url).length;
  const stats: [string, string, string][] = [
    [String(b.steps.length), "steps completed", "bg-lanelearnsoft text-lanelearnink"],
    [String(courses), "courses with real providers", "bg-laneaisoft text-laneaiink"],
    [b.quiz ? `${b.quiz.attempts}` : "–", b.quiz ? (b.quiz.attempts === 1 ? "try to pass the AI quiz" : "tries to pass the AI quiz") : "AI quiz", "bg-goldsoft text-laneaiink"],
    [b.met ? "1" : "–", "advisor session", "bg-laneresumesoft text-laneresumeink"],
  ];
  return (
    <div>
      <PageTitle title={b.title}>{b.met ? `${b.holder} completed this pathway on Jobbery on ${day(b.issued)}, including a session with advisor ${b.met.advisor.name}.` : `${b.holder} completed this pathway on Jobbery, confirmed by ${b.counsellor?.confirmedBy ? `counsellor ${b.counsellor.confirmedBy.name}` : "an employment counsellor"} on ${day(b.counsellor?.confirmedAt ?? b.issued)}.`}</PageTitle>
      <div className="-mt-2 mb-5 flex flex-wrap gap-2">
        {b.strands.map((s) => <span key={s} className={`rounded-full px-3 py-1 text-xs font-semibold ${s.startsWith("AI") ? "bg-laneaisoft text-laneaiink" : "bg-laneresumesoft text-laneresumeink"}`}>{s}</span>)}
        {b.synthetic && <Chip tone="demo">Made-up demo profile</Chip>}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-[22px] bg-gradient-to-br from-[#1d3557] to-[#2d5a87] p-3 shadow-[0_10px_30px_rgb(29_53_87/0.35)]">
            <BadgeArt title={b.role} date={day(b.issued)} met={!!b.met} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn href={linkedinAddUrl(b, url)} className="!bg-[#0a66c2] !text-white"><BriefcaseBusiness size={16} aria-hidden />Add to LinkedIn profile</Btn>
            <Btn href={linkedinShareUrl(url)} variant="ghost"><Share2 size={16} aria-hidden />Share a post</Btn>
          </div>
          <p className="mt-3 text-xs text-muted">This badge says the pathway was completed. It is not a qualification or a licence, and no employer or agency partnership is implied.</p>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {stats.map(([n, l, c]) => <li key={l} className={`rounded-2xl px-4 py-3 ${c}`}><p className="num text-2xl font-bold leading-none">{n}</p><p className="mt-1 text-xs font-medium">{l}</p></li>)}
          </ul>
        </div>
        <Card className="lg:col-span-7" tone="raised">
          <H sub="Courses link to their providers, many of which issue their own certificates.">What was completed</H>
          <div className="space-y-4">
            {groups.map(({ k, st, steps }) => {
              const Icon = st.icon;
              return (
                <section key={k}>
                  <h3 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${st.ink}`}><span className={`grid size-7 place-items-center rounded-lg ${st.solid} text-white`}><Icon size={15} aria-hidden /></span>{st.label}<span className="num text-xs font-normal text-muted">{steps.length}</span></h3>
                  <ol className={`space-y-1 border-l-4 pl-3 ${st.bar}`}>
                    {steps.map((s, i) => (
                      <li key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${st.soft}`}>
                        <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-rise" />
                        <span>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="font-medium underline decoration-control underline-offset-2">{s.title}</a> : <span className="font-medium">{s.title}</span>}{s.provider ? <span className="text-muted"> · {s.provider}</span> : null}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
          {b.quiz && <p className="mt-4 flex items-start gap-2 rounded-xl bg-goldsoft px-3 py-2 text-sm"><Award size={16} aria-hidden className="mt-0.5 shrink-0 text-gold" />Passed the AI quiz on &ldquo;{b.quiz.card}&rdquo;: found every planted mistake in an AI-written answer.</p>}
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

      <Card className="mt-4 border-2 border-[#2d5a87]/30" tone="raised">
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#1d3557] text-white"><ShieldCheck size={22} /></span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Check it is genuine</h2>
            <p className="text-sm text-muted">Each log record includes the hash of the one before, so changing this badge would break every later record.</p>
            <p className="num mt-2 break-all rounded-xl bg-surface2 px-3 py-2 font-mono text-xs">Log record {entry.seq} · {day(entry.ts)} · hash {entry.hash}</p>
            <p className="mt-2 text-sm">{b.met ? <>{`Advisor session (${topicLabel(b.met.topic).toLowerCase()}) with ${b.met.advisor.name} (${b.met.advisor.id}) on ${day(b.met.at)}. Badge issued ${day(b.issued)}, when every step was done.`} </> : b.counsellor && <>{b.counsellor.approvedPlanAt && <>Plan approved {signer(b.counsellor.approvedBy)}{day(b.counsellor.approvedPlanAt)}; </>}Completion confirmed {signer(b.counsellor.confirmedBy)}{day(b.counsellor.confirmedAt)}. </>}<Link href="/trust" className="underline decoration-control underline-offset-2">Verify the whole log</Link></p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// The badge itself: a navy certificate with a gold seal and the three strand colours as ribbons.
function BadgeArt({ title, date, met }: { title: string; date: string; met: boolean }) {
  const size = title.length > 26 ? 18 : title.length > 18 ? 22 : 28;
  return (
    <svg viewBox="0 0 320 210" role="img" aria-label={`Jobbery pathway badge: ${title}, ${date}`} className="w-full">
      <rect x="1" y="1" width="318" height="208" rx="16" fill="none" stroke="#ffd59a" strokeOpacity="0.55" strokeWidth="1.5" />
      <text x="22" y="34" fill="#ffd59a" fontSize="11" fontWeight="700" letterSpacing="2.5">JOBBERY · PATHWAY COMPLETED</text>
      <text x="22" y="78" fill="#ffffff" fontSize={size} fontWeight="700">{title}</text>
      <text x="22" y="100" fill="#ffffff" fontSize="12" opacity="0.85">AI at work · Interview-ready</text>
      <rect x="22" y="118" width="62" height="7" rx="3.5" fill="#4f86c6" />
      <rect x="88" y="118" width="62" height="7" rx="3.5" fill="#d08a1e" />
      <rect x="154" y="118" width="62" height="7" rx="3.5" fill="#8a78c8" />
      <text x="22" y="142" fill="#ffffff" fontSize="9" opacity="0.75">JOB SKILLS</text>
      <text x="88" y="142" fill="#ffffff" fontSize="9" opacity="0.75">AI AT WORK</text>
      <text x="154" y="142" fill="#ffffff" fontSize="9" opacity="0.75">PEOPLE SKILLS</text>
      <text x="22" y="186" fill="#ffffff" fontSize="11.5" opacity="0.9">{met ? `Includes an advisor session · ${date}` : date}</text>
      <g transform="translate(272 124) scale(0.8)">
        <path d="M-14 14 L-20 44 L-6 36 L0 48 L6 36 L20 44 L14 14 Z" fill="#c9741a" />
        <circle r="30" fill="#e9b949" />
        <circle r="24" fill="none" stroke="#fff6dc" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M-10 0 L-3 8 L11 -8" fill="none" stroke="#5a3a06" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
