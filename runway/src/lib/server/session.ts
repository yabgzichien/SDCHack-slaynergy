import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "runway_sid";
// Without SESSION_SECRET: a fixed secret in development, and in production a random one per server process
// (sessions then reset on restart). Kept on globalThis so hot reloads do not sign everyone out.
const g = globalThis as unknown as { __runwaySecret?: string };
const secret = () => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") return "runway-local-development-only";
  if (!g.__runwaySecret) {
    g.__runwaySecret = crypto.randomBytes(32).toString("hex");
    console.warn("SESSION_SECRET is not set; using a random per-process secret.");
  }
  return g.__runwaySecret;
};
const sign = (id: string) => crypto.createHmac("sha256", secret()).update(id).digest("hex").slice(0, 24);

export async function getSessionId(create = true): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  if (v) {
    const [id, sig] = v.split(".");
    if (id && sig && sig === sign(id)) return id;
  }
  if (!create) return null;
  const id = crypto.randomBytes(12).toString("hex");
  jar.set(COOKIE, `${id}.${sign(id)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7, secure: process.env.NODE_ENV === "production" });
  return id;
}
