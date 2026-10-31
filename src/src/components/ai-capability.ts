import { series } from "@/lib/engine/data";

// The data behind the AI benchmark chart, kept apart from AiTrendCharts so the landing page can show the
// headline numbers without loading Recharts up front.
export const qLabel = (q: string) => q.replace("Q", " Q");

// Chart 2: the best AI result on three public benchmarks each quarter (Epoch AI). Not split by sector.
// Three hues that all read on the cream theme: green, amber, deep ink.
export const BENCH = [
  { id: "swe", color: "var(--accent)", name: "Fixing real software bugs" },
  { id: "tbench", color: "var(--fall)", name: "Doing tasks on a computer" },
  { id: "hle", color: "var(--ink)", name: "Very hard expert exam questions" },
];
export function aiCapability(asOfQuarter: string) {
  const qs = [...new Set(BENCH.flatMap((b) => series.epoch[b.id].frontier.map((x) => x.q)))].filter((q) => q >= "2024Q3" && q <= asOfQuarter).sort();
  const data = qs.map((q) => {
    const row: Record<string, number | string> = { q: qLabel(q) };
    for (const b of BENCH) {
      const v = series.epoch[b.id].frontier.find((x) => x.q === q)?.v;
      if (v !== undefined) row[b.id] = v;
    }
    return row;
  });
  const metr = series.epoch.metr.frontier.filter((x) => x.q <= asOfQuarter);
  const hours = (v: number) => 2 ** v / 60;
  const mNow = metr[metr.length - 1], mThen = metr.find((x) => x.q === "2024Q3");
  const summary = mThen ? `In 2024, AI could finish a task that takes a person about ${Math.round(hours(mThen.v) * 60)} minutes. By ${qLabel(mNow.q)}, it could finish tasks that take a person about ${hours(mNow.v).toFixed(0)} hours.` : "";
  const headline = mThen ? { hoursNow: Math.round(hours(mNow.v)), minutesThen: Math.round(hours(mThen.v) * 60), asOf: qLabel(mNow.q) } : null;
  return { data, summary, headline };
}
