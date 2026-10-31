import { describe, expect, it } from "vitest";
import { cleanResumeText } from "@/lib/engine/resume-layout";
import { analyseResume } from "@/lib/engine/resume";
import { computeWorld } from "@/lib/engine/world";
import { initialState } from "@/lib/engine/state";

const weights = computeWorld(initialState()).weights;

describe("cleaning text that a PDF gives but the page does not show", () => {
  it("joins letter-spaced headings, including two words run together", () => {
    expect(cleanResumeText("E D U C A T I O N")).toBe("EDUCATION");
    expect(cleanResumeText("S K I L L S")).toBe("SKILLS");
    expect(cleanResumeText("W O R K E X P E R I E N C E")).toBe("WORK EXPERIENCE");
  });
  it("leaves ordinary lines and short initials alone", () => {
    expect(cleanResumeText("Prepared monthly reports for 12 clients")).toBe("Prepared monthly reports for 12 clients");
    expect(cleanResumeText("A B C")).toBe("A B C");
  });
  it("collapses a line the hidden text layer glued to itself, and drops lines it repeated", () => {
    expect(cleanResumeText("Foundation in Science (2023 to 2024)Foundation in Science (2023 to 2024)")).toBe("Foundation in Science (2023 to 2024)");
    expect(cleanResumeText("Xiamen University Malaysia\nCGPA : 3.91\nXiamen University Malaysia")).toBe("Xiamen University Malaysia\nCGPA : 3.91");
  });
  it("keeps short lines that can honestly repeat, and changes nothing when run twice", () => {
    expect(cleanResumeText("2024\nSkills\n2024")).toBe("2024\nSkills\n2024");
    const once = cleanResumeText("W O R K E X P E R I E N C E\nAudit Assistant\nAudit Assistant\nS K I L L S");
    expect(cleanResumeText(once)).toBe(once);
  });
});

describe("the scanner on a template with spaced headings", () => {
  const spaced = [
    "Jane Doe", "jane@example.com", "+60 12-345 6789",
    "S U M M A R Y", "Audit assistant with two years of work in finance teams.",
    "W O R K E X P E R I E N C E", "Audit Assistant, Example Sdn Bhd", "2022 - 2024",
    "Audited 120 monthly financial reports and reconciled spreadsheets against bank records for partner companies.",
    "Prepared tax schedules for 30 clients each quarter and liaised with the representatives of partner enterprises.",
    "E D U C A T I O N", "Bachelor of Accounting, Example University, 2018 - 2022",
    "S K I L L S", "Microsoft Excel, bookkeeping, reconciliation, financial reporting, tax preparation",
  ].join("\n");
  it("finds the sections and no longer asks for headings that are there", () => {
    const a = analyseResume(spaced, weights);
    expect(a.findings.find((f) => f.id === "structure")?.severity).toBe("good");
    expect(a.findings.find((f) => f.id === "skills")?.title).not.toMatch(/Add a Skills section/);
  });
  it("scores the same as the plain-heading version", () => {
    const plain = spaced.replace("S U M M A R Y", "Summary").replace("W O R K E X P E R I E N C E", "Work Experience").replace("E D U C A T I O N", "Education").replace("S K I L L S", "Skills");
    expect(analyseResume(spaced, weights).score).toBe(analyseResume(plain, weights).score);
  });
  it("does not count a doubled text layer twice", () => {
    const plain = spaced.replace("S U M M A R Y", "Summary").replace("W O R K E X P E R I E N C E", "Work Experience").replace("E D U C A T I O N", "Education").replace("S K I L L S", "Skills");
    const doubled = plain.split("\n").map((l) => l + l).join("\n");
    expect(analyseResume(doubled, weights).score).toBe(analyseResume(plain, weights).score);
  });
});
