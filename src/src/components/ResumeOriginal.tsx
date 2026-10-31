"use client";
import { useState } from "react";

export type ResumeSource = { name: string; text: string; html?: string; fileUrl?: string; isPdf?: boolean };

const WORD_CSS = "body{margin:0;padding:40px 48px;font:14px/1.55 system-ui,sans-serif;color:#26332c;overflow-wrap:anywhere}h1,h2,h3{margin:1.1em 0 .4em;line-height:1.25}p{margin:.45em 0}ul,ol{margin:.4em 0;padding-left:1.4em}table{border-collapse:collapse;width:100%}td,th{padding:4px 8px;vertical-align:top}img{max-width:100%}@media(max-width:600px){body{padding:24px 20px}}";

// The worker's own resume, as they made it: the PDF itself, the Word file's content, or their text with its line breaks.
export function ResumeOriginal({ source: s }: { source: ResumeSource }) {
  const [wordHeight, setWordHeight] = useState(900);
  const page = "mx-auto block w-full max-w-[760px] rounded-md bg-white shadow-[0_8px_30px_rgba(33,60,50,.18)]";

  if (s.isPdf && s.fileUrl) {
    return (
      <div>
        <iframe title={`${s.name}, your resume`} src={`${s.fileUrl}#toolbar=0&navpanes=0&view=FitH`} className={`${page} h-[85vh]`} />
        <p className="mt-2 text-center text-xs text-muted"><a href={s.fileUrl} target="_blank" rel="noreferrer" className="underline decoration-control underline-offset-2">Open your file</a></p>
      </div>
    );
  }
  if (s.html) {
    // No scripts may run in here, so same-origin only lets this page read the height. Word files can hold links and markup we did not write.
    return (
      <iframe
        title={`${s.name}, your resume`} sandbox="allow-same-origin" srcDoc={`<!doctype html><meta charset="utf-8"><base target="_blank"><style>${WORD_CSS}</style>${s.html}`}
        onLoad={(e) => { const h = e.currentTarget.contentDocument?.body.scrollHeight; if (h) setWordHeight(h); }}
        style={{ height: wordHeight }} className={page}
      />
    );
  }
  return <pre data-no-translate className={`${page} whitespace-pre-wrap break-words px-6 py-8 font-sans text-sm leading-relaxed text-[#26332c] sm:px-12 sm:py-10`}>{s.text}</pre>;
}
