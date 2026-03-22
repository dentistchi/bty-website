/**
 * 로컬/CI: `public/avatars/default/characters`(캐릭터)·`outfits`(옷)에 코드가 기대하는 PNG가 있는지 검사.
 * 프로덕션 404는 브라우저 Network로 동일 경로를 확인( docs/AVATAR_DEPLOY_VERIFY.md ).
 *
 * Usage:
 *   npx --yes tsx scripts/verify-avatar-assets.ts
 *   npx --yes tsx scripts/verify-avatar-assets.ts --characters-only
 *
 * Exit: 0 = 전부 존재, 1 = 누락 있음, 2 = 스크립트 오류
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AVATAR_CHARACTERS, getCharacterThumbImageUrl } from "../src/lib/bty/arena/avatarCharacters";
import { getOutfitFilename } from "../src/lib/bty/arena/avatarOutfits";
import { OUTFIT_IDS } from "../src/lib/bty/arena/avatar-assets.data";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");

function fileExistsFromUrlPath(urlPath: string): boolean {
  const clean = urlPath.replace(/^\//, "").split("?")[0] ?? "";
  const decoded = decodeURIComponent(clean);
  const abs = path.join(publicDir, decoded);
  return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

function main(): void {
  const charactersOnly = process.argv.includes("--characters-only");
  const missing: string[] = [];

  for (const c of AVATAR_CHARACTERS) {
    const p = c.imageUrl.replace(/^\//, "");
    if (!fileExistsFromUrlPath("/" + p)) {
      missing.push(`[character] ${c.id} → ${p}`);
    }
    const thumb = getCharacterThumbImageUrl(c.id).replace(/^\//, "");
    if (!fileExistsFromUrlPath("/" + thumb)) {
      missing.push(`[character thumb 512] ${c.id} → ${thumb}`);
    }
  }

  let outfitIdsChecked = 0;
  if (!charactersOnly) {
    const outfitIds = new Set<string>([...OUTFIT_IDS]);
    outfitIdsChecked = outfitIds.size;
    for (const id of outfitIds) {
      const name = getOutfitFilename(id);
      const rel = path.join("avatars", "outfits", name);
      const abs = path.join(publicDir, rel);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        missing.push(`[outfit] ${id} → avatars/outfits/${name}`);
      }
    }
  }

  if (missing.length > 0) {
    console.error("verify-avatar-assets: missing files (add PNGs under public/avatars/ or fix mappings):\n");
    for (const m of missing) console.error(" ", m);
    console.error(`\nTotal missing: ${missing.length}`);
    process.exit(1);
  }

  console.log(
    "verify-avatar-assets: OK — character files:",
    AVATAR_CHARACTERS.length,
    charactersOnly
      ? "(characters-only; outfits not checked)"
      : `outfit ids checked: ${outfitIdsChecked}`,
  );
  process.exit(0);
}

main();
