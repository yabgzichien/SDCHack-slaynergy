// Downloads each course provider's site icon into public/logos/<domain>.png, so the app never calls other sites at runtime.
// Usage: node scripts/fetch-logos.mjs   (then commit public/logos and data/logos.json)
import fs from "node:fs";
import crypto from "node:crypto";
import { logoDomain } from "../src/lib/logo-domain.mjs";

const courses = JSON.parse(fs.readFileSync("data/courses.json", "utf8"));
const domains = [...new Set(courses.map(logoDomain))].sort();
fs.mkdirSync("public/logos", { recursive: true });
const ok = {};
const seen = new Map();
for (const d of domains) {
  const res = await fetch(`https://www.google.com/s2/favicons?domain=${d}&sz=128`);
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = crypto.createHash("sha1").update(buf).digest("hex");
  // The service returns the same generic globe for sites without an icon: skip those, the app shows a book instead.
  if (!res.ok || buf.length < 200) { console.log("no icon:", d); continue; }
  seen.set(hash, [...(seen.get(hash) ?? []), d]);
  fs.writeFileSync(`public/logos/${d}.png`, buf);
  ok[d] = hash;
}
for (const ds of seen.values()) if (ds.length > 2) for (const d of ds) { delete ok[d]; fs.rmSync(`public/logos/${d}.png`); console.log("generic icon:", d); }
fs.writeFileSync("data/logos.json", JSON.stringify(Object.keys(ok).sort(), null, 1) + "\n");
console.log(Object.keys(ok).length, "of", domains.length, "providers have a logo");
