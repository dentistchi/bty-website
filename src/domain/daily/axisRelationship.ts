/**
 * BTY Today Intelligence v1 — Axis → Relationship lookup (Commander-locked).
 *
 * Pure domain: inputs in, relationship out. No I/O, no display strings.
 *
 * AXIS_RELATIONSHIP_LOOKUP_V1 is the Commander-approved v1 map (STEP 7B decision lock).
 * The three product-facing relationships:
 *   Self   = relationship with Self
 *   Others = relationship with Others
 *   World  = relationship with World
 *
 * LOCK: an unknown / unmatched axis MUST NOT be guessed. No axis match → null →
 * clean fallback upstream. This function never invents a relationship.
 */
import { normalizePatternFamilyId } from "@/domain/pattern-family";

export type Relationship = "Self" | "Others" | "World";

/** Commander AXIS_RELATIONSHIP_LOOKUP_V1 (STEP 7B). Keys are canonical axis tokens. */
export const AXIS_RELATIONSHIP_LOOKUP_V1: Readonly<Record<string, Relationship>> = {
  ownership: "Others",
  time: "Self",
  authority: "Others",
  truth: "World",
  repair: "Others",
  conflict: "Others",
  integrity: "Self",
  visibility: "World",
  accountability: "Others",
  courage: "Self",
  courage_risk: "Self",
  risk: "Self",
  control: "World",
  identity: "Self",
} as const;

/**
 * Canonical pattern-family → axis token. Derived from the documented axis labels in
 * {@link normalizePatternFamilyId}'s source (pattern-family.ts alias groupings): each
 * canonical family already belongs to exactly one axis. This lets a stored `axis` value
 * that is actually a family id resolve to its axis token without guessing.
 */
const CANONICAL_FAMILY_AXIS: Readonly<Record<string, string>> = {
  ownership_escape: "ownership",
  repair_avoidance: "repair",
  explanation_substitution: "accountability",
  delegation_deflection: "conflict",
  future_deferral: "time",
  truth_naming: "truth",
  integrity_compromise: "integrity",
  authority_protection: "authority",
  self_protection: "control",
  reputation_protection: "visibility",
} as const;

/** Axis values that explicitly carry no single relationship signal → never derive. */
const NON_DERIVABLE_AXIS = new Set(["", "unknown", "multi", "none", "mixed"]);

/**
 * Resolve a raw stored axis string to a canonical axis token, or null when it carries
 * no derivable single-relationship signal. Resolution order (no guessing):
 *   1. direct Commander-lookup token (e.g. "ownership")
 *   2. the axis is a pattern-family id → its documented axis token
 * Anything else → null.
 */
export function axisTokenFromRaw(rawAxis: string | null | undefined): string | null {
  if (rawAxis == null || typeof rawAxis !== "string") return null;
  const token = rawAxis.trim().toLowerCase();
  if (NON_DERIVABLE_AXIS.has(token)) return null;

  if (token in AXIS_RELATIONSHIP_LOOKUP_V1) return token;

  const family = normalizePatternFamilyId(token);
  if (family && CANONICAL_FAMILY_AXIS[family]) return CANONICAL_FAMILY_AXIS[family];

  return null;
}

/**
 * Map a raw stored axis to a product relationship, or null when unknown / unmatched.
 * LOCK: null means "no relationship derivation" — the caller MUST fall back cleanly,
 * never guess.
 */
export function axisToRelationship(rawAxis: string | null | undefined): Relationship | null {
  const token = axisTokenFromRaw(rawAxis);
  if (!token) return null;
  return AXIS_RELATIONSHIP_LOOKUP_V1[token] ?? null;
}
