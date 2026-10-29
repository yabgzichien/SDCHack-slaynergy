// Builds src/lib/malaysia-map.json from public/geo/malaysia-states.json (geoBoundaries, ODbL).
// Two layouts: "wide" puts Sabah and Sarawak beside the peninsula with the South China Sea narrowed,
// "stacked" tucks them under the peninsula for narrower screens. Coordinates are projected to map units (100 per degree,
// longitudes scaled by cos 4°) and simplified. Label anchors and callout positions are hand-placed in degrees.
import { readFileSync, writeFileSync } from "node:fs";

const geo = JSON.parse(readFileSync(new URL("../public/geo/malaysia-states.json", import.meta.url)));
const K = 100, COS = Math.cos((4 * Math.PI) / 180);
const BORNEO = new Set(["MY-12", "MY-13", "MY-15"]);

// Where each state's name sits. "at" is inside the state; small states get a callout label in the sea ("label"),
// with text ending at that point ("end") or starting there ("start").
const PLACES = {
  "MY-02": { at: [100.68, 6.02] },
  "MY-09": { at: [100.24, 6.5], label: [99.35, 6.72], side: "end" },
  "MY-07": { at: [100.3, 5.38], label: [99.45, 5.32], side: "end" },
  "MY-08": { at: [101.0, 4.72] },
  "MY-03": { at: [102.02, 5.32] },
  "MY-11": { at: [103.0, 4.8] },
  "MY-06": { at: [102.62, 3.72] },
  "MY-10": { at: [101.22, 3.58] },
  "MY-14": { at: [101.69, 3.14], label: [100.45, 3.12], side: "end" },
  "MY-16": { at: [101.69, 2.93], label: [100.75, 2.55], side: "end" },
  "MY-05": { at: [102.22, 2.86] },
  "MY-04": { at: [102.27, 2.27], label: [101.6, 1.85], side: "end" },
  "MY-01": { at: [103.35, 2.02] },
  "MY-13": { at: [112.7, 2.4] },
  "MY-12": { at: [116.85, 5.3] },
  "MY-15": { at: [115.22, 5.32], label: [114.55, 5.95], side: "end", stacked: [114.0, 6.6] },
};

const LAYOUTS = {
  wide: { shift: [-4.0, 0], bounds: [97.5, 115.6, 0.6, 7.6] },
  stacked: { shift: [-9.0, -3.0], bounds: [97.5, 110.6, -2.4, 7.0] },
};
// Zoom presets per layout, in degrees before the Borneo shift: peninsula and Borneo.
const VIEWS = {
  peninsular: [97.5, 104.8, 1.1, 6.95],
  borneo: [109.3, 119.5, 0.6, 7.5],
};

const area = (r) => Math.abs(r.reduce((a, q, i) => { const n = r[(i + 1) % r.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0)) / 2;

function build(name) {
  const L = LAYOUTS[name];
  const [w0, , , n0] = L.bounds;
  const proj = (lng, lat, borneo) => {
    const x = (lng + (borneo ? L.shift[0] : 0) - w0) * K * COS;
    const y = (n0 - (lat + (borneo ? L.shift[1] : 0))) * K;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };
  const width = Math.round((L.bounds[1] - L.bounds[0]) * K * COS), height = Math.round((L.bounds[3] - L.bounds[2]) * K);
  // Draw Selangor before Kuala Lumpur and Putrajaya, which sit inside it.
  const order = (id) => (id === "MY-14" || id === "MY-16" ? 1 : 0);
  const states = [...geo.features].sort((a, b) => order(a.properties.id) - order(b.properties.id)).map((f) => {
    const id = f.properties.id, borneo = BORNEO.has(id);
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const rings = polys.map((p) => p[0].map(([lng, lat]) => proj(lng, lat, borneo)));
    const biggest = Math.max(...rings.map(area));
    let d = "";
    const xs = [], ys = [];
    for (const r of rings) {
      // keep real islands (Penang, Langkawi, Labuan) and drop specks
      if (area(r) < Math.min(6, biggest * 0.5)) continue;
      const pts = [r[0]];
      for (const p of r.slice(1)) { const q = pts[pts.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.4) pts.push(p); }
      if (pts.length < 3) continue;
      d += `M${pts.map((p) => `${p[0]} ${p[1]}`).join("L")}Z`;
      for (const p of pts) { xs.push(p[0]); ys.push(p[1]); }
    }
    const pl = PLACES[id];
    return {
      id, name: f.properties.name, d,
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v)),
      at: proj(pl.at[0], pl.at[1], borneo),
      label: pl.label ? (name === "stacked" && pl.stacked ? proj(pl.stacked[0], pl.stacked[1], borneo) : proj(pl.label[0], pl.label[1], borneo)) : null,
      side: pl.side ?? null,
    };
  });
  const view = ([w, e, s, n], borneo) => {
    const [x1, y1] = proj(w, n, borneo), [x2, y2] = proj(e, s, borneo);
    return [Math.max(0, x1), Math.max(0, y1), Math.min(width, x2) - Math.max(0, x1), Math.min(height, y2) - Math.max(0, y1)].map(Math.round);
  };
  return { width, height, states, views: { all: [0, 0, width, height], peninsular: view(VIEWS.peninsular, false), borneo: view(VIEWS.borneo, true) } };
}

const out = { source: "geoBoundaries ADM1 for Malaysia (OpenStreetMap contributors, ODbL), simplified", layouts: { wide: build("wide"), stacked: build("stacked") } };
writeFileSync(new URL("../src/lib/malaysia-map.json", import.meta.url), JSON.stringify(out));
console.log("wrote src/lib/malaysia-map.json", Math.round(JSON.stringify(out).length / 1024), "KB");
