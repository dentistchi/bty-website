import { describe, it, expect } from "vitest";
import { establishedEvidence, highestEstablished } from "./learner-evidence";

/**
 * SLICE 3.2M-2 — what one learner's record actually establishes.
 *
 * The ladder was a ceiling on what a program may CLAIM. This is the other half, and its most
 * important property is what it can never return.
 */
const facts = (o: Partial<Parameters<typeof establishedEvidence>[0]> = {}) => ({
  completed: false, reflection: false, decision: false, practiceCompleted: false, ...o,
});

describe("[3.2M-2] established evidence", () => {
  it("nothing is established before the training is finished — not even a completed practice", () => {
    expect(establishedEvidence(facts())).toEqual([]);
    expect(establishedEvidence(facts({ reflection: true, decision: true, practiceCompleted: true }))).toEqual([]);
    expect(highestEstablished(facts({ practiceCompleted: true }))).toBeNull();
  });

  it("finishing establishes EXPOSED and nothing more", () => {
    expect(establishedEvidence(facts({ completed: true }))).toEqual(["exposed"]);
  });

  it("a reflection adds REFLECTED; a decision adds DECIDED", () => {
    expect(establishedEvidence(facts({ completed: true, reflection: true }))).toEqual(["exposed", "reflected"]);
    expect(establishedEvidence(facts({ completed: true, decision: true }))).toEqual(["exposed", "decided"]);
  });

  it("a completed rehearsal adds PRACTICED — the 3.2M-2 rung", () => {
    expect(establishedEvidence(facts({ completed: true, reflection: true, decision: true, practiceCompleted: true })))
      .toEqual(["exposed", "reflected", "decided", "practiced"]);
    expect(highestEstablished(facts({ completed: true, practiceCompleted: true }))).toBe("practiced");
  });

  it("NOTHING reaches APPLIED, OBSERVED or SUSTAINED — for any combination at all", () => {
    for (const completed of [true, false]) {
      for (const reflection of [true, false]) {
        for (const decision of [true, false]) {
          for (const practiceCompleted of [true, false]) {
            const got = establishedEvidence({ completed, reflection, decision, practiceCompleted });
            for (const forbidden of ["applied", "observed", "sustained"] as const) {
              expect(got, JSON.stringify({ completed, reflection, decision, practiceCompleted })).not.toContain(forbidden);
            }
          }
        }
      }
    }
  });

  it("a decision is not a rehearsal — DECIDED never implies PRACTICED", () => {
    expect(establishedEvidence(facts({ completed: true, decision: true }))).not.toContain("practiced");
  });
});
