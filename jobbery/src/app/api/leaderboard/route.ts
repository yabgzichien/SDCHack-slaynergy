import { NextResponse } from "next/server";
import { computeLeaderboard } from "@/lib/engine/world";
import { getSessionId } from "@/lib/server/session";
import { loadState } from "@/lib/server/store";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";

// Every forecaster ranked by accuracy (Brier score), with the influence the Hedge rule gave them.
export async function GET() {
  await ensureData();
  const sid = (await getSessionId())!;
  return NextResponse.json(computeLeaderboard(await loadState(sid)));
}
