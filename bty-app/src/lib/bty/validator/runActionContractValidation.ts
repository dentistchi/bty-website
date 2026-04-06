/**
 * VALIDATOR_ARCHITECTURE_V1 §2–§4 — orchestration: Layer 1 then Layer 2; no parallel layers.
 */
import { runAllLayer1Rules } from "./layer1Rules";
import { runLayer2Semantic } from "./layer2Semantic";
import { getPatternContextForModel } from "./patternFamilyRegistry";
import { routeLayer2Outcome } from "./routeLayer2Outcome";
import type { Layer1Error, Layer2ModelResult, ValidatorOutcome } from "./types";

export type ValidationEvaluationResult = {
  outcome: ValidatorOutcome;
  layer1Errors: Layer1Error[];
  layer2Criteria: Layer2ModelResult | null;
  modelId: string | null;
  /** Set when Layer 2 could not run; outcome escalates to defer to human review. */
  layer2TechnicalError: string | null;
};

export async function evaluateActionContractPayload(input: {
  who: string;
  what: string;
  how: string;
  when: string;
  rawText: string;
  patternFamily: string | null;
}): Promise<ValidationEvaluationResult> {
  const layer1Errors = runAllLayer1Rules({
    who: input.who,
    what: input.what,
    how: input.how,
    when: input.when,
    rawText: input.rawText,
  });

  if (layer1Errors.length > 0) {
    return {
      outcome: "revise",
      layer1Errors,
      layer2Criteria: null,
      modelId: null,
      layer2TechnicalError: null,
    };
  }

  const pattern = getPatternContextForModel(input.patternFamily);
  const l2 = await runLayer2Semantic({
    pattern,
    who: input.who,
    what: input.what,
    how: input.how,
    when: input.when,
    rawText: input.rawText,
  });

  if (!l2.ok) {
    return {
      outcome: "escalate",
      layer1Errors: [],
      layer2Criteria: null,
      modelId: null,
      layer2TechnicalError: l2.error,
    };
  }

  const outcome = routeLayer2Outcome(l2.result);
  return {
    outcome,
    layer1Errors: [],
    layer2Criteria: l2.result,
    modelId: l2.modelId,
    layer2TechnicalError: null,
  };
}
