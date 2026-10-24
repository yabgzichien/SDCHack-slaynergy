// Automatic data updates. The server keeps its data as numbered snapshots in the database (snapshot 0 is the bundled
// data/series.json and data/states.json). Every request that reads data calls ensureData(), which loads the newest
// snapshot and, when the last check is old enough, starts a background refresh without making the request wait:
//   1. fetch DOSM Job Market Insights, Epoch AI and OpenDOSM's state figures;
//   2. check each against the data it replaces (src/lib/datasrc/validate.ts); a source that fails is left as it was;
//   3. re-derive the market calendar (engine/calendar.ts), which settles questions whose answers are now in;
//   4. if anything changed, save a new snapshot and write its hash, the settlements and any revisions to the log.
// ILO, the Anthropic Economic Index and the DOSM annual Labour Force Survey report are pinned: a weekly check only
// raises an alert on the Sources page when a newer version appears.
import seriesJson from "../../../data/series.json";
import statesJson from "../../../data/states.json";
import { prevQuarter, series, setSeries, withSeries, type Series } from "../engine/data";
import { geo, setStates, type StatesFile } from "../engine/geo";
import { calendarMoved, deriveCalendar, newlySettled, quarterOfDay } from "../engine/calendar";
import { makeQuestions, pairOf } from "../engine/questions";
import { computeWorld } from "../engine/world";
import { initialState } from "../engine/state";
import { checkDosm, checkEpoch, checkStates } from "../datasrc/validate";
import { checkPinned, fetchDosmRelease, fetchEpoch, fetchStateLabour, EPOCH_ZIP, OPENDOSM, type Alert } from "./sources";
import { getKv, getSnapshot, insertSnapshot, latestSnapshotId, logSystem, setKv, setKvIf, sha256, type SnapshotRow } from "./store";

export type SourceId = "dosm" | "epoch" | "opendosm";
export type SourceStatus = { checkedAt: string; ok: boolean; detail: string; updatedAt?: string };
export type DataStatus = {
  checkedAt: string | null;
  alertsCheckedAt: string | null;
  sources: Partial<Record<SourceId, SourceStatus>>;
  alerts: Alert[];
};
const EMPTY: DataStatus = { checkedAt: null, alertsCheckedAt: null, sources: {}, alerts: [] };

const HOUR = 3600_000, DAY = 24 * HOUR;
const LOCK_MS = 10 * 60_000;
const STATUS_KEY = "data_status", LOCK_KEY = "data_refresh_lock";

const g = globalThis as unknown as { __runwayData?: { loaded: number | null; lastPeek: number; running: boolean } };
const mem = (g.__runwayData ??= { loaded: null, lastPeek: 0, running: false });

const stringify = (s: Series, st: StatesFile) => ({ series: JSON.stringify(s), states: JSON.stringify(st) });
const hashOf = (series: string, states: string) => sha256(`${series}\n${states}`);
const myDay = (ms: number) => new Date(ms + 8 * HOUR).toISOString().slice(0, 10); // Malaysian calendar day

export const refreshDisabled = () => process.env.DATA_REFRESH === "off";

// Load the newest snapshot (seeding snapshot 0 on a fresh database), then start a refresh if one is due.
export async function ensureData(now: number = Date.now()): Promise<void> {
  let id = await latestSnapshotId();
  if (id === null) id = await seed();
  if (mem.loaded !== id) await load(id);
  if (!refreshDisabled()) void maybeRefresh(now);
}

async function seed(): Promise<number> {
  const s = seriesJson as unknown as Series, st = statesJson as unknown as StatesFile;
  const body = stringify(s, st);
  const row: SnapshotRow = { id: 0, createdAt: new Date().toISOString(), hash: hashOf(body.series, body.states), ...body };
  try {
    await insertSnapshot(row);
    await logSystem("data_snapshot", { snapshot: 0, hash: row.hash, changed: ["bundled starting data"], calendar: { dosm: s.market.dosm, epoch: s.market.epoch } });
  } catch { /* another request seeded it first */ }
  return (await latestSnapshotId()) ?? 0;
}

async function load(id: number) {
  const row = await getSnapshot(id);
  if (!row) return;
  setSeries(JSON.parse(row.series) as Series, row.id);
  setStates(JSON.parse(row.states) as StatesFile);
  mem.loaded = row.id;
}

export async function readStatus(): Promise<DataStatus> {
  const raw = await getKv(STATUS_KEY);
  try { return raw ? { ...EMPTY, ...(JSON.parse(raw) as DataStatus) } : EMPTY; } catch { return EMPTY; }
}

// Daily; hourly from DOSM's announced release day until two days after it; the pinned-version check weekly.
export function refreshInterval(now: number, dosmNext: string | undefined): number {
  const today = myDay(now);
  if (dosmNext && today >= dosmNext && today <= myDay(Date.parse(dosmNext) + 2 * DAY)) return HOUR;
  return DAY;
}

async function maybeRefresh(now: number) {
  if (mem.running || now - mem.lastPeek < 60_000) return; // look at most once a minute per server
  mem.lastPeek = now;
  try {
    const st = await readStatus();
    const due = !st.checkedAt || now - Date.parse(st.checkedAt) >= refreshInterval(now, series.sources.find((s) => s.id === "dosm")?.next);
    if (due) await runRefresh(now);
  } catch (e) { console.error("data refresh failed", e); }
}

// One refresh. Returns what happened (also used by `npm run data:refresh`).
export async function runRefresh(now: number = Date.now(), opts: { force?: boolean } = {}): Promise<{ ran: boolean; snapshot: number | null; status: DataStatus }> {
  const nowIso = new Date(now).toISOString();
  const got = await setKvIf(LOCK_KEY, new Date(now + LOCK_MS).toISOString(), nowIso);
  if (!got) return { ran: false, snapshot: null, status: await readStatus() };
  mem.running = true;
  try {
    let id = await latestSnapshotId();
    if (id === null) id = await seed();
    if (mem.loaded !== id) await load(id);
    const cur = series, curStates = geo;
    const status = await readStatus();
    const sources: DataStatus["sources"] = { ...status.sources };
    const mark = (k: SourceId, ok: boolean, detail: string, updated = false) => {
      sources[k] = { checkedAt: nowIso, ok, detail, updatedAt: updated ? nowIso : sources[k]?.updatedAt };
    };
    const changed: string[] = [];
    const today = myDay(now);

    // DOSM Job Market Insights: look for the quarter after the latest one.
    let dosm = cur.dosm, dosmSource = cur.sources.find((s) => s.id === "dosm")!;
    const want = cur.market.dosm.next;
    try {
      const r = await fetchDosmRelease(want);
      if (!r.found) mark("dosm", true, `${want.replace("Q", " Q")} not published yet`);
      else {
        const bad = checkDosm(cur.dosm.quarters, r.quarters);
        if (bad) { mark("dosm", false, `rejected: ${bad}`); await logSystem("snapshot_rejected", { source: "dosm", reason: bad }); }
        else {
          dosm = { publishedAt: { ...cur.dosm.publishedAt, [want]: cur.dosm.publishedAt[want] ?? today }, quarters: r.quarters };
          dosmSource = { ...dosmSource, url: r.page, retrieved: today, latest: `${want} (published ${dosm.publishedAt[want]})`, next: undefined };
          mark("dosm", true, `${want.replace("Q", " Q")} release loaded`, true);
          changed.push(`DOSM Job Market Insights ${want}`);
        }
      }
    } catch (e) { mark("dosm", false, `fetch failed: ${(e as Error).message}`); }

    // Epoch AI: complete quarters only.
    let epoch = cur.epoch, epochSource = cur.sources.find((s) => s.id === "epoch")!;
    try {
      const r = await fetchEpoch(prevQuarter(quarterOfDay(today)));
      const bad = checkEpoch(cur.epoch, r.epoch);
      if (bad) { mark("epoch", false, `rejected: ${bad}`); await logSystem("snapshot_rejected", { source: "epoch", reason: bad }); }
      else {
        const moved = JSON.stringify(r.epoch) !== JSON.stringify(cur.epoch);
        epoch = r.epoch;
        epochSource = { ...epochSource, url: epochSource.url, retrieved: today, latest: r.latestModel ? `models to ${r.latestModel}` : epochSource.latest };
        mark("epoch", true, moved ? "new results loaded" : "no new results", moved);
        if (moved) changed.push("Epoch AI benchmark results");
      }
    } catch (e) { mark("epoch", false, `fetch failed: ${(e as Error).message}`); }

    // OpenDOSM state labour force and wages (the job map); the industry and occupation tables stay pinned.
    let states = curStates;
    try {
      const r = await fetchStateLabour();
      const next: StatesFile = {
        ...curStates,
        states: curStates.states.map((s) => ({ ...s, ...(r.byState[s.id] ?? {}) })),
        sources: curStates.sources.map((s) => s.id === "lfs_state" ? { ...s, latest: r.lfsQuarter } : s.id === "wages_state" ? { ...s, latest: r.wagesYear } : s),
      };
      const bad = checkStates(curStates, next);
      if (bad) { mark("opendosm", false, `rejected: ${bad}`); await logSystem("snapshot_rejected", { source: "opendosm", reason: bad }); }
      else {
        const moved = JSON.stringify(next.states) !== JSON.stringify(curStates.states);
        if (moved) { states = { ...next, generatedAt: today }; changed.push(`OpenDOSM state figures (labour force ${r.lfsQuarter}, wages ${r.wagesYear})`); }
        mark("opendosm", true, moved ? `labour force ${r.lfsQuarter}, wages ${r.wagesYear} loaded` : "no new figures", moved);
      }
    } catch (e) { mark("opendosm", false, `fetch failed: ${(e as Error).message}`); }

    // Pinned sources: alert only.
    let alerts = status.alerts, alertsCheckedAt = status.alertsCheckedAt;
    if (opts.force || !alertsCheckedAt || now - Date.parse(alertsCheckedAt) >= 7 * DAY) {
      const r = await checkPinned();
      for (const a of r.alerts) if (!alerts.some((x) => x.id === a.id && x.found === a.found)) await logSystem("source_alert", a);
      alerts = r.alerts;
      alertsCheckedAt = nowIso;
    }

    // The new data, and the calendar it implies (time alone can settle an Epoch AI quarter).
    const base: Omit<Series, "market"> = {
      ...cur, generatedAt: changed.length ? today : cur.generatedAt, dosm, epoch,
      sources: cur.sources.map((s) => s.id === "dosm" ? dosmSource : s.id === "epoch" ? epochSource : s),
    };
    const market = deriveCalendar(base, cur.market, nowIso);
    const next: Series = { ...base, market };
    const moved = calendarMoved(cur.market, market);
    let snapshot: number | null = null;
    if (changed.length || moved || states !== curStates) {
      snapshot = (id ?? 0) + 1;
      const body = stringify(next, states);
      const hash = hashOf(body.series, body.states);
      await insertSnapshot({ id: snapshot, createdAt: nowIso, hash, ...body });
      await logSystem("data_snapshot", { snapshot, hash, changed: changed.length ? changed : ["market calendar moved"], calendar: { dosm: market.dosm, epoch: market.epoch } });
      await logOutcomes(cur, curStates, next, states, snapshot);
      await load(snapshot);
    }
    const out: DataStatus = { checkedAt: nowIso, alertsCheckedAt, sources, alerts };
    await setKv(STATUS_KEY, JSON.stringify(out));
    return { ran: true, snapshot, status: out };
  } finally {
    mem.running = false;
    await setKv(LOCK_KEY, new Date(0).toISOString());
  }
}

// What a new snapshot settled, and any revision to a question that had already settled (logged, never re-settled).
async function logOutcomes(before: Series, beforeStates: StatesFile, after: Series, afterStates: StatesFile, snapshot: number) {
  const settled = newlySettled(before.market, after.market);
  if (settled.length) {
    const st = { ...initialState(), clock: { t0: new Date().toISOString() } };
    const w0 = withStates(beforeStates, () => withSeries(before, () => computeWorld(st)));
    const w1 = withStates(afterStates, () => withSeries(after, () => computeWorld(st)));
    const crowd = Object.fromEntries(w0.events.map((e) => [e.id, +e.strikes.find((s) => s.base)!.close.toFixed(3)]));
    const qs = withSeries(after, () => makeQuestions());
    await logSystem("data_release", {
      snapshot,
      settled: settled.map((id) => ({ id, outcome: qs.find((q) => q.id === id)?.outcome ?? null, crowd: crowd[id] ?? null })),
      futures: { before: w0.futures.map((f) => +f.weight.toFixed(3)), after: w1.futures.map((f) => +f.weight.toFixed(3)) },
    });
  }
  const revisions = withSeries(after, () => makeQuestions()
    .filter((q) => before.market.frozen[q.id]?.pair)
    .map((q) => {
      const old = withSeries(before, () => pairOf(q, false)), now = pairOf(q, false);
      return old && now && (Math.abs(old[0] - now[0]) > 1e-6 || Math.abs(old[1] - now[1]) > 1e-6) ? { question: q.id, settledOn: after.market.frozen[q.id].pair, dataNow: now } : null;
    })
    .filter((x) => x !== null));
  if (revisions.length) await logSystem("revision", { snapshot, revisions });
}

function withStates<T>(st: StatesFile, f: () => T): T {
  const prev = geo;
  setStates(st);
  try { return f(); } finally { setStates(prev); }
}

// For the Sources page: what the server knows about each source right now.
export async function dataInfo() {
  const status = await readStatus();
  return {
    snapshot: mem.loaded ?? 0,
    status,
    urls: { dosm: series.sources.find((s) => s.id === "dosm")?.url, epoch: EPOCH_ZIP, opendosm: OPENDOSM.lfs },
    disabled: refreshDisabled(),
  };
}
