/**
 * INDEPENDENT OBSERVATION (Slice 3.2M-4).
 *
 * APPLIED is the learner saying they tried it. OBSERVED is a DIFFERENT authorised person
 * saying they personally saw or heard the behaviour. Those are two sources, not two degrees
 * of the same claim, and the product must be able to hold them in disagreement.
 *
 * What an observer is asked is deliberately small: did you see or hear THIS, yes / no / could
 * not tell. They are never asked to judge intent, attitude, competence or improvement — that
 * would be a performance rating wearing an evidence label.
 */
export type ObservationOutcome = "OBSERVED" | "NOT_OBSERVED" | "UNABLE_TO_TELL";

export const OBSERVATION_OUTCOMES: readonly ObservationOutcome[] = [
  "OBSERVED",
  "NOT_OBSERVED",
  "UNABLE_TO_TELL",
] as const;

export function isObservationOutcome(v: unknown): v is ObservationOutcome {
  return v === "OBSERVED" || v === "NOT_OBSERVED" || v === "UNABLE_TO_TELL";
}

/**
 * Only a positive observation establishes the rung.
 *
 * "I didn't observe this" is NOT "it did not happen" — the observer may simply not have been
 * there. Treating absence of observation as evidence against the learner would punish them for
 * their colleague's schedule, so it establishes nothing in either direction.
 */
export function establishesObservation(outcome: ObservationOutcome): boolean {
  return outcome === "OBSERVED";
}

export type ObservationFact = {
  readonly outcome: ObservationOutcome;
  readonly observerUserId: string;
  /**
   * The date the observer says they personally saw or heard it, "YYYY-MM-DD" (Slice 3.2M-5).
   *
   * OCCURRENCE time. `submittedAt` is when they told us, which is a fact about the observer's
   * admin habits — two reports filed the same afternoon may describe two different weeks. Only
   * this field may ever be used to reason about repetition over time.
   */
  readonly observedOn: string;
  readonly submittedAt: string;
};

/**
 * Does this set of observations establish OBSERVED?
 *
 * ANY positive observation by an authorised distinct person does. A later negative report from
 * someone else does NOT erase it: two people can honestly report different things, and the
 * evidence describes the sources rather than resolving them into one score.
 *
 * Count is deliberately ignored. Three positives are still OBSERVED — SUSTAINED has its own
 * contract and is not a tally of this one.
 */
export function observationEstablished(facts: readonly ObservationFact[]): boolean {
  return facts.some((f) => establishesObservation(f.outcome));
}

/**
 * The distinct people who positively observed it. Exists so the Host surface can say how many
 * without any caller inventing its own counting rule — and so nothing mistakes repeated
 * reports from one person for corroboration.
 */
export function distinctPositiveObservers(facts: readonly ObservationFact[]): string[] {
  return [...new Set(facts.filter((f) => establishesObservation(f.outcome)).map((f) => f.observerUserId))];
}
