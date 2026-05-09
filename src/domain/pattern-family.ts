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

/**
 * AL-2-B Phase 1 — alias dictionary mapping non-canonical scenario family vocabulary
 * to existing canonical 5. Source: docs/AL-2-A-mapping-decision-template.csv
 * (HIGH + MEDIUM confidence rows only; LOW rows deferred).
 * NEW_AXIS aliases (truth/integrity/authority/control/visibility) = Phase 2 scope.
 */
const PATTERN_FAMILY_ALIAS: Readonly<Record<string, string>> = {
  // ownership axis (canonical: ownership_escape) — 7 entries
  ownership_avoidance: "ownership_escape",
  ownership_act: "ownership_escape",
  ownership_clarity: "ownership_escape",
  over_ownership: "ownership_escape",
  ownership_transfer: "ownership_escape",
  documentation_without_ownership: "ownership_escape",
  role_ownership: "ownership_escape",

  // time axis (canonical: future_deferral) — 1 entry
  burnout_normalization: "future_deferral",

  // conflict axis (canonical: delegation_deflection) — 5 entries
  silence_avoidance: "delegation_deflection",
  silence_normalization: "delegation_deflection",
  conflict_avoidance: "delegation_deflection",
  stability_preservation: "delegation_deflection",
  silence_alignment: "delegation_deflection",

  // accountability axis (canonical: explanation_substitution) — 6 entries
  performance_blame: "explanation_substitution",
  blame_shift: "explanation_substitution",
  rationalization: "explanation_substitution",
  documentation_sanitization: "explanation_substitution",
  blame_reversal: "explanation_substitution",
  growth_justification: "explanation_substitution",

  // repair axis (canonical: repair_avoidance) — 4 entries
  trust_repair: "repair_avoidance",
  correction_avoidance: "repair_avoidance",
  boundary_reset: "repair_avoidance",
  compensation_loop: "repair_avoidance",

  // ── AL-2-B Phase 2 — NEW_AXIS aliases ──
  // truth axis (canonical: truth_naming) — 7 entries
  reality_distortion: "truth_naming",
  truth_entry: "truth_naming",
  truth_expression: "truth_naming",
  system_exposure: "truth_naming",
  truth_recognition: "truth_naming",
  reality_reclaiming: "truth_naming",
  distortion_identification: "truth_naming",

  // integrity axis (canonical: integrity_compromise) — 12 entries
  insight_without_behavior: "integrity_compromise",
  integrity_alignment: "integrity_compromise",
  identity_commitment: "integrity_compromise",
  silent_execution: "integrity_compromise",
  exception_normalization: "integrity_compromise",
  leader_variability: "integrity_compromise",
  passive_trust: "integrity_compromise",
  person_dependent_integrity: "integrity_compromise",
  relationship_exception: "integrity_compromise",
  drift_normalization: "integrity_compromise",
  principle_without_constraint: "integrity_compromise",
  selective_enforcement: "integrity_compromise",

  // authority axis (canonical: authority_protection) — 5 entries
  authority_preservation: "authority_protection",
  neutrality_masking: "authority_protection",
  authority_exercise: "authority_protection",
  leader_protection: "authority_protection",
  authority_constraint: "authority_protection",

  // control axis (canonical: self_protection) — 5 entries
  hidden_resistance: "self_protection",
  surface_compliance: "self_protection",
  temporary_compliance: "self_protection",
  control_fixation: "self_protection",
  recentralized_control: "self_protection",

  // visibility axis (canonical: reputation_protection) — 1 entry (V-1-A unlocked in AL-2-C R3.4.1)
  group_conformity: "reputation_protection",

  // ── AL-2-C R3 decision lock — additional alias entries ──
  // Source: docs/AL-2-C-decision-lock.md (Hanbit Commander semantic decision lock)
  // 7 alias additions resolving R3.3.* + R3.4.1 LOW row decisions.

  // control axis (R3.3.1)
  private_intention: "self_protection",

  // authority axis (R3.3.3, R3.3.4)
  successor_protection: "authority_protection",
  system_defensiveness: "authority_protection",

  // accountability axis (R3.3.7) — rationalizing > owning
  accountability_application: "explanation_substitution",

  // truth axis (R3.3.9, R3.3.11) — naming-as-correction semantic
  misuse_correction: "truth_naming",
  visible_correction: "truth_naming",
};

export function normalizePatternFamilyId(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return null;
  const tLower = t.toLowerCase();
  if (tLower === LEGACY_EXPLANATION_ALIAS) return "explanation_substitution";
  const aliased = PATTERN_FAMILY_ALIAS[tLower];
  if (aliased) return aliased;
  return t;
}

export function isCanonicalPatternFamily(id: string): id is CanonicalPatternFamily {
  return (CANONICAL_PATTERN_FAMILIES as readonly string[]).includes(id);
}
