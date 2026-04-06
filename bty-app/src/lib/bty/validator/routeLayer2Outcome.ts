/**
 * VALIDATOR_ARCHITECTURE_V1 §3.4 — confidence threshold 0.7, mixed-signal → escalate.
 */
import type { Layer2ModelResult, ValidatorOutcome } from "./types";

const CONFIDENCE_THRESHOLD = 0.7;

function criterionNeedsEscalation(c: { outcome: string; confidence: number }): boolean {
  if (c.outcome === "ambiguous") return true;
  if (!Number.isFinite(c.confidence) || c.confidence < CONFIDENCE_THRESHOLD) return true;
  return false;
}

/**
 * After Layer 2 JSON is parsed and normalized: aggregate routing only (no client rationale).
 */
export function routeLayer2Outcome(parsed: Layer2ModelResult): ValidatorOutcome {
  const keys: (keyof Layer2ModelResult)[] = [
    "re_entry_direction",
    "external_measurability",
    "non_cosmetic",
  ];
  for (const k of keys) {
    if (criterionNeedsEscalation(parsed[k])) return "escalate";
  }
  for (const k of keys) {
    if (parsed[k].outcome === "fail") return "reject";
  }
  return "approve";
}

export const VALIDATOR_CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLD;
