import { NextResponse } from "next/server";
import { computeView } from "@/lib/engine/view";
import { checkCertificate, needsCertificate } from "@/lib/engine/certificate";
import { aiReadCertificate, certProviders } from "@/lib/server/ai-certificate";
import { getSessionId } from "@/lib/server/session";
import { loadState, logEvent, saveState } from "@/lib/server/store";
import { ensureData } from "@/lib/server/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const reply = (status: "verified" | "rejected" | "unreadable" | "unavailable", message: string, code = 200) => NextResponse.json({ status, message }, { status: code });

// By what the file starts with, not by its name: a JPG, a PNG screenshot or a PDF.
function kind(b: Buffer): "jpeg" | "png" | "pdf" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "png";
  if (b.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";
  return null;
}

// A step is only ticked here, after the certificate is read and matches the step's course. The file itself is
// processed in memory for this request and never stored; the session keeps only that the step was verified.
export async function POST(req: Request) {
  await ensureData();
  const sid = (await getSessionId())!;
  let form: FormData;
  try { form = await req.formData(); } catch { return reply("rejected", "We could not read that upload.", 400); }
  const file = form.get("file");
  const stepId = String(form.get("stepId") ?? "");
  const state = await loadState(sid);
  const step = computeView(state).plan?.steps.find((s) => s.id === stepId);
  if (!step || !needsCertificate(step)) return reply("rejected", "This step does not need a certificate.", 400);
  if (!(file instanceof File)) return reply("rejected", "Choose a certificate to upload.", 400);
  if (file.size > MAX_BYTES) return reply("rejected", "That file is larger than 5 MB. Please upload a smaller one.", 413);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = kind(buf);
  if (!type) return reply("rejected", "Please upload a JPG, PNG or PDF file.", 415);
  if (!certProviders().length) return reply("unavailable", "Certificate checking is not switched on right now, so we cannot verify it. Please try again later.");

  let text: string | undefined;
  let read;
  if (type === "pdf") {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const out = await extractText(pdf, { mergePages: true });
      text = (Array.isArray(out.text) ? out.text.join("\n") : out.text).trim();
    } catch { text = ""; }
    if (text.length < 20) return reply("unreadable", "We could not read any text in that PDF. Upload a screenshot of the certificate (JPG or PNG) instead.");
    read = await aiReadCertificate({ text });
  } else {
    read = await aiReadCertificate({ image: { mime: type === "jpeg" ? "image/jpeg" : "image/png", base64: buf.toString("base64") } });
  }
  if (!read) return reply("unreadable", "We could not read that certificate. Try a clearer image, or try again in a moment.");

  const check = checkCertificate(read, step, text);
  if (!check.ok) { await logEvent("certificate", sid, { stepId, ok: false }); return reply("rejected", check.reason); }
  await saveState(sid, {
    ...state,
    progress: { ...state.progress, [stepId]: true },
    certificates: { ...state.certificates, [stepId]: { how: "ai", at: new Date().toISOString(), title: step.title } },
  });
  await logEvent("certificate", sid, { stepId, ok: true });
  return reply("verified", "Certificate verified. This step is marked as done.");
}
