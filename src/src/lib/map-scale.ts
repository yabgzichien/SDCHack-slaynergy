// Colour scales for the job map, kept apart from the map component so pages can use them on the server too.
// Five steps from pale to deep, one hue per meaning: green for jobs, blue for pay, and amber where more is worse
// (unemployment). The same colours are used in light and dark themes, and every label picks dark or white text,
// whichever contrasts more with the shade under it.
export type Measure = "jobs" | "unemployment" | "wage";
export const RAMPS: Record<"good" | "pay" | "bad", string[]> = {
  good: ["#f1faee", "#c7e9c0", "#9bcb95", "#6fa66a", "#355c35"],
  pay: ["#eff6ff", "#bfdbfe", "#93c5fd", "#4f8fd8", "#24558f"],
  bad: ["#fff0d8", "#f8c982", "#e5ad61", "#bd7b2b", "#7d481d"],
};
export const rampFor = (m: Measure) => (m === "unemployment" ? RAMPS.bad : m === "wage" ? RAMPS.pay : RAMPS.good);
export const LEGEND_RAMP = RAMPS.good;

export const colourFor = (v: number, bins: number[], ramp: string[] = RAMPS.good) => {
  const i = bins.findIndex((b) => v <= b);
  return ramp[i === -1 ? ramp.length - 1 : Math.min(ramp.length - 1, i)];
};

const DARK_TEXT = "#1f421f", LIGHT_TEXT = "#fff0d8";
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Dark or white text for a fill, whichever reads better.
export const inkOn = (fill: string) => (contrast(fill, DARK_TEXT) >= contrast(fill, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT);
export const contrastOn = (fill: string) => contrast(fill, inkOn(fill));

export type MapValue = { id: string; value: number; label: string; short: string };
