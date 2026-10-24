import { logit } from "./math";

// Hanson's logarithmic market scoring rule. Prices are probabilities; points only, never money.
export type Lmsr = { qy: number; qn: number; b: number };

export const newMarket = (b = 60): Lmsr => ({ qy: 0, qn: 0, b });
export const cost = (m: Lmsr) => m.b * Math.log(Math.exp(m.qy / m.b) + Math.exp(m.qn / m.b));
export const price = (m: Lmsr) => 1 / (1 + Math.exp((m.qn - m.qy) / m.b));

export type Trade = { side: "yes" | "no"; shares: number; spent: number };

// Buy shares on the side of `target` until the price reaches it or the budget runs out.
export function tradeToward(m: Lmsr, target: number, budget: number): Trade | null {
  const p = price(m);
  if (budget <= 0 || Math.abs(target - p) < 1e-4) return null;
  const side: "yes" | "no" = target > p ? "yes" : "no";
  const diff = m.qy - m.qn;
  const want = m.b * logit(target) - diff; // yes: increase diff; no: decrease it
  const full = side === "yes" ? want : -want;
  if (full <= 0) return null;
  const costOf = (s: number) => {
    const next = side === "yes" ? { ...m, qy: m.qy + s } : { ...m, qn: m.qn + s };
    return cost(next) - cost(m);
  };
  let shares = full;
  if (costOf(full) > budget) {
    let lo = 0, hi = full;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (costOf(mid) > budget) hi = mid; else lo = mid;
    }
    shares = lo;
  }
  if (shares <= 1e-9) return null;
  const spent = costOf(shares);
  if (side === "yes") m.qy += shares; else m.qn += shares;
  return { side, shares, spent };
}

export const payout = (t: Trade, outcome: boolean) => ((t.side === "yes") === outcome ? t.shares : 0);
