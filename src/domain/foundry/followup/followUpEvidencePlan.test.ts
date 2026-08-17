import { describe, it, expect } from "vitest";
import {
  classifyFollowUpEvidencePlan,
  isFollowUpDays,
  FOLLOW_UP_DAYS_VALUES,
} from "./followUpObligation";
import { FOLLOW_UP_DAY_OPTIONS } from "../module/module-builder";

/**
 * SLICE R4-R2C — WHAT "NO FOLLOW-UP" MEANS, SAID ONCE.
 * SLICE R4-R2C-R1 — AND SAID ONLY WHEN A HOST ACTUALLY SAID IT.
 *
 * The defect was never that a Host may decline a checkpoint. It was that declining one silently
 * removed every independent-observation path from a training that had still frozen a real
 * observable standard, and nothing anywhere said so.
 *
 * R2C-R1 then closed the inverse hazard. NO_FOLLOW_UP is a POSITIVE claim — a Host was offered
 * three options and chose the one with the lower evidence ceiling. R2C's two-way classifier
 * produced that claim for `null`, `undefined`, `5` and `{}` alike, so a corrupt or absent value
 * would have been reported as a deliberate decision. These tests pin the three-way answer, and
 * pin the valid half to the SAME predicate the completion path already obeys.
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
      agrees with `isFollowUpDays` — the predicate the service actually calls at completion — about
      which values schedule a checkpoint. If someone adds a third checkpoint to one side only, this
      fails. It says nothing about how the REST are classified; that is R2C-R1's business, below.
    */
    const candidates: unknown[] = [...FOLLOW_UP_DAY_OPTIONS, 1, 14, 60, -7, 7.5, null, undefined, "7", NaN, {}];
    for (const v of candidates) {
      const scheduled = classifyFollowUpEvidencePlan(v) === "FOLLOW_UP_SCHEDULED";
      expect(scheduled, `disagreed on ${String(v)}`).toBe(isFollowUpDays(v));
    }
    expect(FOLLOW_UP_DAYS_VALUES.every((d) => classifyFollowUpEvidencePlan(d) === "FOLLOW_UP_SCHEDULED")).toBe(true);
  });

  it("is pure — same input, same answer, no clock and no state", () => {
    expect(classifyFollowUpEvidencePlan(0)).toBe(classifyFollowUpEvidencePlan(0));
    expect(classifyFollowUpEvidencePlan(7)).toBe(classifyFollowUpEvidencePlan(7));
  });
});

describe("[R4-R2C-R1] an invalid value is not a decision", () => {
  /*
    THE REGRESSION THIS SLICE EXISTS FOR. R2C returned NO_FOLLOW_UP for every one of these, and a
    test in this very file asserted that as the "fail-safe direction". It was not fail-safe: the
    safe direction for a value BTY cannot read is to say nothing about the Host's intent, not to
    attribute an intent to them.
  */
  const NOT_A_CHOICE: [string, unknown][] = [
    ["null", null],
    ["undefined", undefined],
    ["NaN", NaN],
    ["5", 5],
    ["1", 1],
    ["14", 14],
    ["60", 60],
    ["-7", -7],
    ["7.5", 7.5],
    ['the string "0"', "0"],
    ['the string "7"', "7"],
    ["an empty string", ""],
    ["false", false],
    ["true", true],
    ["an object", {}],
    ["an array", []],
  ];

  for (const [label, value] of NOT_A_CHOICE) {
    it(`${label} is UNRESOLVED — never NO_FOLLOW_UP`, () => {
      expect(classifyFollowUpEvidencePlan(value)).toBe("UNRESOLVED");
      expect(classifyFollowUpEvidencePlan(value)).not.toBe("NO_FOLLOW_UP");
    });
  }

  it("`false` and the string \"0\" cannot pass as the choice — identity, not coercion", () => {
    /*
      `false == 0` and `"0" == 0` are both true in JavaScript. A loose comparison here would have
      let a checkbox default and a form-encoded string both report themselves as a deliberate
      decision to skip follow-up.
    */
    expect(classifyFollowUpEvidencePlan(false)).toBe("UNRESOLVED");
    expect(classifyFollowUpEvidencePlan("0")).toBe("UNRESOLVED");
    expect(classifyFollowUpEvidencePlan(0)).toBe("NO_FOLLOW_UP");
  });

  it("exactly the three offered options are resolvable, and nothing else is", () => {
    /*
      Ties the resolvable set to the Builder's OWN offer list rather than to a literal repeated
      here. A fourth option added to the Builder without a decision about its evidence meaning
      fails this, which is the correct place to find out.
    */
    for (const opt of FOLLOW_UP_DAY_OPTIONS) {
      expect(classifyFollowUpEvidencePlan(opt), `option ${opt}`).not.toBe("UNRESOLVED");
    }
    for (const [, value] of NOT_A_CHOICE) {
      expect((FOLLOW_UP_DAY_OPTIONS as readonly unknown[]).includes(value)).toBe(false);
    }
  });
});
