import {
  isArenaPrimaryMissionChoiceId,
  isArenaReinforcementMissionChoiceId,
} from "./arenaMissionChoiceToken";
import type { PrimaryChoice, ReinforcementChoice } from "./types";

export const ARENA_MISSION_CHOICE_LABEL_MAX_LENGTH = 64;
export const ARENA_MISSION_CHOICE_TITLE_MAX_LENGTH = 500;
export const ARENA_MISSION_CHOICE_SUBTITLE_MAX_LENGTH = 500;

function trimmedNonEmptyBounded(s: string, max: number): string | null {
  const t = s.trim();
  if (!t || t.length > max) return null;
  return t;
}

/**
 * Parses a `PrimaryChoice`-shaped object from JSON-like input.
 * `id` must satisfy `isArenaPrimaryMissionChoiceId` (A|B|C).
 * Non-objects (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */
export function arenaPrimaryChoiceFromUnknown(value: unknown): PrimaryChoice | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.label !== "string" || typeof o.title !== "string") {
    return null;
  }
  const id = o.id.trim();
  if (!isArenaPrimaryMissionChoiceId(id)) return null;
  const label = trimmedNonEmptyBounded(o.label, ARENA_MISSION_CHOICE_LABEL_MAX_LENGTH);
  const title = trimmedNonEmptyBounded(o.title, ARENA_MISSION_CHOICE_TITLE_MAX_LENGTH);
  if (label === null || title === null) return null;

  const out: PrimaryChoice = { id, label, title };

  if ("subtitle" in o && o.subtitle !== undefined) {
    if (o.subtitle === null) return null;
    if (typeof o.subtitle !== "string") return null;
    const subtitle = trimmedNonEmptyBounded(
      o.subtitle,
      ARENA_MISSION_CHOICE_SUBTITLE_MAX_LENGTH,
    );
    if (subtitle === null) return null;
    out.subtitle = subtitle;
  }

  return out;
}

/**
 * Parses a `ReinforcementChoice`-shaped object from JSON-like input.
 * `id` must satisfy `isArenaReinforcementMissionChoiceId` (X|Y).
 * Non-objects (including top-level **`Symbol`** / **`bigint`**) → **`null`**.
 */
export function arenaReinforcementChoiceFromUnknown(value: unknown): ReinforcementChoice | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.label !== "string" || typeof o.title !== "string") {
    return null;
  }
  const id = o.id.trim();
  if (!isArenaReinforcementMissionChoiceId(id)) return null;
  const label = trimmedNonEmptyBounded(o.label, ARENA_MISSION_CHOICE_LABEL_MAX_LENGTH);
  const title = trimmedNonEmptyBounded(o.title, ARENA_MISSION_CHOICE_TITLE_MAX_LENGTH);
  if (label === null || title === null) return null;
  return { id, label, title };
}
