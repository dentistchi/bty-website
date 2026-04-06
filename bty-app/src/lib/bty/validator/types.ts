/**
 * VALIDATOR_ARCHITECTURE_V1 — shared types (no PII in Layer 2 payload).
 */

export type ValidatorOutcome = "revise" | "approve" | "reject" | "escalate";

export type Layer1RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

export type Layer1Error = {
  rule: Layer1RuleId;
  signal: string;
};

export type CriterionOutcome = "pass" | "fail" | "ambiguous";

export type Layer2CriterionResult = {
  outcome: CriterionOutcome;
  confidence: number;
};

export type Layer2ModelResult = {
  re_entry_direction: Layer2CriterionResult;
  external_measurability: Layer2CriterionResult;
  non_cosmetic: Layer2CriterionResult;
};

export type PatternContextForModel = {
  pattern_family: string;
  avoided_reality: string;
  re_entry_direction: string;
};
