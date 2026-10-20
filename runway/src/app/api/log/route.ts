import { NextResponse } from "next/server";
import { logAll, logHead, verifyChain } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await logAll();
  const check = verifyChain(all);
  const head = await logHead();
  return NextResponse.json({
    ok: check.ok, checked: check.checked, brokenAt: check.brokenAt,
    head: head ? { seq: head.seq, hash: head.hash, ts: head.ts } : null,
    recent: all.slice(-15).reverse(),
    note: "Hash-chained log of bets, data releases and approvals. Session IDs are one-way hashed. Publish the head hash to the public repo with scripts/anchor-log.mjs.",
  });
}
