// Draws a plain-text resume as a printed page: name block, ruled section headings, dated roles, bullets.
const HEADINGS = new Set(["PROFILE", "WORK EXPERIENCE", "EDUCATION", "SKILLS", "PERSONAL DETAILS"]);
type Block = { head: string; lines: string[] };

function parse(text: string) {
  const rows = text.split("\n").map((l) => l.trimEnd());
  const [name = "", title = "", contact = ""] = rows.filter((l) => l.trim()).slice(0, 3);
  const blocks: Block[] = [];
  for (const l of rows.slice(rows.indexOf(contact) + 1)) {
    if (HEADINGS.has(l.trim())) blocks.push({ head: l.trim(), lines: [] });
    else if (l.trim() && blocks.length) blocks[blocks.length - 1].lines.push(l.trim());
  }
  return { name, title, contact, blocks };
}

function Role({ line }: { line: string }) {
  const m = line.match(/^(.*)\(([^)]*)\)\s*$/);
  const [role, ...org] = (m ? m[1] : line).split(",");
  return (
    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 first:mt-0">
      <p className="text-[13px] font-bold text-[#1d2b22]">{role.trim()}{org.length > 0 && <span className="font-medium text-[#4a5a50]">, {org.join(",").trim()}</span>}</p>
      {m && <p className="num text-[11px] text-[#6b7a70]">{m[2]}</p>}
    </div>
  );
}

export function ResumePaper({ text }: { text: string }) {
  const { name, title, contact, blocks } = parse(text);
  return (
    <article data-no-translate aria-label="Sample resume, as a page" className="mx-auto w-full max-w-[640px] bg-white px-6 py-7 text-[12.5px] leading-relaxed text-[#2b3a31] shadow-[0_6px_28px_rgba(33,60,50,.16)] sm:px-10 sm:py-9" style={{ aspectRatio: "auto" }}>
      <header className="border-b-2 border-[#2f5d45] pb-3 text-center">
        <h3 className="text-[22px] font-extrabold tracking-[.08em] text-[#1d2b22]">{name}</h3>
        <p className="mt-0.5 text-[13px] font-semibold text-[#2f5d45]">{title}</p>
        <p className="mt-1 text-[11px] text-[#6b7a70]">{contact}</p>
      </header>
      {blocks.map((b) => (
        <section key={b.head} className="mt-4">
          <h4 className="border-b border-[#cfdccf] pb-0.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#2f5d45]">{b.head}</h4>
          <div className="mt-2">
            {b.head === "SKILLS" ? (
              <ul className="flex flex-wrap gap-1.5">{b.lines.join(", ").split(",").map((s) => <li key={s} className="rounded bg-[#eaf3ea] px-2 py-0.5 text-[11.5px]">{s.trim()}</li>)}</ul>
            ) : b.lines.map((l, i) => l.startsWith("- ")
              ? <p key={i} className="flex gap-2 pl-1"><span aria-hidden className="text-[#2f5d45]">•</span><span>{l.slice(2)}</span></p>
              : b.head === "WORK EXPERIENCE" || b.head === "EDUCATION" ? <Role key={i} line={l} /> : <p key={i}>{l}</p>)}
          </div>
        </section>
      ))}
    </article>
  );
}
