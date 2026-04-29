/** Recovery layer — re-entry gate, not failure state. */

export type RecoveryPromptReason = "low-regulation" | "repeated-friction" | "pressure-accumulation";

export type RecoveryPrompt = {
  source: "growth" | "arena";
  reason: RecoveryPromptReason;
  title: string;
  body: string;
  cue: string;
  createdAt: number;
};

export type RecoveryEntry = {
  id: string;
  promptReason: RecoveryPromptReason;
  promptSource: RecoveryPrompt["source"];
  patternNote: string;
  resetAction: string;
  reentryCommitment: string;
  createdAt: number;
};
