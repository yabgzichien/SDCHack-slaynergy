// Runs one data refresh now, against the same database the app uses (DATABASE_URL, or the local SQLite file), and
// prints what it found. The app does this by itself when someone visits; this is for checking it by hand.
import { runRefresh } from "../src/lib/server/refresh";
import { dataVersion, series } from "../src/lib/engine/data";

runRefresh(Date.now(), { force: true }).then((r) => {
  if (!r.ran) console.log("Another refresh holds the lock; try again in a few minutes.");
  console.log(JSON.stringify(r.status, null, 2));
  console.log(r.snapshot === null ? `No change. Data version ${dataVersion}.` : `New snapshot ${r.snapshot}.`);
  console.log("Market:", JSON.stringify({ dosm: series.market.dosm, epoch: series.market.epoch }));
  process.exit(0);
}, (e) => { console.error(e); process.exit(1); });
