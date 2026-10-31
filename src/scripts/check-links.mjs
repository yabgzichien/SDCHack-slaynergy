// Updates linkStatus and checked in data/courses.json. A 403 means "check by hand", not "broken".
import fs from "node:fs";

const file = "data/courses.json";
const courses = JSON.parse(fs.readFileSync(file, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const UA = "Mozilla/5.0 (Jobbery link check)";

for (const c of courses) {
  try {
    const r = await fetch(c.url, { method: "GET", redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    const status = r.status === 403 ? "403 to automated checks; open it manually to confirm" : String(r.status);
    if (String(c.linkStatus).startsWith("403") && r.status === 403) continue; // keep any note written by hand
    c.linkStatus = r.status === 200 ? 200 : status;
    if (r.status === 200) c.checked = today;
  } catch (e) {
    c.linkStatus = `error: ${e.name}`;
  }
  if (c.linkStatus !== 200) console.log(c.id, c.linkStatus, c.url);
}
fs.writeFileSync(file, JSON.stringify(courses, null, 2) + "\n");
