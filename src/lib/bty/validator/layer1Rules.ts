/**
 * VALIDATOR_ARCHITECTURE_V1 §2 — Layer 1 R1–R6; all rules in one pass, every failure collected.
 * Field semantics align with actionContractFieldValidation (Arena + chain workspace).
 */
import {
  validateContractHow,
  validateContractWhat,
  validateContractWhenDetailed,
  validateContractWho,
} from "@/lib/bty/action-contract/actionContractFieldValidation";
import type { Layer1Error, Layer1RuleId } from "./types";

function push(out: Layer1Error[], rule: Layer1RuleId, signal: string) {
  out.push({ rule, signal });
}

/**
 * Evaluate R1–R6 in parallel (single synchronous pass over fields); returns all failures.
 */
export function runAllLayer1Rules(input: {
  who: string;
  what: string;
  how: string;
  when: string;
  rawText: string;
}): Layer1Error[] {
  const who = input.who.trim();
  const what = input.what.trim();
  const how = input.how.trim();
  const when = input.when.trim();
  const rawText = input.rawText.trim();

  const errors: Layer1Error[] = [];

  if (!who || !what || !how || !when || !rawText) {
    push(errors, "R6", "Each field is required");
  }

  if (who.length > 0) {
    const msg = validateContractWho(who);
    if (msg) push(errors, "R1", msg);
  }

  if (what.length > 0) {
    const msg = validateContractWhat(what);
    if (msg) push(errors, "R2", msg);
  }

  if (when.length > 0) {
    const w = validateContractWhenDetailed(when);
    if (w) push(errors, w.rule, w.message);
  }

  if (how.length > 0) {
    const msg = validateContractHow(how);
    if (msg) push(errors, "R4", msg);
  }

  const ruleOrder: Record<Layer1RuleId, number> = {
    R1: 1,
    R2: 2,
    R3: 3,
    R4: 4,
    R5: 5,
    R6: 6,
  };
  errors.sort((a, b) => ruleOrder[a.rule] - ruleOrder[b.rule]);

  return errors;
}
