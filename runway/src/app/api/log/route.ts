import { NextResponse } from "next/server";
import { logAll, logHead, logRecent, verifyChain } from "@/lib/server/store";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureData();
  const all = await logAll();
  const check = verifyChain(all);
  const head = await logHead();
  return NextResponse.json({
    ok: check.ok, checked: check.checked, brokenAt: check.brokenAt,
    head: head ? { seq: head.seq, hash: head.hash, ts: head.ts } : null,
    recent: await logRecent(15),
    note: "Hash-chained log of predictions, data releases, advice given and badges issued. Session IDs are one-way hashed. Publish the head hash to the public repo with scripts/anchor-log.mjs.",
  });
}
