import { NextResponse } from "next/server";
import { analyseResume, summarise } from "@/lib/engine/resume";
import { aiReadResume } from "@/lib/server/ai-resume";
import { computeWorld } from "@/lib/engine/world";
import { getSessionId } from "@/lib/server/session";
import { loadState, logEvent, saveState } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024;
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function extract(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: buf })).value;
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return buf.toString("utf8");
  throw new Error("Please upload a PDF, Word (.docx) or text file, or paste the text.");
}

// The resume text is processed in memory for this request only (and, if the worker allows it, sent to the
// Groq API once to read it). It is never stored or logged;
// only the score, the skills you confirm and your findings summary are kept in your session.
export async function POST(req: Request) {
  const sid = (await getSessionId())!;
  let text = "";
  let useAi = true;
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return bad("No file received.");
      useAi = form.get("ai") !== "0";
      if (file.size > MAX_BYTES) return bad("That file is larger than 3 MB. Please upload a smaller one.", 413);
      text = await extract(file);
    } else {
      const body = (await req.json()) as { text?: string; ai?: boolean };
      text = String(body.text ?? "");
      useAi = body.ai !== false;
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : "We could not read that file. Try pasting the text instead.");
  }
  text = text.trim();
  if (text.split(/\s+/).length < 40) return bad("We could not find enough text to scan (at least about 40 words). If your PDF is a picture, paste the text instead.");

  const state = await loadState(sid);
  const world = computeWorld(state);
  // The rule scan always runs; the AI read is optional and only adds suggestions on top of it.
  const [analysis, read] = [analyseResume(text, world.weights), useAi ? await aiReadResume(text) : null];
  const ai = read && { ...read, skills: read.skills.filter((s) => !analysis.skills.some((d) => d.id === s.id)) };
  const aiStatus = !useAi ? "off" : !process.env.GROQ_API_KEY ? "unavailable" : ai ? "used" : "failed";
  const summary = summarise(analysis);
  await saveState(sid, { ...state, resume: summary });
  await logEvent("resume_scan", sid, { score: summary.score, skills: summary.skillIds.length, ai: aiStatus, aiSkills: ai?.skills.length ?? 0, aiRewrites: ai?.rewrites.length ?? 0 });
  // Return the extracted text to this tab so the worker can preview what we read.
  // It is not written to the session, database or logs.
  return NextResponse.json({ analysis, summary, ai, aiStatus, previewText: text });
}
