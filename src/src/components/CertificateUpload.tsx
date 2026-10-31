"use client";
import { useRef, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Btn } from "@/components/ui";
import type { PlanStep } from "@/lib/engine/plan";

type Result = { status: "verified" | "rejected" | "unreadable" | "unavailable"; message: string };
const ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

// A course step is done when its certificate is uploaded and our AI check confirms it is for this course. The file is
// read once and not kept. The dashed button is the developer shortcut: it finishes every step before the resume in one click, so the
// plan lands on the resume step, the same as the other demo buttons.
export function CertificateUpload({ step, courseHref }: { step: PlanStep; courseHref?: string }) {
  const { act, refresh, busy } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const check = async () => {
    if (!file) return;
    setChecking(true); setResult(null);
    try {
      const body = new FormData();
      body.append("stepId", step.id);
      body.append("file", file);
      const res = await fetch("/api/certificate", { method: "POST", body });
      const d = (await res.json()) as Result;
      setResult(d);
      if (d.status === "verified") await refresh();
    } catch {
      setResult({ status: "unreadable", message: "Network problem. Please try again." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="certificate-upload w-full">
      <p className="certificate-upload-title">Show your certificate to finish this step</p>
      <p className="certificate-upload-copy">Upload a screenshot (JPG or PNG) or a PDF of the certificate. Our AI checks it is for this course. We read it once and do not keep the file.</p>
      <div className="certificate-upload-actions">
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label="Certificate file"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        <Btn variant="ghost" onClick={() => input.current?.click()} disabled={checking} className="certificate-upload-choose">{file ? "Choose another file" : "Choose a certificate"}</Btn>
        <Btn onClick={check} disabled={!file || checking || busy} className="certificate-upload-check">{checking ? "Checking…" : "Check my certificate"}</Btn>
      </div>
      {file && <p className="certificate-upload-file"><FileCheck2 size={14} aria-hidden className="shrink-0" />{file.name}</p>}
      {result && <p role="status" className={`certificate-upload-result ${result.status === "verified" ? "text-rise" : "text-fall"}`}>{result.message}</p>}
      <button type="button" onClick={() => act("certificateDemoAll")} disabled={busy || checking}
        className="certificate-upload-demo press">
        Demo: skip all courses and go to the resume step (for developers)
      </button>
      {courseHref && <Btn href={courseHref} variant="ghost" className="certificate-upload-course">Open the course</Btn>}
    </div>
  );
}
