/**
 * 레벨맵·매니페스트가 참조하는 악세서리 URL에 해당하는 파일이 없으면
 * 최소 SVG(.dental) / PNG(.game) 플레이스홀더를 `public/avatars/accessories/`에 씁니다.
 * (브라우저 Network 404 반복 방지 — 실제 에셋으로 교체 가능)
 *
 * Usage: npm run write:accessory-placeholders
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  getAccessoryImageUrl,
  LEGACY_ACCESSORY_IDS_FOR_ASSETS,
} from "../src/lib/bty/arena/avatarOutfits";
import { ACCESSORY_IDS_ALL } from "../src/lib/bty/arena/avatar-assets.data";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");

function urlToPublicPath(url: string): string {
  const clean = url.replace(/^\//, "").split("?")[0] ?? "";
  return decodeURIComponent(clean);
}

function minimalSvg(label: string): string {
  const safe = label.replace(/[<>&]/g, "").slice(0, 12);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${safe}">
  <rect width="64" height="64" fill="#ececec"/>
  <text x="32" y="36" text-anchor="middle" font-size="7" fill="#888" font-family="system-ui,sans-serif">${safe}</text>
</svg>
`;
}

async function main(): Promise<void> {
  const ids = new Set<string>([...ACCESSORY_IDS_ALL, ...LEGACY_ACCESSORY_IDS_FOR_ASSETS]);
  let wrote = 0;
  let skipped = 0;

  for (const id of ids) {
    const url = getAccessoryImageUrl(id);
    const rel = urlToPublicPath(url);
    const abs = path.join(publicDir, rel);
    try {
      await fs.access(abs);
      skipped += 1;
      continue;
    } catch {
      // missing
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    if (rel.toLowerCase().endsWith(".svg")) {
      await fs.writeFile(abs, minimalSvg(id), "utf8");
    } else {
      const buf = await sharp({
        create: {
          width: 64,
          height: 64,
          channels: 4,
          background: { r: 236, g: 236, b: 236, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      await fs.writeFile(abs, buf);
    }
    wrote += 1;
    console.log("wrote", rel);
  }

  console.log(`write-accessory-placeholders: wrote ${wrote}, skipped (exists) ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
