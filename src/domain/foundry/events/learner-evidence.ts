import { EVIDENCE_LADDER, type EvidenceLevel } from "@/domain/foundry/module/program-authorship";

/**
 * WHAT ONE LEARNER'S RECORD ACTUALLY ESTABLISHES (Slice 3.2M-2).
 *
 * The ladder already existed, but only as a CEILING on what a program may CLAIM. This is the
 * other half: given the durable facts of one person's training, which rungs are actually
 * earned. It is a pure derivation — no rung is stored, because a stored rung is one that can
 * drift from the evidence it is supposed to summarise.
 *
 * The three reachable rungs each require a thing the learner DID:
 *   EXPOSED   they finished the material.
 *   REFLECTED they wrote an answer.
 *   DECIDED   they wrote what THEY will do (Slice 3.2M-1).
 *   PRACTICED they completed a rehearsal built from this training (Slice 3.2M-2).
 *
 * APPLIED, OBSERVED and SUSTAINED are deliberately unreachable here and must stay that way.
 * Completing a simulation inside BTY says nothing about what someone did at work; a
 * self-report is what they SAY they did; observation needs a second person; lasting change
 * needs repetition. Nothing in this file may ever return them.
 */
export type LearnerEvidenceFacts = {
  /** The training was finished — the material was read or watched to the end. */
  readonly completed: boolean;
  /** A private reflection exists. */
  readonly reflection: boolean;
  /** The learner recorded their own decision (never BTY's proposed sentence). */
  readonly decision: boolean;
  /** A completed practice run, built from this training, belonging to this learner. */
  readonly practiceCompleted: boolean;
};

/** The rungs this record legitimately supports, lowest first. Never above PRACTICED. */
export function establishedEvidence(facts: LearnerEvidenceFacts): EvidenceLevel[] {
  const out: EvidenceLevel[] = [];
  if (facts.completed) out.push("exposed");
  if (facts.completed && facts.reflection) out.push("reflected");
  if (facts.completed && facts.decision) out.push("decided");
  // Practice is its own act. It does not require the reflection or the decision, but it does
  // require the training to have been finished — the rehearsal belongs to that training.
  if (facts.completed && facts.practiceCompleted) out.push("practiced");
  return out;
}

/** The highest rung established, or null. Exists so no caller invents its own ordering. */
export function highestEstablished(facts: LearnerEvidenceFacts): EvidenceLevel | null {
  const got = new Set(establishedEvidence(facts));
  for (let i = EVIDENCE_LADDER.length - 1; i >= 0; i -= 1) {
    const level = EVIDENCE_LADDER[i]!;
    if (got.has(level)) return level;
  }
  return null;
}
