import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../src/app/api/cron/refresh/route";

const call = (auth?: string) => GET(new Request("http://localhost/api/cron/refresh", { headers: auth ? { authorization: auth } : {} }));
const saved = { secret: process.env.CRON_SECRET, off: process.env.DATA_REFRESH };
afterEach(() => {
  if (saved.secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved.secret;
  if (saved.off === undefined) delete process.env.DATA_REFRESH; else process.env.DATA_REFRESH = saved.off;
});

describe("the scheduled data refresh route", () => {
  it("refuses everything when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer anything")).status).toBe(503);
    expect((await call()).status).toBe(503);
  });

  it("rejects a missing or wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call("s3cret-value")).status).toBe(401);
    expect((await call("Bearer s3cret-valuf")).status).toBe(401);
  });

  it("accepts the right secret and does nothing when refresh is off", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    process.env.DATA_REFRESH = "off";
    const r = await call("Bearer s3cret-value");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ran: false, snapshot: null });
  });
});
