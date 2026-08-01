/**
 * STABILITY TERMINAL LABELS (Slice 3.2I-R5B1A.1-R2.24).
 *
 * The verdict itself is a pure domain rule (`domain/foundry/arena-draft/stabilityVerdict`); domain
 * code holds no display strings. This module owns the words, and it is the ONLY producer of the
 * pass string in the codebase.
 *
 * That single-producer property is the fix. R2.23D-R4 had two independent producers — the collator's
 * markdown header and the runner's terminal `printf` — each gated on a question that was not about
 * generation quality (artifact completeness, and the orchestrator's exit status respectively). A run
 * that generated 1 valid scenario out of 6 satisfied both and printed GATES PASS.
 */

import type { StabilityMetrics, StabilityVerdict } from "@/domain/foundry/arena-draft/stabilityVerdict";

export const STABILITY_PASS_LABEL = "STRUCTURAL + SEMANTIC GATES PASS";
export const STABILITY_FAIL_LABEL = "STABILITY HARD GATES FAILED";

/**
 * Render the terminal label for a completed run.
 *
 * Reachable only through `verdict.stabilityHardGatesPass`, which is computed from the hard gates
 * alone and never from execution completeness.
 */
export function stabilityTerminalLabel(v: StabilityVerdict, m: StabilityMetrics): string[] {
  if (v.stabilityHardGatesPass) {
    return [STABILITY_PASS_LABEL, "HUMAN PRODUCT REVIEW REQUIRED"];
  }
  return [
    `LIVE EXECUTION COMPLETE · ${m.executedCases}/${m.expectedCases} EVIDENCE WRITTEN`,
    STABILITY_FAIL_LABEL,
    "HUMAN CONTENT REVIEW LIMITED TO GENERATED OUTPUTS",
  ];
}
