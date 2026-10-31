import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { refreshIfDue } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";
// A refresh fetches up to three sources with a 60 s timeout each.
export const maxDuration = 60;

// Called hourly by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET". With no secret set the
// route refuses everything, so a missing setting can never leave it open to the public.
function allowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!allowed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await refreshIfDue());
  } catch (e) {
    console.error("scheduled data refresh failed", e);
    return NextResponse.json({ error: "refresh failed" }, { status: 500 });
  }
}
