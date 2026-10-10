/**
 * Terminal DIAGNOSTIC CODES — what the attempt row's `finding_codes` keeps when generation ends.
 *
 * WHY THIS EXISTS
 *
 * Three production failures of "Opening the Office Safely" (af921b9d) were recorded with
 * `finding_codes = []`. The validators had named the defect each time — the codes simply never left
 * the function that produced them, so each failure needed a blind offline investigation:
 *   - the boundary stage's terminal exit carried only one catch-all diagnostic
 *     (`boundary_review_validation_failed` / `boundary_repair_validation_failed`);
 *   - the generation loop's final retry returned `generation_rejected` and dropped `llm.rejection`.
 *
 * WHAT IS KEPT
 *
 * Only SERVER-DEFINED identifiers — validator codes, repair codes, the reason a repair plan was not
 * available. Never prompts, scenario text, reviewer prose or any other generated content: anything
 * that is not a stable identifier is dropped by the same rule `sanitizeFindingCodes` applies.
 *
 * Each code carries its STAGE as a prefix, because the column is a flat `text[]`:
 *   r1_  first boundary review       fp_  why no field-repair plan was used
 *   fr_  field repair (patch)        r2_  second (full) boundary review
 *   g_   generation's deterministic gates on its final attempt
 *
 * The column holds at most 8 codes, so the stages are INTERLEAVED (first code of each stage, then the
 * second of each, …) — one noisy stage can never crowd another out.
 *
 * These codes are diagnostics only. They never decide an outcome, a refusal count or a system block.
 *
 * Pure: no I/O.
 */

/** The attempt row's own limits (CHECK `foundry_practice_gen_attempt_finding_codes_chk`). */
export const DIAGNOSTIC_CODE_RE = /^[a-z][a-z0-9_]{2,63}$/;
export const MAX_DIAGNOSTIC_CODES = 8;

export const DIAGNOSTIC_STAGE_PREFIXES = {
  firstReview: "r1_",
  repairPlan: "fp_",
  repair: "fr_",
  finalReview: "r2_",
  generation: "g_",
} as const;

/** Codes for one stage: prefixed, identifier-checked, de-duplicated, order kept. */
function staged(prefix: string, codes: readonly (string | null | undefined)[] | null | undefined): string[] {
  const out: string[] = [];
  for (const c of codes ?? []) {
    if (typeof c !== "string") continue;
    const v = `${prefix}${c.trim()}`;
    if (!DIAGNOSTIC_CODE_RE.test(v) || out.includes(v)) continue;
    out.push(v);
  }
  return out;
}

/** Interleave stage lists and bound the result to the column's limit. */
export function interleaveDiagnosticCodes(stages: readonly string[][]): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < MAX_DIAGNOSTIC_CODES; i++) {
    let any = false;
    for (const s of stages) {
      if (i >= s.length) continue;
      any = true;
      if (!out.includes(s[i]!)) out.push(s[i]!);
      if (out.length >= MAX_DIAGNOSTIC_CODES) break;
    }
    if (!any) break;
  }
  return out;
}

/** One boundary call as the stage recorded it: which attempt, whether it was a patch, its codes. */
export type BoundaryCallCodes = { attempt: number; kind: "review" | "repair"; codes: readonly string[] };

export type BoundaryDiagnosticInput = {
  calls: readonly BoundaryCallCodes[];
  /** Why a field-repair plan was not used (`field_repair_ambiguous_rule_target`, …). */
  repairPlanUnavailable?: string | null;
  /** The patch's own refusal codes (`field_repair_operation_missing`, …). */
  repairCodes?: readonly string[] | null;
};

/** The boundary stage's diagnostic codes, stage-prefixed and interleaved. */
export function boundaryDiagnosticCodes(input: BoundaryDiagnosticInput): string[] {
  const first = input.calls.find((c) => c.attempt === 1 && c.kind === "review");
  const repair = input.calls.filter((c) => c.kind === "repair");
  const final = input.calls.filter((c) => c.kind === "review" && c.attempt > 1).at(-1);
  return interleaveDiagnosticCodes([
    staged(DIAGNOSTIC_STAGE_PREFIXES.firstReview, first?.codes),
    staged(DIAGNOSTIC_STAGE_PREFIXES.repairPlan, input.repairPlanUnavailable ? [input.repairPlanUnavailable] : []),
    staged(DIAGNOSTIC_STAGE_PREFIXES.repair, [...(input.repairCodes ?? []), ...repair.flatMap((c) => c.codes)]),
    staged(DIAGNOSTIC_STAGE_PREFIXES.finalReview, final?.codes),
  ]);
}

/** Generation's deterministic-gate codes on its final attempt. */
export function generationDiagnosticCodes(codes: readonly string[] | null | undefined): string[] {
  return interleaveDiagnosticCodes([staged(DIAGNOSTIC_STAGE_PREFIXES.generation, codes)]);
}
