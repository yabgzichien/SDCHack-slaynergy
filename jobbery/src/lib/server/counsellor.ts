import crypto from "node:crypto";
import { cookies } from "next/headers";
import { hmac } from "./session";
import { legacyKey } from "../legacy";

// Counsellor sign-in. One shared passcode (COUNSELLOR_PASSCODE, a Replit secret) plus the counsellor's own name.
// Without the secret the published demo passcode works, so judges can try the counsellor view.
// Production would give each counsellor their own login; the name here is what the log and the badge record.
export const DEMO_PASSCODE = "counsellor-demo";
const COOKIE = "jobbery_counsellor";
const MAX_NAME = 60;

export type Counsellor = { id: string; name: string };

const passcode = () => process.env.COUNSELLOR_PASSCODE || DEMO_PASSCODE;
export const usingDemoPasscode = () => !process.env.COUNSELLOR_PASSCODE;

export const cleanName = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
// A short stable id for the name, so log records can be matched to one counsellor without relying on spelling alone.
export const counsellorId = (name: string) => "c-" + crypto.createHash("sha256").update(legacyKey(`jobbery-counsellor|${name.toLowerCase()}`)).digest("hex").slice(0, 8);

const tag = (name: string) => hmac(`counsellor|${name}`).slice(0, 32);
const same = (a: string, b: string) => {
  const x = crypto.createHash("sha256").update(a).digest(), y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
};

export async function getCounsellor(): Promise<Counsellor | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value ?? jar.get(legacyKey(COOKIE))?.value;
  if (!v) return null;
  const [enc, sig] = v.split(".");
  if (!enc || !sig) return null;
  const name = cleanName(Buffer.from(enc, "base64url").toString("utf8"));
  if (!name || !same(sig, tag(name))) return null;
  return { id: counsellorId(name), name };
}

export async function signIn(rawName: unknown, code: unknown): Promise<Counsellor | string> {
  const name = cleanName(rawName);
  if (name.length < 2) return "Enter your name as the worker should see it.";
  if (!same(String(code ?? ""), passcode())) return "That passcode is not right.";
  (await cookies()).set(COOKIE, `${Buffer.from(name, "utf8").toString("base64url")}.${tag(name)}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12, secure: process.env.NODE_ENV === "production",
  });
  return { id: counsellorId(name), name };
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(legacyKey(COOKIE));
}
