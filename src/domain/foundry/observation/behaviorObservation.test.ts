import { describe, it, expect } from "vitest";
import {
  OBSERVATION_OUTCOMES,
  distinctPositiveObservers,
  establishesObservation,
  isObservationOutcome,
  observationEstablished,
  type ObservationFact,
} from "./behaviorObservation";

/**
 * SLICE 3.2M-4 — what an independent observation can and cannot say.
 */
const at = (n: number) => `2026-08-0${n}T00:00:00Z`;
const fact = (outcome: (typeof OBSERVATION_OUTCOMES)[number], observer: string, day = 1): ObservationFact => ({
  outcome, observerUserId: observer, submittedAt: at(day),
});

describe("[3.2M-4] observation outcomes", () => {
  it("only a positive observation establishes the rung", () => {
    expect(establishesObservation("OBSERVED")).toBe(true);
    expect(establishesObservation("NOT_OBSERVED")).toBe(false);
    expect(establishesObservation("UNABLE_TO_TELL")).toBe(false);
  });

  it("rejects anything outside the vocabulary — including plausible near-misses", () => {
    for (const bad of ["observed", "SEEN", "YES", "APPLIED", "", null, undefined, 1]) {
      expect(isObservationOutcome(bad), String(bad)).toBe(false);
    }
    for (const good of OBSERVATION_OUTCOMES) expect(isObservationOutcome(good)).toBe(true);
  });

  it("no observations at all establishes nothing", () => {
    expect(observationEstablished([])).toBe(false);
  });

  it("negative and uncertain reports establish nothing, alone or together", () => {
    expect(observationEstablished([fact("NOT_OBSERVED", "o1"), fact("UNABLE_TO_TELL", "o2")])).toBe(false);
  });

  it("one positive observation establishes it", () => {
    expect(observationEstablished([fact("OBSERVED", "o1")])).toBe(true);
  });

  it("a later negative report by someone else does NOT erase a true observation", () => {
    // Two people can honestly report different things. The evidence describes the sources.
    expect(observationEstablished([fact("OBSERVED", "o1", 1), fact("NOT_OBSERVED", "o2", 2)])).toBe(true);
  });

  it("an earlier negative does not block a later genuine observation", () => {
    expect(observationEstablished([fact("NOT_OBSERVED", "o1", 1), fact("OBSERVED", "o1", 2)])).toBe(true);
  });

  it("repeated reports from ONE person are not corroboration", () => {
    const facts = [fact("OBSERVED", "o1", 1), fact("OBSERVED", "o1", 2), fact("OBSERVED", "o1", 3)];
    expect(observationEstablished(facts)).toBe(true);
    expect(distinctPositiveObservers(facts)).toEqual(["o1"]);
  });

  it("counts distinct positive observers, ignoring negatives", () => {
    const facts = [fact("OBSERVED", "o1"), fact("NOT_OBSERVED", "o2"), fact("OBSERVED", "o3")];
    expect(distinctPositiveObservers(facts).sort()).toEqual(["o1", "o3"]);
  });

  it("three positive observers are still just OBSERVED — count is not a rung", () => {
    const facts = [fact("OBSERVED", "o1"), fact("OBSERVED", "o2"), fact("OBSERVED", "o3")];
    expect(observationEstablished(facts)).toBe(true);
    expect(distinctPositiveObservers(facts)).toHaveLength(3);
    // Nothing here returns SUSTAINED, and nothing may derive it from a tally.
  });
});
