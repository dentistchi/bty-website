import {
  isArenaPrimaryMissionChoiceId,
  isArenaReinforcementMissionChoiceId,
} from "./arenaMissionChoiceToken";

/**
 * Builds `ArenaScenario.outcomes` lookup key (`primary_reinforcement`, e.g. `A_X`) when both ids are valid mission tokens.
 * Returns null if either id fails `isArenaPrimaryMissionChoiceId` / `isArenaReinforcementMissionChoiceId`.
 */
export function arenaMissionOutcomeKeyFromChoiceIds(
  primaryId: unknown,
  reinforcementId: unknown,
): string | null {
  if (typeof primaryId !== "string" || typeof reinforcementId !== "string") return null;
  const p = primaryId.trim();
  const r = reinforcementId.trim();
  if (!isArenaPrimaryMissionChoiceId(p)) return null;
  if (!isArenaReinforcementMissionChoiceId(r)) return null;
  return `${p}_${r}`;
}

export type ArenaMissionOutcomeKeyParts = {
  primaryId: string;
  reinforcementId: string;
};

/**
 * Parses a stored outcomes map key (`primary_reinforcement`) using the first `_` as the separator.
 * Returns null if the shape is not exactly one valid primary + one valid reinforcement token (trimmed).
 */
export function arenaMissionOutcomeKeyPartsFromUnknown(raw: unknown): ArenaMissionOutcomeKeyParts | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  const i = s.indexOf("_");
  if (i <= 0 || i >= s.length - 1) return null;
  const primary = s.slice(0, i);
  const reinforcement = s.slice(i + 1);
  if (!isArenaPrimaryMissionChoiceId(primary)) return null;
  if (!isArenaReinforcementMissionChoiceId(reinforcement)) return null;
  return { primaryId: primary.trim(), reinforcementId: reinforcement.trim() };
}
