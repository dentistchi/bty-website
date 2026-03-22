/**
 * 덴탈 악세 PNG를 동일 픽셀을 담은 SVG(embedded raster)로 바꿉니다.
 * 진짜 벡터 SVG가 필요하면 디자인 툴에서 다시 내보내세요.
 *
 * Usage: npx --yes tsx scripts/embed-accessory-png-as-svg.ts
 *
 * 처리: public/avatars/accessories/*.png (하위 catalog 제외) → {slug}.svg 생성 후 .png 삭제
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugifyOutfitAssetBasename } from "../src/lib/bty/arena/avatar-manifest-scan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const accDir = path.join(root, "public", "avatars", "accessories");

function main(): void {
  const names = fs.readdirSync(accDir).filter((n) => {
    const p = path.join(accDir, n);
    return fs.statSync(p).isFile() && n.toLowerCase().endsWith(".png");
  });
  if (names.length === 0) {
    console.log(
      "embed-accessory-png-as-svg: nothing to do — no .png files in public/avatars/accessories/ (already converted, or add PNGs here to convert).",
    );
    process.exit(0);
  }

  for (const name of names) {
    const base = name.slice(0, -".png".length);
    const id = slugifyOutfitAssetBasename(base);
    const pngBuf = fs.readFileSync(path.join(accDir, name));
    const b64 = pngBuf.toString("base64");
    const w = 1024;
    const h = 1024;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${id}">
  <image href="data:image/png;base64,${b64}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
    const outName = `${id}.svg`;
    const outPath = path.join(accDir, outName);
    fs.writeFileSync(outPath, svg, "utf8");
    fs.unlinkSync(path.join(accDir, name));
    console.log(`  ${name} → ${outName}`);
  }
  console.log(`embed-accessory-png-as-svg: converted ${names.length} file(s).`);
  process.exit(0);
}

main();
