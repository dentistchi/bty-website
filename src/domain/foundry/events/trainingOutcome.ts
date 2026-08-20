import { classifyFollowUpDue, type FollowUpDays, type FollowUpOutcome } from "../followup/followUpObligation";
import { observationEstablished, type ObservationOutcome } from "../observation/behaviorObservation";

/**
 * TRAINING OUTCOME — the Host's answer to "did anything change?" (Slice R4-R3A). Pure: no DB,
 * no I/O, no display strings.
 *
 * WHY THIS IS A DOMAIN FUNCTION AND NOT A `.filter()` IN REACT.
 *
 * Every judgement on this screen already has exactly one owner, and each of them exists because
 * an earlier slice found a way to get it wrong:
 *
 *   `establishesObservation` — only OBSERVED confirms. "I didn't observe this" is not "it did
 *     not happen"; the observer may simply not have been there.
 *   `classifyFollowUpDue`   — overdue is a BTY DAY-KEY comparison, not an instant one, because
 *     dueAt is the 05:00-local START of the due day and an instant compare reads overdue all day.
 *
 * A component that re-implemented either would be a second authority, and the two would drift.
 * So this module consumes them and the UI consumes this.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it never merges the three levels into one number. Completed,
 * learner-reported application, and independent observation are separate facts about separate
 * things, and a Host who is shown one "success rate" has been told something nobody measured.
 */

/**
 * TWO CONTRACTS, NEVER ONE (Slice R4-R3A-R1).
 *
 * R4-R3A carried a single `downstream` field and derived it from the Journey. That was measurably
 * false: `materializeFollowupObligation` never reads the Journey. It asks `isFollowUpDays` about
 * the frozen `module_snapshot.followUpDays`, and nothing else. Reading one thing and writing on
 * another meant the Host was told "no follow-up was set up for it" on 17 of the 31 production
 * events that have completions — every one of which HAD a 7- or 30-day checkpoint configured.
 *
 * The two capabilities are now carried separately and must stay that way. They gate different
 * obligations and they fail for different reasons, so one word cannot name both without lying
 * about one of them.
 */

/**
 * Whether this training can produce an APPLY WINDOW — a separate obligation with a separate gate
 * (`materializeApplyWindow`: grounded `action_decision` + a written decision + identity).
 *
 * `none` covers both "no module row" and "a module with no Journey": for the application journey
 * those are the same fact — there is no journey — and R4-R3A's extra split existed only to explain
 * a follow-up state this field no longer speaks for.
 */
export type ApplicationJourneyState = "none" | "journey_no_decision" | "action_decision";

export type FollowUpFact = {
  readonly status: "PENDING" | "RESPONDED";
  readonly outcome: FollowUpOutcome | null;
  /** The stored due instant. Classified by day key, never compared as an instant. */
  readonly dueAtIso: string;
};

/**
 * One observation row, carrying the target it belongs to.
 *
 * `followUpId` IS the observable target: the observations table FKs to it, and one follow-up is
 * one learner's obligation for one training. The grouping is not cosmetic — the unique index is
 * `(followup_id, observer_user_id, observed_on, outcome)`, so a SINGLE observer can legitimately
 * file several rows against one target on different days. Counting rows would inflate a Host's
 * "Confirmed" number twice over: once per extra observer, once per extra day.
 */
export type ObservationFactLite = { readonly followUpId: string; readonly outcome: ObservationOutcome };

export type TrainingOutcomeFacts = {
  readonly joined: number;
  readonly completed: number;
  /** Completions carrying a durable BTY identity — the only ones that can go downstream. */
  readonly linkedCompletions: number;
  readonly decisionCount: number;
  readonly followUps: readonly FollowUpFact[];
  readonly observations: readonly ObservationFactLite[];
  /**
   * The frozen `module_snapshot.followUpDays`, already validated by `isFollowUpDays` — the SAME
   * predicate the write path asks. Null means the Host set no checkpoint (0, absent, or no module
   * row at all), which is the only state in which this training truly ends at completion.
   */
  readonly followUpDays: FollowUpDays | null;
  readonly applicationJourney: ApplicationJourneyState;
};

export type TrainingOutcome = {
  participation: {
    joined: number;
    completed: number;
    linkedCompletions: number;
    /**
     * Completions with no durable identity. NOT a failure by the learner — it is why downstream
     * evidence can be thin, and the Host is owed that explanation rather than a silent gap.
     */
    unclaimedCompletions: number;
  };
  followUp: {
    /**
     * Did the Host ask for a checkpoint? This — and ONLY this — decides whether the training ends
     * at completion. It is deliberately not inferable from anything about the Journey.
     */
    configured: boolean;
    days: FollowUpDays | null;
    applied: number;
    partlyApplied: number;
    notYet: number;
    blocked: number;
    /** PENDING and not yet past its due day. */
    waiting: number;
    /** PENDING and past its due day, per `classifyFollowUpDue`. */
    overdue: number;
    total: number;
    answered: number;
  };
  /**
   * COUNTED IN TARGETS, NOT ROWS. Each observed follow-up contributes at most 1, to exactly one
   * bucket. Two colleagues confirming the same person is ONE confirmed person — and it is still
   * not "sustained", which has its own contract and is not a tally of this one.
   */
  observation: {
    /** Targets where at least one OBSERVED exists. Nothing else confirms. */
    confirmed: number;
    /** Targets with reports, none positive, at least one NOT_OBSERVED. Not a contradiction. */
    notEstablished: number;
    /** Targets whose only reports were UNABLE_TO_TELL. Establishes nothing either way. */
    couldntTell: number;
    /** Number of distinct targets anyone reported on. */
    total: number;
  };
  /**
   * Apply-window capability, carried for correctness of the payload rather than for display. This
   * repair adds NO Journey UI — its whole purpose is to stop the Journey being used as the answer
   * to a follow-up question.
   */
  applicationJourney: ApplicationJourneyState;
  /** How many learners recorded a decision. The texts themselves are fetched separately. */
  decisionCount: number;
  /**
   * The one-line reading of the above. `unknown_yet` is the honest default whenever answers are
   * still outstanding — it is a statement about our knowledge, never about the learners.
   *
   * `ends_at_completion` replaces R4-R3A's `no_downstream` and is now reachable ONLY when no
   * checkpoint was configured. `awaiting_identity` is the state that sentence used to swallow:
   * the checkpoint EXISTS, and the people who finished cannot be reached because they never
   * signed in. Naming the wrong cause is not a smaller error than saying nothing.
   */
  reading:
    | "ends_at_completion"
    | "awaiting_identity"
    | "nothing_yet"
    | "unknown_yet"
    | "reported_only"
    | "confirmed";
};

export function summariseTrainingOutcome(
  facts: TrainingOutcomeFacts,
  now: Date,
  tz: string,
): TrainingOutcome {
  const f = { applied: 0, partlyApplied: 0, notYet: 0, blocked: 0, waiting: 0, overdue: 0 };
  for (const fu of facts.followUps) {
    if (fu.status === "RESPONDED") {
      if (fu.outcome === "APPLIED") f.applied += 1;
      else if (fu.outcome === "PARTLY_APPLIED") f.partlyApplied += 1;
      else if (fu.outcome === "NOT_YET") f.notYet += 1;
      else if (fu.outcome === "BLOCKED") f.blocked += 1;
      continue;
    }
    // PENDING: the SINGLE overdue authority decides, by day key.
    if (classifyFollowUpDue(fu.dueAtIso, now, tz) === "overdue") f.overdue += 1;
    else f.waiting += 1;
  }

  /*
    GROUP BY TARGET FIRST, then ask the domain authority once per target. `observationEstablished`
    already answers "does this SET of facts establish it?" — passing it one row at a time was the
    bug: it turned two honest colleagues into two confirmed people.
  */
  const byTarget = new Map<string, ObservationOutcome[]>();
  for (const ob of facts.observations) {
    const list = byTarget.get(ob.followUpId);
    if (list) list.push(ob.outcome);
    else byTarget.set(ob.followUpId, [ob.outcome]);
  }
  const o = { confirmed: 0, notEstablished: 0, couldntTell: 0 };
  for (const outcomes of byTarget.values()) {
    if (observationEstablished(outcomes.map((outcome) => ({ outcome, observerUserId: "", observedOn: "", submittedAt: "" })))) {
      o.confirmed += 1;
    } else if (outcomes.includes("NOT_OBSERVED")) {
      o.notEstablished += 1;
    } else {
      o.couldntTell += 1;
    }
  }

  const answered = f.applied + f.partlyApplied + f.notYet + f.blocked;
  const outstanding = f.waiting + f.overdue;

  /*
    THE READING, and every branch is a statement about what we know rather than about anyone's
    performance. `confirmed` is the only one that claims something happened, and it requires an
    independent OBSERVED — a learner's own report can never reach it.
  */
  const configured = facts.followUpDays !== null;
  const unclaimed = Math.max(0, facts.completed - facts.linkedCompletions);
  const reading: TrainingOutcome["reading"] = !configured
    ? "ends_at_completion"
    : o.confirmed > 0
      ? "confirmed"
      : outstanding > 0
        ? "unknown_yet"
        : answered > 0
          ? "reported_only"
          : /*
              A checkpoint EXISTS and produced not one obligation, while people did finish without
              signing in. That is the identity gap, and it is the reason — not an absent
              configuration and not anything the learners did. Ordered AFTER the evidence branches
              on purpose: a training with real follow-up rows reports its evidence, and the
              unclaimed completions are explained separately alongside it.
            */
            facts.followUps.length === 0 && unclaimed > 0
            ? "awaiting_identity"
            : "nothing_yet";

  return {
    participation: {
      joined: facts.joined,
      completed: facts.completed,
      linkedCompletions: facts.linkedCompletions,
      unclaimedCompletions: Math.max(0, facts.completed - facts.linkedCompletions),
    },
    followUp: {
      configured,
      days: facts.followUpDays,
      ...f,
      total: facts.followUps.length,
      answered,
    },
    observation: { ...o, total: byTarget.size },
    applicationJourney: facts.applicationJourney,
    decisionCount: facts.decisionCount,
    reading,
  };
}
