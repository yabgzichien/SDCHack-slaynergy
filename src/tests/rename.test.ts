import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStored, removeStored } from "../src/lib/legacy";

const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
import { getSessionId, hmac } from "../src/lib/server/session";
import { counsellorId, getCounsellor, signOut } from "../src/lib/server/counsellor";
import { anonymise } from "../src/lib/server/store";

beforeEach(() => vi.clearAllMocks());

describe("saved data survives the Jobbery rename", () => {
  it("reads old preferences, prefers new choices and clears both on reset", () => {
    const values = new Map([["runway-ai-speed", "slow"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); },
    } as Storage;
    expect(readStored(storage, "jobbery-ai-speed")).toBe("slow");
    values.set("jobbery-ai-speed", "fast");
    expect(readStored(storage, "jobbery-ai-speed")).toBe("fast");
    removeStored(storage, "jobbery-ai-speed");
    expect(readStored(storage, "jobbery-ai-speed")).toBeNull();
  });

  it.each(["runway_sid", "jobbery_sid"])("accepts a valid %s profile cookie", async (cookieName) => {
    const id = "saved-worker";
    jar.get.mockImplementation((name: string) => name === cookieName ? { value: `${id}.${hmac(id).slice(0, 24)}` } : undefined);
    expect(await getSessionId(false)).toBe(id);
    expect(jar.set).not.toHaveBeenCalled();
  });

  it("keeps saved advisor IDs and anonymous log identities stable", () => {
    expect(counsellorId("Demo Advisor")).toBe("c-" + crypto.createHash("sha256").update("runway-counsellor|demo advisor").digest("hex").slice(0, 8));
    expect(anonymise("saved-worker")).toBe(crypto.createHash("sha256").update("runway-session|saved-worker").digest("hex").slice(0, 12));
  });

  it("accepts the previous advisor cookie and clears it when signing out", async () => {
    const name = "Demo Advisor";
    const value = `${Buffer.from(name).toString("base64url")}.${hmac(`counsellor|${name}`).slice(0, 32)}`;
    jar.get.mockImplementation((key: string) => key === "runway_counsellor" ? { value } : undefined);
    expect(await getCounsellor()).toEqual({ name, id: counsellorId(name) });
    await signOut();
    expect(jar.delete).toHaveBeenCalledWith("jobbery_counsellor");
    expect(jar.delete).toHaveBeenCalledWith("runway_counsellor");
  });
});
