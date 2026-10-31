import { describe, expect, it } from "vitest";
import { checkCertificate, needsCertificate, titleMatch, type CertRead } from "@/lib/engine/certificate";
import { parseCertRead } from "@/lib/server/ai-certificate";
import { computeView } from "@/lib/engine/view";
import { personaState } from "@/lib/engine/review";
import { personas } from "@/lib/engine/data";

const step = { title: "AI Fluency: Framework & Foundations", provider: "Anthropic Academy" };
const good: CertRead = { isCertificate: true, completed: true, course: "AI Fluency: Framework & Foundations", issuer: "Anthropic" };

describe("certificate check", () => {
  it("accepts a finished-course certificate for this course", () => {
    expect(checkCertificate(good, step)).toEqual({ ok: true });
  });
  it("rejects what is not a certificate, or not a finished course", () => {
    expect(checkCertificate({ ...good, isCertificate: false }, step).ok).toBe(false);
    expect(checkCertificate({ ...good, completed: false }, step).ok).toBe(false);
  });
  it("rejects a certificate for another course", () => {
    expect(checkCertificate({ ...good, course: "Introduction to Gardening" }, step).ok).toBe(false);
    expect(titleMatch(step.title, "Introduction to Gardening")).toBeLessThan(0.6);
  });
  it("rejects a certificate from a different provider, but not one that names no provider", () => {
    expect(checkCertificate({ ...good, issuer: "Some Other University" }, step).ok).toBe(false);
    expect(checkCertificate({ ...good, issuer: "" }, step).ok).toBe(true);
  });
  it("for a PDF, needs the course title to be in the file's own text", () => {
    expect(checkCertificate(good, step, "Certificate of completion. AI Fluency: Framework & Foundations. Anthropic").ok).toBe(true);
    expect(checkCertificate(good, step, "Certificate of completion. Something else entirely").ok).toBe(false);
  });
  it("keeps only the fields it asked the reader for, as the right types", () => {
    expect(parseCertRead({ isCertificate: "true", completed: true, course: 5, issuer: null, extra: "x" })).toEqual({ isCertificate: false, completed: true, course: "5", issuer: "" });
    expect(parseCertRead(null)).toBeNull();
  });
});

describe("which plan steps need a certificate", () => {
  it("is every course or programme step, and no step with an activity or a practice, application or at-work step", () => {
    const st = personaState(personas[0].id)!;
    const steps = computeView(st).plan!.steps;
    for (const s of steps) {
      expect(needsCertificate(s), s.id).toBe(!s.activity && (s.kind === "course" || s.kind === "programme"));
    }
    expect(steps.some((s) => needsCertificate(s))).toBe(true);
    expect(steps.filter((s) => s.activity).every((s) => !needsCertificate(s))).toBe(true);
  });
});
