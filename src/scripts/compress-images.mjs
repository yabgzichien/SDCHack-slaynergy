// Makes small copies of images that next/image cannot optimise: the CSS background and the site icons.
// Usage: node scripts/compress-images.mjs   (the original PNGs are kept)
import fs from "node:fs";
import sharp from "sharp";

const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;
const jobs = [
  // The landing hero background, set in landing-v2.css, so the browser downloads it as it is.
  { from: "public/landing-nature-skyline.png", to: "public/landing-nature-skyline.webp", run: (s) => s.webp({ quality: 78 }) },
  // The browser-tab and home-screen icons, set in layout.tsx.
  { from: "public/cockatiel-ai-icon-v2.png", to: "public/icon-48.png", run: (s) => s.resize(48).png() },
  { from: "public/cockatiel-ai-icon-v2.png", to: "public/apple-icon-180.png", run: (s) => s.resize(180).png() },
];
for (const j of jobs) {
  await j.run(sharp(j.from)).toFile(j.to);
  console.log(`${j.from} ${kb(j.from)} -> ${j.to} ${kb(j.to)}`);
}
