import { NextResponse } from "next/server";
import { logAll, logHead, logRecent, verifyChain, type LogEntry } from "@/lib/server/store";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";
// A background data refresh (run with after()) can take up to a minute: each source fetch has a 60 s timeout.
export const maxDuration = 60;

// The user funnel, in order: how many distinct (hashed) sessions reached each step. Counts only, no personal data.
const FUNNEL = ["profile", "resume_scan", "job_picked", "step_done", "meeting_booked", "advice_given", "badge_issued"] as const;
function funnelFrom(all: LogEntry[]) {
  const reached = Object.fromEntries(FUNNEL.map((t) => [t, new Set<string>()]));
  let aiTried = 0, aiFailed = 0;
  for (const e of all) {
    if (e.type in reached) reached[e.type].add(e.session);
    if (e.type === "resume_scan") {
      const ai = (JSON.parse(e.payload) as { ai?: string }).ai;
      if (ai === "used" || ai === "failed") { aiTried++; if (ai === "failed") aiFailed++; }
    }
  }
  return {
    sessions: Object.fromEntries(FUNNEL.map((t) => [t, reached[t].size])),
    // Share of resume scans with AI switched on that fell back to the rules alone.
    aiFallbackRate: aiTried ? +(aiFailed / aiTried).toFixed(3) : null,
  };
}

export async function GET() {
  await ensureData();
  const all = await logAll();
  const check = verifyChain(all);
  const head = await logHead();
  return NextResponse.json({
    ok: check.ok, checked: check.checked, brokenAt: check.brokenAt,
    head: head ? { seq: head.seq, hash: head.hash, ts: head.ts } : null,
    recent: await logRecent(15),
    funnel: funnelFrom(all),
    note: "Hash-chained log of predictions, data releases, advice given and badges issued. Session IDs are one-way hashed. Publish the head hash to the public repo with scripts/anchor-log.mjs.",
  });
}
