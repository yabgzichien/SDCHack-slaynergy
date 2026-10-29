import { getSessionId } from "@/lib/server/session";
import { loadState, saveState } from "@/lib/server/store";
import { respond } from "@/lib/server/respond";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureData();
  const sid = (await getSessionId())!;
  let state = await loadState(sid);
  if (!state.clock) { state = { ...state, clock: { t0: new Date().toISOString() } }; await saveState(sid, state); }
  return respond(state);
}
