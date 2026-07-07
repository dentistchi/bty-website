/**
 * BTY Today Intelligence — Axis → Relationship resolution (Commander-locked v1.1).
 *
 * Pure domain: inputs in, relationship out. No I/O, no display strings.
 *
 * The three product-facing relationships:
 *   Self   = relationship with Self
 *   Others = relationship with Others
 *   World  = relationship with World
 *
 * Authority (STEP 7L lock): the axis token is PRIMARY; pattern_family is a FALLBACK used
 * only when the axis is absent / unknown / non-derivable. pattern_family must never
 * override a derivable axis. An unknown / unmatched token MUST NOT be guessed → null.
 */
import { normalizePatternFamilyId } from "@/domain/pattern-family";

export type Relationship = "Self" | "Others" | "World";
export type RelationshipSource = "axis" | "pattern_family_fallback";

/**
 * AXIS_RELATIONSHIP_LOOKUP_V1.1 (STEP 7L). Keys are canonical axis tokens.
 * v1.1 adds `reputation → Others` (relational pressure before people's evaluation),
 * kept distinct from `visibility → World` (reality / record / disclosure / system visibility).
 */
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
  reputation: "Others",
} as const;

/**
 * Canonical pattern-family → axis token. Derived from the documented axis labels in
 * pattern-family.ts's alias groupings: each canonical family belongs to exactly one axis.
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
  reputation_protection: "reputation",
} as const;

/** Axis values that explicitly carry no single relationship signal → never derive. */
const NON_DERIVABLE_AXIS = new Set(["", "unknown", "multi", "none", "mixed"]);

/**
 * Robust axis-token normalization (STEP 7L). Trims, lowercases, and folds space / hyphen /
 * slash separators to a single underscore while preserving simple underscore tokens. So
 * "Ownership" → "ownership", " ownership " → "ownership", "Reputation" → "reputation",
 * "Courage/Risk" → "courage_risk", "courage-risk" → "courage_risk", "courage_risk" → unchanged.
 */
export function normalizeAxisToken(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s/\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Resolve a raw stored axis string to a canonical axis token, or null when it carries no
 * derivable single-relationship signal. Order (no guessing): normalize → direct lookup
 * token → the token is a pattern-family id whose documented axis token maps. Else null.
 */
export function axisTokenFromRaw(rawAxis: string | null | undefined): string | null {
  const token = normalizeAxisToken(rawAxis);
  if (!token || NON_DERIVABLE_AXIS.has(token)) return null;
  if (token in AXIS_RELATIONSHIP_LOOKUP_V1) return token;
  const family = normalizePatternFamilyId(token); // token is already lowercase/trimmed
  if (family && CANONICAL_FAMILY_AXIS[family]) return CANONICAL_FAMILY_AXIS[family];
  return null;
}

/**
 * Map a raw axis token to a relationship, or null when unknown / unmatched (never guessed).
 * This is the PRIMARY-authority path (the axis column).
 */
export function axisToRelationship(rawAxis: string | null | undefined): Relationship | null {
  const token = axisTokenFromRaw(rawAxis);
  if (!token) return null;
  return AXIS_RELATIONSHIP_LOOKUP_V1[token] ?? null;
}

/**
 * FALLBACK-authority path: infer a relationship from a pattern_family id (alias-normalized
 * → canonical → axis token → relationship). Used only when the axis is not derivable.
 */
export function inferRelationshipFromPatternFamily(
  patternFamily: string | null | undefined,
): Relationship | null {
  if (patternFamily == null || typeof patternFamily !== "string") return null;
  const family = normalizePatternFamilyId(patternFamily.trim().toLowerCase());
  if (!family) return null;
  const axisToken = CANONICAL_FAMILY_AXIS[family];
  if (!axisToken) return null;
  return AXIS_RELATIONSHIP_LOOKUP_V1[axisToken] ?? null;
}

/**
 * STEP 7L authority rule: axis PRIMARY, pattern_family FALLBACK. Returns the relationship
 * plus which source produced it, or null when neither derives. pattern_family never
 * overrides a derivable axis.
 */
export function resolveRelationship(input: {
  axis?: string | null;
  patternFamily?: string | null;
}): { relationship: Relationship; source: RelationshipSource } | null {
  const fromAxis = axisToRelationship(input.axis);
  if (fromAxis) return { relationship: fromAxis, source: "axis" };
  const fromFamily = inferRelationshipFromPatternFamily(input.patternFamily);
  if (fromFamily) return { relationship: fromFamily, source: "pattern_family_fallback" };
  return null;
}
