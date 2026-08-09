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
 *   APPLIED   they reported, in their own follow-up, that they did it at work (3.2M-3).
 *
 * APPLIED IS A SELF-REPORT AND THE PRODUCT SAYS SO. It means the learner says they tried it
 * — not that anyone saw it, not that it met the standard, not that anything improved.
 *
 * OBSERVED and SUSTAINED remain unreachable and must stay that way: observation needs a
 * second person, and lasting change needs repetition. Nothing in this file may ever return
 * them.
 *
 * PRACTICED is NOT a prerequisite for APPLIED. Someone can do a thing at work without having
 * rehearsed it here, and inventing a rung to keep the sequence looking tidy would be exactly
 * the dishonesty this ladder exists to prevent.
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
  /**
   * The learner's own follow-up report for this training said they applied it. Only the
   * terminal APPLIED outcome counts — partly, not yet and blocked are honest check-ins, not
   * claims of application.
   */
  readonly appliedReported: boolean;
};

/** The rungs this record legitimately supports, lowest first. Never above APPLIED. */
export function establishedEvidence(facts: LearnerEvidenceFacts): EvidenceLevel[] {
  const out: EvidenceLevel[] = [];
  if (facts.completed) out.push("exposed");
  if (facts.completed && facts.reflection) out.push("reflected");
  if (facts.completed && facts.decision) out.push("decided");
  // Practice is its own act. It does not require the reflection or the decision, but it does
  // require the training to have been finished — the rehearsal belongs to that training.
  if (facts.completed && facts.practiceCompleted) out.push("practiced");
  // Not gated on practice: the ladder records what happened, not a tidy sequence.
  if (facts.completed && facts.appliedReported) out.push("applied");
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
