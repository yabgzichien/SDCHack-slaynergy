// Compact UN SDG tile: official goal colour, goal number, and a short glyph word.
const SDG: Record<number, [string, string]> = {
  1: ["#E5243B", "🏚"], 2: ["#DDA63A", "🌾"], 3: ["#4C9F38", "❤"], 4: ["#C5192D", "📖"],
  5: ["#FF3A21", "⚥"], 6: ["#26BDE2", "💧"], 7: ["#FCC30B", "⚡"], 8: ["#A21942", "📈"],
  9: ["#FD6925", "🏭"], 10: ["#DD1367", "⇄"], 11: ["#FD9D24", "🏙"], 12: ["#BF8B2E", "♻"],
  13: ["#3F7E44", "🌍"], 14: ["#0A97D9", "🐟"], 15: ["#56C02B", "🌳"], 16: ["#00689D", "⚖"],
  17: ["#19486A", "🤝"],
};

export function SdgIcon({ goal, size = 44 }: { goal: number; size?: number }) {
  const [bg, glyph] = SDG[goal] ?? ["#64748b", "•"];
  return (
    <span aria-hidden className="inline-flex shrink-0 flex-col items-center justify-center rounded-lg font-semibold leading-none text-white"
      style={{ background: bg, width: size, height: size }}>
      <span style={{ fontSize: size * 0.42 }}>{goal}</span>
      <span style={{ fontSize: size * 0.3, marginTop: 2 }}>{glyph}</span>
    </span>
  );
}
