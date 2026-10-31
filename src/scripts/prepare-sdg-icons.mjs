// Keep the published SDG number and pictogram; cover only the small title.
// Originals: https://open-sdg.org/translations-un-sdg/
import sharp from "sharp";
import { fileURLToPath } from "node:url";

for (const goal of [6, 7, 8, 9, 12, 16]) {
  const input = fileURLToPath(new URL(`../public/sdg-icons/goal-${goal}-original.png`, import.meta.url));
  const output = fileURLToPath(new URL(`../public/sdg-icons/goal-${goal}.png`, import.meta.url));
  const { data } = await sharp(input).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const color = `rgb(${data[0]},${data[1]},${data[2]})`;
  const cover = Buffer.from(`<svg width="194" height="84"><rect width="194" height="84" fill="${color}"/></svg>`);
  await sharp(input).composite([{ input: cover, left: 56, top: 0 }]).png().toFile(output);
}
