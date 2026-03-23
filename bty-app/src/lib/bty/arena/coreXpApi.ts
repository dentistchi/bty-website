/**
 * GET /api/arena/core-xp response type.
 *
 * Gate 1 (useArenaSession · page tier → API tier only):
 * Clients MUST use `tier` from this response. Do NOT derive tier from
 * coreXpTotal (e.g. Math.floor(coreXpTotal / 10)); tier is computed
 * server-side via domain rules (tierFromCoreXp). Use response.tier for
 * pickRandomScenario(userTier), milestone modal, or any tier-based UI.
 *
 * Gate 2 (beginner 200 → API flag):
 * Clients MUST use `requiresBeginnerPath` for redirect to /bty-arena/beginner.
 * Do NOT compare coreXpTotal to 200 (or BEGINNER_CORE_XP_THRESHOLD) in the UI;
 * this flag is computed server-side from domain BEGINNER_CORE_XP_THRESHOLD.
 */
export type CoreXpGetResponse = {
  coreXpTotal: number;
  /** Server-computed tier (domain tierFromCoreXp). Use this; do not derive from coreXpTotal. */
  tier: number;
  /** Gate 2: true when coreXpTotal < BEGINNER_CORE_XP_THRESHOLD. Use for redirect to beginner path; do not compare coreXpTotal to 200 in UI. */
  requiresBeginnerPath: boolean;
  codeName: string;
  subName: string;
  seasonalXpTotal: number;
  codeHidden: boolean;
  subNameRenameAvailable: boolean;
  avatarUrl: string | null;
  avatarCharacterId: string | null;
  avatarCharacterLocked: boolean;
  avatarOutfitTheme: "professional" | "fantasy" | null;
  avatarSelectedOutfitId: string | null;
  /** Canonical layer URLs for Arena PNG `AvatarComposite` (dashboard, etc.). From `resolveDisplayAvatarLayers` with same `maxUnlockedLevel` as `currentOutfit`. */
  avatarCharacterImageUrl: string | null;
  /** Outfit overlay URL when layered; null if single-layer or N/A. */
  avatarOutfitImageUrl: string | null;
  currentOutfit: {
    outfitId: string;
    outfitLabel: string;
    accessoryIds: string[];
    accessoryLabels: string[];
  };
};
