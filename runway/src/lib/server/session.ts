import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "runway_sid";
const secret = () => process.env.SESSION_SECRET || "runway-dev-secret-change-me";
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
