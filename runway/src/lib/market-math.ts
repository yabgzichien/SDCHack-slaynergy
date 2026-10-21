// Client-safe copy of the LMSR maths, used for instant order quotes in the ticket.
// The server is the source of truth: it recomputes every order from the tape. A test checks that both agree.
export const LIQUIDITY = 200; // must equal TAPE_LIQUIDITY in engine/tape.ts (a test checks the quote against the server)
// Limits on one person's say, so the crowd of ~200 sets the price and no single player can swing it.
export const MAX_MOVE = 0.03; // one guess moves the Yes % by at most 3 points; points beyond that are not spent
export const MAX_PER_ANSWER = 100; // points one person can put into one answer (Yes and No together), across all guesses
export const MAX_MOVE_WINDOW = 0.05; // all of one person's guesses on one answer move it by at most 5 points...
export const MOVE_WINDOW_S = 600; // ...in any 10 minutes, so many small guesses cannot add up to one big push
// How far one person's next buy on an answer may move it, given their earlier executions there.
export function moveAllowance(executions: { t: number; action: "buy" | "sell"; priceBefore: number; priceAfter: number }[], t: number): number {
  const recent = executions.filter((e) => e.action === "buy" && e.t > t - MOVE_WINDOW_S && e.t <= t).reduce((a, e) => a + Math.abs(e.priceAfter - e.priceBefore), 0);
  return Math.max(0, Math.min(MAX_MOVE, MAX_MOVE_WINDOW - recent));
}
// The furthest price one buy may reach from `price`.
export const moveLimit = (price: number, side: "yes" | "no", allow = MAX_MOVE) => (side === "yes" ? Math.min(0.97, price + allow) : Math.max(0.03, price - allow));
const lnOnePlusExp = (x: number) => (x > 30 ? x : Math.log1p(Math.exp(x)));

// d = qYes - qNo, recovered from the price p
export const diffFromPrice = (p: number, b = LIQUIDITY) => b * Math.log(Math.min(0.999999, Math.max(0.000001, p)) / (1 - Math.min(0.999999, Math.max(0.000001, p))));
export const priceFromDiff = (d: number, b = LIQUIDITY) => 1 / (1 + Math.exp(-d / b));

// cost of moving the yes-minus-no difference from d to d2 when buying `side` (yes raises d, no lowers it)
function cost(d: number, ds: number, side: "yes" | "no", b = LIQUIDITY) {
  return side === "yes" ? b * (lnOnePlusExp((d + ds) / b) - lnOnePlusExp(d / b)) : b * (lnOnePlusExp((-d + ds) / b) - lnOnePlusExp(-d / b));
}

export type Quote = { shares: number; points: number; avg: number; priceBefore: number; priceAfter: number; maxPayout: number; profit: number };

export function quoteBuy(price: number, side: "yes" | "no", points: number, b = LIQUIDITY, allow = MAX_MOVE): Quote {
  const d = diffFromPrice(price, b);
  let lo = 0, hi = 1;
  while (cost(d, hi, side, b) < points && hi < 1e7) hi *= 2;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (cost(d, mid, side, b) > points) hi = mid; else lo = mid; }
  const cap = Math.max(0, Math.abs(diffFromPrice(moveLimit(price, side, allow), b) - d));
  const shares = Math.min(lo, cap), spent = cost(d, shares, side, b);
  const d2 = side === "yes" ? d + shares : d - shares;
  return { shares, points: spent, avg: shares > 0 ? spent / shares : 0, priceBefore: price, priceAfter: priceFromDiff(d2, b), maxPayout: shares, profit: shares - spent };
}

export function quoteSell(price: number, side: "yes" | "no", shares: number, b = LIQUIDITY): Quote {
  const d = diffFromPrice(price, b);
  const proceeds = -cost(d, -shares, side, b);
  const d2 = side === "yes" ? d - shares : d + shares;
  return { shares, points: proceeds, avg: shares > 0 ? proceeds / shares : 0, priceBefore: price, priceAfter: priceFromDiff(d2, b), maxPayout: 0, profit: 0 };
}
