import { CODE_NAMES } from "@/domain/constants";

/**
 * Badge asset filename per code index (0..6), matching public/badge/<name>.png.
 * Order MUST mirror CODE_NAMES (constants.ts): FORGE0 … ARCHITECT5, CODELESS6.
 */
const CODE_BADGE_NAMES = [
  "forge",
  "pulse",
  "frame",
  "ascend",
  "nova",
  "architect",
  "codeless",
] as const;

/**
 * Resolve the public badge image src from a display codeName (e.g. "FORGE").
 * Returns null when codeName is not a known CODE_NAMES entry (render → omit).
 */
export function codeBadgeSrcByName(codeName: string): string | null {
  const i = CODE_NAMES.indexOf(codeName);
  if (i < 0) return null;
  return `/badge/${CODE_BADGE_NAMES[i]}.png`;
}
