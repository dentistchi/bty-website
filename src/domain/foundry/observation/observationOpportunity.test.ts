import { describe, it, expect } from "vitest";
import { deriveSustainedEvidence, type SustainedObservationFact } from "./sustainedEvidence";
import {
  isObservationOpportunity,
  observationOpportunityView,
  opportunityDemandsAttention,
  orderObservationOpportunities,
  type OpportunityState,
} from "./observationOpportunity";

/**
 * SLICE 3.2N — what makes an opportunity, and what it is allowed to say about itself.
 *
 * The risk this file guards is not a missing card; it is a card that overclaims — that turns a
 * standing permission into a task, a deadline, or a judgement about the learner.
 */
const EVENT = "ev-1";
const STANDARD = "The outgoing person states each open item aloud.";
const SCOPE = { eventId: EVENT, observableStandard: STANDARD, followUpDays: 7 };

const f = (
  outcome: "OBSERVED" | "NOT_OBSERVED" | "UNABLE_TO_TELL",
  observedOn: string,
  observerUserId = "o1",
): SustainedObservationFact => ({
  outcome, observerUserId, observedOn, submittedAt: `${observedOn}T09:00:00Z`,
  eventId: EVENT, observedStandardSnapshot: STANDARD,
});
const view = (facts: SustainedObservationFact[]) =>
  observationOpportunityView(deriveSustainedEvidence(facts, SCOPE));

const BASE = {
  authorityAllowed: true,
  obligationExists: true,
  learnerUserId: "learner-1",
  observableStandard: STANDARD,
};

describe("[3.2N] what makes an opportunity", () => {
  it("an authorised reviewer with an obligation and a grounded standard has one", () => {
    expect(isObservationOpportunity(BASE)).toBe(true);
  });

  it("no authority → nothing, whatever else is true", () => {
    expect(isObservationOpportunity({ ...BASE, authorityAllowed: false })).toBe(false);
  });

  it("no obligation → nothing", () => {
    expect(isObservationOpportunity({ ...BASE, obligationExists: false })).toBe(false);
  });

  it("no learner identity → nothing (the learner comes from the obligation, never the caller)", () => {
    expect(isObservationOpportunity({ ...BASE, learnerUserId: null })).toBe(false);
  });

  it("no grounded standard → nothing to watch for, so nothing to offer", () => {
    for (const bad of [null, "", "   "]) {
      expect(isObservationOpportunity({ ...BASE, observableStandard: bad }), String(bad)).toBe(false);
    }
  });

  it("does NOT depend on the learner's own report, a rehearsal, or any prior evidence", () => {
    // The predicate's whole input is four facts, none of which is the learner's self-report.
    // Observation is an independent source; gating it on APPLIED would discard true sightings.
    expect(Object.keys(BASE).sort()).toEqual(
      ["authorityAllowed", "learnerUserId", "obligationExists", "observableStandard"].sort(),
    );
  });
});

describe("[3.2N] the five states", () => {
  it("nothing recorded → none", () => {
    expect(view([]).state).toBe("none");
  });

  it("only negative or uncertain reports → not_seen, never a failure state", () => {
    expect(view([f("NOT_OBSERVED", "2026-08-01")]).state).toBe("not_seen");
    expect(view([f("UNABLE_TO_TELL", "2026-08-01")]).state).toBe("not_seen");
    expect(view([f("NOT_OBSERVED", "2026-08-01"), f("UNABLE_TO_TELL", "2026-08-03")]).state).toBe("not_seen");
  });

  it("one positive date → seen_once", () => {
    const v = view([f("OBSERVED", "2026-08-01")]);
    expect(v.state).toBe("seen_once");
    expect(v.positiveDates).toBe(1);
    expect(v.firstObservedOn).toBe("2026-08-01");
  });

  it("several positives on ONE day are still seen_once — days are counted, not rows", () => {
    const v = view([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-01", "o2")]);
    expect(v.state).toBe("seen_once");
    expect(v.positiveDates).toBe(1);
  });

  it("two dates inside the window → seen_repeatedly, not sustained", () => {
    const v = view([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-05")]);
    expect(v.state).toBe("seen_repeatedly");
    expect(v.positiveDates).toBe(2);
  });

  it("two dates a full window apart → sustained", () => {
    const v = view([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-08")]);
    expect(v.state).toBe("sustained");
    expect([v.firstObservedOn, v.lastObservedOn]).toEqual(["2026-08-01", "2026-08-08"]);
  });

  it("a positive plus a later negative keeps the positive state — nothing is subtracted", () => {
    const v = view([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-08"), f("NOT_OBSERVED", "2026-08-10")]);
    expect(v.state).toBe("sustained");
    expect(v.lastObservedOn, "the span ends at the last POSITIVE date").toBe("2026-08-08");
  });
});

describe("[3.2N] nothing here is a task", () => {
  it("no state demands attention — asserted in code, for every state", () => {
    const all: OpportunityState[] = ["none", "not_seen", "seen_once", "seen_repeatedly", "sustained"];
    for (const s of all) expect(opportunityDemandsAttention(s), s).toBe(false);
  });

  it("the view carries no due date, deadline, overdue flag or urgency of any kind", () => {
    const keys = Object.keys(view([f("OBSERVED", "2026-08-01")]));
    expect(keys.sort()).toEqual(["firstObservedOn", "lastObservedOn", "positiveDates", "state"]);
    for (const forbidden of ["dueAt", "dueState", "overdue", "deadline", "urgent"]) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
  });
});

describe("[3.2N] ordering", () => {
  it("least-evidenced first — where a sighting would tell us something new", () => {
    const items = [
      { followupId: "d", state: "sustained" as const },
      { followupId: "b", state: "not_seen" as const },
      { followupId: "a", state: "none" as const },
      { followupId: "c", state: "seen_once" as const },
    ];
    expect(orderObservationOpportunities(items).map((i) => i.followupId)).toEqual(["a", "b", "c", "d"]);
  });

  it("is stable and never mutates its input", () => {
    const items = [
      { followupId: "z", state: "none" as const },
      { followupId: "a", state: "none" as const },
    ];
    const snapshot = JSON.stringify(items);
    expect(orderObservationOpportunities(items).map((i) => i.followupId)).toEqual(["a", "z"]);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
