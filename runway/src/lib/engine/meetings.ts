import type { Signer } from "./state";

// Advisor meetings. The worker books a 30-minute slot when they want a second opinion; nothing waits on it.
// Times are Malaysia time (UTC+8, no daylight saving), stored as UTC ISO strings.

export const TZ = "Asia/Kuala_Lumpur";
const OFFSET = "+08:00";
export const SLOT_MINUTES = 30;
export const WINDOW_DAYS = 14;
export const MAX_QUESTION = 500;
export const MAX_NOTES = 1500;
// The grid an advisor can open: 09:00 to 16:30 starts.
export const GRID_TIMES = Array.from({ length: 16 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const DEMO_TIMES = ["10:00", "11:30", "14:30", "16:00"];

export const DEMO_ADVISOR: Signer = { id: "c-demo", name: "Demo advisor (made-up)" };

export const TOPICS = [
  { id: "mock", label: "A mock interview" },
  { id: "job", label: "Which job to aim for" },
  { id: "courses", label: "Courses and what they cost" },
  { id: "time", label: "Fitting it into my time" },
  { id: "interview", label: "Interviews and applications" },
  { id: "other", label: "Something else" },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];
export const isTopic = (x: unknown): x is TopicId => TOPICS.some((t) => t.id === x);
export const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? "Something else";

export type Slot = { id: string; start: string; advisor: Signer; demo?: boolean };
export type MeetingStatus = "booked" | "advised" | "cancelled";
export type Meeting = {
  id: string; slotId: string; start: string; advisor: Signer;
  // The anonymised session id, the same one the hash log and the case list use.
  caseId: string;
  worker: { name: string; synthetic: boolean };
  status: MeetingStatus;
  topic: TopicId; question: string; bookedAt: string;
  cancelledAt?: string; cancelledBy?: "worker" | "advisor"; reason?: string;
  notes?: string; notesAt?: string;
};

// "2026-10-21" for the Malaysian calendar day of an instant.
export const myDay = (iso: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
export const myTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
export const slotStart = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00${OFFSET}`).toISOString();
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
// Monday = 0 … Sunday = 6, for a calendar day.
export const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

// The bookable window: today plus the next 13 days, Malaysia time.
export const windowDays = (now: string) => Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(myDay(now), i));

// A start an advisor may open: on the grid, inside the window, and not already past.
export function isOpenable(start: string, now: string) {
  const t = Date.parse(start);
  if (!Number.isFinite(t) || t <= Date.parse(now)) return false;
  return windowDays(now).includes(myDay(start)) && GRID_TIMES.includes(myTime(start));
}

export const slotId = (advisorId: string, start: string) => `${advisorId}|${start}`;

// The made-up advisor's weekday hours, generated on the fly so the calendar is never empty.
export function demoSlots(now: string): Slot[] {
  const out: Slot[] = [];
  for (const day of windowDays(now)) {
    if (weekday(day) > 4) continue;
    for (const hhmm of DEMO_TIMES) {
      const start = slotStart(day, hhmm);
      if (Date.parse(start) > Date.parse(now)) out.push({ id: slotId(DEMO_ADVISOR.id, start), start, advisor: DEMO_ADVISOR, demo: true });
    }
  }
  return out;
}

export const active = (m: Meeting) => m.status !== "cancelled";
export const upcoming = (m: Meeting, now: string) => active(m) && Date.parse(m.start) + SLOT_MINUTES * 6e4 > Date.parse(now);

// Free slots in the window, earliest first: every open slot not held by a live booking.
export function freeSlots(open: Slot[], meetings: Meeting[], now: string): Slot[] {
  const taken = new Set(meetings.filter(active).map((m) => m.slotId));
  const days = new Set(windowDays(now));
  const seen = new Set<string>();
  return open
    .filter((s) => Date.parse(s.start) > Date.parse(now) && days.has(myDay(s.start)) && !taken.has(s.id) && !seen.has(s.id) && seen.add(s.id))
    .sort((a, b) => a.start.localeCompare(b.start) || a.advisor.name.localeCompare(b.advisor.name));
}

// Checks a booking before it is stored. The store's unique index is the final word on a slot being free.
export function checkBooking(slot: Slot | undefined, mine: Meeting[], now: string, hasProfile: boolean): string | null {
  if (!hasProfile) return "Tell us about yourself first, so the advisor knows who they are meeting.";
  if (!slot) return "That time is no longer free. Please pick another.";
  if (Date.parse(slot.start) <= Date.parse(now)) return "That time has passed. Please pick another.";
  if (mine.some((m) => upcoming(m, now))) return "You already have a meeting booked. Cancel it first to pick a new time.";
  return null;
}

// The advisor's side: what is on their list, with the next meeting first and past ones after.
export function advisorMeetings<M extends Meeting>(all: M[], advisorId: string, now: string) {
  const mine = all.filter((m) => m.advisor.id === advisorId || m.advisor.id === DEMO_ADVISOR.id);
  const next = mine.filter((m) => upcoming(m, now)).sort((a, b) => a.start.localeCompare(b.start));
  const past = mine.filter((m) => !upcoming(m, now)).sort((a, b) => b.start.localeCompare(a.start));
  return { next, past };
}

// "Tue 28 Oct" for a calendar day, and "Tue 28 Oct, 10:00" for a slot, both in Malaysia time.
export const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(new Date(`${day}T12:00:00${OFFSET}`));
export const whenLabel = (iso: string) => `${dayLabel(myDay(iso))}, ${myTime(iso)}`;
