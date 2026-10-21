// Publishes the crowd's forecasts for the questions that are still open, BEFORE their real data comes out.
// Commit and push the anchors/ folder: the git history then proves when each forecast was made, and anyone can
// check it against DOSM (17 Nov 2026) and Epoch AI (Jan 2027) once those releases are out.
// Usage: npx tsx scripts/anchor-forecasts.ts
import crypto from "node:crypto";
import fs from "node:fs";
import { computeWorld } from "../src/lib/engine/world";
import { initialState } from "../src/lib/engine/state";
import { replayHistory } from "../src/lib/engine/replay";

// A fixed clock, so the forecast is the crowd's opening price after the 2026 Q2 release and anyone can recompute it.
const T = "2026-10-21T00:00:00.000Z";
const world = computeWorld({ ...initialState(), release: 1, clock: { t0: T, t1: T } }, Date.parse(T));
const stats = replayHistory().stats;

const record = {
  what: "Runway crowd forecasts for questions not yet answered by real data (simulated forecasters, demo)",
  method: "Opening LMSR price of each answer after the 2026 Q2 release; forecasters weighted by the Hedge rule over the replayed releases",
  trackRecord: { questions: stats.questions, from: stats.perQuarter[0].q, to: stats.perQuarter[stats.perQuarter.length - 1].q },
  futures: Object.fromEntries(world.futures.map((f) => [f.id, +f.weight.toFixed(4)])),
  questions: world.events.map((e) => ({
    id: e.id, text: e.text, settles: e.settles, source: e.source.url,
    answers: e.strikes.map((s) => ({ id: s.marketId, label: s.label, main: s.base, yes: +s.close.toFixed(4) })),
  })),
};
const body = JSON.stringify(record, null, 2) + "\n";
const hash = crypto.createHash("sha256").update(body).digest("hex");
const now = new Date().toISOString();
fs.mkdirSync("anchors", { recursive: true });
const file = `anchors/forecasts-${world.events.map((e) => e.quarter).sort().at(-1)}.json`;
fs.writeFileSync(file, body);
fs.appendFileSync("anchors/ANCHORS.md", `- ${now}: open-question forecasts \`${file}\` sha256 \`${hash}\`\n`);
console.log(`Wrote ${file} (sha256 ${hash}). Commit and push anchors/ now, before the releases come out.`);
