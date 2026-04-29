import type { ReflectionSeed } from "./buildReflectionSeed";

/**
 * Route hint from reflection focus — BTY “행동 후 해석” → next training surface.
 * Returns path segment under `/[locale]/growth/…`.
 */
export function growthTrackSegmentForFocus(focus: ReflectionSeed["focus"]): string {
  switch (focus) {
    case "clarity":
      return "guidance";
    case "trust":
      return "integrity";
    case "regulation":
      return "journey";
    case "alignment":
    default:
      return "journey";
  }
}
