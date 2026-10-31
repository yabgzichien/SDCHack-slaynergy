import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { checkBooking, freeSlots, isTopic, MAX_QUESTION, upcoming, type Meeting } from "@/lib/engine/meetings";
import { allSlots, publicMeeting } from "@/lib/server/meetings";
import { recordMeeting } from "@/lib/engine/review";
import { getSessionId } from "@/lib/server/session";
import { anonymise, insertMeeting, listMeetings, loadState, logEvent, saveState, updateMeeting } from "@/lib/server/store";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";
// A background data refresh (run with after()) can take up to a minute: each source fetch has a 60 s timeout.
export const maxDuration = 60;

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
  await ensureData();
  return NextResponse.json(await payload(await getSessionId(false)));
}

export async function POST(req: Request) {
  await ensureData();
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
      // Booking ticks the plan's meeting step; the advisor's advice still arrives after the meeting.
      await saveState(sid, { ...state, pathway: { ...state.pathway, meetingBooked: { meetingId: m.id, start: m.start, at: now } } });
      await logEvent("meeting_booked", sid, { topic: m.topic });
      return NextResponse.json(await payload(sid));
    }
    case "cancel": {
      const m = (await listMeetings()).find((x) => x.id === String(body.meetingId ?? "") && x.sid === sid);
      if (!m || !upcoming(m, now)) return bad("That meeting was not found, or it has already happened.");
      await updateMeeting({ ...publicMeeting(m), status: "cancelled", cancelledAt: now, cancelledBy: "worker" });
      const st = await loadState(sid);
      if (st.pathway?.meetingBooked?.meetingId === m.id) { const { meetingBooked: _, ...rest } = st.pathway; void _; await saveState(sid, { ...st, pathway: rest }); }
      return NextResponse.json(await payload(sid));
    }
    case "demoAdvise": {
      // Demo shortcut, labelled in the app: plays the advisor for the worker's own booked meeting, so a demo can skip
      // the wait. Sends sample advice, which completes the plan's meeting step just as real advice does.
      const m = (await listMeetings()).find((x) => x.id === String(body.meetingId ?? "") && x.sid === sid);
      if (!m || m.status !== "booked") return bad("That meeting was not found, or it already has advice.");
      const notes = "Demo advice (sample): your plan looks realistic. Finish the job-skills course first, then put your AI quiz work and new skills at the top of your resume. Practise answering \"tell me about a time you checked someone's work\" before interviews.";
      await updateMeeting({ ...publicMeeting(m), status: "advised", notes, notesAt: now });
      const st = await loadState(sid);
      const met = recordMeeting(st, { at: now, by: m.advisor, meetingId: m.id, topic: m.topic });
      if (met !== st) await saveState(sid, met);
      return NextResponse.json(await payload(sid));
    }
    default:
      return bad("Unknown action.");
  }
}
