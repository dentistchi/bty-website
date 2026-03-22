/**
 * Writes **512×512** PNG thumbnails to `public/avatars/default/characters/thumbs/{basename}.png`
 * from full-res `.../characters/{basename}.png`, using **`getCharacterImageBasename(id)`**
 * ([`avatarCharacters.ts`](../src/lib/bty/arena/avatarCharacters.ts)) so `character_11` → `artisan_11.png`, etc.
 *
 * Run from bty-app: `npm run generate:character-thumbs`
 *
 * CI: `verify:avatar-assets:characters` requires both full-res and thumb files.
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

  /** 구버전·직접 URL이 `character_11.png` / `character_12.png` 를 요청하는 경우 대비(배포 404 방지). */
  for (const c of AVATAR_CHARACTERS) {
    const base = getCharacterImageBasename(c.id);
    if (base === c.id) continue;
    const fullSrc = path.join(CHAR_DIR, `${base}.png`);
    const fullDest = path.join(CHAR_DIR, `${c.id}.png`);
    const thumbSrc = path.join(THUMB_DIR, `${base}.png`);
    const thumbDest = path.join(THUMB_DIR, `${c.id}.png`);
    try {
      await fs.access(fullSrc);
      await fs.access(thumbSrc);
    } catch {
      continue;
    }
    await fs.copyFile(fullSrc, fullDest);
    await fs.copyFile(thumbSrc, thumbDest);
    // eslint-disable-next-line no-console -- script output
    console.log("compat copy", `${c.id}.png`, "←", `${base}.png`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
