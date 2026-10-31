"use client";
import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { FUTURES } from "@/lib/engine/futures-def";
import { useT } from "@/components/I18nProvider";
import { Btn } from "@/components/ui";
import { PACE_ORDER, PT } from "@/components/pace-text";
import { Basis as RefBasis, RefList } from "@/components/References";
import type { StudyId } from "@/components/studies";
import type { View } from "@/lib/engine/view";

// How the "AI gets twice as capable every N months" numbers are worked out (engine/view.ts `pace`, futures-def.ts, futures.ts,
// questions.ts `futureProbs`, expiry.ts). Formulas are MathML, which browsers render natively; every number in them is live.
const M = ({ children }: { children: ReactNode }) => (
  <div data-no-translate className="my-1.5 overflow-x-auto rounded-xl bg-raised px-3 py-2 text-[1.05rem]">
    <math display="block">{children}</math>
  </div>
);
const n = (x: string | number) => <mn>{x}</mn>;
const v = (x: string) => <mi>{x}</mi>;
const o = (x: string) => <mo>{x}</mo>;
const sub = (a: ReactNode, b: ReactNode) => <msub><mrow>{a}</mrow><mrow>{b}</mrow></msub>;
const sup = (a: ReactNode, b: ReactNode) => <msup><mrow>{a}</mrow><mrow>{b}</mrow></msup>;
const frac = (a: ReactNode, b: ReactNode) => <mfrac><mrow>{a}</mrow><mrow>{b}</mrow></mfrac>;
const fn = (name: string, arg: ReactNode) => <mrow><mi>{name}</mi><mo>⁡</mo><mrow>{o("(")}{arg}{o(")")}</mrow></mrow>;
const sum = (under: ReactNode, over?: ReactNode) => over === undefined
  ? <munder><mo>∑</mo><mrow>{under}</mrow></munder>
  : <munderover><mo>∑</mo><mrow>{under}</mrow><mrow>{over}</mrow></munderover>;
const gbar = <mover><mi>g</mi><mo>¯</mo></mover>;

const f2 = (x: number) => x.toFixed(2);
const f4 = (x: number) => x.toFixed(4);
const task = (x: number) => { const min = 2 ** x; return min >= 90 ? `${(min / 60).toFixed(1)} h` : `${Math.round(min)} min`; };
const quarter = (q: string) => q.replace("Q", " Q");

function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink">{children}</p>;
}
function Legend({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}
function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-1 space-y-2 text-sm text-muted">{children}</div>
    </section>
  );
}

const Basis = ({ items }: { items: [string, ...StudyId[]][] }) => <RefBasis order={PACE_ORDER} items={items} />;

export function PaceExplain({ pace }: { pace: View["pace"] }) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const g = pace.perQuarter;
  const pts = pace.points;
  const first = pts[0], last = pts[pts.length - 1];
  const rows = FUTURES.map((f) => {
    const p = pace.futures.find((x) => x.id === f.id)!;
    return { id: f.id, name: f.name.replace(" AI progress", ""), m: f.capMult, w: p.weight, d: p.doublingMonths, drift: Math.abs(p.clericalPerYear) };
  });
  const blend = rows.reduce((a, r) => a + r.w * r.m, 0);
  const wDrift = rows.reduce((a, r) => a + r.w * r.drift, 0);
  const th = "px-2 py-1.5 text-left font-medium";
  return (
    <>
      <Btn variant="ghost" onClick={() => ref.current?.showModal()} className="mt-1">{PT.open}</Btn>
      <dialog ref={ref} aria-labelledby="pace-explain-title" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="m-auto w-[min(48rem,calc(100vw-2rem))] max-h-[88vh] overflow-y-auto rounded-[22px] bg-surface p-5 text-ink backdrop:bg-black/40 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="pace-explain-title" className="text-xl font-bold">{PT.title}</h2>
          <button type="button" aria-label={PT.close} onClick={() => ref.current?.close()} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised"><X size={18} aria-hidden /></button>
        </div>
        <p className="mt-2 text-sm text-muted">{PT.intro}</p>

        <Step title={PT.h1}>
          <p>{PT.s1a}</p>
          <p>{PT.s1b}</p>
          <p>{PT.s1c}</p>
          <p>{PT.s1d}</p>
          <p>{PT.s1e}</p>
          <Caption>{PT.c1}</Caption>
          <M><mrow>{sub(v("x"), v("q"))}{o("=")}{sub(<mi>log</mi>, n(2))}<mo>⁡</mo><mrow>{o("(")}<munder><mi>max</mi><mrow>{v("m")}{o("≤")}{v("q")}</mrow></munder>{sub(v("H"), v("m"))}{o(")")}</mrow></mrow></M>
          <Legend>{PT.l1}</Legend>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-muted"><tr><th className={th}>{PT.thQuarter}</th><th className={th}>{PT.thScore}</th><th className={th}>{PT.thTask}</th></tr></thead>
            <tbody data-no-translate className="num text-ink">
              {pts.map((p) => <tr key={p.q} className="border-t border-black/5"><td className="px-2 py-1">{quarter(p.q)}</td><td className="px-2 py-1">{f2(p.v)}</td><td className="px-2 py-1">{task(p.v)}</td></tr>)}
            </tbody>
          </table>
          <Basis items={[[PT.b1a, "kwa", "metr", "epoch"], [PT.b1b, "nguyen"]]} />
        </Step>

        <Step title={PT.h2}>
          <p>{PT.s2a}</p>
          <p>{PT.s2b}</p>
          <Caption>{PT.c2}</Caption>
          <M><mrow>{v("g")}{o("=")}{frac(n(1), n(4))}{sum(<>{v("k")}{o("=")}{n(0)}</>, n(3))}{o("(")}{sub(v("x"), <>{v("q")}{o("−")}{v("k")}</>)}{o("−")}{sub(v("x"), <>{v("q")}{o("−")}{v("k")}{o("−")}{n(1)}</>)}{o(")")}{o("=")}{frac(<>{sub(v("x"), v("q"))}{o("−")}{sub(v("x"), <>{v("q")}{o("−")}{n(4)}</>)}</>, n(4))}</mrow></M>
          <p>{PT.withNumbers}</p>
          <M><mrow>{v("g")}{o("=")}{frac(<>{n(f4(last.v))}{o("−")}{n(f4(first.v))}</>, n(4))}{o("=")}{n(f4(g))}</mrow></M>
          <p>{PT.s2c}</p>
          <Basis items={[[PT.b2a, "hyndman"], [PT.b2b, "kwa"]]} />
        </Step>

        <Step title={PT.h3}>
          <p>{PT.s3a}</p>
          <p>{PT.s3b}</p>
          <p>{PT.s3c}</p>
          <Caption>{PT.c3}</Caption>
          <M><mrow>{sub(v("D"), v("f"))}{o("=")}{frac(n(3), <>{sub(v("m"), v("f"))}{o("×")}{v("g")}</>)}</mrow></M>
          <Legend>{PT.l3}</Legend>
          <Basis items={[[PT.b3a], [PT.b3b, "kwa", "metrDomains"], [PT.b3c]]} />
        </Step>

        <Step title={PT.h4}>
          <p>{PT.s4a}</p>
          <p>{PT.s4b}</p>
          <Caption>{PT.c4}</Caption>
          <M><mrow>{sub(v("D"), <mtext>forecast</mtext>)}{o("=")}{frac(n(3), <>{v("g")}{o("×")}{sum(v("f"))}{sub(v("w"), v("f"))}{sub(v("m"), v("f"))}</>)}{o("=")}{frac(n(3), <>{n(f4(g))}{o("×")}{n(f4(blend))}</>)}{o("=")}{n(f2(pace.expectedMonths))}</mrow></M>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-muted"><tr><th className={th}>{PT.thSpeed}</th><th className={th}>{PT.thLikely}</th><th className={th}>{PT.thMult}</th><th className={th}>{PT.thMonths}</th><th className={th}>{PT.thDrift}</th></tr></thead>
              <tbody className="text-ink">
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="px-2 py-1">{t(r.name)}</td>
                    <td data-no-translate className="num px-2 py-1">{Math.round(r.w * 100)}%</td>
                    <td data-no-translate className="num px-2 py-1">{f2(r.m)}</td>
                    <td data-no-translate className="num px-2 py-1">{f2(r.d)}</td>
                    <td data-no-translate className="num px-2 py-1">{f2(r.drift)}</td>
                  </tr>
                ))}
                <tr className="border-t border-black/5 font-medium">
                  <td className="px-2 py-1">{t("Our forecast")}</td>
                  <td data-no-translate className="num px-2 py-1">100%</td>
                  <td data-no-translate className="num px-2 py-1">{f4(blend)}</td>
                  <td data-no-translate className="num px-2 py-1">{f2(pace.expectedMonths)}</td>
                  <td data-no-translate className="num px-2 py-1">{f2(wDrift)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>{PT.s4c}</p>
          <Basis items={[[PT.b4a, "stone", "bates"], [PT.b4b, "hoeting"], [PT.b4c]]} />
        </Step>

        <Step title={PT.h5}>
          <p>{PT.s5a}</p>
          <p>{PT.s5b}</p>
          <p>{PT.s5c}</p>
          <Caption>{PT.c5a}</Caption>
          <M><mrow>{sub(v("s"), v("f"))}{o("←")}{n("0.85")}{o("×")}{sub(v("s"), v("f"))}{o("+")}{n("0.5")}{o("×")}{fn("ln", sub(v("ℓ"), v("f")))}</mrow></M>
          <Legend>{PT.l5a}</Legend>
          <p>{PT.s5d}</p>
          <Caption>{PT.c5b}</Caption>
          <M><mrow>{sub(v("τ"), v("f"))}{o("=")}{n("0.25")}{sum(<mtext>open</mtext>)}{o("[")}{v("P")}{o("×")}{fn("ln", sub(v("p"), v("f")))}{o("+")}{o("(")}{n(1)}{o("−")}{v("P")}{o(")")}{o("×")}{fn("ln", <>{n(1)}{o("−")}{sub(v("p"), v("f"))}</>)}{o("]")}</mrow></M>
          <Legend>{PT.l5b}</Legend>
          <p>{PT.s5e}</p>
          <Caption>{PT.c5c}</Caption>
          <M><mrow>{sub(v("w"), v("f"))}{o("=")}{n("0.05")}{o("+")}{n("0.85")}{o("×")}{frac(sup(v("e"), <>{sub(v("s"), v("f"))}{o("+")}{sub(v("τ"), v("f"))}</>), <>{sum(v("k"))}{sup(v("e"), <>{sub(v("s"), v("k"))}{o("+")}{sub(v("τ"), v("k"))}</>)}</>)}</mrow></M>
          <p>{PT.s5f}</p>
          <Caption>{PT.c5d}</Caption>
          <M><mrow>{sub(v("p"), v("f"))}{o("=")}{n(1)}{o("−")}{v("Φ")}{o("(")}{frac(<>{v("T")}{o("−")}{sub(v("m"), v("f"))}{o("×")}{gbar}</>, v("σ"))}{o(")")}</mrow></M>
          <Legend>{PT.l5d}</Legend>
          <Legend>{PT.l5e}</Legend>
          <p>{PT.s5g}</p>
          <Basis items={[[PT.b5a, "good", "gneiting"], [PT.b5b, "raftery"], [PT.b5c, "cesa"], [PT.b5d, "herbster"], [PT.b5e, "gneiting", "wolfers"], [PT.b5f], [PT.b5g, "hyndman"], [PT.b5h]]} />
        </Step>

        <Step title={PT.h6}>
          <p>{PT.s6a}</p>
          <p>{PT.s6b}</p>
          <Caption>{PT.c6}</Caption>
          <M><mrow>{v("r")}{o("=")}{n("0.15")}{o("+")}{n("0.6")}{o("×")}{v("K")}</mrow></M>
          <M><mrow>{sub(v("t"), v("f"))}{o("=")}{frac(fn("ln", frac(n(1), <>{n(1)}{o("−")}{frac(n("0.45"), v("E"))}</>)), <>{v("r")}{o("×")}{sub(v("m"), v("f"))}</>)}</mrow></M>
          <Legend>{PT.l6}</Legend>
          <p>{PT.s6c}</p>
          <p>{PT.s6d}</p>
          <p>{PT.s6e}</p>
          <Basis items={[[PT.b6a, "bass"], [PT.b6b, "bass"], [PT.b6c, "gmyrek", "handa", "aei"], [PT.b6d, "observed"], [PT.b6e]]} />
        </Step>

        <Step title={PT.h7}>
          <ul className="list-disc space-y-1 pl-5">
            <li>{PT.k1}</li>
            <li>{PT.k2}</li>
            <li>{PT.k3}</li>
            <li>{PT.k4}</li>
          </ul>
        </Step>

        <Step title={PT.h8}>
          <RefList order={PACE_ORDER} />
        </Step>
      </dialog>
    </>
  );
}
