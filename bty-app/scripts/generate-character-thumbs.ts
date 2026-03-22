/**
 * Writes 512×512 PNG thumbnails to `public/avatars/default/characters/thumbs/{basename}.png`
 * from full-res `.../characters/{basename}.png`, using the same basename mapping as
 * `getCharacterImageBasename` in `avatarCharacters.ts`.
 *
 * Run from bty-app: `npm run generate:character-thumbs`
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  AVATAR_CHARACTERS,
  getCharacterImageBasename,
} from "../src/lib/bty/arena/avatarCharacters";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_DIR = path.join(__dirname, "../public/avatars/default/characters");
const THUMB_DIR = path.join(CHAR_DIR, "thumbs");
const THUMB_SIZE = 512;

async function main(): Promise<void> {
  await fs.mkdir(THUMB_DIR, { recursive: true });

  for (const c of AVATAR_CHARACTERS) {
    const base = getCharacterImageBasename(c.id);
    const src = path.join(CHAR_DIR, `${base}.png`);
    const dest = path.join(THUMB_DIR, `${base}.png`);
    try {
      await fs.access(src);
    } catch {
      // eslint-disable-next-line no-console -- script output
      console.warn("missing source (skip):", path.relative(process.cwd(), src));
      continue;
    }
    await sharp(src)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toFile(dest);
    // eslint-disable-next-line no-console -- script output
    console.log("wrote", path.relative(process.cwd(), dest));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
