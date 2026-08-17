import { describe, it, expect } from "vitest";
import {
  classifyFollowUpEvidencePlan,
  isFollowUpDays,
  FOLLOW_UP_DAYS_VALUES,
} from "./followUpObligation";
import { FOLLOW_UP_DAY_OPTIONS } from "../module/module-builder";

/**
 * SLICE R4-R2C — WHAT "NO FOLLOW-UP" MEANS, SAID ONCE.
 *
 * The defect was never that a Host may decline a checkpoint. It was that declining one silently
 * removed every independent-observation path from a training that had still frozen a real
 * observable standard, and nothing anywhere said so.
 *
 * These tests pin the canonical interpretation and — more importantly — pin it to the SAME
 * predicate the completion path already obeys, so the sentence the Host reads before publish and
 * the branch `materializeFollowupObligation` takes can never disagree about the same number.
 */
describe("[R4-R2C] follow-up evidence plan", () => {
  it("0 is still a VALID authoring choice — the Builder option set keeps it", () => {
    // The product decision, pinned: "No follow-up" is not removed and not deprecated.
    expect(FOLLOW_UP_DAY_OPTIONS).toContain(0);
  });

  it("0 resolves to NO_FOLLOW_UP", () => {
    expect(classifyFollowUpEvidencePlan(0)).toBe("NO_FOLLOW_UP");
  });

  it("7 and 30 resolve to FOLLOW_UP_SCHEDULED — existing behaviour, unchanged", () => {
    expect(classifyFollowUpEvidencePlan(7)).toBe("FOLLOW_UP_SCHEDULED");
    expect(classifyFollowUpEvidencePlan(30)).toBe("FOLLOW_UP_SCHEDULED");
  });

  it("every value that materializes an obligation is FOLLOW_UP_SCHEDULED, and only those", () => {
    /*
      THE ANTI-DRIFT TEST. Not a restatement of the two cases above: this asserts the classifier
      agrees with `isFollowUpDays` — the predicate the service actually calls at completion — over
      the whole authoring option set plus the junk a stored snapshot can carry. If someone adds a
      third checkpoint to one side only, this fails.
    */
    const candidates: unknown[] = [...FOLLOW_UP_DAY_OPTIONS, 1, 14, 60, -7, 7.5, null, undefined, "7", NaN, {}];
    for (const v of candidates) {
      const expected = isFollowUpDays(v) ? "FOLLOW_UP_SCHEDULED" : "NO_FOLLOW_UP";
      expect(classifyFollowUpEvidencePlan(v), `disagreed on ${String(v)}`).toBe(expected);
    }
    expect(FOLLOW_UP_DAYS_VALUES.every((d) => classifyFollowUpEvidencePlan(d) === "FOLLOW_UP_SCHEDULED")).toBe(true);
  });

  it("an absent or malformed stored value reads as NO_FOLLOW_UP, never as a scheduled checkpoint", () => {
    /*
      FAIL-SAFE DIRECTION. The only safe default is the one that claims LESS evidence. Reading a
      corrupt snapshot as FOLLOW_UP_SCHEDULED would tell a Host an observation is coming that the
      completion path will never create — the exact silence this slice removes, inverted.
    */
    for (const junk of [undefined, null, "", "none", 0, -1, {}]) {
      expect(classifyFollowUpEvidencePlan(junk)).toBe("NO_FOLLOW_UP");
    }
  });

  it("is pure — same input, same answer, no clock and no state", () => {
    expect(classifyFollowUpEvidencePlan(0)).toBe(classifyFollowUpEvidencePlan(0));
    expect(classifyFollowUpEvidencePlan(7)).toBe(classifyFollowUpEvidencePlan(7));
  });
});
