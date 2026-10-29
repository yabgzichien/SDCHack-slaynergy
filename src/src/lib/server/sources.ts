// Fetchers for the public sources the server refreshes by itself, and the version checks for the pinned ones.
// Every fetcher returns data or throws; refresh.ts turns a throw into "kept the last good data" plus the reason.
import { buildDosm, buildEpoch, buildStateLabour, EPOCH, isXlsx, parseCsv, unzipCsvs, type StateLabour } from "../datasrc/parse";
import type { DosmQuarter, EpochSeries } from "../engine/data";

const TIMEOUT_MS = 60_000;
const MAX_BYTES = 40 * 1024 * 1024;
const UA = { "user-agent": "Jobbery/1.0 (open-data refresh; https://github.com/yabgzichien/SDCHack-slaynergy)" };

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, { ...init, headers: { ...UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r;
}
async function bytes(url: string): Promise<Uint8Array> {
  const r = await get(url);
  const len = Number(r.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error(`${url}: ${len} bytes is too large`);
  const b = new Uint8Array(await r.arrayBuffer());
  if (b.length > MAX_BYTES) throw new Error(`${url}: too large`);
  return b;
}
const textOf = async (url: string) => new TextDecoder().decode(await bytes(url));

// ---------- OpenDOSM: labour force by state (quarterly) and wages by state (annual) ----------
export const OPENDOSM = {
  lfs: "https://storage.dosm.gov.my/labour/lfs_qtr_state.csv",
  wages: "https://storage.dosm.gov.my/labour/wages_state.csv",
};
export async function fetchStateLabour(): Promise<{ byState: Record<string, StateLabour>; lfsQuarter: string; wagesYear: string }> {
  const [lfs, wages] = await Promise.all([textOf(OPENDOSM.lfs), textOf(OPENDOSM.wages)]);
  return buildStateLabour(lfs, wages);
}

// ---------- DOSM Job Market Insights: one release page per quarter ----------
// The page for 2026 Q2 is .../big-data-analytics-job-market-insights-q22026. A page for a quarter not yet published
// still answers 200 but lists no documents, so "published" means: the page links a document that is a real xlsx.
// This naming is taken from the one release page we have seen; if DOSM names a page differently, nothing is found,
// the current data stays, and the Sources page says the release was not found.
export const dosmPageUrl = (q: string) => `https://www.dosm.gov.my/portal-main/release-content/big-data-analytics-job-market-insights-q${q[5]}${q.slice(0, 4)}`;
const DOC_URL = "https://www.dosm.gov.my/portal-main/release-document-log?release_document_id=";

export type DosmFetch = { found: false; page: string } | { found: true; page: string; doc: string; quarters: DosmQuarter[] };
export async function fetchDosmRelease(q: string): Promise<DosmFetch> {
  const page = dosmPageUrl(q);
  const html = await textOf(page);
  const ids = [...new Set([...html.matchAll(/release_document_id=(\d+)/g)].map((m) => m[1]))];
  for (const id of ids) {
    let b: Uint8Array;
    try { b = await bytes(DOC_URL + id); } catch { continue; }
    if (!isXlsx(b)) continue;
    return { found: true, page, doc: DOC_URL + id, quarters: buildDosm(b, q) };
  }
  return { found: false, page };
}

// ---------- Epoch AI benchmarking data ----------
export const EPOCH_ZIP = "https://epoch.ai/data/benchmark_data.zip";
export async function fetchEpoch(cutoff: string): Promise<{ epoch: Record<string, EpochSeries>; latestModel: string | null }> {
  const files = unzipCsvs(await bytes(EPOCH_ZIP));
  const epoch = buildEpoch(files, cutoff);
  let latest: string | null = null;
  for (const e of EPOCH) {
    if (e.replayOnly) continue;
    for (const r of parseCsv(files[e.file])) {
      const d = (r["Release date"] || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!latest || d > latest)) latest = d;
    }
  }
  return { epoch, latestModel: latest };
}

// ---------- pinned sources: only look for a newer version, never apply it ----------
export type Alert = { id: string; name: string; found: string; url: string };
export const PINNED = { aeiRelease: "release_2026_06_26", iloRetrieved: "2026-10-20", lfsYear: 2024 };

export async function checkPinned(): Promise<{ alerts: Alert[]; errors: string[] }> {
  const alerts: Alert[] = [], errors: string[] = [];
  const tryIt = async (name: string, f: () => Promise<void>) => { try { await f(); } catch (e) { errors.push(`${name}: ${(e as Error).message}`); } };
  await Promise.all([
    tryIt("Anthropic Economic Index", async () => {
      const tree = JSON.parse(await textOf("https://huggingface.co/api/datasets/Anthropic/EconomicIndex/tree/main")) as { path: string }[];
      const newer = tree.map((x) => x.path).filter((p) => /^release_\d{4}_\d{2}_\d{2}$/.test(p) && p > PINNED.aeiRelease).sort();
      if (newer.length) alerts.push({ id: "aei", name: "Anthropic Economic Index", found: `${newer.length} newer release${newer.length > 1 ? "s" : ""}, latest ${newer.at(-1)!.slice(8).replace(/_/g, "-")}`, url: "https://huggingface.co/datasets/Anthropic/EconomicIndex" });
    }),
    tryIt("ILO exposure scores", async () => {
      const commits = JSON.parse(await textOf("https://api.github.com/repos/pgmyrek/2025_GenAI_scores_ISCO08/commits?per_page=1")) as { commit: { committer: { date: string } } }[];
      const d = commits[0]?.commit.committer.date.slice(0, 10);
      if (d && d > PINNED.iloRetrieved) alerts.push({ id: "ilo", name: "ILO GenAI exposure scores", found: `the data repository changed on ${d}`, url: "https://github.com/pgmyrek/2025_GenAI_scores_ISCO08" });
    }),
    tryIt("DOSM Labour Force Survey Report", async () => {
      // The full annual report (with the state tables) is several MB; DOSM's short summary of a year is under 2 MB.
      for (let y = PINNED.lfsYear + 1; y <= PINNED.lfsYear + 3; y++) {
        const url = `https://storage.dosm.gov.my/labour/lfs_annual_${y}.pdf`;
        const r = await fetch(url, { method: "HEAD", headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (r.ok && Number(r.headers.get("content-length") ?? 0) > 3_000_000) alerts.push({ id: "lfs_pdf", name: "DOSM Labour Force Survey Report", found: `a full ${y} report is out`, url });
      }
    }),
  ]);
  return { alerts, errors };
}
