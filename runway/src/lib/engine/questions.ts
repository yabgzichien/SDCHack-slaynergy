import { series, prevQuarter, quarterLabel, quarterIndex, sourceById } from "./data";
import { FUTURES, type FutureId } from "./futures-def";
import { clamp, mean, median, normCdf, std } from "./math";

export type Phase = "replay" | "live" | "next";
export type Question = {
  id: string;
  quarter: string;
  kind: "dosm" | "epoch";
  series: string; // "dosm_clerical" or an Epoch series id
  text: string;
  threshold: number; // dosm: change in share (points) below which the answer is yes (0); epoch: gain to beat
  source: { name: string; url: string };
  settles: string;
  reason: string;
  phase: Phase;
  outcome?: boolean;
};

export const REPLAY_FROM_DOSM = "2021Q1";
export const REPLAY_FROM_EPOCH = "2023Q1";
export const LIVE_QUARTER = "2026Q2"; // the release the app holds back
export const NEXT_QUARTER = "2026Q3";
export const LAST_BEFORE = "2026Q1"; // newest data visible in the "before" state

const dosmShares = new Map(series.dosm.quarters.map((d) => [d.q, d.clerical_share]));
const floorOf = (id: string) => {
  const v = series.epoch[id].frontier.map((x) => x.v);
  return Math.max(0.05, 0.04 * (Math.max(...v) - Math.min(...v)));
};

function epochGains(id: string, upTo: string): { q: string; g: number }[] {
  const f = series.epoch[id].frontier;
  const out: { q: string; g: number }[] = [];
  for (let i = 1; i < f.length; i++) if (quarterIndex(f[i].q) <= quarterIndex(upTo)) out.push({ q: f[i].q, g: f[i].v - f[i - 1].v });
  return out;
}
function dosmChanges(upTo: string): { q: string; d: number }[] {
  const qs = series.dosm.quarters;
  const out: { q: string; d: number }[] = [];
  for (let i = 1; i < qs.length; i++) if (quarterIndex(qs[i].q) <= quarterIndex(upTo)) out.push({ q: qs[i].q, d: qs[i].clerical_share - qs[i - 1].clerical_share });
  return out;
}

const fmt = (x: number, unit: string) => (unit.startsWith("doubl") ? x.toFixed(2) : x.toFixed(1));
const unitShort = (u: string) => (u.startsWith("doubl") ? "doublings" : "points");

function epochThreshold(id: string, q: string) {
  const g = epochGains(id, prevQuarter(q)).map((x) => x.g);
  if (g.length < 3) return null;
  const med = median(g.slice(-4));
  return { d: med > 1e-6 ? med : 0, g };
}

export function makeQuestions(): Question[] {
  const out: Question[] = [];
  const dosmQs = series.dosm.quarters.map((d) => d.q);
  const published = series.dosm.publishedAt;

  const addDosm = (q: string, phase: Phase) => {
    const hist = dosmChanges(prevQuarter(q));
    const last4 = hist.slice(-4);
    const fell = last4.filter((x) => x.d < 0).length;
    const lastShare = dosmShares.get(prevQuarter(q));
    const known = dosmShares.has(q);
    out.push({
      id: `dosm-${q}`, quarter: q, kind: "dosm", series: "dosm_clerical",
      text: `Will clerical support's share of online job ads fall in ${quarterLabel(q)}?`,
      threshold: 0,
      source: { name: "DOSM Job Market Insights", url: sourceById.dosm.url },
      settles: phase === "next" ? `DOSM release of ${sourceById.dosm.next ?? "next quarter"}` : `DOSM ${quarterLabel(q)} release${published[q] ? ` (${published[q]})` : ""}`,
      reason: `The clerical share fell in ${fell} of the last ${last4.length} quarters; it was ${lastShare?.toFixed(2)}% in ${quarterLabel(prevQuarter(q))} (DOSM).`,
      phase,
      outcome: known && phase !== "next" ? dosmShares.get(q)! - dosmShares.get(prevQuarter(q))! < 0 : undefined,
    });
  };

  const addEpoch = (id: string, q: string, phase: Phase) => {
    const th = epochThreshold(id, q);
    if (!th) return;
    const e = series.epoch[id];
    const f = e.frontier.find((x) => x.q === q);
    const pf = e.frontier.find((x) => x.q === prevQuarter(q));
    const known = phase !== "next" && f && pf;
    const last3 = th.g.slice(-3).map((x) => fmt(x, e.unit)).join(", ");
    const thLabel = th.d > 0 ? `by more than ${fmt(th.d, e.unit)} ${unitShort(e.unit)}` : "at all";
    out.push({
      id: `${id}-${q}`, quarter: q, kind: "epoch", series: id,
      text: `Will the best ${e.name} result rise ${thLabel} in ${quarterLabel(q)}?`,
      threshold: th.d,
      source: { name: "Epoch AI benchmarking data", url: sourceById.epoch.url },
      settles: phase === "next" ? "Epoch AI data after the quarter closes" : `Epoch AI data for ${quarterLabel(q)} (retrieved ${sourceById.epoch.retrieved})`,
      reason: `The best result rose ${last3} ${unitShort(e.unit)} in the last quarters (Epoch AI).`,
      phase,
      outcome: known ? f!.v - pf!.v > th.d + 1e-9 : undefined,
    });
  };

  for (const q of dosmQs) {
    if (quarterIndex(q) >= quarterIndex(REPLAY_FROM_DOSM) && quarterIndex(q) <= quarterIndex(LAST_BEFORE)) addDosm(q, "replay");
  }
  addDosm(LIVE_QUARTER, "live");
  addDosm(NEXT_QUARTER, "next");
  for (const id of Object.keys(series.epoch)) {
    const f = series.epoch[id].frontier;
    for (const p of f) {
      if (quarterIndex(p.q) >= quarterIndex(REPLAY_FROM_EPOCH) && quarterIndex(p.q) <= quarterIndex(LAST_BEFORE)) addEpoch(id, p.q, "replay");
    }
    if (series.epoch[id].replayOnly) continue;
    addEpoch(id, LIVE_QUARTER, "live");
    addEpoch(id, NEXT_QUARTER, "next");
  }
  return out.sort((a, b) => quarterIndex(a.quarter) - quarterIndex(b.quarter) || a.id.localeCompare(b.id));
}

// What each future expects. Parameters come from futures-def.ts and are shown in the app.
export function futureProbs(q: Question, opts: { saturation?: boolean } = {}): Record<FutureId, number> {
  const res = {} as Record<FutureId, number>;
  if (q.kind === "dosm") {
    const ch = dosmChanges(prevQuarter(q.quarter)).slice(-8).map((x) => x.d);
    const sigma = Math.max(std(ch), 0.25);
    for (const f of FUTURES) res[f.id] = clamp(normCdf((q.threshold - f.clericalDriftPp) / sigma), 0.04, 0.96);
    return res;
  }
  const gains = epochGains(q.series, prevQuarter(q.quarter)).map((x) => x.g);
  let gbar = mean(gains.slice(-4));
  if (opts.saturation && series.epoch[q.series].unit.startsWith("%")) {
    // Careful experts know scores near 100% cannot keep rising at the old pace: scale by remaining headroom.
    const f = series.epoch[q.series].frontier.filter((x) => quarterIndex(x.q) < quarterIndex(q.quarter));
    const now = 100 - f[f.length - 1].v;
    const avg = mean(f.slice(-5, -1).map((x) => 100 - x.v));
    if (avg > 0) gbar *= clamp(now / avg, 0.2, 1.5);
  }
  const sigma = Math.max(std(gains.slice(-8)), 0.5 * Math.abs(gbar), floorOf(q.series));
  for (const f of FUTURES) res[f.id] = clamp(1 - normCdf((q.threshold - f.capMult * gbar) / sigma), 0.04, 0.96);
  return res;
}

// Plain-language real figures for a settled question.
export function factFor(q: Question): string | null {
  if (q.kind === "dosm") {
    const a = dosmShares.get(prevQuarter(q.quarter)), b = dosmShares.get(q.quarter);
    return a !== undefined && b !== undefined ? `Clerical share of online job ads: ${a.toFixed(2)}% → ${b.toFixed(2)}%` : null;
  }
  const f = series.epoch[q.series].frontier;
  const a = f.find((x) => x.q === prevQuarter(q.quarter)), b = f.find((x) => x.q === q.quarter);
  if (!a || !b) return null;
  return `Best ${series.epoch[q.series].name}: ${fmt(a.v, series.epoch[q.series].unit)} → ${fmt(b.v, series.epoch[q.series].unit)} (${b.v - a.v >= 0 ? "+" : ""}${fmt(b.v - a.v, series.epoch[q.series].unit)} ${unitShort(series.epoch[q.series].unit)})`;
}


// ---------- the ladder: several strikes per event (like Kalshi's "Above 25.5% / 26.4% / 27.7%") ----------
export type Strike = Question & { eventId: string; strike: number; label: string; base: boolean };
export const STRIKES = 3;

const floorUnit = (id: string) => floorOf(id);

export function ladder(q: Question): Strike[] {
  const ths: number[] = q.kind === "dosm" ? [-0.5, 0, 0.5] : (() => {
    const f = floorUnit(q.series);
    const d = q.threshold;
    return d > 0 ? [d * 0.5, d, d * 1.5] : [0, f, 2 * f];
  })();
  return ths.map((t, k) => {
    const label = q.kind === "dosm"
      ? (t < 0 ? `Falls by more than ${Math.abs(t).toFixed(1)} points` : t === 0 ? "Falls at all" : `Rises by less than ${t.toFixed(1)} points`)
      : (t > 0 ? `Rises by more than ${fmt(t, series.epoch[q.series].unit)} ${unitShort(series.epoch[q.series].unit)}` : "Rises at all");
    let outcome: boolean | undefined;
    if (q.kind === "dosm") {
      const a = dosmShares.get(prevQuarter(q.quarter)), b = dosmShares.get(q.quarter);
      outcome = q.phase === "next" || a === undefined || b === undefined ? undefined : b - a < t;
    } else {
      const f = series.epoch[q.series].frontier;
      const a = f.find((x) => x.q === prevQuarter(q.quarter)), b = f.find((x) => x.q === q.quarter);
      outcome = q.phase === "next" || !a || !b ? undefined : b.v - a.v > t + 1e-9;
    }
    return { ...q, id: `${q.id}~${k}`, eventId: q.id, strike: k, label, base: k === 1, threshold: t, outcome };
  });
}

export function eventTitle(q: Question): string {
  if (q.kind === "dosm") return `Clerical support's share of online job ads in ${quarterLabel(q.quarter)}`;
  return `Best ${series.epoch[q.series].name} result in ${quarterLabel(q.quarter)}`;
}
