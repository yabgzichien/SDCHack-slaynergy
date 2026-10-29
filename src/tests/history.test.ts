import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { personas, series } from "@/lib/engine/data";
import { computeWorld } from "@/lib/engine/world";
import { computeView, historyChanges, viewAsOf, type View } from "@/lib/engine/view";
import { personaState } from "@/lib/engine/review";
import { DOSM_RELEASE_DAYS, HISTORY_FROM, dosmQuarterAt, epochQuarterAt, historyStops, openQuestionsAt, releaseDay, scoresAt, settleDay, upcomingRelease, weightsAt, yearOf } from "@/lib/engine/history";
import { epochSettleDay, makeQuestions } from "@/lib/engine/questions";
import { nowYear, NOW, withNow } from "@/lib/engine/expiry";

const hafiz = () => personaState(personas[0].id)!;
const stops = historyStops();
const past = stops.filter((s) => !s.today);
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const pct = (x: number) => `${Math.round(x * 100)}%`;

describe("history timeline: the releases", () => {
  it("has one stop per dated DOSM release from 2025 Q3 to today, in order, with the real publication days", () => {
    expect(stops.map((s) => s.q)).toEqual(["2025Q3", "2025Q4", "2026Q1", "2026Q2"]);
    expect(stops[0].q).toBe(HISTORY_FROM);
    expect(stops.at(-1)!.today).toBe(true);
    expect(stops.at(-1)!.q).toBe(series.market.dosm.live);
    expect(stops.map((s) => s.day)).toEqual(["2026-04-28", "2026-05-25", "2026-06-25", "2026-08-18"]);
    for (const s of stops) {
      expect(s.day).toBe(series.dosm.publishedAt[s.q] ?? DOSM_RELEASE_DAYS[s.q]);
      expect(s.url).toContain(`q${s.q[5]}${s.q.slice(0, 4)}`);
    }
    for (let i = 1; i < stops.length; i++) expect(stops[i].day > stops[i - 1].day).toBe(true);
  });

  it("names the next release with DOSM's announced day", () => {
    expect(upcomingRelease()).toMatchObject({ q: "2026Q3", day: "2026-11-17" });
  });

  it("dates every question by when its answer became public", () => {
    expect(settleDay({ kind: "dosm", quarter: "2025Q4" })).toBe("2026-05-25");
    expect(settleDay({ kind: "dosm", quarter: "2021Q1" })).toBe("0000-00-00"); // before every dated release
    expect(settleDay({ kind: "epoch", quarter: "2026Q1" })).toBe(epochSettleDay("2026Q1"));
    expect(releaseDay("2026Q3")).toBeNull(); // not published yet: never estimated
  });

  it("works out decimal years and puts the skill-date clock back", () => {
    expect(yearOf("2026-01-01")).toBe(2026);
    expect(yearOf("2026-07-02")).toBeCloseTo(2026.5, 2);
    expect(withNow(2026.3, () => nowYear())).toBe(2026.3);
    expect(nowYear()).toBe(NOW);
  });
});

describe("history timeline: nothing from after the day", () => {
  it("replaying every answer gives exactly today's stored scores", () => {
    expect(scoresAt("2099-01-01")).toEqual(computeWorld(hafiz()).scores);
  });

  it("uses only DOSM quarters, Epoch AI quarters and answers public by each past day", () => {
    const st = hafiz();
    for (const s of past) {
      const v = viewAsOf(st, s.q);
      expect(v.world.asOfQuarter).toBe(s.q);
      expect(dosmQuarterAt(s.day)).toBe(s.q);
      for (const h of v.world.clericalHistory) { const d = settleDay({ kind: "dosm", quarter: h.q }); expect(d !== null && d <= s.day).toBe(true); }
      const eq = v.world.epochQuarter!;
      expect(eq).toBe(epochQuarterAt(s.day));
      expect(epochSettleDay(eq) <= s.day).toBe(true);
      expect(v.pace.asOf).toBe(eq);
      expect(v.world.nextAnswers.dosm).toBeNull();
      expect(v.world.events).toEqual([]);
      // The weights equal those from only the questions answered by then, and differ from those with the next answers.
      expect(v.world.weights).toEqual(weightsAt(s.day));
      const later = makeQuestions().filter((q) => q.phase !== "next" && (settleDay(q) ?? "9999") > s.day);
      expect(later.length).toBeGreaterThan(0);
      expect(v.world.weights).not.toEqual(weightsAt("2099-01-01"));
    }
  });

  it("lists the questions open on a past day without their answers", () => {
    for (const s of past) {
      const open = openQuestionsAt(s.day);
      expect(open.length).toBeGreaterThan(0);
      for (const q of open) {
        expect(q).not.toHaveProperty("outcome");
        const qq = makeQuestions().find((x) => x.id === q.id)!;
        expect((settleDay(qq) ?? "9999") > s.day).toBe(true);
      }
    }
  });
});

describe("history timeline: read-only and consistent", () => {
  it("never changes the session, the data or today's forecast", () => {
    const st = hafiz();
    const before = { st: hash(st), data: hash(series), w: computeWorld(st).weights };
    const today = computeView(st);
    const at = (q: string) => (q === series.market.dosm.live ? today : viewAsOf(st, q));
    for (const s of stops) { at(s.q); historyChanges(st, s.q, { at }); }
    expect(hash(st)).toBe(before.st);
    expect(hash(series)).toBe(before.data);
    expect(computeWorld(st).weights).toEqual(before.w);
    expect(nowYear()).toBe(NOW);
  });

  it("gives the same numbers in the bands, the pages and the log at every stop", () => {
    const st = hafiz();
    const today = computeView(st);
    const views: Record<string, View> = {};
    const at = (q: string) => (views[q] ??= q === series.market.dosm.live ? today : viewAsOf(st, q));
    for (const [i, s] of stops.entries()) {
      const v = at(s.q);
      if (!s.today) expect(weightsAt(s.day)).toEqual(v.world.weights);
      const log = historyChanges(st, s.q, { at });
      const prev = i > 0 ? at(stops[i - 1].q) : null;
      for (const f of v.world.futures) {
        const line = log.find((c) => c.kind === "futures" && c.text.startsWith(`${f.name}:`))!;
        expect(line.text).toContain(prev ? `${pct(prev.world.weights[f.id])} → ${pct(f.weight)}` : pct(f.weight));
      }
      for (const c of log.filter((x) => x.source.url.includes("release-content"))) expect(c.source.date).toMatch(/\d{1,2} \w{3} \d{4}/);
    }
  });

  it("changes the job order, a radar row and the forecast when stepping back one release", () => {
    const st = hafiz();
    const a = viewAsOf(st, past.at(-1)!.q), b = viewAsOf(st, past.at(-2)!.q);
    expect(a.matches.map((m) => m.roleId)).not.toEqual(b.matches.map((m) => m.roleId));
    expect(a.world.weights).not.toEqual(b.world.weights);
    const rows = (v: View) => JSON.stringify([v.radar.risingJobs.map((x) => x.roleId), v.radar.declining.map((x) => [x.skillId, x.expected])]);
    expect(rows(a)).not.toBe(rows(b));
  });
});
