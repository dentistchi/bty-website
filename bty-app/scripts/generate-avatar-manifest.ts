/**
 * `public/avatars/outfits`·`accessories` 폴더를 스캔해 `avatar-assets.json`을 생성한다.
 *
 * Usage:
 *   npx --yes tsx scripts/generate-avatar-manifest.ts
 *   npx --yes tsx scripts/generate-avatar-manifest.ts --rename-loose   # 옷·악세: 공백 등 비표준 파일명 → outfit_{slug}.png / {slug}.svg|png
 *   npx --yes tsx scripts/generate-avatar-manifest.ts --force   # 개수 불일치여도 쓰기(비권장)
 *
 * 목표 개수: `avatar-manifest-constants.ts` (옷 20 · 악세 24).
 * Professional / Fantasy 분할:
 *   - `public/avatars/outfits/manifest-split.json` 이 있으면 그대로 사용(스캔 id와 집합 일치 필수).
 *   - 없으면 파일명 id를 정렬해 앞 절반 → professional, 뒤 절반 → fantasy.
 *
 * 출력(동일 내용):
 *   - src/lib/bty/arena/data/avatar-assets.json
 *   - public/avatars/avatar-assets.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AVATAR_MANIFEST_EXPECTED_ACCESSORY_FILES,
  AVATAR_MANIFEST_EXPECTED_OUTFIT_FILES,
} from "../src/lib/bty/arena/avatar-manifest-constants";
import {
  accessoryIdAndKindFromAnyFilename,
  outfitIdFromAnyOutfitPngFilename,
  partitionOutfitsAlphabetical,
  partitionOutfitsFromSplit,
  type ManifestSplit,
} from "../src/lib/bty/arena/avatar-manifest-scan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const outfitsDir = path.join(publicDir, "avatars", "outfits");
/** 공백·임시 PNG가 섞인 상위 폴더와 분리: `catalog/`에 `[a-z0-9_]+.(svg|png)`만 두면 24개 스캔이 안정적. */
const accessoriesCatalogDir = path.join(publicDir, "avatars", "accessories", "catalog");
const accessoriesRootDir = path.join(publicDir, "avatars", "accessories");
const splitPath = path.join(outfitsDir, "manifest-split.json");
const outSrc = path.join(root, "src", "lib", "bty", "arena", "data", "avatar-assets.json");
const outPublic = path.join(publicDir, "avatars", "avatar-assets.json");

function readDirFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => {
    const p = path.join(dir, n);
    return fs.statSync(p).isFile();
  });
}

function countScannableAccessories(dir: string): number {
  let n = 0;
  for (const name of readDirFiles(dir)) {
    if (accessoryIdAndKindFromAnyFilename(name)) n += 1;
  }
  return n;
}

function resolveAccessoriesDir(): string {
  if (fs.existsSync(accessoriesCatalogDir)) {
    if (countScannableAccessories(accessoriesCatalogDir) > 0) return accessoriesCatalogDir;
  }
  return accessoriesRootDir;
}

/**
 * 베이스 옷 PNG마다 id 한 개(outfit_ 접두 또는 파일명 슬러그).
 * 동일 id가 두 파일에서 나오면 예외.
 */
function scanOutfitIds(): string[] {
  const pngs = readDirFiles(outfitsDir).filter((n) => n.toLowerCase().endsWith(".png"));
  const idToFile = new Map<string, string>();
  for (const name of pngs) {
    const id = outfitIdFromAnyOutfitPngFilename(name);
    if (!id) continue;
    const prev = idToFile.get(id);
    if (prev && prev !== name) {
      throw new Error(
        `generate-avatar-manifest: duplicate outfit id "${id}" from files "${prev}" and "${name}". Remove or rename one.`,
      );
    }
    idToFile.set(id, name);
  }
  return [...idToFile.keys()].sort((a, b) => a.localeCompare(b, "en"));
}

/** 런타임·verify와 맞추기: `outfit_{id}.png` 가 아닌 베이스 PNG를 슬러그 기준으로 이름 변경. */
function renameLooseOutfitFilesToCanonical(): void {
  const pngs = readDirFiles(outfitsDir).filter((n) => n.toLowerCase().endsWith(".png"));
  const targets: { from: string; target: string }[] = [];
  for (const name of pngs) {
    const id = outfitIdFromAnyOutfitPngFilename(name);
    if (!id) continue;
    const target = `outfit_${id}.png`;
    if (name === target) continue;
    targets.push({ from: name, target });
  }
  if (targets.length === 0) return;

  const seenTargets = new Set<string>();
  for (const t of targets) {
    if (seenTargets.has(t.target)) {
      throw new Error(
        `generate-avatar-manifest: multiple files would rename to "${t.target}". Resolve duplicate slugs first.`,
      );
    }
    seenTargets.add(t.target);
  }

  for (const t of targets) {
    const absTarget = path.join(outfitsDir, t.target);
    if (fs.existsSync(absTarget) && t.from !== t.target) {
      throw new Error(
        `generate-avatar-manifest: cannot rename "${t.from}" → "${t.target}": "${t.target}" already exists.`,
      );
    }
  }
  for (let i = 0; i < targets.length; i++) {
    const from = path.join(outfitsDir, targets[i].from);
    const tmp = path.join(outfitsDir, `.manifest-rename-${i}.tmp.png`);
    fs.renameSync(from, tmp);
  }
  for (let i = 0; i < targets.length; i++) {
    const tmp = path.join(outfitsDir, `.manifest-rename-${i}.tmp.png`);
    const to = path.join(outfitsDir, targets[i].target);
    fs.renameSync(tmp, to);
  }
  console.log(
    `generate-avatar-manifest: renamed ${targets.length} loose outfit file(s) to outfit_{id}.png (see slug rules in avatar-manifest-scan.ts)`,
  );
}

/** 런타임 URL: `/avatars/accessories/{id}.svg|png` — 슬러그 파일명으로 맞춤. */
function renameLooseAccessoryFilesToCanonical(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const targets: { from: string; target: string }[] = [];
  for (const name of readDirFiles(dir)) {
    const parsed = accessoryIdAndKindFromAnyFilename(name);
    if (!parsed) continue;
    const ext = parsed.kind === "dental" ? "svg" : "png";
    const target = `${parsed.id}.${ext}`;
    if (name === target) continue;
    targets.push({ from: name, target });
  }
  if (targets.length === 0) return;

  const seenTargets = new Set<string>();
  for (const t of targets) {
    if (seenTargets.has(t.target)) {
      throw new Error(
        `generate-avatar-manifest: multiple accessory files would rename to "${t.target}". Resolve duplicate slugs first.`,
      );
    }
    seenTargets.add(t.target);
  }
  for (const t of targets) {
    const absTarget = path.join(dir, t.target);
    if (fs.existsSync(absTarget) && t.from !== t.target) {
      throw new Error(
        `generate-avatar-manifest: cannot rename "${t.from}" → "${t.target}": "${t.target}" already exists.`,
      );
    }
  }
  for (let i = 0; i < targets.length; i++) {
    const ext = targets[i].target.endsWith(".svg") ? "svg" : "png";
    fs.renameSync(
      path.join(dir, targets[i].from),
      path.join(dir, `.manifest-acc-${i}.tmp.${ext}`),
    );
  }
  for (let i = 0; i < targets.length; i++) {
    const ext = targets[i].target.endsWith(".svg") ? "svg" : "png";
    fs.renameSync(path.join(dir, `.manifest-acc-${i}.tmp.${ext}`), path.join(dir, targets[i].target));
  }
  console.log(
    `generate-avatar-manifest: renamed ${targets.length} loose accessory file(s) in ${path.relative(root, dir)} → {id}.svg|png`,
  );
}

function scanAccessories(dir: string): { dental: string[]; game: string[] } {
  const idToFile = new Map<string, { kind: "dental" | "game"; file: string }>();
  for (const name of readDirFiles(dir)) {
    const parsed = accessoryIdAndKindFromAnyFilename(name);
    if (!parsed) continue;
    const prev = idToFile.get(parsed.id);
    if (prev) {
      if (prev.kind !== parsed.kind) {
        throw new Error(
          `generate-avatar-manifest: id "${parsed.id}" appears as both dental (.svg) and game (.png): conflict.`,
        );
      }
      if (prev.file !== name) {
        throw new Error(
          `generate-avatar-manifest: duplicate accessory id "${parsed.id}" from "${prev.file}" and "${name}".`,
        );
      }
    }
    idToFile.set(parsed.id, { kind: parsed.kind, file: name });
  }
  const dental: string[] = [];
  const game: string[] = [];
  for (const [id, { kind }] of idToFile) {
    if (kind === "dental") dental.push(id);
    else game.push(id);
  }
  dental.sort((a, b) => a.localeCompare(b, "en"));
  game.sort((a, b) => a.localeCompare(b, "en"));
  return { dental, game };
}

function loadSplit(): ManifestSplit | null {
  if (!fs.existsSync(splitPath)) return null;
  const raw = fs.readFileSync(splitPath, "utf8");
  const j = JSON.parse(raw) as unknown;
  if (!j || typeof j !== "object") throw new Error("manifest-split.json must be an object");
  const o = j as Record<string, unknown>;
  const pro = o.professional;
  const fan = o.fantasy;
  if (!Array.isArray(pro) || !Array.isArray(fan)) {
    throw new Error("manifest-split.json requires { professional: string[], fantasy: string[] }");
  }
  if (!pro.every((x) => typeof x === "string") || !fan.every((x) => typeof x === "string")) {
    throw new Error("manifest-split.json arrays must contain strings");
  }
  return { professional: pro as string[], fantasy: fan as string[] };
}

function writeManifest(data: object): void {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  fs.mkdirSync(path.dirname(outSrc), { recursive: true });
  fs.writeFileSync(outSrc, text, "utf8");
  fs.mkdirSync(path.dirname(outPublic), { recursive: true });
  fs.writeFileSync(outPublic, text, "utf8");
}

/** 런타임 URL은 `/avatars/accessories/{id}.svg|png` 이므로 catalog에만 있으면 복사. */
function syncAccessoriesCatalogToRoot(): void {
  if (!fs.existsSync(accessoriesCatalogDir)) return;
  const names = readDirFiles(accessoriesCatalogDir).filter((n) => accessoryIdAndKindFromAnyFilename(n));
  if (names.length === 0) return;
  fs.mkdirSync(accessoriesRootDir, { recursive: true });
  for (const name of names) {
    const from = path.join(accessoriesCatalogDir, name);
    const to = path.join(accessoriesRootDir, name);
    fs.copyFileSync(from, to);
  }
  console.log(
    `generate-avatar-manifest: synced ${names.length} file(s) from accessories/catalog → accessories/ (for /avatars/accessories/{id}.* URLs)`,
  );
}

function main(): void {
  const force = process.argv.includes("--force");
  const renameLoose = process.argv.includes("--rename-loose");

  if (renameLoose) {
    renameLooseOutfitFilesToCanonical();
    renameLooseAccessoryFilesToCanonical(accessoriesRootDir);
    if (fs.existsSync(accessoriesCatalogDir)) {
      renameLooseAccessoryFilesToCanonical(accessoriesCatalogDir);
    }
  }

  const outfitIds = scanOutfitIds();
  const accDir = resolveAccessoriesDir();
  const { dental, game } = scanAccessories(accDir);
  const accTotal = dental.length + game.length;

  if (!force) {
    if (outfitIds.length !== AVATAR_MANIFEST_EXPECTED_OUTFIT_FILES) {
      console.error(
        `generate-avatar-manifest: expected ${AVATAR_MANIFEST_EXPECTED_OUTFIT_FILES} base outfit PNGs (excluding _A/_B/_C/_D body variants), found ${outfitIds.length}.`,
      );
      console.error("  Dir:", outfitsDir);
      console.error(
        "  Hint: Any *.png is accepted; id = outfit_{id}.png strip, else slug of the basename. If files are not yet named outfit_{id}.png, run once with --rename-loose",
      );
      process.exit(1);
    }
    if (accTotal !== AVATAR_MANIFEST_EXPECTED_ACCESSORY_FILES) {
      console.error(
        `generate-avatar-manifest: expected ${AVATAR_MANIFEST_EXPECTED_ACCESSORY_FILES} accessory files (.svg dental + .png game), found ${accTotal} (${dental.length} svg + ${game.length} png).`,
      );
      console.error("  Dir:", accDir);
      console.error(
        "  Hint: .svg = dental, .png = game. Loose names (spaces, etc.) get slug ids; run with --rename-loose once. Prefer 24 files in accessories/catalog/ or flat in accessories/.",
      );
      process.exit(1);
    }
  }

  let outfits: ManifestSplit;
  const split = loadSplit();
  if (split) {
    outfits = partitionOutfitsFromSplit(outfitIds, split);
  } else {
    outfits = partitionOutfitsAlphabetical(outfitIds);
  }

  const manifest = {
    accessories: { dental, game },
    outfits: {
      professional: outfits.professional,
      fantasy: outfits.fantasy,
    },
  };

  writeManifest(manifest);
  syncAccessoriesCatalogToRoot();

  console.log(
    `generate-avatar-manifest: wrote ${outSrc} and ${outPublic} — outfits ${outfits.professional.length}+${outfits.fantasy.length}=${outfitIds.length}, accessories dental ${dental.length} + game ${game.length} = ${accTotal}`,
  );
  process.exit(0);
}

main();
