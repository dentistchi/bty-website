/**
 * EXACT REFUSAL ATTRIBUTION (Slice 3.2I-R5B2-R5C-1).
 *
 * R5B read two real attempt rows and could not say what actually refused them. Two measured
 * defects caused that, and this module fixes both.
 *
 * ONE — a `startsWith("boundary_review")` umbrella folded EIGHT distinct reasons into one outcome,
 * including `reviewer_terminal_failure`, which belongs to the SEMANTIC reviewer and has nothing to
 * do with boundaries. An infrastructure failure was recorded as a content rejection.
 *
 * TWO, and larger — a genuine boundary CONTENT rejection never reaches the recorder as a boundary
 * reason at all. `boundaryStage.outcome === "boundary_review_reject"` retries once and then returns
 * plain `generation_rejected`, exactly like a quality-gate refusal. So the reason alone can never
 * separate "the boundary reviewer found a violation" from "the validator disliked the scenario".
 * The distinguishing evidence is the REJECTION GATE, which the service already computes and then
 * discarded. Carrying it is what makes attribution possible.
 *
 * Pure: no I/O, no clock, no randomness.
 */

/** Where the submission actually stopped. One stage per owner — semantic and boundary never merge. */
export const TERMINAL_STAGES = [
  "observability_gate",
  "generation_eligibility",
  "generation_provider",
  "generation_parse",
  "generation_schema",
  "scenario_quality",
  "semantic_review",
  "boundary_review",
  "persistence",
  "internal",
] as const;
export type TerminalStage = (typeof TERMINAL_STAGES)[number];

export const TERMINAL_REASON_CODES = [
  // pre-provider
  "generation_observability_unavailable",
  "generation_not_eligible",
  // provider transport — R5A taxonomy, unchanged
  "provider_timeout",
  "provider_transport_error",
  "provider_http_error",
  "provider_empty_output",
  "provider_malformed_output",
  "provider_schema_invalid",
  // content refusals
  "scenario_quality_rejected",
  "semantic_content_rejected",
  "semantic_review_authority_failure",
  "semantic_review_inconclusive",
  "semantic_reviewer_terminal_failure",
  "semantic_reviewer_transport_failure",
  "semantic_reviewer_schema_failure",
  "boundary_content_rejected",
  "boundary_review_authority_failure",
  "boundary_review_inconclusive",
  "boundary_reviewer_terminal_failure",
  "boundary_reviewer_transport_failure",
  "boundary_reviewer_schema_failure",
  // tail
  "scenario_persistence_failed",
  "internal_unclassified_failure",
] as const;
export type TerminalReasonCode = (typeof TERMINAL_REASON_CODES)[number];

/**
 * The gate vocabulary the generation service already reports through `RejectionOutcome.primaryGate`.
 * Measured from source; not invented here.
 */
export const REFUSAL_GATES = [
  "provider_dto",
  "canonical_validator",
  "semantic_review",
  "branch_review",
  "phase_choice_review",
  "primary_choice_review",
  "urgency_review",
  "boundary_review",
  "narrow_boundary_review",
] as const;
export type RefusalGate = (typeof REFUSAL_GATES)[number];

/** Gates owned by the BOUNDARY reviewer. Everything else is a scenario-quality gate. */
const BOUNDARY_GATES: readonly string[] = ["boundary_review", "narrow_boundary_review"];
/** Gates owned by the SEMANTIC reviewer. */
const SEMANTIC_GATES: readonly string[] = ["semantic_review", "branch_review", "phase_choice_review", "primary_choice_review", "urgency_review"];

/** Bounded, so one pathological reviewer response can never grow a telemetry row without limit. */
export const MAX_FINDING_CODES = 8;
/** A finding code is a stable identifier, never prose. */
const FINDING_CODE_RE = /^[a-z][a-z0-9_]{2,63}$/;

export const ATTRIBUTION_VERSION = 1;

export type AttributionInput = {
  /** The exact service reason. Never a message. */
  reason: string;
  /** `RejectionOutcome.primaryGate`, when the refusal came from a gate. */
  gate?: string | null;
  /** `RejectionOutcome.primaryCode`. */
  primaryFindingCode?: string | null;
  /** `RejectionOutcome.defectCodes`, in precedence order. */
  findingCodes?: readonly string[] | null;
};

export type Attribution = {
  attributionVersion: number;
  terminalStage: TerminalStage;
  terminalReasonCode: TerminalReasonCode;
  refusalGate: RefusalGate | null;
  primaryFindingCode: string | null;
  findingCodes: string[];
  findingCount: number;
};

/**
 * Legacy service reasons that mean exactly one domain event, mapped deliberately rather than by
 * prefix. Both authority aliases describe the same condition and are documented as one.
 */
const DIRECT: Record<string, { stage: TerminalStage; code: TerminalReasonCode }> = {
  generation_observability_unavailable: { stage: "observability_gate", code: "generation_observability_unavailable" },
  structured_output_unavailable: { stage: "generation_schema", code: "provider_schema_invalid" },
  scenario_persistence_failed: { stage: "persistence", code: "scenario_persistence_failed" },

  // BOUNDARY reviewer — none of these is a content rejection.
  boundary_review_inconclusive: { stage: "boundary_review", code: "boundary_review_inconclusive" },
  boundary_reviewer_terminal_failure: { stage: "boundary_review", code: "boundary_reviewer_terminal_failure" },
  boundary_review_authority_failure: { stage: "boundary_review", code: "boundary_review_authority_failure" },
  /** ALIAS of the line above — same domain event, two spellings in source. */
  review_boundary_authority_failed: { stage: "boundary_review", code: "boundary_review_authority_failure" },

  // SEMANTIC reviewer — the reason R5B's attempt 1 could have been, mis-filed under boundaries.
  reviewer_terminal_failure: { stage: "semantic_review", code: "semantic_reviewer_terminal_failure" },

  // Eligibility declines: measured `resolveAuthority` refusals, before any provider call.
  fixed_answer_knowledge: { stage: "generation_eligibility", code: "generation_not_eligible" },
  safety_boundary_unresolved: { stage: "generation_eligibility", code: "generation_not_eligible" },
  boundary_confirmation_required: { stage: "generation_eligibility", code: "generation_not_eligible" },
  practice_boundary_scope_required: { stage: "generation_eligibility", code: "generation_not_eligible" },
  too_many_active_boundaries: { stage: "generation_eligibility", code: "generation_not_eligible" },
  unknown_active_boundary: { stage: "generation_eligibility", code: "generation_not_eligible" },
  missing_required_active_boundary: { stage: "generation_eligibility", code: "generation_not_eligible" },
  active_boundary_set_changed: { stage: "generation_eligibility", code: "generation_not_eligible" },
  boundary_scope_not_confirmed: { stage: "generation_eligibility", code: "generation_not_eligible" },
  generation_unavailable: { stage: "generation_eligibility", code: "generation_not_eligible" },

  // A confirmed-constraint judgment with no legitimate difficult choice is a QUALITY verdict.
  no_safe_judgment_space: { stage: "scenario_quality", code: "scenario_quality_rejected" },
};

/** Provider transport faults keep the R5A taxonomy exactly. */
const PROVIDER_FAULT: Record<string, { stage: TerminalStage; code: TerminalReasonCode }> = {
  provider_timeout: { stage: "generation_provider", code: "provider_timeout" },
  provider_transport_error: { stage: "generation_provider", code: "provider_transport_error" },
  provider_http_error: { stage: "generation_provider", code: "provider_http_error" },
  provider_empty_output: { stage: "generation_provider", code: "provider_empty_output" },
  provider_malformed_output: { stage: "generation_parse", code: "provider_malformed_output" },
  provider_schema_invalid: { stage: "generation_schema", code: "provider_schema_invalid" },
};

/** Keep only codes that look like identifiers, in order, deduplicated, bounded. */
export function sanitizeFindingCodes(raw: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const c of raw) {
    if (typeof c !== "string") continue;
    const v = c.trim();
    // One explicit policy: anything that is not a stable identifier is DISCARDED, never truncated
    // into telemetry. Prose, excerpts and reviewer explanations all fail this test.
    if (!FINDING_CODE_RE.test(v)) continue;
    if (out.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_FINDING_CODES) break;
  }
  return out;
}

/**
 * Resolve the exact stage and reason. Total: an unrecognised reason becomes a VISIBLE
 * `internal_unclassified_failure`, never the nearest plausible known bucket.
 */
export function resolveAttribution(input: AttributionInput): Attribution {
  const findingCodes = sanitizeFindingCodes(input.findingCodes);
  const primaryRaw = typeof input.primaryFindingCode === "string" ? input.primaryFindingCode.trim() : "";
  // Evaluator ranking is preserved: the primary is the evaluator's own headline code when it is a
  // valid identifier, otherwise the first surviving ranked code.
  const primaryFindingCode = FINDING_CODE_RE.test(primaryRaw) ? primaryRaw : (findingCodes[0] ?? null);
  const gate = typeof input.gate === "string" && (REFUSAL_GATES as readonly string[]).includes(input.gate) ? (input.gate as RefusalGate) : null;

  const base = { attributionVersion: ATTRIBUTION_VERSION, refusalGate: gate, primaryFindingCode, findingCodes, findingCount: findingCodes.length };

  const direct = DIRECT[input.reason] ?? PROVIDER_FAULT[input.reason];
  if (direct) return { ...base, terminalStage: direct.stage, terminalReasonCode: direct.code };

  if (input.reason === "generation_rejected") {
    // THE measured crux. `generation_rejected` is returned both by the quality gates AND by a
    // boundary CONTENT rejection that exhausted its retry. Only the gate can tell them apart.
    if (gate && BOUNDARY_GATES.includes(gate)) {
      return { ...base, terminalStage: "boundary_review", terminalReasonCode: "boundary_content_rejected" };
    }
    if (gate && SEMANTIC_GATES.includes(gate)) {
      return { ...base, terminalStage: "semantic_review", terminalReasonCode: "semantic_content_rejected" };
    }
    // `provider_dto` / `canonical_validator` / no gate reported → the scenario-quality contract.
    return { ...base, terminalStage: "scenario_quality", terminalReasonCode: "scenario_quality_rejected" };
  }

  return { ...base, terminalStage: "internal", terminalReasonCode: "internal_unclassified_failure" };
}
