// Colour scale for the job map, kept apart from the map component so pages can use it without loading Leaflet on the server.
// Five steps from the panel tone to the data hue: one hue, no rainbow.
export const LEGEND_RAMP = ["#e6efed", "#bcd8d3", "#86b9b1", "#4b938a", "#1b6e66"];
export const colourFor = (v: number, bins: number[]) => {
  const i = bins.findIndex((b) => v <= b);
  return LEGEND_RAMP[i === -1 ? LEGEND_RAMP.length - 1 : Math.min(LEGEND_RAMP.length - 1, i)];
};
export type MapValue = { id: string; value: number; label: string };
