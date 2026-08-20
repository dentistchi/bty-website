import { describe, it, expect } from "vitest";
import { summariseTrainingOutcome, type TrainingOutcomeFacts } from "./trainingOutcome";

/**
 * R4-R3A — the aggregation that answers "did anything change?".
 *
 * Every number on the Host's screen is decided here, once, using the authorities that already
 * own each judgement. These tests exist to pin the three things the product must never get
 * wrong: overdue is a day-key question, only OBSERVED confirms, and the three evidence levels
 * are never merged.
 *
 * The fixtures use real production shapes — the counts in "the production shape" test are the
 * measured state of the training that traversed the most stages.
 */

const NOW = new Date("2026-08-19T12:00:00Z");
const TZ = "UTC";

function facts(over: Partial<TrainingOutcomeFacts> = {}): TrainingOutcomeFacts {
  return {
    joined: 0,
    completed: 0,
    linkedCompletions: 0,
    decisionCount: 0,
    followUps: [],
    observations: [],
    followUpDays: 7,
    applicationJourney: "action_decision",
    ...over,
  };
}

describe("R4-R3A · 1 · participation counts", () => {
  it("joined and completed are reported as measured, not derived from each other", () => {
    const s = summariseTrainingOutcome(facts({ joined: 18, completed: 12, linkedCompletions: 5 }), NOW, TZ);
    expect(s.participation.joined).toBe(18);
    expect(s.participation.completed).toBe(12);
    expect(s.participation.linkedCompletions).toBe(5);
  });
});

describe("R4-R3A · 2–5 · follow-up outcome aggregation", () => {
  const responded = (outcome: "APPLIED" | "PARTLY_APPLIED" | "NOT_YET" | "BLOCKED") =>
    ({ status: "RESPONDED" as const, outcome, dueAtIso: "2026-08-10T05:00:00Z" });

  it("APPLIED, PARTLY_APPLIED, NOT_YET and BLOCKED each land in their own bucket", () => {
    const s = summariseTrainingOutcome(
      facts({
        followUps: [
          responded("APPLIED"), responded("APPLIED"),
          responded("PARTLY_APPLIED"),
          responded("NOT_YET"), responded("NOT_YET"), responded("NOT_YET"),
          responded("BLOCKED"),
        ],
      }),
      NOW,
      TZ,
    );
    expect(s.followUp.applied).toBe(2);
    expect(s.followUp.partlyApplied).toBe(1);
    expect(s.followUp.notYet).toBe(3);
    expect(s.followUp.blocked).toBe(1);
    expect(s.followUp.answered).toBe(7);
    // A RESPONDED follow-up is never also counted as waiting or overdue.
    expect(s.followUp.waiting).toBe(0);
    expect(s.followUp.overdue).toBe(0);
  });
});

describe("R4-R3A · 6 · Waiting vs Overdue comes from classifyFollowUpDue", () => {
  it("a PENDING follow-up past its due DAY is overdue; one still ahead is waiting", () => {
    const s = summariseTrainingOutcome(
      facts({
        followUps: [
          { status: "PENDING", outcome: null, dueAtIso: "2026-08-11T05:00:00Z" }, // past
          { status: "PENDING", outcome: null, dueAtIso: "2026-08-25T05:00:00Z" }, // ahead
        ],
      }),
      NOW,
      TZ,
    );
    expect(s.followUp.overdue).toBe(1);
    expect(s.followUp.waiting).toBe(1);
  });

  it("the DUE DAY ITSELF is not overdue — the authority is day-key, not instant", () => {
    /*
      `due_at` is the 05:00-local START of the due day. An instant comparison would call this
      overdue from 05:00 onwards, which is wrong for a day-granular obligation — the whole day
      belongs to the learner. This is exactly why the domain calls `classifyFollowUpDue` instead
      of comparing timestamps.
    */
    const s = summariseTrainingOutcome(
      facts({ followUps: [{ status: "PENDING", outcome: null, dueAtIso: "2026-08-19T05:00:00Z" }] }),
      NOW,
      TZ,
    );
    expect(s.followUp.overdue).toBe(0);
    expect(s.followUp.waiting).toBe(1);
  });
});

describe("R4-R3A · 7–9 · observation, and only OBSERVED confirms", () => {
  it("OBSERVED alone establishes confirmation", () => {
    const s = summariseTrainingOutcome(facts({ observations: [{ followUpId: "f1", outcome: "OBSERVED" }] }), NOW, TZ);
    expect(s.observation.confirmed).toBe(1);
    expect(s.reading).toBe("confirmed");
  });

  it("NOT_OBSERVED is neither confirmation nor contradiction", () => {
    const s = summariseTrainingOutcome(facts({ observations: [{ followUpId: "f1", outcome: "NOT_OBSERVED" }] }), NOW, TZ);
    expect(s.observation.confirmed).toBe(0);
    expect(s.observation.notEstablished).toBe(1);
    // It must not be read as evidence against the learner either — nothing was established.
    expect(s.reading).not.toBe("confirmed");
  });

  it("UNABLE_TO_TELL NEVER counts as confirmed, even alongside other reports", () => {
    const s = summariseTrainingOutcome(
      facts({ observations: [{ followUpId: "f1", outcome: "UNABLE_TO_TELL" }, { followUpId: "f2", outcome: "UNABLE_TO_TELL" }, { followUpId: "f3", outcome: "NOT_OBSERVED" }] }),
      NOW,
      TZ,
    );
    expect(s.observation.confirmed).toBe(0);
    expect(s.observation.couldntTell).toBe(2);
    expect(s.observation.notEstablished).toBe(1);
    expect(s.reading).not.toBe("confirmed");
  });

  it("a learner's own APPLIED can never reach 'confirmed' on its own", () => {
    const s = summariseTrainingOutcome(
      facts({ followUps: [{ status: "RESPONDED", outcome: "APPLIED", dueAtIso: "2026-08-10T05:00:00Z" }] }),
      NOW,
      TZ,
    );
    expect(s.followUp.applied).toBe(1);
    expect(s.observation.confirmed).toBe(0);
    // Reported, not confirmed — the distinction the whole screen exists to preserve.
    expect(s.reading).toBe("reported_only");
  });
});

describe("R4-R3A · 10 · anonymous completions are counted honestly", () => {
  it("unclaimed = completed minus linked, and never negative", () => {
    const s = summariseTrainingOutcome(facts({ completed: 39, linkedCompletions: 12 }), NOW, TZ);
    expect(s.participation.unclaimedCompletions).toBe(27);

    const odd = summariseTrainingOutcome(facts({ completed: 2, linkedCompletions: 5 }), NOW, TZ);
    expect(odd.participation.unclaimedCompletions).toBe(0);
  });
});

/*
  R4-R3A-R1 CORRECTED THIS BLOCK.

  It previously asserted that `no_module` / `no_journey` / `no_decision` each read as
  `no_downstream` — i.e. that the Journey decided whether a follow-up existed. That was the
  defect, pinned as if it were the contract, and the assertions are inverted here rather than
  deleted so the record of what changed survives (the R4-R2E-R2 precedent).

  The follow-up gate is `followUpDays`, because that is what `materializeFollowupObligation` asks.
*/
describe("R4-R3A-R1 · 11 · only an absent checkpoint ends a training at completion", () => {
  it("no checkpoint → ends_at_completion, and the learner is never blamed", () => {
    const s = summariseTrainingOutcome(
      facts({ joined: 9, completed: 7, followUpDays: null, applicationJourney: "none" }),
      NOW,
      TZ,
    );
    expect(s.reading).toBe("ends_at_completion");
    expect(s.followUp.configured).toBe(false);
    expect(s.followUp.days).toBeNull();
    // The completion facts still stand — only the reading changes.
    expect(s.participation.completed).toBe(7);
  });

  for (const applicationJourney of ["none", "journey_no_decision", "action_decision"] as const) {
    it(`applicationJourney=${applicationJourney} does NOT decide the follow-up reading`, () => {
      const s = summariseTrainingOutcome(
        facts({ joined: 9, completed: 7, linkedCompletions: 7, followUpDays: 7, applicationJourney }),
        NOW,
        TZ,
      );
      // Configured is configured, whatever the Journey does or does not carry.
      expect(s.followUp.configured).toBe(true);
      expect(s.reading).not.toBe("ends_at_completion");
      expect(s.applicationJourney).toBe(applicationJourney);
    });
  }

  it("a configured checkpoint reports its real follow-up rows even with no Journey at all", () => {
    const s = summariseTrainingOutcome(
      facts({
        followUpDays: 7,
        applicationJourney: "none",
        linkedCompletions: 1,
        completed: 1,
        followUps: [{ status: "PENDING", outcome: null, dueAtIso: "2026-08-01T05:00:00Z" }],
      }),
      NOW,
      TZ,
    );
    // Previously these rows were suppressed by `no_downstream`. They are real, and they are shown.
    expect(s.reading).toBe("unknown_yet");
    expect(s.followUp.total).toBe(1);
  });
});

describe("R4-R3A · 16 · honest empty state", () => {
  it("a configured training with nothing yet says exactly that", () => {
    const s = summariseTrainingOutcome(facts({ joined: 3, completed: 0 }), NOW, TZ);
    expect(s.reading).toBe("nothing_yet");
    expect(s.followUp.total).toBe(0);
    expect(s.observation.total).toBe(0);
    expect(s.decisionCount).toBe(0);
  });

  it("outstanding answers make the reading 'we don't know yet', never a verdict", () => {
    const s = summariseTrainingOutcome(
      facts({
        completed: 12,
        followUps: [
          { status: "RESPONDED", outcome: "APPLIED", dueAtIso: "2026-08-10T05:00:00Z" },
          { status: "PENDING", outcome: null, dueAtIso: "2026-08-11T05:00:00Z" },
          { status: "PENDING", outcome: null, dueAtIso: "2026-08-25T05:00:00Z" },
        ],
      }),
      NOW,
      TZ,
    );
    expect(s.reading).toBe("unknown_yet");
    expect(s.followUp.overdue).toBe(1);
    expect(s.followUp.waiting).toBe(1);
  });
});

describe("R4-R3A · the three levels are never merged", () => {
  it("completed, applied and confirmed stay three separate numbers", () => {
    const s = summariseTrainingOutcome(
      facts({
        joined: 18,
        completed: 12,
        linkedCompletions: 12,
        followUps: [{ status: "RESPONDED", outcome: "APPLIED", dueAtIso: "2026-08-10T05:00:00Z" }],
        observations: [{ followUpId: "f1", outcome: "UNABLE_TO_TELL" }],
      }),
      NOW,
      TZ,
    );
    expect(s.participation.completed).toBe(12);
    expect(s.followUp.applied).toBe(1);
    expect(s.observation.confirmed).toBe(0);
    // No field anywhere combines them.
    expect(Object.keys(s)).toEqual(
      expect.arrayContaining(["participation", "followUp", "observation", "applicationJourney", "decisionCount", "reading"]),
    );
    expect(JSON.stringify(s)).not.toMatch(/successRate|score|percent/i);
  });

  it("THE PRODUCTION SHAPE — the training that traversed the most stages", () => {
    /*
      Measured on `Establishing Action Ownership in Huddles`: one learner completed with a
      decision, an apply window opened, the follow-up is still PENDING and past due, and the one
      observation on it was UNABLE_TO_TELL. The honest reading is that we do not know — which is
      exactly what a Host should be told, rather than a number implying success or failure.
    */
    const s = summariseTrainingOutcome(
      facts({
        joined: 2,
        completed: 1,
        linkedCompletions: 1,
        decisionCount: 1,
        followUps: [{ status: "PENDING", outcome: null, dueAtIso: "2026-08-22T05:00:00Z" }],
        observations: [{ followUpId: "f1", outcome: "UNABLE_TO_TELL" }],
      }),
      new Date("2026-08-25T12:00:00Z"),
      TZ,
    );
    expect(s.followUp.overdue).toBe(1);
    expect(s.observation.confirmed).toBe(0);
    expect(s.observation.couldntTell).toBe(1);
    expect(s.reading).toBe("unknown_yet");
  });
});


describe("R4-R3A · 2 · Confirmed counts TARGETS, never observation rows", () => {
  /*
    THE DEFECT THIS PINS. The first implementation iterated a flat list, so two colleagues
    confirming the SAME person reported "Confirmed 2" — two people changed, when one did. The
    unique index is `(followup_id, observer_user_id, observed_on, outcome)`, so even a single
    observer filing on two days would have inflated it.
  */
  it("two positive observers on ONE target ⇒ Confirmed = 1", () => {
    const s = summariseTrainingOutcome(
      facts({
        observations: [
          { followUpId: "same-target", outcome: "OBSERVED" },
          { followUpId: "same-target", outcome: "OBSERVED" },
        ],
      }),
      NOW,
      TZ,
    );
    expect(s.observation.confirmed).toBe(1);
    expect(s.observation.total).toBe(1);
  });

  it("one positive observation on EACH of two distinct targets ⇒ Confirmed = 2", () => {
    const s = summariseTrainingOutcome(
      facts({
        observations: [
          { followUpId: "target-a", outcome: "OBSERVED" },
          { followUpId: "target-b", outcome: "OBSERVED" },
        ],
      }),
      NOW,
      TZ,
    );
    expect(s.observation.confirmed).toBe(2);
    expect(s.observation.total).toBe(2);
  });

  it("one positive alongside a negative on the SAME target is still one confirmed, not a contradiction", () => {
    const s = summariseTrainingOutcome(
      facts({
        observations: [
          { followUpId: "t", outcome: "NOT_OBSERVED" },
          { followUpId: "t", outcome: "OBSERVED" },
        ],
      }),
      NOW,
      TZ,
    );
    expect(s.observation.confirmed).toBe(1);
    expect(s.observation.notEstablished).toBe(0);
    expect(s.observation.total).toBe(1);
  });

  it("many observers never imply Sustained — there is no such field", () => {
    const s = summariseTrainingOutcome(
      facts({
        observations: [
          { followUpId: "t", outcome: "OBSERVED" },
          { followUpId: "t", outcome: "OBSERVED" },
          { followUpId: "t", outcome: "OBSERVED" },
        ],
      }),
      NOW,
      TZ,
    );
    expect(s.observation.confirmed).toBe(1);
    expect(JSON.stringify(s)).not.toMatch(/sustain/i);
  });

  it("each target lands in exactly one bucket — the three never double-count", () => {
    const s = summariseTrainingOutcome(
      facts({
        observations: [
          { followUpId: "a", outcome: "OBSERVED" },
          { followUpId: "b", outcome: "NOT_OBSERVED" },
          { followUpId: "c", outcome: "UNABLE_TO_TELL" },
          { followUpId: "c", outcome: "UNABLE_TO_TELL" },
        ],
      }),
      NOW,
      TZ,
    );
    const { confirmed, notEstablished, couldntTell, total } = s.observation;
    expect(confirmed + notEstablished + couldntTell).toBe(total);
    expect(total).toBe(3);
  });
});

describe("R4-R3A · 1 · overdue is judged in the HOST'S timezone, not UTC", () => {
  /*
    `due_at` is the 05:00-LOCAL start of the due BTY day. The same instant is therefore a
    different BTY day in different frames — which is exactly why the reader's tz has to reach the
    server. These fix the two frames the product actually runs in.
  */
  const dueAt = "2026-08-20T12:00:00Z";

  it("Asia/Seoul — the due day itself is NOT overdue, and the next BTY day IS", () => {
    const onDueDay = summariseTrainingOutcome(
      facts({ followUps: [{ status: "PENDING", outcome: null, dueAtIso: dueAt }] }),
      new Date("2026-08-20T15:00:00Z"), // 2026-08-21 00:00 KST → still the due BTY day (05:00 start)
      "Asia/Seoul",
    );
    expect(onDueDay.followUp.overdue).toBe(0);
    expect(onDueDay.followUp.waiting).toBe(1);

    const nextDay = summariseTrainingOutcome(
      facts({ followUps: [{ status: "PENDING", outcome: null, dueAtIso: dueAt }] }),
      new Date("2026-08-21T23:00:00Z"),
      "Asia/Seoul",
    );
    expect(nextDay.followUp.overdue).toBe(1);
  });

  it("America/Los_Angeles — the due day itself is NOT overdue, and the next BTY day IS", () => {
    const onDueDay = summariseTrainingOutcome(
      facts({ followUps: [{ status: "PENDING", outcome: null, dueAtIso: dueAt }] }),
      new Date("2026-08-20T20:00:00Z"), // 13:00 PDT on the due day
      "America/Los_Angeles",
    );
    expect(onDueDay.followUp.overdue).toBe(0);

    const nextDay = summariseTrainingOutcome(
      facts({ followUps: [{ status: "PENDING", outcome: null, dueAtIso: dueAt }] }),
      new Date("2026-08-21T20:00:00Z"),
      "America/Los_Angeles",
    );
    expect(nextDay.followUp.overdue).toBe(1);
  });

  it("THE FRAME MATTERS: one instant, two timezones, two different answers", () => {
    const at = new Date("2026-08-21T04:00:00Z"); // 21:00 PDT Aug 20 · 13:00 KST Aug 21
    const fu = { status: "PENDING" as const, outcome: null, dueAtIso: dueAt };
    const la = summariseTrainingOutcome(facts({ followUps: [fu] }), at, "America/Los_Angeles");
    const seoul = summariseTrainingOutcome(facts({ followUps: [fu] }), at, "Asia/Seoul");
    expect(la.followUp.overdue).toBe(0);
    expect(seoul.followUp.overdue).toBe(1);
  });
});
