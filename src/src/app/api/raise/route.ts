import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/server/session";
import { loadState } from "@/lib/server/store";
import { ensureData } from "@/lib/server/refresh";
import { roleById } from "@/lib/engine/data";
import { raiseView } from "@/lib/engine/view";

export const dynamic = "force-dynamic";
// A background data refresh (run with after()) can take up to a minute: each source fetch has a 60 s timeout.
export const maxDuration = 60;

// Why a job scores what it does and what would raise it, for the job page (read-only; nothing is saved).
export async function GET(req: Request) {
  await ensureData();
  const roleId = new URL(req.url).searchParams.get("role") ?? "";
  if (!roleById[roleId]) return NextResponse.json({ error: "Unknown job." }, { status: 400 });
  const state = await loadState((await getSessionId())!);
  const out = raiseView(state, roleId);
  return out ? NextResponse.json(out) : NextResponse.json({ error: "Build your profile first." }, { status: 404 });
}
