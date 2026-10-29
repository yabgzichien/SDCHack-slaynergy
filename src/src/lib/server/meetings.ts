import { demoSlots, type Meeting, type Slot } from "../engine/meetings";
import { openSlots, type StoredMeeting } from "./store";

// Every slot that could be booked right now: the made-up advisor's generated hours plus what real advisors opened.
export const allSlots = async (now: string): Promise<Slot[]> => [...demoSlots(now), ...(await openSlots(now))];

// The raw session id never leaves the server.
export function publicMeeting(m: StoredMeeting): Meeting {
  const { sid, ...rest } = m;
  void sid;
  return rest;
}
