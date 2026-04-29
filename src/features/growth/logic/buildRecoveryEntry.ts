import type { RecoveryEntry, RecoveryPrompt } from "./recoveryTypes";

export function buildRecoveryEntry(
  prompt: RecoveryPrompt,
  payload: {
    patternNote: string;
    resetAction: string;
    reentryCommitment: string;
  },
): RecoveryEntry {
  const id = `rec-${prompt.createdAt}-${Date.now()}`;

  return {
    id,
    promptReason: prompt.reason,
    promptSource: prompt.source,
    patternNote: payload.patternNote.trim(),
    resetAction: payload.resetAction.trim(),
    reentryCommitment: payload.reentryCommitment.trim(),
    createdAt: Date.now(),
  };
}
