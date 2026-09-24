/**
 * Durable, non-content explanation for a terminal narrow-boundary reviewer failure.
 *
 * This is deliberately separate from terminal reason attribution: the reason continues to
 * express the governance class, while this vocabulary identifies the exact execution seam
 * that knew why the reviewer could not be used.
 */
export const BOUNDARY_REVIEW_DIAGNOSTIC_CONTRACT_VERSION = 1;

export const BOUNDARY_REVIEW_DIAGNOSTIC_CODES = [
  "boundary_review_parse_failed",
  "boundary_review_validation_failed",
  "boundary_repair_dependency_unavailable",
  "boundary_repair_parse_failed",
  "boundary_repair_validation_failed",
  "boundary_repair_normalization_failed",
  "boundary_review_budget_exhausted",
] as const;

export type BoundaryReviewDiagnosticCode = (typeof BOUNDARY_REVIEW_DIAGNOSTIC_CODES)[number];

export const BOUNDARY_REVIEW_DIAGNOSTIC_STAGES = ["boundary_review", "boundary_repair"] as const;
export type BoundaryReviewDiagnosticStage = (typeof BOUNDARY_REVIEW_DIAGNOSTIC_STAGES)[number];

export type BoundaryReviewTerminalDiagnostic = {
  code: BoundaryReviewDiagnosticCode;
  stage: BoundaryReviewDiagnosticStage;
  contractVersion: typeof BOUNDARY_REVIEW_DIAGNOSTIC_CONTRACT_VERSION;
};

export function boundaryReviewDiagnostic(
  code: BoundaryReviewDiagnosticCode,
  stage: BoundaryReviewDiagnosticStage,
): BoundaryReviewTerminalDiagnostic {
  return { code, stage, contractVersion: BOUNDARY_REVIEW_DIAGNOSTIC_CONTRACT_VERSION };
}
