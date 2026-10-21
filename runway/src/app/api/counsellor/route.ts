import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { computeView } from "@/lib/engine/view";
import { advisorMeetings, DEMO_ADVISOR, GRID_TIMES, isOpenable, MAX_NOTES, slotId, slotStart, upcoming, windowDays, type Meeting } from "@/lib/engine/meetings";
import { caseSummary, confirmCompletion, finishedPersonaState, personaState } from "@/lib/engine/review";
import { getCounsellor, signIn, signOut, usingDemoPasscode, DEMO_PASSCODE } from "@/lib/server/counsellor";
import { publicMeeting } from "@/lib/server/meetings";
import { catalog } from "@/lib/server/respond";
import { getSessionId } from "@/lib/server/session";
import { addSlot, anonymise, findCase, insertMeeting, listCases, listMeetings, loadState, logEvent, openSlots, removeSlot, saveState, updateMeeting } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// The advisor's desk: their meetings (and the demo advisor's), their open times, and finished pathways to confirm.
// Only a signed-in advisor sees any of it. ?meeting= or ?case= opens one in full.
async function payload(q: { meeting?: string | null; caseId?: string | null }) {
  const me = await getCounsellor();
  if (!me) return { signedIn: false as const, demoPasscode: usingDemoPasscode() ? DEMO_PASSCODE : null };
  const now = new Date().toISOString();
  const own = await getSessionId(false);
  const [cases, all, open] = await Promise.all([listCases(), listMeetings(), openSlots(now)]);
  const { next, past } = advisorMeetings(all, me.id, now);
  const m = q.meeting ? all.find((x) => x.id === q.meeting && (x.advisor.id === me.id || x.advisor.id === DEMO_ADVISOR.id)) : null;
  const c = q.caseId ? cases.find((x) => x.id === q.caseId) : null;
  const open1 = async (sid: string) => { const state = await loadState(sid); return { state, view: computeView(state), catalog: catalog() }; };
  return {
    signedIn: true as const,
    counsellor: me,
    now,
    days: windowDays(now),
    times: GRID_TIMES,
    meetings: { next: next.map(publicMeeting), past: past.slice(0, 30).map(publicMeeting) },
    myOpen: open.filter((s) => s.advisor.id === me.id).map((s) => s.start),
    myBooked: all.filter((x) => x.advisor.id === me.id && upcoming(x, now)).map((x) => x.start),
    cases: cases.map((x) => caseSummary(x.id, x.state, x.sid === own)),
    selectedMeeting: m ? { meeting: publicMeeting(m), ...(await open1(m.sid)) } : null,
    selectedCase: c ? { id: c.id, state: c.state, view: computeView(c.state), catalog: catalog() } : null,
  };
}

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  return NextResponse.json(await payload({ meeting: u.get("meeting"), caseId: u.get("case") }));
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad("Invalid request."); }
  const type = String(body.type ?? "");
  const caseId = typeof body.caseId === "string" ? body.caseId : null;
  const meetingId = typeof body.meetingId === "string" ? body.meetingId : null;

  if (type === "signIn") {
    const r = await signIn(body.name, body.passcode);
    if (typeof r === "string") return bad(r, 401);
    await logEvent("counsellor_signed_in", "counsellor", { counsellor: r });
    return NextResponse.json(await payload({}));
  }
  if (type === "signOut") {
    await signOut();
    return NextResponse.json(await payload({}));
  }

  const me = await getCounsellor();
  if (!me) return bad("Sign in as an advisor first.", 401);
  const now = new Date().toISOString();
  // A meeting this advisor may act on: their own, or the shared demo advisor's.
  const mine = async () => {
    const m = meetingId ? (await listMeetings()).find((x) => x.id === meetingId) : null;
    return m && (m.advisor.id === me.id || m.advisor.id === DEMO_ADVISOR.id) ? m : null;
  };

  switch (type) {
    case "toggleSlot": {
      const start = String(body.start ?? "");
      const id = slotId(me.id, start);
      const isOpen = (await openSlots(now)).some((s) => s.id === id);
      if (isOpen) {
        if ((await listMeetings()).some((m) => m.slotId === id && upcoming(m, now))) return bad("Someone has booked that time. Cancel the meeting first.");
        await removeSlot(id);
      } else {
        if (!isOpenable(start, now)) return bad("Pick a time in the next two weeks that has not passed.");
        await addSlot({ id, start, advisor: me });
      }
      return NextResponse.json(await payload({}));
    }
    case "advise": {
      const m = await mine();
      if (!m || m.status === "cancelled") return bad("That meeting was not found, or it was cancelled.", 404);
      const notes = String(body.notes ?? "").trim().slice(0, MAX_NOTES);
      if (notes.length < 10) return bad("Write a few words of advice for the worker.");
      const next: Meeting = { ...publicMeeting(m), status: "advised", notes, notesAt: now };
      await updateMeeting(next);
      await logEvent("advice_given", m.sid, { meeting: m.id, advisor: me, topic: m.topic, noteHash: sha(notes) });
      return NextResponse.json(await payload({ meeting: m.id }));
    }
    case "cancelMeeting": {
      const m = await mine();
      if (!m || !upcoming(m, now)) return bad("That meeting was not found, or it has already happened.", 404);
      const reason = String(body.reason ?? "").trim().slice(0, 300);
      if (reason.length < 3) return bad("Tell the worker why, so they can rebook.");
      await updateMeeting({ ...publicMeeting(m), status: "cancelled", cancelledAt: now, cancelledBy: "advisor", reason });
      return NextResponse.json(await payload({ meeting: m.id }));
    }
    case "demoMeeting": {
      // A made-up worker in their own new session, booked into this advisor's next free half hour.
      const s = personaState("hafiz")!;
      const plan = computeView(s).plan;
      const sid = crypto.randomBytes(12).toString("hex");
      await saveState(sid, { ...s, clock: { t0: now }, chosenRoleId: plan?.roleId ?? null });
      const taken = new Set((await listMeetings()).filter((m) => m.advisor.id === me.id && upcoming(m, now)).map((m) => m.start));
      const start = windowDays(now).slice(1).flatMap((d) => GRID_TIMES.map((t) => slotStart(d, t))).find((x) => !taken.has(x) && isOpenable(x, now));
      if (!start) return bad("Your next two weeks are fully booked.");
      const id = slotId(me.id, start);
      await addSlot({ id, start, advisor: me });
      const m: Meeting = {
        id: crypto.randomBytes(9).toString("base64url"), slotId: id, start, advisor: me, caseId: anonymise(sid),
        worker: { name: s.profile!.name, synthetic: true }, status: "booked", topic: "courses",
        question: "The plan says a data course first, but I can only study in the evenings and money is tight. Is there a cheaper order to do things in?",
        bookedAt: now,
      };
      if (!(await insertMeeting(m, sid))) return bad("Could not book the demo meeting. Please try again.");
      return NextResponse.json(await payload({ meeting: m.id }));
    }
    case "demoCase": {
      // A made-up worker who has finished every step and asked for the badge.
      const state = finishedPersonaState("hafiz", now);
      if (!state) return bad("Could not build the demo pathway.");
      const sid = crypto.randomBytes(12).toString("hex");
      await saveState(sid, state);
      await logEvent("completion_requested", sid, { role: state.chosenRoleId, synthetic: true });
      return NextResponse.json(await payload({ caseId: anonymise(sid) }));
    }
    case "confirm": {
      const c = caseId ? await findCase(caseId) : null;
      if (!c) return bad("That case was not found.", 404);
      const r = confirmCompletion(c.state, computeView(c.state).plan, me, String(body.note ?? ""), now, crypto.randomBytes(9).toString("base64url"));
      if (typeof r === "string") return bad(r);
      await logEvent("badge_issued", c.sid, r.record);
      await saveState(c.sid, r.state);
      return NextResponse.json(await payload({ caseId: c.id }));
    }
    default:
      return bad("Unknown action.");
  }
}
