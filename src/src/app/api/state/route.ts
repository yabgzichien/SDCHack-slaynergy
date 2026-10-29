import { getSessionId } from "@/lib/server/session";
import { loadState, saveState } from "@/lib/server/store";
import { respond } from "@/lib/server/respond";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";
// A background data refresh (run with after()) can take up to a minute: each source fetch has a 60 s timeout.
export const maxDuration = 60;

export async function GET() {
  await ensureData();
  const sid = (await getSessionId())!;
  let state = await loadState(sid);
  if (!state.clock) { state = { ...state, clock: { t0: new Date().toISOString() } }; await saveState(sid, state); }
  return respond(state);
}
