import type { ReactNode } from "react";

// Small helpers for writing formulas as MathML, which browsers draw natively (no library). A formula sits in M, which
// keeps it out of the page translator: letters and numbers are the same in every language.
export const M = ({ children }: { children: ReactNode }) => (
  <div data-no-translate className="my-1.5 overflow-x-auto rounded-xl bg-raised px-3 py-2 text-[1.05rem]">
    <math display="block">{children}</math>
  </div>
);
export const n = (x: string | number) => <mn>{x}</mn>;
export const v = (x: string) => <mi>{x}</mi>;
export const o = (x: string) => <mo>{x}</mo>;
export const txt = (x: string) => <mtext>{x}</mtext>;
export const sub = (a: ReactNode, b: ReactNode) => <msub><mrow>{a}</mrow><mrow>{b}</mrow></msub>;
export const sup = (a: ReactNode, b: ReactNode) => <msup><mrow>{a}</mrow><mrow>{b}</mrow></msup>;
export const frac = (a: ReactNode, b: ReactNode) => <mfrac><mrow>{a}</mrow><mrow>{b}</mrow></mfrac>;
export const fn = (name: string, arg: ReactNode) => <mrow><mi>{name}</mi><mo>⁡</mo><mrow>{o("(")}{arg}{o(")")}</mrow></mrow>;
export const sum = (under: ReactNode, over?: ReactNode) => over === undefined
  ? <munder><mo>∑</mo><mrow>{under}</mrow></munder>
  : <munderover><mo>∑</mo><mrow>{under}</mrow><mrow>{over}</mrow></munderover>;
export const bar = (x: ReactNode) => <mover><mrow>{x}</mrow><mo>¯</mo></mover>;
export const gap = <mtext>{"\u2003"}</mtext>;
