import { sourceById } from "@/lib/engine/data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayLabel = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

// What the app is showing for a source whose last check failed: the last good figures, and from when.
export function lastGood(k: string, updatedAt?: string): string {
  const src = sourceById[k];
  if (k === "dosm" && src) return `${src.latest.split(" ")[0].replace("Q", " Q")}, published ${dayLabel(src.latest.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? src.retrieved)}`;
  if (k === "epoch" && src) return src.latest;
  return updatedAt ? `loaded ${dayLabel(updatedAt)}` : "the figures that came with the app";
}
