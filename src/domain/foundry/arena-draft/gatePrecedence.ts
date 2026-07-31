/**
 * GATE PRECEDENCE AUTHORITY (Slice 3.2I-R5B1A.1-R2.23).
 *
 * THE MEASURED PROBLEM
 *
 * Gate order was an implementation accident. Every deterministic stage returned on its own first
 * error, so whichever validator happened to run first owned the reported reason:
 *
 *   - c01's `Assure the client that everything is on schedule` was reported as
 *     `construction_contradicts_label` (Level 4) because the construction gate runs before the
 *     measured-label gate that names it `false_reassurance` (Level 5). Both are true; only one
 *     survived, and the retry saw only one.
 *   - c09's byte-identical repeated branch choice was reported as `provider_low_quality` because an
 *     older gate runs before `repeated_choice_meaning_within_branch`.
 *
 * Neither was wrong, but two consequences are: a SAFETY or BOUNDARY finding could be hidden behind
 * a lower-level quality code purely by execution order, and the retry received one code when the
 * attempt contained several correctable defects.
 *
 * THE CONTRACT
 *
 * Findings are collected from every applicable gate, then a PRIMARY code is chosen by documented
 * precedence — never by whichever gate ran first, and never by object iteration order. The complete
 * ordered defect list travels to the retry and into the evaluation artifact.
 *
 * Redundant gates are kept. Two gates detecting related defects is defence in depth; the fix is to
 * stop letting the accident of ordering decide which one is heard.
 *
 * Pure domain: no I/O, no provider, no DB.
 */

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export const GATE_LEVELS = {
  1: "provider_capability_transport",
  2: "dto_structural_integrity",
  3: "confirmed_boundary_hard_safety",
  4: "choice_construction_integrity",
  5: "all_phase_content_quality",
  6: "branch_progression_causal_diversity",
  7: "reviewer_contract_integrity",
  /** Anything the registry does not know. Never silently treated as harmless. */
  8: "unclassified",
} as const;
export type GateLevel = keyof typeof GATE_LEVELS;

export type CodeClass = {
  code: string;
  level: GateLevel;
  /** Terminal codes never enter a generation retry — retrying cannot change them. */
  terminal: boolean;
  /** Rank within the level. Declaration order, so nothing depends on iteration order. */
  rank: number;
};

/**
 * The precedence registry, in authority order.
 *
 * Level 1 and unrecoverable Level 2 terminate immediately — there is no content to judge. Levels
 * 3-7 are collected together and ranked. Within a level the order below is the tie-break, so the
 * primary code for a given finding set is a pure function of the set, not of how it was built.
 */
const REGISTRY_ORDER: Array<{ code: string; level: GateLevel; terminal?: boolean }> = [
  // --- LEVEL 1 — provider capability / transport -----------------------------
  { code: "generation_unavailable", level: 1, terminal: true },
  { code: "structured_output_unavailable", level: 1, terminal: true },
  { code: "provider_refusal", level: 1, terminal: true },
  { code: "provider_error", level: 1, terminal: true },
  { code: "provider_timeout", level: 1, terminal: true },
  { code: "empty_output", level: 1, terminal: true },
  { code: "truncated_output", level: 1 },
  { code: "malformed_shape", level: 1 },

  // --- LEVEL 2 — DTO / structural integrity ----------------------------------
  { code: "dto_not_an_object", level: 2 },
  { code: "dto_branch_count_mismatch", level: 2 },
  { code: "dto_branches_not_array", level: 2 },
  { code: "dto_title_missing", level: 2 },
  { code: "dto_opening_missing", level: 2 },
  { code: "dto_flat_escalation_missing", level: 2 },
  { code: "dto_grounding_not_array", level: 2 },
  { code: "dto_grounding_malformed", level: 2 },
  { code: "action_choice_missing_commitment_flag", level: 2 },
  { code: "no_action_commitment", level: 2 },
  { code: "branch_no_action_commitment", level: 2 },
  { code: "duplicate_choice_id", level: 2 },
  { code: "branch_orphan_key", level: 2 },
  { code: "missing_title", level: 2 },
  { code: "missing_opening", level: 2 },
  { code: "primary_missing", level: 2 },
  { code: "tradeoff_missing", level: 2 },
  { code: "action_missing", level: 2 },
  { code: "invalid_structure", level: 2 },

  // --- LEVEL 3 — confirmed boundary / hard safety ----------------------------
  // Deliberately ABOVE construction and quality: a boundary or safety finding may never be hidden
  // behind a lower-level code because a construction validator happened to run first.
  { code: "unresolved_boundary_requires_confirmation", level: 3, terminal: true },
  { code: "all_options_violate_confirmed_boundary", level: 3, terminal: true },
  { code: "prohibited_choice_only", level: 3, terminal: true },
  { code: "confirmed_boundary_absent", level: 3 },
  { code: "choice_bypasses_boundary", level: 3 },
  { code: "branch_drops_boundary", level: 3 },
  { code: "action_reopens_boundary", level: 3 },
  { code: "boundary_treated_as_optional", level: 3 },
  { code: "boundary_not_operationalized", level: 3 },
  { code: "vacuous_boundary_compliance", level: 3 },
  { code: "boundary_violation", level: 3 },
  { code: "constraint_violation", level: 3 },
  { code: "unsafe_delay", level: 3 },
  { code: "avoidable_foreseeable_harm", level: 3 },
  { code: "convenience_over_safety", level: 3 },
  { code: "missing_required_escalation", level: 3 },
  { code: "unsafe_option", level: 3 },
  { code: "unknown_boundary_reference", level: 3 },
  { code: "missing_boundary_reference", level: 3 },
  { code: "grounding_missing", level: 3 },
  { code: "grounding_malformed", level: 3 },
  { code: "grounding_duplicate_boundary", level: 3 },
  { code: "grounding_statement_altered", level: 3 },
  { code: "grounding_missing_remaining_judgment", level: 3 },
  { code: "assessment_missing", level: 3 },
  { code: "assessment_missing_for_choice", level: 3 },
  { code: "assessment_malformed", level: 3 },
  { code: "assessment_not_satisfied", level: 3 },
  { code: "assessment_unknown_constraint", level: 3 },
  { code: "assessment_constraint_uncovered", level: 3 },
  { code: "assessment_rationale_empty", level: 3 },

  // --- LEVEL 4 — choice-construction integrity -------------------------------
  { code: "construction_missing", level: 4 },
  { code: "competent_intent_bad_faith", level: 4 },
  { code: "construction_contradicts_label", level: 4 },
  { code: "no_legitimate_value", level: 4 },
  { code: "no_real_cost", level: 4 },
  { code: "unsupported_boundary_compliance", level: 4 },
  { code: "unsupported_delay_basis", level: 4 },
  { code: "duplicate_value_cost_profile", level: 4 },
  { code: "dominated_choice", level: 4 },
  { code: "construction_metadata_generic", level: 4 },

  // --- LEVEL 5 — all-phase content quality -----------------------------------
  { code: "bad_faith_option", level: 5 },
  { code: "moral_decoy", level: 5 },
  { code: "false_reassurance", level: 5 },
  { code: "vague_reassurance", level: 5 },
  { code: "deflection_without_value", level: 5 },
  { code: "non_commitment_decoy", level: 5 },
  { code: "passive_delay", level: 5 },
  { code: "repeated_decoy_across_branches", level: 5 },
  { code: "obvious_correct_answer", level: 5 },
  { code: "vague_evasion", level: 5 },
  { code: "duplicate_tradeoff", level: 5 },
  { code: "no_value_tension", level: 5 },
  { code: "moral_label_language", level: 5 },
  { code: "choice_no_concrete_action", level: 5 },
  { code: "placeholder_leak", level: 5 },

  // --- LEVEL 6 — branch progression / causal diversity -----------------------
  { code: "branch_repeats_primary", level: 6 },
  { code: "tradeoff_repeats_primary", level: 6 },
  { code: "action_repeats_tradeoff", level: 6 },
  { code: "action_reopens_primary", level: 6 },
  { code: "branch_decision_loop", level: 6 },
  { code: "no_new_decision_dimension", level: 6 },
  { code: "repeated_choice_meaning_within_branch", level: 6 },
  { code: "branch_semantic_collapse", level: 6 },
  { code: "cross_branch_axis_collapse", level: 6 },
  { code: "interchangeable_branch_consequence", level: 6 },
  { code: "generic_communication_collapse", level: 6 },
  { code: "sibling_world_state_overlap", level: 6 },
  { code: "repeated_action_meaning", level: 6 },
  { code: "primary_choice_has_no_causal_effect", level: 6 },
  { code: "branch_paraphrase", level: 6 },
  { code: "branch_incoherent_escalation", level: 6 },
  { code: "branch_incoherent_reference", level: 6 },
  { code: "generic_branch_reaction", level: 6 },
  { code: "generic_escalation", level: 6 },
  { code: "boilerplate_repetition", level: 6 },

  // --- LEVEL 7 — reviewer contract integrity ---------------------------------
  { code: "review_truncated", level: 7 },
  { code: "review_not_json", level: 7 },
  { code: "review_contradictory", level: 7 },
  { code: "review_verdict_contradicts_details", level: 7 },
  { code: "review_reject_without_defect", level: 7 },
  { code: "review_intent_contradicts_label", level: 7 },
  { code: "review_construction_dispute_empty", level: 7 },
  { code: "review_phase_choice_uncovered", level: 7 },
  { code: "review_phase_choice_duplicated", level: 7 },
  { code: "review_phase_choice_unknown", level: 7 },
  { code: "review_phase_choices_missing", level: 7 },
  { code: "review_phase_invalid", level: 7 },
  { code: "review_cross_branch_missing", level: 7 },
  { code: "review_no_safe_unsupported", level: 7 },
  { code: "review_no_safe_unsupported_by_boundary", level: 7 },
  { code: "review_urgency_fabricated", level: 7 },
  { code: "review_urgency_contradictory", level: 7 },
  { code: "review_urgency_unsupported", level: 7 },
];

const REGISTRY: Map<string, CodeClass> = new Map(
  REGISTRY_ORDER.map((e, i) => [e.code, { code: e.code, level: e.level, terminal: e.terminal === true, rank: i }]),
);

/** Prefix fallbacks for the wide structural/reviewer families, so nothing lands unclassified. */
const PREFIX_RULES: Array<{ prefix: string; level: GateLevel }> = [
  { prefix: "dto_", level: 2 },
  { prefix: "assessment_", level: 3 },
  { prefix: "grounding_", level: 3 },
  { prefix: "constraint_", level: 3 },
  { prefix: "boundary_", level: 3 },
  { prefix: "construction_", level: 4 },
  { prefix: "branch_", level: 6 },
  { prefix: "review_", level: 7 },
];

/**
 * Classify one rejection code. An unknown code is reported at level 8 rather than assumed harmless —
 * a code nobody classified must be visible, not silently outranked.
 */
export function classifyCode(code: string): CodeClass {
  const known = REGISTRY.get(code);
  if (known) return known;
  const prefixed = PREFIX_RULES.find((r) => code.startsWith(r.prefix));
  // Unregistered codes rank after every registered one, deterministically by name.
  return { code, level: prefixed ? prefixed.level : 8, terminal: false, rank: REGISTRY_ORDER.length + hashRank(code) };
}

/** Stable, name-derived tie-break for unregistered codes. Not a hash of anything sensitive. */
function hashRank(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100_000;
  return h;
}

export const isRegisteredCode = (code: string): boolean => REGISTRY.has(code);
export const registeredCodes = (): string[] => REGISTRY_ORDER.map((e) => e.code);

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

/** One defect, with the coordinates the retry and the artifact both need. */
export type Finding = {
  code: string;
  /** Which gate detected it — kept even when another gate found the same code. */
  gate: string;
  phase?: string;
  branchIndex?: number;
  choiceIndex?: number;
  boundaryId?: string;
  detail?: string;
};

export type ResolvedFinding = Finding & { level: GateLevel; terminal: boolean };

export type RejectionOutcome = {
  /** The single stable code reported to callers and recorded as the headline reason. */
  primaryCode: string;
  primaryLevel: GateLevel;
  primaryGate: string;
  terminal: boolean;
  /** Every distinct code, ordered by precedence. */
  defectCodes: string[];
  /** Every finding, deduplicated by (code, coordinate), ordered by precedence. */
  findings: ResolvedFinding[];
  /** Codes seen more than once, with every gate that reported them — evidence is never dropped. */
  evidenceSources: Record<string, string[]>;
};

const coordinateKey = (f: Finding) => `${f.code}|${f.phase ?? ""}|${f.branchIndex ?? ""}|${f.choiceIndex ?? ""}|${f.boundaryId ?? ""}`;

/**
 * Resolve a set of findings into one deterministic rejection outcome.
 *
 * Ordering is (level, rank, coordinate) — all three derived from the finding itself, so shuffling
 * the input array cannot change `primaryCode`. Duplicate findings from different gates collapse to
 * one entry while every reporting gate is retained in `evidenceSources`.
 */
export function resolveRejection(findings: Finding[]): RejectionOutcome | null {
  if (findings.length === 0) return null;

  const bySource: Record<string, string[]> = {};
  const deduped = new Map<string, ResolvedFinding>();
  for (const f of findings) {
    const cls = classifyCode(f.code);
    (bySource[f.code] ??= []).push(f.gate);
    const key = coordinateKey(f);
    if (!deduped.has(key)) deduped.set(key, { ...f, level: cls.level, terminal: cls.terminal });
  }

  const ordered = [...deduped.values()].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    const ra = classifyCode(a.code).rank;
    const rb = classifyCode(b.code).rank;
    if (ra !== rb) return ra - rb;
    return coordinateKey(a) < coordinateKey(b) ? -1 : coordinateKey(a) > coordinateKey(b) ? 1 : 0;
  });

  const head = ordered[0];
  const codes: string[] = [];
  for (const f of ordered) if (!codes.includes(f.code)) codes.push(f.code);

  return {
    primaryCode: head.code,
    primaryLevel: head.level,
    primaryGate: head.gate,
    terminal: head.terminal,
    defectCodes: codes,
    findings: ordered,
    evidenceSources: Object.fromEntries(
      Object.entries(bySource)
        .filter(([, gates]) => new Set(gates).size > 1)
        .map(([code, gates]) => [code, [...new Set(gates)].sort()]),
    ),
  };
}

/** Findings a second generation attempt could realistically correct. */
export function retryableFindings(outcome: RejectionOutcome): ResolvedFinding[] {
  return outcome.findings.filter((f) => !classifyCode(f.code).terminal);
}

/** True when nothing in the outcome can be corrected by regenerating. */
export function isTerminalOutcome(outcome: RejectionOutcome): boolean {
  return outcome.terminal || retryableFindings(outcome).length === 0;
}
