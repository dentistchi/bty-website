import { describe, it, expect } from "vitest";
import { establishedEvidence, highestEstablished } from "./learner-evidence";

/**
 * SLICE 3.2M-2 — what one learner's record actually establishes.
 *
 * The ladder was a ceiling on what a program may CLAIM. This is the other half, and its most
 * important property is what it can never return.
 */
const facts = (o: Partial<Parameters<typeof establishedEvidence>[0]> = {}) => ({
  completed: false, reflection: false, decision: false, practiceCompleted: false, appliedReported: false,
  independentlyObserved: false, sustained: false, ...o,
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

  it("a reported application adds APPLIED — the 3.2M-3 rung", () => {
    expect(establishedEvidence(facts({ completed: true, appliedReported: true }))).toEqual(["exposed", "applied"]);
    expect(highestEstablished(facts({ completed: true, appliedReported: true }))).toBe("applied");
  });

  it("APPLIED does not require PRACTICED — someone can do it at work without rehearsing here", () => {
    const got = establishedEvidence(facts({ completed: true, appliedReported: true }));
    expect(got).toContain("applied");
    expect(got).not.toContain("practiced");
  });

  it("an independent observation adds OBSERVED — the 3.2M-4 rung", () => {
    expect(establishedEvidence(facts({ completed: true, independentlyObserved: true }))).toEqual(["exposed", "observed"]);
    expect(highestEstablished(facts({ completed: true, independentlyObserved: true }))).toBe("observed");
  });

  it("APPLIED and OBSERVED are independent — all four combinations are representable", () => {
    const f = (applied: boolean, observed: boolean) =>
      establishedEvidence(facts({ completed: true, appliedReported: applied, independentlyObserved: observed }));
    expect(f(false, false)).toEqual(["exposed"]);
    expect(f(true, false)).toEqual(["exposed", "applied"]);
    // Someone was seen doing a thing they never reported. That is a real state.
    expect(f(false, true)).toEqual(["exposed", "observed"]);
    expect(f(true, true)).toEqual(["exposed", "applied", "observed"]);
  });

  /**
   * SLICE 3.2M-5 — SUSTAINED appears if and only if it was DECIDED ELSEWHERE.
   *
   * The 3.2M-2 version of this test asserted `sustained` was never returned for any of the 64
   * combinations, which was the right guarantee while the rung had no contract. It now has one,
   * owned by `deriveSustainedEvidence`, and the guarantee that replaces it is stronger: across
   * all 128 combinations the rung tracks the precomputed fact exactly — never inferred from a
   * count, a self-report, a rehearsal, or the shape of the ladder.
   */
  it("SUSTAINED appears only when the precomputed temporal fact is true — all 128 combinations", () => {
    for (const completed of [true, false]) {
      for (const reflection of [true, false]) {
        for (const decision of [true, false]) {
          for (const practiceCompleted of [true, false]) {
            for (const appliedReported of [true, false]) {
              for (const independentlyObserved of [true, false]) {
                for (const sustained of [true, false]) {
                  const all = { completed, reflection, decision, practiceCompleted, appliedReported, independentlyObserved, sustained };
                  const got = establishedEvidence(all);
                  const label = JSON.stringify(all);
                  // Never without the fact — nothing in this file may derive it.
                  if (!sustained) expect(got, label).not.toContain("sustained");
                  // And never from the fact alone: an unfinished training, or one nobody
                  // observed, cannot carry a claim about repetition.
                  expect(got.includes("sustained"), label).toBe(completed && independentlyObserved && sustained);
                  if (!completed) expect(got, label).toEqual([]);
                }
              }
            }
          }
        }
      }
    }
  });

  it("SUSTAINED sits above OBSERVED and never replaces it — the 3.2M-5 rung", () => {
    const f = facts({ completed: true, independentlyObserved: true, sustained: true });
    expect(establishedEvidence(f)).toEqual(["exposed", "observed", "sustained"]);
    expect(highestEstablished(f)).toBe("sustained");
  });

  it("repeated SELF-REPORT never reaches SUSTAINED, however much of it there is", () => {
    // The learner saying they applied it — even alongside a rehearsal and a decision — is not
    // an observation, and no quantity of it becomes one.
    const got = establishedEvidence(
      facts({ completed: true, reflection: true, decision: true, practiceCompleted: true, appliedReported: true }),
    );
    expect(got).not.toContain("sustained");
    expect(got).not.toContain("observed");
  });

  it("SUSTAINED does not require APPLIED — being seen twice needs no self-report", () => {
    const got = establishedEvidence(facts({ completed: true, independentlyObserved: true, sustained: true }));
    expect(got).toContain("sustained");
    expect(got).not.toContain("applied");
  });

  it("a decision is not a rehearsal — DECIDED never implies PRACTICED", () => {
    expect(establishedEvidence(facts({ completed: true, decision: true }))).not.toContain("practiced");
  });
});
