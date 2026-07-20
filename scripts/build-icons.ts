/**
 * Render app icons from an inline SVG mark (three river waves on lapis —
 * دریا means "river" in Dari). Pure vector, no font dependencies.
 * Run: node scripts/build-icons.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

function mark(padding: number): string {
  // Waves drawn in a 512-unit viewBox, inset by `padding` on each side.
  const s = (512 - padding * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${padding > 0 ? 0 : 116}" fill="#2B4C8C"/>
  <g transform="translate(${padding} ${padding}) scale(${s})" fill="none" stroke="#FAF7F2" stroke-width="34" stroke-linecap="round">
    <path d="M96 190 q40 -34 80 0 t80 0 t80 0 t80 0" opacity="0.55"/>
    <path d="M96 262 q40 -34 80 0 t80 0 t80 0 t80 0"/>
    <path d="M96 334 q40 -34 80 0 t80 0 t80 0 t80 0" opacity="0.55"/>
  </g>
</svg>`;
}

const outDir = join(import.meta.dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const targets: Array<[string, number, number]> = [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["icon-512-maskable.png", 512, 72], // safe-zone inset for maskable
  ["apple-touch-icon.png", 180, 0],
];

for (const [name, size, padding] of targets) {
  const png = await sharp(Buffer.from(mark(padding))).resize(size, size).png().toBuffer();
  writeFileSync(join(outDir, name), png);
  console.log(`wrote public/icons/${name}`);
}
