import crypto from "node:crypto";
import { cookies } from "next/headers";
import { legacyKey } from "../legacy";

const COOKIE = "jobbery_sid";
// Without SESSION_SECRET: a fixed secret in development, and in production a random one per server process
// (sessions then reset on restart). Kept on globalThis so hot reloads do not sign everyone out.
const g = globalThis as unknown as { __jobberySecret?: string };
const secret = () => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") return legacyKey("jobbery-local-development-only");
  if (!g.__jobberySecret) {
    g.__jobberySecret = crypto.randomBytes(32).toString("hex");
    console.warn("SESSION_SECRET is not set; using a random per-process secret.");
  }
  return g.__jobberySecret;
};
export const hmac = (s: string) => crypto.createHmac("sha256", secret()).update(s).digest("hex");
const sign = (id: string) => hmac(id).slice(0, 24);

export async function getSessionId(create = true): Promise<string | null> {
  const jar = await cookies();
  for (const name of [COOKIE, legacyKey(COOKIE)]) {
    const v = jar.get(name)?.value;
    if (!v) continue;
    const [id, sig] = v.split(".");
    if (id && sig && sig === sign(id)) return id;
  }
  if (!create) return null;
  const id = crypto.randomBytes(12).toString("hex");
  jar.set(COOKIE, `${id}.${sign(id)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7, secure: process.env.NODE_ENV === "production" });
  return id;
}
