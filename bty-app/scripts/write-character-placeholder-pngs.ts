/**
 * Writes visible placeholder PNGs for default character avatars (colored tile + initial).
 * Run from repo root: npm run write:character-placeholder-pngs -w bty-app
 * Or from bty-app: npm run write:character-placeholder-pngs
 *
 * Replace these files with real illustrations when assets are ready.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { AVATAR_CHARACTERS, getCharacterImageBasename } from "../src/lib/bty/arena/avatarCharacters";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main(): Promise<void> {
  const outDir = path.join(__dirname, "../public/avatars/default/characters");
  await fs.mkdir(outDir, { recursive: true });

  for (let i = 0; i < AVATAR_CHARACTERS.length; i += 1) {
    const c = AVATAR_CHARACTERS[i]!;
    const hue = (i * 28) % 360;
    const letter = escapeXml(c.label.slice(0, 1).toUpperCase());
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="hsl(${hue}, 48%, 42%)"/>
  <text x="256" y="310" font-size="200" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700"
    fill="rgba(255,255,255,0.92)">${letter}</text>
</svg>`;

    const base = getCharacterImageBasename(c.id);
    const pngPath = path.join(outDir, `${base}.png`);
    await sharp(Buffer.from(svg, "utf8")).png().toFile(pngPath);
    // eslint-disable-next-line no-console -- script output
    console.log("wrote", path.relative(process.cwd(), pngPath), `(${c.id} → ${base}.png)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
