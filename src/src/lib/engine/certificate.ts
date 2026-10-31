import type { PlanStep } from "./plan";

// A course or programme step is finished by showing its certificate, not by ticking it. Practice, application and
// at-work steps have no certificate, so they keep the plain tick.
export const needsCertificate = (s: Pick<PlanStep, "kind" | "activity">) => !s.activity && (s.kind === "course" || s.kind === "programme");

// What the reader found on the document. It only reads; checkCertificate decides.
export type CertRead = { isCertificate: boolean; completed: boolean; course: string; issuer: string };
export type CertCheck = { ok: true } | { ok: false; reason: string };

const STOP = new Set(["the", "and", "for", "with", "to", "of", "in", "on", "a", "an", "course", "certificate", "programme", "program", "professional", "introduction"]);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = (s: string) => norm(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w));

// The share of the plan step's title words that the certificate's course title also has.
export const titleMatch = (stepTitle: string, certCourse: string) => {
  const want = words(stepTitle), have = new Set(words(certCourse));
  return want.length ? want.filter((w) => have.has(w)).length / want.length : 0;
};

export const MATCH_AT = 0.6;

// The certificate has to be a finished-course certificate for this step's course, from its provider when the certificate
// names one. `text`, when the document has readable text (a PDF), must also contain what the reader claims to have seen.
export function checkCertificate(read: CertRead, step: { title: string; provider?: string }, text?: string): CertCheck {
  if (!read.isCertificate) return { ok: false, reason: "That does not look like a certificate of completion." };
  if (!read.completed) return { ok: false, reason: "The certificate does not say the course was completed." };
  if (titleMatch(step.title, read.course) < MATCH_AT) return { ok: false, reason: "The course on the certificate does not match this step's course." };
  const issuer = words(read.issuer);
  const provider = words(step.provider ?? "");
  if (issuer.length && provider.length && !provider.some((w) => issuer.includes(w)) && !words(read.course).some((w) => provider.includes(w))) {
    return { ok: false, reason: "The certificate was issued by a different provider than this step's course." };
  }
  if (text !== undefined) {
    const doc = ` ${norm(text)} `;
    if (!words(read.course).every((w) => doc.includes(` ${w} `))) return { ok: false, reason: "We could not find that course title in the file." };
  }
  return { ok: true };
}
