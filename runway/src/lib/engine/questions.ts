import { series, prevQuarter, quarterIndex, sourceById } from "./data";
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
export const NEXT_QUARTER = "2026Q3"; // DOSM: Jul to Sep 2026, published 17 Nov 2026
// Epoch AI: Jul to Sep 2026 has already ended (data retrieved 20 Oct 2026), so the open AI questions ask about Oct to Dec.
export const NEXT_QUARTER_EPOCH = "2026Q4";
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

// Everyday names and wording for the question pages. METR is stored as doublings (log2 minutes), so a change of x
// doublings is shown as "grows by (2^x - 1) x 100 percent" and a level as hours or minutes.
const PLAIN_NAME: Record<string, string> = {
  metr: "How long a task AI can do on its own", swe: "AI fixing real software bugs",
  hle: "AI on very hard expert exam questions", tbench: "AI doing tasks on a computer",
};
const plainName = (id: string) => PLAIN_NAME[id] ?? `AI on ${series.epoch[id].short}`;
const PLAIN_TASK: Record<string, string> = { swe: "fixing real software bugs", hle: "very hard expert exam questions", tbench: "doing tasks on a computer" };
const plainTask = (id: string) => PLAIN_TASK[id] ?? series.epoch[id].short;
const isDoubling = (id: string) => series.epoch[id].unit.startsWith("doubl");
const change = (id: string, x: number) => (isDoubling(id) ? `${Math.round((2 ** x - 1) * 100)}%` : `${x.toFixed(1)} points`);
const level = (id: string, v: number) => {
  if (!isDoubling(id)) return `${v.toFixed(1)} out of 100`;
  const min = 2 ** v;
  return min >= 90 ? `${(min / 60).toFixed(1)} hours` : `${Math.round(min)} minutes`;
};
const MONTHS = ["Jan to Mar", "Apr to Jun", "Jul to Sep", "Oct to Dec"];
export const quarterPlain = (q: string) => `${MONTHS[Number(q[5]) - 1]} ${q.slice(0, 4)}`;

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
      text: `Will a smaller part of Malaysia's job ads be for office admin jobs in ${quarterPlain(q)}?`,
      threshold: 0,
      source: { name: "DOSM Job Market Insights", url: sourceById.dosm.url },
      settles: phase === "next" ? `DOSM release of ${sourceById.dosm.next ?? "next quarter"}` : `DOSM numbers for ${quarterPlain(q)}${published[q] ? ` (published ${published[q]})` : ""}`,
      reason: `Office admin jobs made up a smaller part of job ads in ${fell} of the last ${last4.length} quarters. In ${quarterPlain(prevQuarter(q))} they were ${lastShare?.toFixed(1)} in every 100 job ads (DOSM).`,
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
    const last3 = th.g.slice(-3).map((x) => change(id, x)).join(", ");
    const before = e.frontier.filter((x) => quarterIndex(x.q) <= quarterIndex(prevQuarter(q))).at(-1);
    const from = before ? `, from ${level(id, before.v)} at the end of ${quarterPlain(prevQuarter(q)).split(" to ")[1]}` : "";
    const thLabel = th.d > 0 ? `by more than ${change(id, th.d)}` : "at all";
    out.push({
      id: `${id}-${q}`, quarter: q, kind: "epoch", series: id,
      text: isDoubling(id)
        ? `Will the longest task AI can do on its own grow ${thLabel} in ${quarterPlain(q)}${from}?`
        : `Will the best AI score on ${e.name}, a test of ${plainTask(id)}, rise ${thLabel} in ${quarterPlain(q)}${from}?`,
      threshold: th.d,
      source: { name: "Epoch AI benchmarking data", url: sourceById.epoch.url },
      settles: phase === "next" ? `Epoch AI results for ${quarterPlain(q)}, checked in Jan 2027 (best result by 31 Dec against the best by 30 Sep)` : `Epoch AI results for ${quarterPlain(q)}`,
      reason: `In the last three quarters ${isDoubling(id) ? "the longest task grew by" : "the best score went up by"} ${last3} (Epoch AI).`,
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
    addEpoch(id, NEXT_QUARTER_EPOCH, "next");
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

// A trend chaser's own signal: it ignores the three futures and assumes the last quarter's change repeats.
// It reads the same public data in a different way, so the crowd combines more than one view.
export function trendProb(q: Question): number {
  if (q.kind === "dosm") {
    const ch = dosmChanges(prevQuarter(q.quarter)).map((x) => x.d);
    const sigma = Math.max(std(ch.slice(-8)), 0.25);
    return clamp(normCdf((q.threshold - ch[ch.length - 1]) / sigma), 0.04, 0.96);
  }
  const gains = epochGains(q.series, prevQuarter(q.quarter)).map((x) => x.g);
  const last = gains[gains.length - 1];
  const sigma = Math.max(std(gains.slice(-8)), 0.5 * Math.abs(last), floorOf(q.series));
  return clamp(1 - normCdf((q.threshold - last) / sigma), 0.04, 0.96);
}

// Plain-language real figures for a settled question.
export function factFor(q: Question): string | null {
  if (q.kind === "dosm") {
    const a = dosmShares.get(prevQuarter(q.quarter)), b = dosmShares.get(q.quarter);
    return a !== undefined && b !== undefined ? `Office admin jobs: ${a.toFixed(1)} → ${b.toFixed(1)} in every 100 job ads` : null;
  }
  const f = series.epoch[q.series].frontier;
  const a = f.find((x) => x.q === prevQuarter(q.quarter)), b = f.find((x) => x.q === q.quarter);
  if (!a || !b) return null;
  const id = q.series, d = b.v - a.v;
  return isDoubling(id)
    ? `Longest task: ${level(id, a.v)} → ${level(id, b.v)}`
    : `Best score: ${level(id, a.v)} → ${level(id, b.v)} (${d >= 0 ? "up" : "down"} ${change(id, Math.abs(d))})`;
}


// ---------- the ladder: several strikes per event (easier, main and harder versions of one question) ----------
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
      ? (t < 0 ? `Drops by more than ${Math.abs(t).toFixed(1)} (per 100 ads)` : t === 0 ? "Drops at all" : `Does not rise by ${t.toFixed(1)} or more (per 100 ads)`)
      : (t > 0 ? `${isDoubling(q.series) ? "Grows" : "Goes up"} by more than ${change(q.series, t)}` : `${isDoubling(q.series) ? "Grows" : "Goes up"} at all`);
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
  if (q.kind === "dosm") return `Office admin jobs in Malaysian job ads, ${quarterPlain(q.quarter)}`;
  const name = series.epoch[q.series].name;
  return isDoubling(q.series) ? `${plainName(q.series)} (${name.split(" ")[0]}), ${quarterPlain(q.quarter)}` : `${name}: ${plainName(q.series)}, ${quarterPlain(q.quarter)}`;
}
