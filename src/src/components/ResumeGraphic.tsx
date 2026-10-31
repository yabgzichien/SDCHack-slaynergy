import { layoutResume, type ResumeBlock } from "@/lib/engine/resume-layout";

// The scanned resume drawn as a designed page, in the same style as the updated resume at the end of the plan
// (ResumeSheet): a name band, a side column for skills and education, and a main column for the rest.
// Resume contents stay as written (data-no-translate).
const HEAD = "text-[10.5px] font-extrabold uppercase tracking-[.16em] text-[#22405f]";

function Block({ b, side }: { b: ResumeBlock; side?: boolean }) {
  return (
    <section>
      {b.head && <h4 className={`${HEAD} ${side ? "" : "border-b border-[#d5dee8] pb-0.5"}`}>{b.head}</h4>}
      {b.chips.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{b.chips.map((c, i) => <li key={i} className="rounded bg-white px-2 py-0.5 text-[11px] text-[#33433a] ring-1 ring-[#d5dee8]">{c}</li>)}</ul>}
      <div className="mt-1.5 space-y-1">
        {b.entries.map((e, i) => e.kind === "bullet"
          ? <p key={i} className="flex gap-2"><span aria-hidden className="text-[#22405f]">•</span><span>{e.text}</span></p>
          : e.kind === "role"
            ? (
              <div key={i} className={`flex flex-wrap items-baseline justify-between gap-x-3 ${i > 0 ? "pt-2" : ""}`}>
                <p><b className="font-bold">{e.text}</b>{e.org && <span className="text-[#4a5a50]">{side ? <span className="block">{e.org}</span> : `, ${e.org}`}</span>}</p>
                {e.date && <p className="num whitespace-nowrap text-[11px] text-[#6b7a70]">{e.date}</p>}
              </div>
            )
            : <p key={i}>{e.text}</p>)}
      </div>
    </section>
  );
}

export function ResumeGraphic({ lines }: { lines: string[] }) {
  const r = layoutResume(lines);
  return (
    <article data-no-translate aria-label={r.name ? `Resume for ${r.name}` : "Your resume"} className="mx-auto w-full max-w-[720px] overflow-hidden rounded-md bg-white text-[12.5px] leading-relaxed text-[#26332c] shadow-[0_8px_30px_rgba(33,60,50,.18)]">
      {(r.name || r.title || r.contact.length > 0) && (
        <header className="bg-[#22405f] px-6 py-5 text-white sm:px-8">
          {r.name && <h3 className="text-[22px] font-extrabold tracking-[.06em]">{r.name}</h3>}
          {r.title && <p className="mt-0.5 text-[13px] font-medium text-[#ffd59a]">{r.title}</p>}
          {r.contact.map((c) => <p key={c} className="mt-1 break-words text-[11px] text-white/75">{c}</p>)}
        </header>
      )}
      <div className={r.side.length > 0 && r.main.length > 0 ? "grid sm:grid-cols-[34%_1fr]" : ""}>
        {r.side.length > 0 && <aside className="space-y-5 bg-[#f3f6fa] px-5 py-5">{r.side.map((b, i) => <Block key={i} b={b} side />)}</aside>}
        {r.main.length > 0 && <div className="min-w-0 space-y-5 px-5 py-5 sm:px-6">{r.main.map((b, i) => <Block key={i} b={b} />)}</div>}
      </div>
    </article>
  );
}
