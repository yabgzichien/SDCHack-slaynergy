"use client";
import { useT } from "@/components/I18nProvider";
import { STUDIES, type StudyId } from "@/components/studies";

function goToRef(id: StudyId) {
  const el = document.getElementById(`ref-${id}`);
  el?.scrollIntoView({ block: "center" });
  el?.focus({ preventScroll: true });
}

// What backs a step: each line is a sentence, followed by the numbers of its references. `order` is the page's reference list.
// The numbers sit beside the sentence, not inside it, so the page translator still sees the whole sentence.
export function Basis({ order, items }: { order: readonly StudyId[]; items: [string, ...StudyId[]][] }) {
  const { t } = useT();
  return (
    <div className="mt-3 rounded-xl border border-black/10 px-3 py-2.5 text-xs text-muted">
      <p className="font-semibold text-ink">{t("What backs this up")}</p>
      <ul className="mt-1 space-y-1.5">
        {items.map(([text, ...refs]) => (
          <li key={text} className="flex items-start justify-between gap-3">
            <p>{text}</p>
            {refs.length > 0 && (
              <span data-no-translate className="num flex shrink-0 gap-1">
                {refs.map((id) => <button key={id} type="button" onClick={() => goToRef(id)} className="press underline decoration-control underline-offset-2">[{order.indexOf(id) + 1}]</button>)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RefList({ order }: { order: readonly StudyId[] }) {
  const { t } = useT();
  return (
    <>
      <p>{t("Each source below backs the method it is cited for, not the values we chose.")}</p>
      <ol data-no-translate className="space-y-1.5 text-xs">
        {order.map((id, i) => {
          const r = STUDIES[id];
          return (
            <li key={id} id={`ref-${id}`} tabIndex={-1} className="flex gap-2 rounded-lg px-1 py-0.5 outline-none focus:bg-raised">
              <span className="num shrink-0">[{i + 1}]</span>
              <span>{r.cite} <a href={r.url} target="_blank" rel="noreferrer" className="underline decoration-control underline-offset-2">{r.title}</a> {r.where}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
