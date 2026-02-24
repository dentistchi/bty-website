/**
 * BTY Arena Code and Sub Name constants (BTY_ARENA_SYSTEM_SPEC).
 * tier = floor(coreXP / 10), codeIndex = floor(tier / 100), subTierGroup = floor((tier % 100) / 25).
 */

export const CODE_NAMES = [
  "FORGE",
  "PULSE",
  "FRAME",
  "ASCEND",
  "NOVA",
  "ARCHITECT",
  "CODELESS ZONE",
] as const;

export type CodeIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Default sub names per code, by subTierGroup 0-3. Code 6 (CODELESS ZONE) has no defaults. */
export const SUB_NAMES: Record<CodeIndex, readonly [string, string, string, string] | null> = {
  0: ["Spark", "Ember", "Flame", "Inferno"],
  1: ["Echo", "Rhythm", "Resonance", "Surge"],
  2: ["Outline", "Structure", "Framework", "Foundation"],
  3: ["Lift", "Rise", "Elevation", "Summit"],
  4: ["Glimmer", "Radiance", "Brilliance", "Supernova"],
  5: ["Draft", "Design", "Blueprint", "Grand Architect"],
  6: null, // CODELESS ZONE: user-defined only
};

export function tierFromCoreXp(coreXp: number): number {
  return Math.max(0, Math.floor(coreXp / 10));
}

export function codeIndexFromTier(tier: number): CodeIndex {
  const idx = Math.floor(tier / 100);
  return Math.min(6, Math.max(0, idx)) as CodeIndex;
}

export function subTierGroupFromTier(tier: number): 0 | 1 | 2 | 3 {
  const g = Math.floor((tier % 100) / 25);
  return Math.min(3, Math.max(0, g)) as 0 | 1 | 2 | 3;
}

/**
 * Resolve display sub name: custom (profile.sub_name) or default from code/subTierGroup.
 * CODELESS ZONE (codeIndex 6): always use custom or fallback to "—".
 */
export function resolveSubName(
  codeIndex: CodeIndex,
  subTierGroup: 0 | 1 | 2 | 3,
  customSubName: string | null
): string {
  if (customSubName != null && customSubName.trim() !== "") return customSubName.trim();
  const defaults = SUB_NAMES[codeIndex];
  if (defaults) return defaults[subTierGroup];
  return "—";
}

/**
 * Seasonal XP → Core XP conversion (hidden from user).
 * Core < 200: 45 seasonal = 1 core (Beginner boost). Else 60:1.
 */
export function seasonalToCoreConversion(
  seasonalEarned: number,
  currentCoreXp: number
): { rate: number; coreGain: number; fractionalBuffer: number } {
  const rate = currentCoreXp < 200 ? 45 : 60;
  const exact = seasonalEarned / rate;
  const coreGain = Math.floor(exact);
  const fractionalBuffer = exact - coreGain;
  return { rate, coreGain, fractionalBuffer };
}
