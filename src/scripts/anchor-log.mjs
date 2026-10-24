// Publishes the tamper-evident log's latest fingerprint into the repo, where anyone can compare it with the app.
// Usage: BASE_URL=https://sdc-runway.vercel.app npm run anchor   (then commit the anchors/ folder)
import fs from "node:fs";

const base = process.env.BASE_URL || "http://localhost:3000";
const res = await fetch(`${base}/api/log`);
if (!res.ok) throw new Error(`GET ${base}/api/log failed: ${res.status}`);
const log = await res.json();
if (!log.ok) {
  console.error(`The chain does NOT verify (broken at record ${log.brokenAt}). Not anchoring.`);
  process.exit(1);
}
if (!log.head) {
  console.log("The log is empty; nothing to anchor yet.");
  process.exit(0);
}
fs.mkdirSync("anchors", { recursive: true });
const entry = { seq: log.head.seq, hash: log.head.hash, loggedAt: log.head.ts, anchoredAt: new Date().toISOString(), source: base };
fs.writeFileSync("anchors/log-head.json", JSON.stringify(entry, null, 2) + "\n");
fs.appendFileSync("anchors/ANCHORS.md", `- record ${entry.seq}: \`${entry.hash}\` (anchored ${entry.anchoredAt})\n`);
console.log("Anchored record", entry.seq, entry.hash);
