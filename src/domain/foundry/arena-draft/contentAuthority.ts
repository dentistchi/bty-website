/**
 * REVIEWER CONTENT AUTHORITY (Slice 3.2I-R5B1A.1-R2.34).
 *
 * WHAT CHANGED, AND WHY IT HAD TO.
 *
 * The content-veto inventory measured the old architecture exactly: **DEFAULT TERMINAL + a
 * two-entry BLOCKLIST**. Any non-empty defect set rejected, an unclassified code still rejected at
 * level 8, six schema enums let the model write 36 content defect codes directly, and four ingest
 * sites accepted them unfiltered. A reviewer opinion therefore became a product veto by default.
 *
 * The `generic_communication_collapse` audit showed what that costs. Its vocabulary rule fired on
 * branches whose decision variables were genuinely different (WHAT to communicate vs WHEN to
 * communicate) and stayed silent on branches that repeated one variable in different words. A
 * deterministic computation over the wrong proxy is still the wrong answer.
 *
 * So authority is inverted, and the unit of authority is NOT the defect string.
 *
 *   AUTHORITY = DEFECT CODE + PROVENANCE PATH
 *
 * The same string `cross_branch_axis_collapse` is TERMINAL when code proved exact identity of two
 * reviewer-authored dimensions, and TELEMETRY when the model simply wrote that string into its
 * `defectCodes` array. A string-only allowlist cannot express that difference, which is precisely
 * how the blocklist approach kept leaking.
 *
 * DOWNGRADED IS NOT DELETED. A finding that loses authority is still retained, with its provenance,
 * so a later run can answer the question this whole arc exists to ask: *what did the reviewer
 * report that the product deliberately refused to trust?*
 *
 * Pure domain: no I/O, no provider, no DB.
 */

/**
 * Where a content finding came from. Attached AT CREATION, never reconstructed from the code string
 * afterwards — reconstruction is what makes a provenance model decorative.
 */
export const CONTENT_PROVENANCE = {
  /** Code proved the defect itself: exact normalized identity over reviewer-authored text. */
  provenExactIdentity: "PROVEN_EXACT_IDENTITY",
  /** A boundary model boolean, deterministically transformed. Authorized by policy, not by proof. */
  provisionalBoundaryBoolean: "PROVISIONAL_BOUNDARY_BOOLEAN",
  /** The model judged something true/false and code turned that judgment into a defect. */
  modelBoolean: "MODEL_BOOLEAN",
  /** The model wrote the defect code itself into a schema-allowed array. */
  modelDefectCode: "MODEL_DEFECT_CODE",
  /** Deterministic, but computed over a proxy that does not establish the defect concept. */
  invalidProxy: "INVALID_PROXY",
} as const;
export type ContentProvenance = (typeof CONTENT_PROVENANCE)[keyof typeof CONTENT_PROVENANCE];

export type ContentAuthority = "terminal" | "telemetry";

export type ContentFinding = {
  code: string;
  provenance: ContentProvenance;
  /** Optional human-readable note about what established (or failed to establish) the finding. */
  evidence?: string;
};

/**
 * PROVEN AUTHORITY — the only two paths where code proves the defect concept rather than relaying an
 * opinion about it. Both compare declared-equal strings; neither guesses at meaning.
 *
 * Keyed by code, valued by the ONE provenance that earns authority for it. A different provenance
 * carrying the same code is telemetry, which is the entire point.
 */
export const PROVEN_CONTENT_AUTHORITY: Readonly<Record<string, ContentProvenance>> = {
  cross_branch_axis_collapse: CONTENT_PROVENANCE.provenExactIdentity,
  no_new_decision_dimension: CONTENT_PROVENANCE.provenExactIdentity,
};

/**
 * PROVISIONAL BOUNDARY AUTHORITY — a NAMED EXCEPTION, not a proof.
 *
 * source:          MODEL BOOLEAN. The reviewer decides whether a rule is present, operationalized
 *                  or complied with; code only transforms that judgment.
 * authority basis: COMMANDER RISK ASYMMETRY EXCEPTION — a false boundary PASS is currently judged
 *                  more costly than a false rejection.
 * proof status:    NOT DETERMINISTICALLY PROVEN. Nothing here establishes the boundary fact from
 *                  the scenario itself.
 * sunset:          remove once a validated deterministic boundary gate derives violation from
 *                  DECLARED FACTS + RENDERED LEARNER CONTENT. No implementation shape is
 *                  pre-committed — whether literal containment proves compliance needs its own
 *                  evidence.
 *
 * Re-enumerated from `validateSemanticReview` rather than from remembered names. Direct
 * `boundaryAssessments[].defectCodes` are deliberately ABSENT: a model-written boundary code earns
 * nothing from sharing a family with these.
 */
export const PROVISIONAL_BOUNDARY_AUTHORITY: readonly string[] = [
  "confirmed_boundary_absent",
  "boundary_not_operationalized",
  "vacuous_boundary_compliance",
  "choice_bypasses_boundary",
  "action_reopens_boundary",
  "branch_drops_boundary",
  "boundary_treated_as_optional",
  "boundary_violation",
];

/**
 * The whole authority decision, in one place.
 *
 * Everything not named above is telemetry — including codes nobody classified. An unclassified
 * CONTENT finding gaining silent authority is the failure mode this module exists to remove.
 */
export function classifyContentAuthority(finding: ContentFinding): ContentAuthority {
  const proven = PROVEN_CONTENT_AUTHORITY[finding.code];
  if (proven !== undefined && finding.provenance === proven) return "terminal";
  if (
    finding.provenance === CONTENT_PROVENANCE.provisionalBoundaryBoolean &&
    PROVISIONAL_BOUNDARY_AUTHORITY.includes(finding.code)
  ) {
    return "terminal";
  }
  return "telemetry";
}

export type ContentSplit = { terminalFindings: ContentFinding[]; telemetryFindings: ContentFinding[] };

/** Split once, keep both halves. The telemetry half is evidence, not waste. */
export function splitContentFindings(findings: ContentFinding[]): ContentSplit {
  const terminalFindings: ContentFinding[] = [];
  const telemetryFindings: ContentFinding[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    const key = `${f.code}|${f.provenance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (classifyContentAuthority(f) === "terminal" ? terminalFindings : telemetryFindings).push(f);
  }
  return { terminalFindings, telemetryFindings };
}
