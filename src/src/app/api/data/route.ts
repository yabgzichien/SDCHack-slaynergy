import { NextResponse } from "next/server";
import { dataVersion, series } from "@/lib/engine/data";
import { geo } from "@/lib/engine/geo";
import { dataInfo, ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";
// A background data refresh (run with after()) can take up to a minute: each source fetch has a 60 s timeout.
export const maxDuration = 60;

// The active data snapshot, for the browser to swap in (components/AppProvider), plus when each source was last checked.
// ?info=1 returns only the status, for the Sources page.
export async function GET(req: Request) {
  await ensureData();
  const info = await dataInfo();
  if (new URL(req.url).searchParams.get("info")) return NextResponse.json({ version: dataVersion, info });
  return NextResponse.json({ version: dataVersion, series, states: geo, info });
}
