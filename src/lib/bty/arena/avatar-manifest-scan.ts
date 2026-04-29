/**
 * 아바타 매니페스트 스캔용 순수 규칙 (파일명 → id).
 * `scripts/generate-avatar-manifest.ts`에서 fs와 조합해 사용.
 */

/** 체형 접미사 `_*_[ABCD].png` (확장자 직전) 는 베이스 옷이 아님. */
export function isOutfitBodyVariantPngFilename(filename: string): boolean {
  return /\.png$/i.test(filename) && /_([ABCD])\.png$/i.test(filename);
}

/** `outfit_{id}.png` 베이스만 인정. `outfit_x_A.png` 등 체형 접미사 파일은 제외. */
export function outfitIdFromOutfitFilename(filename: string): string | null {
  if (!/^outfit_.+\.png$/i.test(filename)) return null;
  if (isOutfitBodyVariantPngFilename(filename)) return null;
  const m = /^outfit_(.+)\.png$/i.exec(filename);
  return m ? m[1] : null;
}

/**
 * `1 Basic Clinic Scrubs.png` 등 임의 PNG → id (소문자·공백→`_`·비 [a-z0-9_] 제거).
 * 런타임은 `outfit_{id}.png` 를 요청하므로, 매니페스트 반영 전 파일명을 맞추거나 `--rename-loose` 사용.
 */
export function slugifyOutfitAssetBasename(baseWithoutExt: string): string {
  const s = baseWithoutExt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return s || "outfit";
}

/** 베이스 옷 PNG 하나에서 매니페스트 outfit id 추출 (outfit_ 형식 우선, 아니면 슬러그). */
export function outfitIdFromAnyOutfitPngFilename(filename: string): string | null {
  if (!filename.toLowerCase().endsWith(".png")) return null;
  if (filename === "README.md" || filename.startsWith(".")) return null;
  if (isOutfitBodyVariantPngFilename(filename)) return null;
  const fromPrefix = outfitIdFromOutfitFilename(filename);
  if (fromPrefix) return fromPrefix;
  const base = filename.slice(0, -".png".length);
  return slugifyOutfitAssetBasename(base);
}

/**
 * 악세사리 파일명 → id + dental(.svg) / game(.png).
 * `mask.svg`·`sword.png` 같은 표준명 또는 `Arena core.png` → 슬러그 `arena_core`.
 */
export function accessoryIdAndKindFromAnyFilename(
  filename: string,
): { id: string; kind: "dental" | "game" } | null {
  if (filename === "README.md" || filename.startsWith(".") || filename.toLowerCase() === ".ds_store") {
    return null;
  }
  if (filename.startsWith(".manifest")) return null;
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".svg") && !lower.endsWith(".png")) return null;
  const kind: "dental" | "game" = lower.endsWith(".svg") ? "dental" : "game";
  const ext = lower.endsWith(".svg") ? ".svg" : ".png";
  const base = filename.slice(0, -ext.length);
  const canonical = /^[a-z0-9][a-z0-9_]*\.(svg|png)$/i.test(filename);
  const id = canonical ? base : slugifyOutfitAssetBasename(base);
  if (!id) return null;
  return { id, kind };
}

/** @deprecated — use accessoryIdAndKindFromAnyFilename (동일 동작). */
export function accessoryIdAndKindFromFilename(
  filename: string,
): { id: string; kind: "dental" | "game" } | null {
  return accessoryIdAndKindFromAnyFilename(filename);
}

export type ManifestSplit = { professional: string[]; fantasy: string[] };

/** 스캔된 id를 정렬 후 반으로 나눔(20→10+10). 홀수면 professional 쪽에 하나 더. */
export function partitionOutfitsAlphabetical(allIds: string[]): ManifestSplit {
  const sorted = [...new Set(allIds)].sort((a, b) => a.localeCompare(b, "en"));
  const mid = Math.ceil(sorted.length / 2);
  return { professional: sorted.slice(0, mid), fantasy: sorted.slice(mid) };
}

/** manifest-split.json 내용으로 분할. 스캔 id 집합과 정확히 일치해야 함(중복·누락 없음). */
export function partitionOutfitsFromSplit(
  scannedIds: string[],
  split: ManifestSplit,
): ManifestSplit {
  const scan = new Set(scannedIds);
  const pro = split.professional;
  const fan = split.fantasy;
  const seen = new Set<string>();
  for (const id of pro) {
    if (seen.has(id)) throw new Error(`Duplicate outfit id "${id}" in manifest-split professional`);
    seen.add(id);
    if (fan.includes(id)) {
      throw new Error(`Outfit id "${id}" appears in both professional and fantasy in manifest-split.json`);
    }
  }
  for (const id of fan) {
    if (seen.has(id)) throw new Error(`Duplicate outfit id "${id}" in manifest-split fantasy`);
    seen.add(id);
  }
  for (const id of scan) {
    if (!seen.has(id)) {
      throw new Error(`Scanned outfit id "${id}" is missing from manifest-split.json`);
    }
  }
  for (const id of seen) {
    if (!scan.has(id)) {
      throw new Error(`manifest-split.json lists "${id}" but no matching outfit_${id}.png was found`);
    }
  }
  return {
    professional: [...pro].sort((a, b) => a.localeCompare(b, "en")),
    fantasy: [...fan].sort((a, b) => a.localeCompare(b, "en")),
  };
}
