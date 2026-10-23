import type { BuiltResume } from "@/lib/build-resume";

// The updated resume drawn as a printed page: a coloured name band, a side column for skills and education, and the
// main column for the summary, experience, courses and portfolio. Skills learned on the plan are marked "New".
// Resume contents stay in English (data-no-translate), like the scanned resume.
export function ResumeSheet({ r }: { r: BuiltResume }) {
  const head = "text-[10.5px] font-extrabold uppercase tracking-[.16em]";
  return (
    <article data-no-translate aria-label={`Updated resume for ${r.name}`} className="mx-auto w-full max-w-[680px] overflow-hidden rounded-md bg-white text-[12.5px] leading-relaxed text-[#26332c] shadow-[0_8px_30px_rgba(33,60,50,.18)]">
      <header className="bg-[#22405f] px-6 py-5 text-white sm:px-8">
        <h3 className="text-[22px] font-extrabold tracking-[.06em]">{r.name}</h3>
        <p className="mt-0.5 text-[13px] font-medium text-[#ffd59a]">{r.headline}</p>
        {r.place && <p className="mt-1 text-[11px] text-white/75">{r.place}, Malaysia</p>}
      </header>
      <div className="grid sm:grid-cols-[34%_1fr]">
        <aside className="space-y-5 bg-[#f3f6fa] px-5 py-5">
          <section>
            <h4 className={`${head} text-[#22405f]`}>Skills</h4>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {r.skills.map((s) => (
                <li key={s.name} className={`rounded px-2 py-0.5 text-[11px] ${s.isNew ? "bg-[#fff0d6] font-semibold text-[#7a4508] ring-1 ring-[#e9a54a]" : "bg-white text-[#33433a] ring-1 ring-[#d5dee8]"}`}>
                  {s.name}{s.isNew && <span className="ml-1 rounded-sm bg-[#c9741a] px-1 text-[9px] font-bold uppercase text-white">New</span>}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className={`${head} text-[#22405f]`}>Education</h4>
            <p className="mt-1.5">{r.education}</p>
          </section>
        </aside>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <section>
            <h4 className={`${head} border-b border-[#d5dee8] pb-0.5 text-[#22405f]`}>Profile</h4>
            <p className="mt-1.5">{r.summary}</p>
          </section>
          {r.experience.length > 0 && (
            <section>
              <h4 className={`${head} border-b border-[#d5dee8] pb-0.5 text-[#22405f]`}>Work experience</h4>
              {r.experience.map((e) => <p key={e.title} className="mt-1.5 flex justify-between gap-3"><b className="font-bold">{e.title}</b><span className="text-[11px] text-[#6b7a70]">{e.detail}</span></p>)}
            </section>
          )}
          {r.courses.length > 0 && (
            <section>
              <h4 className={`${head} border-b border-[#d5dee8] pb-0.5 text-[#7a4508]`}>Recent training</h4>
              <ul className="mt-1.5 space-y-1">{r.courses.map((c) => <li key={c.title} className="flex gap-2"><span aria-hidden className="text-[#c9741a]">▸</span><span>{c.title}{c.provider && <span className="text-[#6b7a70]"> · {c.provider}</span>}</span></li>)}</ul>
            </section>
          )}
          {r.portfolio && (
            <section>
              <h4 className={`${head} border-b border-[#d5dee8] pb-0.5 text-[#6a4fb0]`}>Portfolio</h4>
              <p className="mt-1.5">{r.portfolio}</p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
