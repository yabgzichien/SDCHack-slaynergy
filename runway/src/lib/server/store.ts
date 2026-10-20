import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SessionState } from "../engine/state";
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
  all(limit?: number): Promise<LogEntry[]>;
}

function sqliteDriver(): Driver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const file = process.env.SQLITE_PATH || path.join(process.cwd(), ".data", "runway.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL);
           CREATE TABLE IF NOT EXISTS log (seq INTEGER PRIMARY KEY, ts TEXT NOT NULL, type TEXT NOT NULL, session TEXT NOT NULL, payload TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL);`);
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
    async all(limit = 5000) { return db.prepare("SELECT * FROM log ORDER BY seq ASC LIMIT ?").all(limit) as LogEntry[]; },
  };
}

function pgDriver(url: string): Driver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } });
  let ready: Promise<void> | null = null;
  const init = () => (ready ??= (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS log (seq BIGINT PRIMARY KEY, ts TEXT NOT NULL, type TEXT NOT NULL, session TEXT NOT NULL, payload TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL);`);
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
    async all(limit = 5000) { await init(); return (await pool.query("SELECT * FROM log ORDER BY seq ASC LIMIT $1", [limit])).rows.map(toEntry); },
  };
}

const g = globalThis as unknown as { __runwayDb?: Driver };
function db(): Driver {
  return (g.__runwayDb ??= process.env.DATABASE_URL ? pgDriver(process.env.DATABASE_URL) : sqliteDriver());
}

export async function loadState(id: string): Promise<SessionState> {
  const raw = await db().getState(id);
  if (!raw) return initialState();
  try { return { ...initialState(), ...(JSON.parse(raw) as SessionState) }; } catch { return initialState(); }
}
export const saveState = (id: string, s: SessionState) => db().putState(id, JSON.stringify(s));
export const resetState = (id: string) => db().deleteState(id);
export const logEvent = (type: string, sid: string, payload: unknown) => db().append(type, anonymise(sid), JSON.stringify(payload));
export const logHead = () => db().head();
export const logAll = (limit?: number) => db().all(limit);

export function verifyChain(entries: LogEntry[]): { ok: boolean; checked: number; brokenAt: number | null } {
  let prev = GENESIS;
  for (const e of entries) {
    if (e.prev !== prev || entryHash(e) !== e.hash) return { ok: false, checked: entries.length, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true, checked: entries.length, brokenAt: null };
}
