import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { checkBooking, freeSlots, isTopic, MAX_QUESTION, upcoming, type Meeting } from "@/lib/engine/meetings";
import { allSlots, publicMeeting } from "@/lib/server/meetings";
import { getSessionId } from "@/lib/server/session";
import { anonymise, insertMeeting, listMeetings, loadState, updateMeeting } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// The worker's side: the free slots for the next two weeks and their own meetings, newest first.
async function payload(sid: string | null) {
  const now = new Date().toISOString();
  const [slots, all] = await Promise.all([allSlots(now), listMeetings()]);
  const mine = sid ? all.filter((m) => m.sid === sid) : [];
  const state = sid ? await loadState(sid) : null;
  return {
    now,
    hasProfile: !!state?.profile,
    free: freeSlots(slots, all, now),
    mine: mine.sort((a, b) => b.start.localeCompare(a.start)).map(publicMeeting),
    hasUpcoming: mine.some((m) => upcoming(m, now)),
  };
}

export async function GET() {
  return NextResponse.json(await payload(await getSessionId(false)));
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad("Invalid request."); }
  const sid = await getSessionId(false);
  if (!sid) return bad("Tell us about yourself first.", 401);
  const now = new Date().toISOString();

  switch (String(body.type ?? "")) {
    case "book": {
      const state = await loadState(sid);
      const [slots, all] = await Promise.all([allSlots(now), listMeetings()]);
      const slot = freeSlots(slots, all, now).find((s) => s.id === String(body.slotId ?? ""));
      const why = checkBooking(slot, all.filter((m) => m.sid === sid), now, !!state.profile);
      if (why || !slot) return bad(why ?? "That time is no longer free.");
      if (!isTopic(body.topic)) return bad("Pick what you would like to talk about.");
      const m: Meeting = {
        id: crypto.randomBytes(9).toString("base64url"), slotId: slot.id, start: slot.start, advisor: slot.advisor,
        caseId: anonymise(sid), worker: { name: state.profile!.name, synthetic: !!state.profile!.synthetic },
        status: "booked", topic: body.topic, question: String(body.question ?? "").trim().slice(0, MAX_QUESTION), bookedAt: now,
      };
      if (!(await insertMeeting(m, sid))) return bad("Someone booked that time a moment ago. Please pick another.", 409);
      return NextResponse.json(await payload(sid));
    }
    case "cancel": {
      const m = (await listMeetings()).find((x) => x.id === String(body.meetingId ?? "") && x.sid === sid);
      if (!m || !upcoming(m, now)) return bad("That meeting was not found, or it has already happened.");
      await updateMeeting({ ...publicMeeting(m), status: "cancelled", cancelledAt: now, cancelledBy: "worker" });
      return NextResponse.json(await payload(sid));
    }
    default:
      return bad("Unknown action.");
  }
}
