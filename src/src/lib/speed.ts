// The AI speed a page shows: "forecast" (Our forecast, the blend of the three speeds) or one speed taken as certain.
// Shared by the engine and the browser, so it holds no engine code.
export const FORECAST = "forecast";
export const SPEEDS = [FORECAST, "slow", "medium", "fast"] as const;
export type Speed = (typeof SPEEDS)[number];
