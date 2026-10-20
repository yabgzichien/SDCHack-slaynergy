"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Feature } from "geojson";
import type { GeoJSON as LGeoJSON, Layer, PathOptions } from "leaflet";
import L from "leaflet";
import { GeoJSON, MapContainer, Marker, ZoomControl, useMap, useMapEvents } from "react-leaflet";

import { colourFor, type MapValue } from "@/lib/map-scale";
type Props = {
  values: MapValue[];
  bins: number[];               // upper edges of the colour classes, ascending
  selected: string | null;
  home: string | null;
  dimOthers?: boolean;          // "not moving": only home stays in colour
  onSelect: (id: string) => void;
  ariaLabel: string;
};

const VIEWS = {
  all: [[0.6, 99.5], [7.6, 119.4]] as [[number, number], [number, number]],
  peninsular: [[1.2, 99.6], [6.8, 104.5]] as [[number, number], [number, number]],
  borneo: [[0.8, 109.5], [7.5, 119.4]] as [[number, number], [number, number]],
};


function FitView({ view }: { view: { b: [[number, number], [number, number]] } | null }) {
  const map = useMap();
  useEffect(() => { if (view) map.flyToBounds(view.b, { padding: [8, 8], duration: 0.6 }); }, [map, view]);
  return null;
}

// Scrolling the page over the map must not zoom it: the wheel zooms only after you click the map, until the pointer leaves.
function WheelOnClick() {
  const map = useMapEvents({ click: () => map.scrollWheelZoom.enable(), mouseout: () => map.scrollWheelZoom.disable() });
  return null;
}

function Fly({ target }: { target: [[number, number], [number, number]] | null }) {
  const map = useMap();
  // move only when the target is not already in view, so tapping a visible state keeps the map still
  useEffect(() => { if (target && !map.getBounds().contains(target)) map.flyToBounds(target, { padding: [24, 24], duration: 0.6 }); }, [map, target]);
  return null;
}

export default function JobMap({ values, bins, selected, home, dimOthers, onSelect, ariaLabel }: Props) {
  const [shapes, setShapes] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<[[number, number], [number, number]] | null>(null);
  const [view, setViewState] = useState<{ b: [[number, number], [number, number]] } | null>(null);
  const setView = (b: [[number, number], [number, number]]) => setViewState({ b });
  const layer = useRef<LGeoJSON | null>(null);
  const byId = useMemo(() => Object.fromEntries(values.map((v) => [v.id, v])), [values]);
  // tooltips are bound once, so they read the latest figures through a ref
  const latest = useRef(byId);
  useEffect(() => { latest.current = byId; }, [byId]);

  useEffect(() => {
    let on = true;
    fetch("/geo/malaysia-states.json").then((r) => r.json()).then((d) => on && setShapes(d)).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);

  const style = (f?: Feature): PathOptions => {
    const id = (f?.properties as { id: string } | undefined)?.id ?? "";
    const v = byId[id];
    const off = dimOthers && id !== home;
    return {
      fillColor: off ? "#d9d9d4" : colourFor(v?.value ?? 0, bins),
      fillOpacity: off ? 0.45 : 0.85,
      color: id === selected ? "#1f201d" : "#ffffff",
      weight: id === selected ? 2.5 : id === home ? 2 : 1,
      dashArray: id === home && id !== selected ? "4 3" : undefined,
    };
  };

  // restyle in place when the data or the selection changes
  useEffect(() => { layer.current?.setStyle((f) => style(f as Feature)); });

  // fly to the selected state when it is picked from the list
  useEffect(() => {
    if (!selected || !layer.current) return;
    layer.current.eachLayer((l) => {
      const f = (l as Layer & { feature?: Feature }).feature;
      if ((f?.properties as { id: string } | undefined)?.id === selected) {
        const b = (l as unknown as { getBounds: () => { getSouthWest: () => { lat: number; lng: number }; getNorthEast: () => { lat: number; lng: number } } }).getBounds();
        const sw = b.getSouthWest(), ne = b.getNorthEast();
        const pad = 0.6;
        setTarget([[sw.lat - pad, sw.lng - pad], [ne.lat + pad, ne.lng + pad]]);
      }
    });
  }, [selected]);

  if (failed) return <p className="p-4 text-sm text-negative">The map could not load. The table below has the same figures.</p>;
  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Map view">
        {([["all", "All Malaysia"], ["peninsular", "Peninsular"], ["borneo", "Sabah and Sarawak"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(VIEWS[k])} className="press min-h-9 rounded-full bg-surface2 px-3 text-xs font-medium hover:bg-control/60">{l}</button>
        ))}
      </div>
      <MapContainer bounds={VIEWS.all} zoomControl={false} zoomSnap={0.25} zoomDelta={0.5} scrollWheelZoom={false} className="h-[420px] w-full rounded-2xl sm:h-[540px]"
        aria-label={ariaLabel} minZoom={4} maxZoom={10} maxBounds={[[-4, 94], [12, 124]]} style={{ background: "#e8eef0" }} attributionControl={false}>
        {shapes && (
          <GeoJSON data={shapes} ref={layer} style={(f) => style(f as Feature)}
            onEachFeature={(f, l) => {
              const id = (f.properties as { id: string; name: string }).id;
              l.on({ click: () => onSelect(id) });
              l.bindTooltip(() => {
                const v = latest.current[id];
                return `<strong>${(f.properties as { name: string }).name}</strong><br/>${v ? v.label : ""}`;
              }, { sticky: true, direction: "top", opacity: 0.95 });
            }} />
        )}
        {shapes && <Labels shapes={shapes} />}
        <ZoomControl position="topright" />
        <Fly target={target} />
        <FitView view={view} />
        <WheelOnClick />
      </MapContainer>
      <p className="mt-2 text-xs text-muted">Drag to move. Pinch, use + and −, or click the map and scroll to zoom. Boundaries: geoBoundaries (OpenStreetMap, ODbL).</p>
    </div>
  );
}

// State names drawn by the app (no third-party base map). Small territories appear once you zoom in.
const SMALL = new Set(["MY-04", "MY-07", "MY-09", "MY-15"]);
const TINY = new Set(["MY-14", "MY-16"]); // Kuala Lumpur and Putrajaya sit side by side inside Selangor
function Labels({ shapes }: { shapes: FeatureCollection }) {
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const [zoom, setZoom] = useState(() => map.getZoom());
  const points = useMemo(() => shapes.features.map((f) => {
    const p = f.properties as { id: string; name: string };
    // centre of the largest part of the state
    const geom = f.geometry as { coordinates: number[][][][] };
    const area = (r: number[][]) => Math.abs(r.reduce((a, q, i) => { const n = r[(i + 1) % r.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0));
    const ring = [...geom.coordinates].sort((a, b) => area(b[0]) - area(a[0]))[0][0];
    const lng = (Math.min(...ring.map((c) => c[0])) + Math.max(...ring.map((c) => c[0]))) / 2;
    const lat = (Math.min(...ring.map((c) => c[1])) + Math.max(...ring.map((c) => c[1]))) / 2;
    return { id: p.id, name: SHORT[p.id] ?? p.name, at: [lat, lng] as [number, number] };
  }), [shapes]);
  return (
    <>
      {points.filter((p) => (TINY.has(p.id) ? zoom >= 8.5 : SMALL.has(p.id) ? zoom >= 7 : zoom >= 5)).map((p) => (
        <Marker key={p.id} position={p.at} interactive={false} keyboard={false}
          icon={L.divIcon({ className: "state-label", html: `<span>${p.name}</span>`, iconSize: [0, 0] })} />
      ))}
    </>
  );
}
const SHORT: Record<string, string> = { "MY-05": "N. Sembilan", "MY-07": "Penang", "MY-14": "Kuala Lumpur", "MY-15": "Labuan", "MY-16": "Putrajaya" };

