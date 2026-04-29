/**
 * Chain workspace CLI: strict menu index + re-exports action-contract validation.
 */

import type { ActionContractAnswers } from "./chainPatternEngine";
import {
  validateContractHow,
  validateContractWhat,
  validateContractWhen,
  validateContractWho,
} from "@/lib/bty/action-contract/actionContractFieldValidation";

export {
  validateContractHow,
  validateContractWhat,
  validateContractWhen,
  validateContractWho,
} from "@/lib/bty/action-contract/actionContractFieldValidation";

export type ContractFieldKey = keyof ActionContractAnswers;

export function validateChainWorkspaceContract(
  answers: ActionContractAnswers,
): { ok: true } | { ok: false; field: ContractFieldKey; message: string } {
  if (!answers.who.trim()) {
    return { ok: false, field: "who", message: "Name one specific person." };
  }
  if (!answers.what.trim()) {
    return { ok: false, field: "what", message: "Describe one conversation you have been avoiding." };
  }
  if (!answers.when.trim()) {
    return { ok: false, field: "when", message: "Choose when you will start." };
  }
  if (!answers.how.trim()) {
    return { ok: false, field: "how", message: "Write your first sentence." };
  }

  const whoErr = validateContractWho(answers.who);
  if (whoErr) return { ok: false, field: "who", message: whoErr };
  const whatErr = validateContractWhat(answers.what);
  if (whatErr) return { ok: false, field: "what", message: whatErr };
  const whenErr = validateContractWhen(answers.when);
  if (whenErr) return { ok: false, field: "when", message: whenErr };
  const howErr = validateContractHow(answers.how);
  if (howErr) return { ok: false, field: "how", message: howErr };
  return { ok: true };
}

/**
 * Chain list index: blank → default; else exact integer string 1..max (no suffix junk, no leading zeros).
 */
export function parseStrictChainListIndex(line: string, max: number): number | "default" | null {
  const t = line.replace(/\r$/, "").trim();
  if (t === "") return "default";
  if (max < 1) return null;
  if (!/^[1-9]\d*$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) return null;
  return n - 1;
}
