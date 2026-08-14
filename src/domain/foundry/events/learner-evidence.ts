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
 *   OBSERVED  a DIFFERENT authorised person said they personally saw or heard it (3.2M-4).
 *   SUSTAINED that observation repeated over the training's own window (3.2M-5).
 *
 * APPLIED IS A SELF-REPORT AND THE PRODUCT SAYS SO. It means the learner says they tried it
 * — not that anyone saw it, not that it met the standard, not that anything improved.
 *
 * APPLIED and OBSERVED are INDEPENDENT SOURCES, not degrees of one claim. A learner may report
 * applying something nobody saw; someone may see a behaviour the learner never reported. Both
 * states are representable, and neither is fabricated to make the ladder look sequential.
 *
 * SUSTAINED IS NOT DERIVED HERE, AND STILL MUST NOT BE (Slice 3.2M-5). Lasting change needs
 * repetition over time, and this function holds six booleans: no dates, no history, no module
 * versions. It could not tell two sightings a week apart from the same sighting reported
 * twice. So `sustained` arrives as an ALREADY-DECIDED fact from `deriveSustainedEvidence`,
 * which owns the temporal contract, and this file only records it — exactly as `observed`
 * arrives already decided from the observation service. A future edit that computes the rung
 * from anything in this file would be reintroducing the bug the split exists to prevent.
 *
 * PRACTICED is NOT a prerequisite for APPLIED. Someone can do a thing at work without having
 * rehearsed it here, and inventing a rung to keep the sequence looking tidy would be exactly
 * the dishonesty this ladder exists to prevent.
 */
export type LearnerEvidenceFacts = {
  /** The training was finished — the material was read or watched to the end. */
  readonly completed: boolean;
  /**
   * A private reflection exists — the OUTPUT of `reflectionEstablished`, never a column read
   * directly. Which column carries the reflection depends on what the event asked, and that
   * boundary belongs in one place (Slice 3.2R-R8B).
   */
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
  /**
   * A distinct authorised person durably attested that they personally saw or heard the
   * frozen observable standard. Never the learner, never an attendance record, never a scan.
   */
  readonly independentlyObserved: boolean;
  /**
   * The temporal rung, ALREADY DECIDED by `deriveSustainedEvidence` (Slice 3.2M-5): positive
   * attestations about this exact behaviour on at least two distinct occurrence dates, spanning
   * at least the training's own followUpDays. Never computed from anything in this file.
   */
  readonly sustained: boolean;
};

/**
 * WHICH ANSWER ESTABLISHES REFLECTED, AND WHEN IT CHANGED (Slice 3.2R-R8B).
 *
 * This is the whole temporal boundary, in one function, deliberately: it is the kind of rule
 * that gets re-derived slightly differently at each call site until two surfaces disagree about
 * what a learner did.
 *
 * BEFORE. Every room asked exactly one question and stored the answer in `response_text`. That
 * answer meant whatever the room asked, and it is the honest evidence of reflection for every
 * row that predates the split — 30 rows across 24 events on staging, only one of which belongs
 * to an event whose published journey carried a reflection element at all.
 *
 * AFTER. An event that publishes a DISTINCT reflection question asks two things, and the
 * commitment answer no longer stands in for the examination. On those rows, and only those,
 * REFLECTED comes from `learner_reflection_text`.
 *
 * NOTHING IS REWRITTEN AND NOTHING IS BACKFILLED. `newReflectionContract` is derived per event
 * from its own frozen snapshot (see `requiredLearnerReflection`), so a historical row is read
 * under the contract it was actually completed under, forever.
 */
export function reflectionEstablished(row: {
  /** The published event asks a reflection question distinct from its other two. */
  readonly newReflectionContract: boolean;
  /** `learner_reflection_text` is present. */
  readonly learnerReflection: boolean;
  /** `response_text` is present — the completion-check answer on a new-contract row. */
  readonly completionResponse: boolean;
}): boolean {
  return row.newReflectionContract ? row.learnerReflection : row.completionResponse;
}

/** The rungs this record legitimately supports, lowest first. Never above OBSERVED. */
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
  /*
    Not gated on the learner's own report: someone can be seen doing a thing they never got
    round to reporting. Requiring APPLIED first would discard a true observation to protect a
    tidy sequence.
  */
  if (facts.completed && facts.independentlyObserved) out.push("observed");
  /*
    Gated on `independentlyObserved` because it is a TAUTOLOGY, not a tidiness rule: the
    positives that make a record sustained are the same positives that make it observed, so a
    sustained record that is not observed is a contradiction the caller has constructed. Refusing
    it here means an impossible fact cannot become a visible claim.
  */
  if (facts.completed && facts.independentlyObserved && facts.sustained) out.push("sustained");
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
