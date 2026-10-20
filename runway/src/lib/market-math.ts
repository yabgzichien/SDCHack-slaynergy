// Client-safe copy of the LMSR maths, used for instant order quotes in the ticket.
// The server is the source of truth: it recomputes every order from the tape. A test checks that both agree.
export const LIQUIDITY = 200; // must equal TAPE_LIQUIDITY in engine/tape.ts (a test checks the quote against the server)
const lnOnePlusExp = (x: number) => (x > 30 ? x : Math.log1p(Math.exp(x)));

// d = qYes - qNo, recovered from the price p
export const diffFromPrice = (p: number, b = LIQUIDITY) => b * Math.log(Math.min(0.999999, Math.max(0.000001, p)) / (1 - Math.min(0.999999, Math.max(0.000001, p))));
export const priceFromDiff = (d: number, b = LIQUIDITY) => 1 / (1 + Math.exp(-d / b));

// cost of moving the yes-minus-no difference from d to d2 when buying `side` (yes raises d, no lowers it)
function cost(d: number, ds: number, side: "yes" | "no", b = LIQUIDITY) {
  return side === "yes" ? b * (lnOnePlusExp((d + ds) / b) - lnOnePlusExp(d / b)) : b * (lnOnePlusExp((-d + ds) / b) - lnOnePlusExp(-d / b));
}

export type Quote = { shares: number; points: number; avg: number; priceBefore: number; priceAfter: number; maxPayout: number; profit: number };

export function quoteBuy(price: number, side: "yes" | "no", points: number, b = LIQUIDITY): Quote {
  const d = diffFromPrice(price, b);
  let lo = 0, hi = 1;
  while (cost(d, hi, side, b) < points && hi < 1e7) hi *= 2;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (cost(d, mid, side, b) > points) hi = mid; else lo = mid; }
  const shares = lo, spent = cost(d, shares, side, b);
  const d2 = side === "yes" ? d + shares : d - shares;
  return { shares, points: spent, avg: shares > 0 ? spent / shares : 0, priceBefore: price, priceAfter: priceFromDiff(d2, b), maxPayout: shares, profit: shares - spent };
}

export function quoteSell(price: number, side: "yes" | "no", shares: number, b = LIQUIDITY): Quote {
  const d = diffFromPrice(price, b);
  const proceeds = -cost(d, -shares, side, b);
  const d2 = side === "yes" ? d - shares : d + shares;
  return { shares, points: proceeds, avg: shares > 0 ? proceeds / shares : 0, priceBefore: price, priceAfter: priceFromDiff(d2, b), maxPayout: 0, profit: 0 };
}
