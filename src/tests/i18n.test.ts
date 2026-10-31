import { describe, expect, it } from "vitest";
import { DICT, LANGS } from "../src/lib/i18n";
import { ROWS } from "../src/lib/i18n/rows";
import { lookup } from "../src/lib/i18n/dom";
import { roles } from "../src/lib/engine/data";

const names = (s: string) => new Set([...s.matchAll(/\{[#~]?(\w+)\}/g)].map((m) => m[1]));

describe("translations", () => {
  it("every row has all four languages", () => {
    for (const r of ROWS) {
      expect(r.length, r[0]).toBe(4);
      for (const col of r) expect(col.trim().length, r[0]).toBeGreaterThan(0);
    }
  });

  it("translations write blanks plainly ({n}, never {#n} or {~n}), or the number is never filled in", () => {
    const bad = ROWS.flatMap((r) => r.slice(1).filter((t) => /\{[#~]\w+\}/.test(t)).map(() => r[0]));
    expect(bad).toEqual([]);
  });

  it("no translation uses a blank its English text does not have", () => {
    const bad: string[] = [];
    for (const r of ROWS) {
      const want = names(r[0]);
      for (let i = 1; i < 4; i++) for (const n of names(r[i])) if (!want.has(n)) bad.push(`${LANGS[i].code}: ${r[0]} uses {${n}}`);
    }
    expect(bad).toEqual([]);
  });

  it("every job's human core sentence and tag is translated", () => {
    const missing = roles.filter((r) => LANGS.slice(1).some((l) => [r.humanEdge.text, r.humanEdge.tag].some((t) => lookup(l.code as "ms" | "zh" | "ta", t) === null))).map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it("the three languages translate the same set of texts", () => {
    const keys = (l: "ms" | "zh" | "ta") => Object.keys(DICT[l]).sort();
    expect(keys("zh")).toEqual(keys("ms"));
    expect(keys("ta")).toEqual(keys("ms"));
  });

  it("fills blanks, dates and lowercase names", () => {
    expect(lookup("zh", "Plan my path to this job")).toBe("为这份工作规划我的路径");
    expect(lookup("ms", "Aim for procurement officer.")).toBe("Sasarkan Pegawai perolehan.".replace("Pegawai", "pegawai"));
    expect(lookup("zh", "starts changing Apr 2030")).toBe("从 2030年4月 起开始变化");
    expect(lookup("ta", "Weeks 2–3: Core finance")).toContain("வாரங்கள் 2–3");
  });

  it("leaves English alone for English", () => {
    expect(lookup("en", "Plan my path to this job")).toBeNull();
  });
});

describe("the prediction confirmation", () => {
  it.each(["ms", "zh", "ta"] as const)("is fully translated in %s", (lang) => {
    for (const text of [
      "Prediction placed", "Prediction taken back", "+0.1% from you", "You got 44 points back.",
      "You put 25 points on Yes. If you are right you get 44 points back.",
      "The market moved +0.1% because of you: Yes went from 56.8% to 56.9%.",
      "The market moved −0.1% because of you: Yes went from 56.8% to 56.7%.",
      "The market stays at 56.8% Yes: you have already moved this answer as far as one person can.",
      "The market stays at 56.8% Yes.",
    ]) {
      const out = lookup(lang, text);
      expect(out, text).toBeTruthy();
      expect(out, text).not.toContain("{");
    }
  });
});

describe("the your predictions card", () => {
  it.each(["ms", "zh", "ta"] as const)("is fully translated in %s", (lang) => {
    for (const text of ["Your predictions", "75 points in play, worth 76 now", "You have not made a prediction yet.", "Choose an open question", "to start.", "Still open", "Answered", "Put in", "Back if right", "Worth now", "Result", "25 points", "+12 points", "−12 points", "Now 57% think Yes", "The answer was Yes"]) {
      const out = lookup(lang, text);
      expect(out, text).toBeTruthy();
      expect(out, text).not.toContain("{");
    }
  });
});
