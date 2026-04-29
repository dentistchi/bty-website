/**
 * `ENGINE_ARCHITECTURE_V1.md` §5 rule 1 + `PATTERN_ACTION_MODEL_V1.md` §2 — canonical ids.
 * Legacy alias `explanation` must never be persisted.
 */
export const CANONICAL_PATTERN_FAMILIES = [
  "ownership_escape",
  "repair_avoidance",
  "explanation_substitution",
  "delegation_deflection",
  "future_deferral",
] as const;

/** `PATTERN_ACTION_MODEL_V1.md` §3 — exit signals in 7-run window required to force a contract. */
export const PATTERN_ACTION_CONTRACT_EXIT_THRESHOLD = 3;

export type CanonicalPatternFamily = (typeof CANONICAL_PATTERN_FAMILIES)[number];

const LEGACY_EXPLANATION_ALIAS = "explanation" as const;

export function normalizePatternFamilyId(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return null;
  if (t.toLowerCase() === LEGACY_EXPLANATION_ALIAS) return "explanation_substitution";
  return t;
}

export function isCanonicalPatternFamily(id: string): id is CanonicalPatternFamily {
  return (CANONICAL_PATTERN_FAMILIES as readonly string[]).includes(id);
}
