import { describe, it, expect } from "vitest";
import { deriveCommitmentFrame, selectProposition } from "@/domain/daily/livingResponseFrame";
import { classifyTrajectory } from "@/domain/daily/livingResponseTrajectory";
import { validateLivingResponse } from "@/lib/bty/daily/livingResponseValidator";
import { guardPhrasesFor } from "@/domain/daily/livingResponseGuardPhrases";

const SELF = deriveCommitmentFrame("self")!;
const TODAY = "2026-07-12";
const seed = `${TODAY}:self`;
const returnTrajectory = classifyTrajectory("self", TODAY, [
  { relationship: "others", dayKey: "2026-07-11" },
  { relationship: "self", dayKey: "2026-07-10" },
]); // → return (informative, recurrence)
const expansionTrajectory = classifyTrajectory("world", TODAY, [
  { relationship: "self", dayKey: "2026-07-11" },
  { relationship: "self", dayKey: "2026-07-10" },
  { relationship: "self", dayKey: "2026-07-09" },
]); // → expansion (informative, beginning)

const validateSelf = (text: string, proposition: ReturnType<typeof selectProposition>) =>
  validateLivingResponse(text, {
    relationship: "self",
    guardPhrases: guardPhrasesFor("en", "self"),
    concepts: [],
    recentTexts: [],
    proposition,
  });

describe("trajectory → proposition wiring (Evidence → Trajectory → Voice)", () => {
  it("an informative trajectory CONSUMES behavioral repetition (evidence preserved, not destroyed)", () => {
    const p = selectProposition(SELF, "repetition", ["SELF_RETURN_STRONG"], seed, returnTrajectory);
    expect(p.trajectory?.kind).toBe("return");
    // The Voice speaks ONE continuity claim: the trajectory. Repetition is not a competing output…
    expect(p.repetition).toBeUndefined();
    expect(p.propositionCode).toContain("trajectory.return");
    // …but it was CONSUMED, not discarded — the behavioral evidence code survives in provenance.
    expect(p.provenanceCodes).toContain("SELF_RETURN_STRONG");
  });

  it("a neutral trajectory (continuation) does NOT disturb the existing repetition path", () => {
    const continuation = classifyTrajectory("self", TODAY, [
      { relationship: "self", dayKey: "2026-07-11" },
    ]); // continuation (non-informative)
    const p = selectProposition(SELF, "repetition", ["SELF_RETURN_STRONG"], seed, continuation);
    expect(p.trajectory).toBeUndefined();
    expect(p.repetition?.movement).toBe("repeated_inward_return"); // unchanged V2.2 behavior
  });

  it("omitting the trajectory arg reproduces the exact prior proposition (zero regression)", () => {
    const withNull = selectProposition(SELF, "commitment", [], seed);
    const withUndef = selectProposition(SELF, "commitment", [], seed, undefined);
    expect(withNull).toEqual(withUndef);
    expect(withNull.trajectory).toBeUndefined();
  });
});

describe("trajectory → validator grounding", () => {
  it("accepts a recurrence-trajectory line that returns AND surfaces the frame anchor", () => {
    const p = selectProposition(SELF, "commitment", [], seed, returnTrajectory);
    const r = validateSelf("You come back to what stays inward, naming it again today.", p);
    expect(r.ok).toBe(true);
  });

  it("rejects a recurrence-trajectory line with no returning/continuing marker", () => {
    const p = selectProposition(SELF, "commitment", [], seed, returnTrajectory);
    const r = validateSelf("What stays inward takes honest form when it is named.", p);
    expect(r.violations).toContain("TRAJECTORY_ANCHOR_MISSING");
  });

  it("rejects a beginning-trajectory (expansion) line that leans on recurrence language", () => {
    const world = deriveCommitmentFrame("world")!;
    const p = selectProposition(world, "commitment", [], `${TODAY}:world`, expansionTrajectory);
    const r = validateLivingResponse("Again you build, reaching beyond into wider ground made real.", {
      relationship: "world",
      guardPhrases: guardPhrasesFor("en", "world"),
      concepts: [],
      recentTexts: [],
      proposition: p,
    });
    expect(r.violations).toContain("TRAJECTORY_ANCHOR_MISSING"); // "again" contradicts a widening shape
  });

  it("rejects a trajectory line that adds a judgment/failure claim", () => {
    const p = selectProposition(SELF, "commitment", [], seed, returnTrajectory);
    const r = validateSelf("You return to name what is inward after failing to before.", p);
    expect(r.violations).toContain("PROHIBITED_CLAIM");
  });

  it("does not fire HISTORICAL_CLAIM when a recurrence trajectory authorizes the sequence language", () => {
    const p = selectProposition(SELF, "commitment", [], seed, returnTrajectory);
    const r = validateSelf("You come back again to name what stays inward.", p);
    expect(r.violations).not.toContain("HISTORICAL_CLAIM");
  });
});
