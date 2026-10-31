import { describe, expect, it } from "vitest";
import { aiProviders, aiReadResume, checkAiRead } from "@/lib/server/ai-resume";

const RESUME = `Work Experience
- Responsible for processing loan applications and checking documents
- Reconciled cash deposits, about 200 entries a day
Skills
Microsoft Excel, CCRIS`;

describe("AI resume reader guards", () => {
  it("reports skills outside the list only when their name and quote are in the resume", () => {
    const r = checkAiRead({ unlisted: [
      { name: "CCRIS", evidence: "Microsoft Excel, CCRIS" },
      { name: "SAP FICO", evidence: "Microsoft Excel, CCRIS" },
      { name: "ccris", evidence: "CCRIS" },
      { name: "Spreadsheets (Excel or Sheets)", evidence: "Microsoft Excel" },
      { name: "Tally", evidence: "used Tally daily" },
      "nonsense",
    ] }, RESUME);
    expect(r.unlisted).toEqual([{ name: "CCRIS", evidence: "Microsoft Excel, CCRIS" }]);
    expect(checkAiRead(null, RESUME).unlisted).toEqual([]);
  });

  it("keeps only known skill ids whose evidence is in the resume", () => {
    const r = checkAiRead({ skills: [
      { id: "spreadsheets", evidence: "Microsoft Excel" },
      { id: "spreadsheets", evidence: "Microsoft Excel" },
      { id: "made_up_skill", evidence: "Microsoft Excel" },
      { id: "payroll", evidence: "Ran payroll for 300 staff" },
    ] }, RESUME);
    expect(r.skills.map((s) => s.id)).toEqual(["spreadsheets"]);
  });

  it("drops rewrites of lines that are not in the resume", () => {
    const r = checkAiRead({ rewrites: [{ before: "Led a team of 12 analysts", after: "Led [how many] analysts", why: "" }] }, RESUME);
    expect(r.rewrites).toHaveLength(0);
  });

  it("drops rewrites that invent numbers, keeps ones with placeholders or original numbers", () => {
    const r = checkAiRead({ rewrites: [
      { before: "Responsible for processing loan applications and checking documents", after: "Processed 150 loan applications a month", why: "" },
      { before: "Responsible for processing loan applications and checking documents", after: "Processed [how many] loan applications and checked documents", why: "Starts with an action." },
      { before: "Reconciled cash deposits, about 200 entries a day", after: "Reconciled about 200 cash deposit entries a day", why: "" },
    ] }, RESUME);
    expect(r.rewrites.map((w) => w.after)).toEqual(["Processed [how many] loan applications and checked documents", "Reconciled about 200 cash deposit entries a day"]);
    expect(r.rewrites[0].before).toBe("Responsible for processing loan applications and checking documents");
  });

  it("survives junk output", () => {
    expect(checkAiRead(null, RESUME)).toMatchObject({ skills: [], rewrites: [] });
    expect(checkAiRead({ skills: "x", rewrites: [1, null] }, RESUME)).toMatchObject({ skills: [], rewrites: [] });
  });

  it("returns null without any API key, so the rule scan runs alone", async () => {
    expect(await aiReadResume(RESUME, {})).toBeNull();
  });

  it("tries RunPod first (needs key and endpoint id), then Groq", () => {
    expect(aiProviders({})).toEqual([]);
    const all = aiProviders({ LLM_API_KEY: "l", LLM_BASE_URL: "https://gw.test/v1/", DATA_ASSIST: "off", RUNPOD_API_KEY: "k", RUNPOD_ENDPOINT_ID: "abc", GROQ_API_KEY: "g" });
    expect(all.map((p) => p.name)).toEqual(["llm", "runpod", "groq"]);
    expect(all[0].url).toBe("https://gw.test/v1/chat/completions");
    expect(all.reduce((t, p) => t + p.timeout, 0)).toBeLessThan(60000);
    expect(aiProviders({ RUNPOD_API_KEY: "k" })).toEqual([]);
    expect(aiProviders({ GROQ_API_KEY: "g" }).map((p) => p.name)).toEqual(["groq"]);
    const both = aiProviders({ RUNPOD_API_KEY: "k", RUNPOD_ENDPOINT_ID: "abc", GROQ_API_KEY: "g" });
    expect(both.map((p) => p.name)).toEqual(["runpod", "groq"]);
    expect(both[0].url).toBe("https://api.runpod.ai/v2/abc/openai/v1/chat/completions");
  });
});
