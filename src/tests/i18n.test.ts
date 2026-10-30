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
