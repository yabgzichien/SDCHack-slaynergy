"use client";
import { useEffect, useRef, useState } from "react";
import MAP from "@/lib/malaysia-map.json";
import { colourFor, inkOn, type MapValue } from "@/lib/map-scale";
import { stateById } from "@/lib/engine/geo";

// Malaysia's states drawn as one SVG, no tiles and no third-party map. Sabah and Sarawak sit closer than in reality
// (the South China Sea is narrowed) so all sixteen states fit at a readable size; on phones they sit underneath.
// Every label picks dark or white text for the shade under it. Small states get a label in the sea with a leader line.
type Layout = (typeof MAP.layouts)["wide"];
type ViewKey = "all" | "peninsular" | "borneo";
const NAMES: Record<string, string> = { "MY-05": "N. Sembilan", "MY-07": "Penang", "MY-14": "Kuala Lumpur", "MY-15": "Labuan", "MY-16": "Putrajaya" };
const nameOf = (id: string) => NAMES[id] ?? stateById[id]?.short ?? id;

type Props = {
  values: MapValue[];
  bins: number[];
  ramp: string[];
  selected?: string | null;
  home?: string | null;
  dimOthers?: boolean;       // "not moving": only the home state keeps its colour
  onSelect?: (id: string) => void;
  ariaLabel: string;
  preview?: boolean;         // a small, non-interactive version for other pages
};

export function MalaysiaMap({ values, bins, ramp, selected = null, home = null, dimOthers, onSelect, ariaLabel, preview }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [view, setView] = useState<ViewKey>("all");
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L: Layout = width < 820 && !preview ? MAP.layouts.stacked : MAP.layouts.wide;
  const vb = L.views[view] as number[];
  const px = width / vb[2];                // screen pixels per map unit
  const u = (p: number) => p / px;         // a size in screen pixels, in map units
  const byId = Object.fromEntries(values.map((v) => [v.id, v]));
  const fillOf = (id: string) => (dimOthers && id !== home ? null : colourFor(byId[id]?.value ?? 0, bins, ramp));
  const focus = hover ?? selected;
  const fv = focus ? byId[focus] : null;
  const font = preview || width < 720 ? 11 : 12;
  // the small preview names the state with the highest figure and the person's own state; with no home state set, the top three
  const ranked = [...values].sort((a, b) => b.value - a.value);
  const top3 = new Set(home ? [home, ranked.find((v) => v.id !== home)?.id ?? ""] : ranked.slice(0, 3).map((v) => v.id));
  // on a phone, the small states' sea labels appear once you zoom in; with "stay home" only your state is named
  const phone = width < 480;
  const named = (id: string) => (preview ? top3.has(id) : !(dimOthers && id !== home));
  const calloutsOn = !(phone && view === "all");

  const pick = (id: string) => onSelect?.(id);
  return (
    <div>
      {!preview && (
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Zoom the map">
          {([["all", "All Malaysia"], ["peninsular", "Peninsular"], ["borneo", "Sabah and Sarawak"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} aria-pressed={view === k}
              className={`press min-h-9 rounded-full px-3 text-xs font-medium ${view === k ? "bg-primary text-primaryink" : "bg-surface2 hover:bg-control/60"}`}>{l}</button>
          ))}
        </div>
      )}
      <div ref={box} className="relative w-full">
        <svg viewBox={vb.join(" ")} width="100%" height={vb[3] * px} role="group" aria-label={ariaLabel} className="block select-none"
          onMouseLeave={() => setHover(null)}>
          <g>
            {L.states.map((s) => {
              const f = fillOf(s.id);
              const v = byId[s.id];
              return (
                <path key={s.id} d={s.d} vectorEffect="non-scaling-stroke"
                  style={{ fill: f ?? "var(--surface-2)", transition: "fill 400ms cubic-bezier(0.22,1,0.36,1)" }}
                  stroke="var(--raised)" strokeWidth={1} strokeLinejoin="round"
                  className={preview ? "" : "cursor-pointer outline-none focus-visible:opacity-80"}
                  tabIndex={preview ? undefined : 0} role={preview ? undefined : "button"} aria-pressed={preview ? undefined : selected === s.id}
                  aria-label={preview ? undefined : `${s.name}: ${v?.label ?? "no figure"}`}
                  onMouseEnter={() => !preview && setHover(s.id)} onClick={() => pick(s.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(s.id); } }}>
                  {!preview && <title>{`${s.name}: ${v?.label ?? ""}`}</title>}
                </path>
              );
            })}
          </g>
          {/* outlines on top: your state dashed, the hovered and selected states in ink */}
          <g pointerEvents="none" fill="none" vectorEffect="non-scaling-stroke">
            {home && L.states.filter((s) => s.id === home && s.id !== focus).map((s) => <path key={s.id} d={s.d} stroke="var(--ink)" strokeWidth={1.8} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />)}
            {focus && L.states.filter((s) => s.id === focus).map((s) => <path key={s.id} d={s.d} stroke="var(--ink)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />)}
          </g>
          <g pointerEvents="none" fontFamily="var(--font-sans)">
            {L.states.map((s) => {
              const f = fillOf(s.id);
              const v = byId[s.id];
              const w = (s.box[2] - s.box[0]) * px;
              const n = nameOf(s.id);
              if (s.label) {
                // a callout in the sea: dot on the state, a short line, the name and figure on the page colour
                const [lx, ly] = s.label as number[];
                const [ax, ay] = s.at as number[];
                const inView = (s.at[0] >= vb[0] && s.at[0] <= vb[0] + vb[2] && s.at[1] >= vb[1] && s.at[1] <= vb[1] + vb[3]);
                if (!named(s.id) || !calloutsOn || !inView) return null;
                return (
                  <g key={s.id}>
                    <line x1={ax} y1={ay} x2={lx + u(3)} y2={ly} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    <circle cx={ax} cy={ay} r={u(2.5)} fill="var(--ink)" />
                    <text x={lx} y={ly} textAnchor="end" fontSize={u(font)} fill="var(--ink)" fontWeight={600} dominantBaseline="central">
                      {n}{!preview && v ? <tspan fontWeight={400} fill="var(--muted)">{`  ${v.short}`}</tspan> : null}
                    </text>
                  </g>
                );
              }
              if (w < 26 || !named(s.id)) return null;
              const ink = f ? inkOn(f) : "var(--muted)";
              const showValue = !preview && v && w >= 60;
              const [x, y] = s.at as number[];
              return (
                <text key={s.id} x={x} y={y} textAnchor="middle" fontSize={u(font)} fill={ink} stroke={f ?? "var(--surface-2)"} strokeWidth={u(3)} paintOrder="stroke" strokeLinejoin="round">
                  <tspan x={x} dy={showValue ? u(-3) : u(4)} fontWeight={600}>{n}</tspan>
                  {showValue && <tspan x={x} dy={u(font + 2)} fontWeight={400}>{v.short}</tspan>}
                </text>
              );
            })}
          </g>
        </svg>
      </div>
      {!preview && (
        <p className="mt-2 min-h-6 text-sm" aria-live="polite">
          {fv ? <><span className="font-medium">{stateById[focus!]?.name ?? nameOf(focus!)}</span> <span className="text-muted">· {fv.label}</span></> : <span className="text-muted">{phone && view === "all" ? "Tap a state, or zoom in to see the small ones." : "Point at or tap a state."}</span>}
        </p>
      )}
    </div>
  );
}

// The colour key: five swatches, each with the highest value it covers.
export function MapLegend({ title, bins, ramp, fmt, home }: { title: string; bins: number[]; ramp: string[]; fmt: (x: number) => string; home?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1.5 text-xs text-muted">{title}</p>
        <ol className="flex" aria-label={`${title}: ${ramp.length} shades, from lightest to darkest`}>
          {ramp.map((c, i) => (
            <li key={c} className="w-14 sm:w-16">
              <span className={`block h-3 ${i === 0 ? "rounded-l-md" : ""} ${i === ramp.length - 1 ? "rounded-r-md" : ""}`} style={{ background: c }} />
              <span className="num mt-1 block text-[11px] text-muted">{i === 0 ? "≤ " : i === ramp.length - 1 ? "> " : ""}{fmt(i === ramp.length - 1 ? bins[i - 1] : bins[i])}</span>
            </li>
          ))}
        </ol>
      </div>
      {home && <span className="inline-flex items-center gap-1.5 text-xs text-muted"><span className="inline-block h-3 w-5 rounded border-2 border-dashed border-ink/70" />Your state</span>}
    </div>
  );
}
