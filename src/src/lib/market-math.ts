// Client-safe order maths, used for instant quotes in the ticket. The server is the source of truth: it replays every
// order from the tape using these same rules, and a test checks that both agree.
// Your stake and your say on the market are separate. All your points buy shares at the current Yes %, while the % itself
// moves by a small fixed step, however many points you put in, so the crowd of ~200 sets it and no one person can swing it.
export const PERSON_MOVE = 0.001; // one person moves one answer's Yes % by at most 0.1 of a percentage point in total
export const MAX_PER_ANSWER = 100; // points one person can put into one answer (Yes and No together), across all predictions

export const SCORE_LEAN = 0.05; // for scoring only, never the market: a prediction counts as the crowd's % leaning this far towards the side you chose
// What you are scored on. The market barely moves for you, so the % after your order would score you the same as the crowd.
export function scoredForecast(executions: { action: "buy" | "sell"; side: "yes" | "no"; priceBefore: number }[]): number | null {
  const last = executions.filter((e) => e.action === "buy").at(-1);
  if (!last) return null;
  return Math.min(0.99, Math.max(0.01, last.priceBefore + (last.side === "yes" ? SCORE_LEAN : -SCORE_LEAN)));
}

type Move = { priceBefore: number; priceAfter: number };
// How far this person has pushed the answer so far: above 0 towards Yes, below 0 towards No.
export const pushedSoFar = (executions: Move[]) => executions.reduce((a, e) => a + e.priceAfter - e.priceBefore, 0);

// Where the Yes % lands after a buy. A second prediction on the same side leaves it where it is.
export function priceAfterBuy(price: number, side: "yes" | "no", executions: Move[] = []): number {
  const pushed = pushedSoFar(executions);
  const room = side === "yes" ? PERSON_MOVE - pushed : PERSON_MOVE + pushed;
  const step = room < 1e-9 ? 0 : Math.min(PERSON_MOVE, room);
  return side === "yes" ? Math.max(price, Math.min(0.97, price + step)) : Math.min(price, Math.max(0.03, price - step));
}
// Where the Yes % lands after a sale: taking back everything on a side also takes back that side's push.
export function priceAfterSell(price: number, side: "yes" | "no", sharesLeft: number, executions: Move[] = []): number {
  const pushed = pushedSoFar(executions);
  const sameWay = side === "yes" ? pushed > 1e-9 : pushed < -1e-9;
  return sharesLeft <= 1e-9 && sameWay ? Math.min(0.999, Math.max(0.001, price - pushed)) : price;
}
const sidePrice = (yes: number, side: "yes" | "no") => (side === "yes" ? yes : 1 - yes);

export type Quote = { shares: number; points: number; avg: number; priceBefore: number; priceAfter: number; maxPayout: number; profit: number };

export function quoteBuy(price: number, side: "yes" | "no", points: number, executions: Move[] = []): Quote {
  const avg = sidePrice(price, side), shares = points > 0 ? points / avg : 0;
  return { shares, points: Math.max(0, points), avg, priceBefore: price, priceAfter: priceAfterBuy(price, side, executions), maxPayout: shares, profit: shares - Math.max(0, points) };
}

// Sold at the price after any push comes off, so buying and taking straight back cannot make points.
export function quoteSell(price: number, side: "yes" | "no", shares: number, held = shares, executions: Move[] = []): Quote {
  const priceAfter = priceAfterSell(price, side, held - shares, executions);
  const avg = sidePrice(priceAfter, side);
  return { shares, points: shares * avg, avg, priceBefore: price, priceAfter, maxPayout: 0, profit: 0 };
}
