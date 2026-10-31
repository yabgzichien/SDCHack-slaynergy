import Image from "next/image";

// Compact, titleless tiles derived from the SDG artwork: authentic goal colour, number and pictogram.
const COLORS = [
  "#E5243B", "#DDA63A", "#4C9F38", "#C5192D", "#FF3A21", "#26BDE2", "#FCC30B", "#A21942", "#FD6925",
  "#DD1367", "#FD9D24", "#BF8B2E", "#3F7E44", "#0A97D9", "#56C02B", "#00689D", "#19486A",
];

// The UN's own page for a goal.
export const sdgUrl = (goal: number) => `https://sdgs.un.org/goals/goal${goal}`;

// The official colour of a goal, for tinting anything that serves it.
export const sdgColor = (goal: number) => COLORS[goal - 1] ?? "#64748b";

export function SdgIcon({ goal, size = 44 }: { goal: number; size?: number }) {
  if (goal < 1 || goal > 17) {
    return <span aria-hidden className="inline-flex shrink-0 rounded-lg bg-slate-500" style={{ width: size, height: size }} />;
  }
  return (
    <Image aria-hidden src={`/sdg-icons/goal-${goal}.png`} alt="" width={size} height={size}
      className="inline-block shrink-0 rounded-lg" style={{ width: size, height: size }} />
  );
}
