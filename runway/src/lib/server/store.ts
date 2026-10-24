import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Meeting, Slot } from "../engine/meetings";
import type { SessionState, Signer } from "../engine/state";
import { initialState } from "../engine/state";

// Storage: Postgres when DATABASE_URL is set (Replit), otherwise a local SQLite file.
// The tamper-evident log is one append-only hash chain shared by all sessions.
export type LogEntry = { seq: number; ts: string; type: string; session: string; payload: string; prev: string; hash: string };

const GENESIS = "0".repeat(64);
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const entryHash = (e: Omit<LogEntry, "hash">) => sha(`${e.seq}|${e.ts}|${e.type}|${e.session}|${e.payload}|${e.prev}`);
export const anonymise = (sid: string) => sha(`runway-session|${sid}`).slice(0, 12);

interface Driver {
  getState(id: string): Promise<string | null>;
  putState(id: string, state: string): Promise<void>;
  deleteState(id: string): Promise<void>;
  append(type: string, session: string, payload: string): Promise<LogEntry>;
  head(): Promise<LogEntry | null>;
  all(): Promise<LogEntry[]>;
  recent(n: number): Promise<LogEntry[]>;
  putCase(id: string, sid: string): Promise<void>;
  dropCase(sid: string): Promise<void>;
  cases(): Promise<{ id: string; sid: string; state: string }[]>;
  slots(after: string): Promise<{ id: string; start: string; advisor: string }[]>;
  addSlot(id: string, start: string, advisor: string): Promise<void>;
  removeSlot(id: string): Promise<void>;
  // False when the slot already has a live booking (the partial unique index refuses it).
  insertMeeting(id: string, slotId: string, sid: string, start: string, status: string, data: string): Promise<boolean>;
  updateMeeting(id: string, status: string, data: string): Promise<void>;
  meetings(): Promise<{ sid: string; data: string }[]>;
  // Data snapshots (see src/lib/server/refresh.ts): append-only, newest id is the active one.
  latestSnapshotId(): Promise<number | null>;
  snapshot(id: number): Promise<SnapshotRow | null>;
  insertSnapshot(row: SnapshotRow): Promise<void>;
  // Small key-value store for the refresh lock and the per-source status. setIf only writes when the stored value is
  // missing or sorts below `below` (an ISO time), so it doubles as a lock with an expiry.
  getKv(key: string): Promise<string | null>;
  setKv(key: string, value: string): Promise<void>;
  setKvIf(key: string, value: string, below: string): Promise<boolean>;
}
export type SnapshotRow = { id: number; createdAt: string; hash: string; series: string; states: string };

const DATA_TABLES = `CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, hash TEXT NOT NULL, series TEXT NOT NULL, states TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);`;
const MEETING_TABLES = `CREATE TABLE IF NOT EXISTS slots (id TEXT PRIMARY KEY, start TEXT NOT NULL, advisor TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, slot_id TEXT NOT NULL, sid TEXT NOT NULL, start TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS meetings_live_slot ON meetings (slot_id) WHERE status <> 'cancelled';`;

function sqliteDriver(): Driver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const file = process.env.SQLITE_PATH || path.join(process.cwd(), ".data", "runway.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL);
           CREATE TABLE IF NOT EXISTS log (seq INTEGER PRIMARY KEY, ts TEXT NOT NULL, type TEXT NOT NULL, session TEXT NOT NULL, payload TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL);
           CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, sid TEXT NOT NULL UNIQUE, updated_at INTEGER NOT NULL);
           ${MEETING_TABLES}
           ${DATA_TABLES}`);
  const appendTx = db.transaction((type: string, session: string, payload: string): LogEntry => {
    const last = db.prepare("SELECT * FROM log ORDER BY seq DESC LIMIT 1").get() as LogEntry | undefined;
    const base = { seq: (last?.seq ?? 0) + 1, ts: new Date().toISOString(), type, session, payload, prev: last?.hash ?? GENESIS };
    const e: LogEntry = { ...base, hash: entryHash(base) };
    db.prepare("INSERT INTO log (seq, ts, type, session, payload, prev, hash) VALUES (?,?,?,?,?,?,?)").run(e.seq, e.ts, e.type, e.session, e.payload, e.prev, e.hash);
    return e;
  });
  return {
    async getState(id) { return (db.prepare("SELECT state FROM sessions WHERE id=?").get(id) as { state: string } | undefined)?.state ?? null; },
    async putState(id, state) { db.prepare("INSERT INTO sessions (id,state,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at").run(id, state, Date.now()); },
    async deleteState(id) { db.prepare("DELETE FROM sessions WHERE id=?").run(id); },
    async append(type, session, payload) { return appendTx(type, session, payload); },
    async head() { return (db.prepare("SELECT * FROM log ORDER BY seq DESC LIMIT 1").get() as LogEntry | undefined) ?? null; },
    async all() { return db.prepare("SELECT * FROM log ORDER BY seq ASC").all() as LogEntry[]; },
    async recent(n) { return db.prepare("SELECT * FROM log ORDER BY seq DESC LIMIT ?").all(n) as LogEntry[]; },
    async putCase(id, sid) { db.prepare("INSERT INTO cases (id,sid,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at").run(id, sid, Date.now()); },
    async dropCase(sid) { db.prepare("DELETE FROM cases WHERE sid=?").run(sid); },
    async cases() { return db.prepare("SELECT c.id, c.sid, s.state FROM cases c JOIN sessions s ON s.id = c.sid ORDER BY c.updated_at DESC LIMIT 200").all() as { id: string; sid: string; state: string }[]; },
    async slots(after) { return db.prepare("SELECT id, start, advisor FROM slots WHERE start > ? ORDER BY start").all(after) as { id: string; start: string; advisor: string }[]; },
    async addSlot(id, start, advisor) { db.prepare("INSERT OR IGNORE INTO slots (id,start,advisor) VALUES (?,?,?)").run(id, start, advisor); },
    async removeSlot(id) { db.prepare("DELETE FROM slots WHERE id=?").run(id); },
    async insertMeeting(id, slotId, sid, start, status, data) {
      try { db.prepare("INSERT INTO meetings (id,slot_id,sid,start,status,data) VALUES (?,?,?,?,?,?)").run(id, slotId, sid, start, status, data); return true; }
      catch (err) { if (String((err as { code?: string }).code).startsWith("SQLITE_CONSTRAINT")) return false; throw err; }
    },
    async updateMeeting(id, status, data) { db.prepare("UPDATE meetings SET status=?, data=? WHERE id=?").run(status, data, id); },
    async meetings() { return db.prepare("SELECT sid, data FROM meetings ORDER BY start DESC LIMIT 1000").all() as { sid: string; data: string }[]; },
    async latestSnapshotId() { return (db.prepare("SELECT id FROM snapshots ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined)?.id ?? null; },
    async snapshot(id) {
      const r = db.prepare("SELECT * FROM snapshots WHERE id=?").get(id) as Record<string, unknown> | undefined;
      return r ? { id: Number(r.id), createdAt: String(r.created_at), hash: String(r.hash), series: String(r.series), states: String(r.states) } : null;
    },
    async insertSnapshot(r) { db.prepare("INSERT INTO snapshots (id,created_at,hash,series,states) VALUES (?,?,?,?,?)").run(r.id, r.createdAt, r.hash, r.series, r.states); },
    async getKv(key) { return (db.prepare("SELECT value FROM kv WHERE key=?").get(key) as { value: string } | undefined)?.value ?? null; },
    async setKv(key, value) { db.prepare("INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value); },
    async setKvIf(key, value, below) {
      return db.prepare("INSERT INTO kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE kv.value < ?").run(key, value, below).changes === 1;
    },
  };
}

function pgDriver(url: string): Driver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } });
  let ready: Promise<void> | null = null;
  const init = () => (ready ??= (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS log (seq BIGINT PRIMARY KEY, ts TEXT NOT NULL, type TEXT NOT NULL, session TEXT NOT NULL, payload TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, sid TEXT NOT NULL UNIQUE, updated_at BIGINT NOT NULL);
      ${MEETING_TABLES}
      ${DATA_TABLES}`);
  })());
  const toEntry = (r: Record<string, unknown>): LogEntry => ({ ...(r as unknown as LogEntry), seq: Number(r.seq) });
  return {
    async getState(id) { await init(); const r = await pool.query("SELECT state FROM sessions WHERE id=$1", [id]); return r.rows[0]?.state ?? null; },
    async putState(id, state) { await init(); await pool.query("INSERT INTO sessions (id,state,updated_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state, updated_at=EXCLUDED.updated_at", [id, state, Date.now()]); },
    async deleteState(id) { await init(); await pool.query("DELETE FROM sessions WHERE id=$1", [id]); },
    async append(type, session, payload) {
      await init();
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock(424242)");
        const last = (await c.query("SELECT * FROM log ORDER BY seq DESC LIMIT 1")).rows[0];
        const base = { seq: Number(last?.seq ?? 0) + 1, ts: new Date().toISOString(), type, session, payload, prev: last?.hash ?? GENESIS };
        const e: LogEntry = { ...base, hash: entryHash(base) };
        await c.query("INSERT INTO log (seq,ts,type,session,payload,prev,hash) VALUES ($1,$2,$3,$4,$5,$6,$7)", [e.seq, e.ts, e.type, e.session, e.payload, e.prev, e.hash]);
        await c.query("COMMIT");
        return e;
      } catch (err) { await c.query("ROLLBACK"); throw err; } finally { c.release(); }
    },
    async head() { await init(); const r = await pool.query("SELECT * FROM log ORDER BY seq DESC LIMIT 1"); return r.rows[0] ? toEntry(r.rows[0]) : null; },
    async all() { await init(); return (await pool.query("SELECT * FROM log ORDER BY seq ASC")).rows.map(toEntry); },
    async recent(n) { await init(); return (await pool.query("SELECT * FROM log ORDER BY seq DESC LIMIT $1", [n])).rows.map(toEntry); },
    async putCase(id, sid) { await init(); await pool.query("INSERT INTO cases (id,sid,updated_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET updated_at=EXCLUDED.updated_at", [id, sid, Date.now()]); },
    async dropCase(sid) { await init(); await pool.query("DELETE FROM cases WHERE sid=$1", [sid]); },
    async cases() { await init(); return (await pool.query("SELECT c.id, c.sid, s.state FROM cases c JOIN sessions s ON s.id = c.sid ORDER BY c.updated_at DESC LIMIT 200")).rows; },
    async slots(after) { await init(); return (await pool.query("SELECT id, start, advisor FROM slots WHERE start > $1 ORDER BY start", [after])).rows; },
    async addSlot(id, start, advisor) { await init(); await pool.query("INSERT INTO slots (id,start,advisor) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", [id, start, advisor]); },
    async removeSlot(id) { await init(); await pool.query("DELETE FROM slots WHERE id=$1", [id]); },
    async insertMeeting(id, slotId, sid, start, status, data) {
      await init();
      try { await pool.query("INSERT INTO meetings (id,slot_id,sid,start,status,data) VALUES ($1,$2,$3,$4,$5,$6)", [id, slotId, sid, start, status, data]); return true; }
      catch (err) { if ((err as { code?: string }).code === "23505") return false; throw err; }
    },
    async updateMeeting(id, status, data) { await init(); await pool.query("UPDATE meetings SET status=$1, data=$2 WHERE id=$3", [status, data, id]); },
    async meetings() { await init(); return (await pool.query("SELECT sid, data FROM meetings ORDER BY start DESC LIMIT 1000")).rows; },
    async latestSnapshotId() { await init(); const r = await pool.query("SELECT id FROM snapshots ORDER BY id DESC LIMIT 1"); return r.rows[0] ? Number(r.rows[0].id) : null; },
    async snapshot(id) {
      await init();
      const r = (await pool.query("SELECT * FROM snapshots WHERE id=$1", [id])).rows[0];
      return r ? { id: Number(r.id), createdAt: r.created_at, hash: r.hash, series: r.series, states: r.states } : null;
    },
    async insertSnapshot(r) { await init(); await pool.query("INSERT INTO snapshots (id,created_at,hash,series,states) VALUES ($1,$2,$3,$4,$5)", [r.id, r.createdAt, r.hash, r.series, r.states]); },
    async getKv(key) { await init(); return (await pool.query("SELECT value FROM kv WHERE key=$1", [key])).rows[0]?.value ?? null; },
    async setKv(key, value) { await init(); await pool.query("INSERT INTO kv (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [key, value]); },
    async setKvIf(key, value, below) {
      await init();
      return ((await pool.query("INSERT INTO kv (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value WHERE kv.value < $3", [key, value, below])).rowCount ?? 0) === 1;
    },
  };
}

// Kept on globalThis so hot reloads reuse one connection. Bump the key when the driver gains methods or tables.
const g = globalThis as unknown as { __runwayDb4?: Driver };
function db(): Driver {
  return (g.__runwayDb4 ??= process.env.DATABASE_URL ? pgDriver(process.env.DATABASE_URL) : sqliteDriver());
}

export async function loadState(id: string): Promise<SessionState> {
  const raw = await db().getState(id);
  if (!raw) return initialState();
  try { return { ...initialState(), ...(JSON.parse(raw) as SessionState), release: 1 }; } catch { return initialState(); }
}
// A session becomes an advisor case once the worker asks for their finished pathway to be confirmed.
// Cases are listed by their anonymised id, the same id the hash log uses, so the raw session id never leaves the server.
export const isCase = (s: SessionState) => s.completion.status !== "none";
export async function saveState(id: string, s: SessionState) {
  await db().putState(id, JSON.stringify(s));
  if (isCase(s)) await db().putCase(anonymise(id), id); else await db().dropCase(id);
}
export async function resetState(id: string) { await db().dropCase(id); await db().deleteState(id); }
export type Case = { id: string; sid: string; state: SessionState };
const parse = (raw: string): SessionState => { try { return { ...initialState(), ...(JSON.parse(raw) as SessionState), release: 1 }; } catch { return initialState(); } };
export const listCases = async (): Promise<Case[]> => (await db().cases()).map((c) => ({ id: c.id, sid: c.sid, state: parse(c.state) })).filter((c) => isCase(c.state));
export const findCase = async (id: string) => (await listCases()).find((c) => c.id === id) ?? null;
// Advisor slots and meetings. Meetings keep the raw session id server-side only; callers strip it before responding.
export type StoredMeeting = Meeting & { sid: string };
export const openSlots = async (after: string): Promise<Slot[]> => (await db().slots(after)).map((r) => ({ id: r.id, start: r.start, advisor: JSON.parse(r.advisor) as Signer }));
export const addSlot = (s: Slot) => db().addSlot(s.id, s.start, JSON.stringify(s.advisor));
export const removeSlot = (id: string) => db().removeSlot(id);
export const insertMeeting = (m: Meeting, sid: string) => db().insertMeeting(m.id, m.slotId, sid, m.start, m.status, JSON.stringify(m));
export const updateMeeting = (m: Meeting) => db().updateMeeting(m.id, m.status, JSON.stringify(m));
export const listMeetings = async (): Promise<StoredMeeting[]> => (await db().meetings()).map((r) => ({ ...(JSON.parse(r.data) as Meeting), sid: r.sid }));
export const meetingsOf = async (sid: string) => (await listMeetings()).filter((m) => m.sid === sid);
export const findMeeting = async (id: string) => (await listMeetings()).find((m) => m.id === id) ?? null;
export const logEvent = (type: string, sid: string, payload: unknown) => db().append(type, anonymise(sid), JSON.stringify(payload));
// Server events (data snapshots, settlements, rejected fetches) are logged under the session "server".
export const logSystem = (type: string, payload: unknown) => db().append(type, "server", JSON.stringify(payload));
export const latestSnapshotId = () => db().latestSnapshotId();
export const getSnapshot = (id: number) => db().snapshot(id);
export const insertSnapshot = (r: SnapshotRow) => db().insertSnapshot(r);
export const getKv = (key: string) => db().getKv(key);
export const setKv = (key: string, value: string) => db().setKv(key, value);
export const setKvIf = (key: string, value: string, below: string) => db().setKvIf(key, value, below);
export const sha256 = sha;
export const logHead = () => db().head();
export const logAll = () => db().all();
export const logRecent = (n: number) => db().recent(n);
// A badge is read back from its log entry, so the public page shows exactly what was recorded.
export async function findBadge(id: string): Promise<LogEntry | null> {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
  return (await db().all()).find((e) => e.type === "badge_issued" && (JSON.parse(e.payload) as { id?: string }).id === id) ?? null;
}

export function verifyChain(entries: LogEntry[]): { ok: boolean; checked: number; brokenAt: number | null } {
  let prev = GENESIS;
  for (const e of entries) {
    if (e.prev !== prev || entryHash(e) !== e.hash) return { ok: false, checked: entries.length, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true, checked: entries.length, brokenAt: null };
}
