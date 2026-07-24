import { describe, it, expect } from "vitest";
import {
  isReviewedActionPlanEligible,
  reviewedActionPlanReviewDate,
  reviewedActionPlanSortKey,
  compareReviewedActionPlanRecency,
  type ReviewedActionPlanDates,
} from "./reviewedActionPlan";

const NO_DATES: ReviewedActionPlanDates = {
  reviewedAt: null,
  verifiedAt: null,
  completedAt: null,
  submittedAt: null,
  createdAt: null,
};

describe("reviewedActionPlan — eligibility", () => {
  it("accepts an approved, verified field_action only", () => {
    expect(
      isReviewedActionPlanEligible({ actionType: "field_action", status: "approved", verifiedAt: "2026-07-24T00:00:00Z" }),
    ).toBe(true);
  });

  it("rejects non-approved statuses", () => {
    for (const status of ["pending", "submitted", "rejected", "escalated", "missed"]) {
      expect(
        isReviewedActionPlanEligible({ actionType: "field_action", status, verifiedAt: "2026-07-24T00:00:00Z" }),
      ).toBe(false);
    }
  });

  it("rejects an Arena action even when approved+verified", () => {
    expect(
      isReviewedActionPlanEligible({ actionType: "arena_run_completion", status: "approved", verifiedAt: "2026-07-24T00:00:00Z" }),
    ).toBe(false);
  });

  it("rejects an approved row with no verified_at (guards the verified-completion invariant)", () => {
    expect(isReviewedActionPlanEligible({ actionType: "field_action", status: "approved", verifiedAt: null })).toBe(false);
    expect(isReviewedActionPlanEligible({ actionType: "field_action", status: "approved", verifiedAt: "  " })).toBe(false);
  });
});

describe("reviewedActionPlan — review date (display) hierarchy", () => {
  it("prefers reviewed_at", () => {
    expect(
      reviewedActionPlanReviewDate({ ...NO_DATES, reviewedAt: "2026-07-24T03:00:00Z", verifiedAt: "2026-07-24T02:00:00Z", completedAt: "2026-07-24T01:00:00Z" }),
    ).toBe("2026-07-24T03:00:00Z");
  });
  it("falls back reviewed → verified → completed", () => {
    expect(reviewedActionPlanReviewDate({ ...NO_DATES, verifiedAt: "V", completedAt: "C" })).toBe("V");
    expect(reviewedActionPlanReviewDate({ ...NO_DATES, completedAt: "C" })).toBe("C");
  });
  it("never fabricates a date when reviewed/verified/completed are all absent (ignores submitted/created)", () => {
    expect(reviewedActionPlanReviewDate({ ...NO_DATES, submittedAt: "S", createdAt: "X" })).toBeNull();
  });
});

describe("reviewedActionPlan — sort key (broader precedence)", () => {
  it("uses reviewed → verified → completed → submitted → created", () => {
    expect(reviewedActionPlanSortKey({ ...NO_DATES, reviewedAt: "R" })).toBe("R");
    expect(reviewedActionPlanSortKey({ ...NO_DATES, submittedAt: "S" })).toBe("S");
    expect(reviewedActionPlanSortKey({ ...NO_DATES, createdAt: "X" })).toBe("X");
    expect(reviewedActionPlanSortKey(NO_DATES)).toBe("");
  });
});

describe("reviewedActionPlan — recency comparator", () => {
  it("orders newest sort-key first", () => {
    const list = [
      { contractId: "a", dates: { ...NO_DATES, reviewedAt: "2026-07-20T00:00:00Z" } },
      { contractId: "b", dates: { ...NO_DATES, reviewedAt: "2026-07-24T00:00:00Z" } },
      { contractId: "c", dates: { ...NO_DATES, reviewedAt: "2026-07-22T00:00:00Z" } },
    ];
    expect([...list].sort(compareReviewedActionPlanRecency).map((x) => x.contractId)).toEqual(["b", "c", "a"]);
  });

  it("tie-breaks equal keys by contract id ascending (stable across refresh)", () => {
    const same = "2026-07-24T00:00:00Z";
    const list = [
      { contractId: "zzz", dates: { ...NO_DATES, reviewedAt: same } },
      { contractId: "aaa", dates: { ...NO_DATES, reviewedAt: same } },
      { contractId: "mmm", dates: { ...NO_DATES, reviewedAt: same } },
    ];
    expect([...list].sort(compareReviewedActionPlanRecency).map((x) => x.contractId)).toEqual(["aaa", "mmm", "zzz"]);
    // reversed input → identical output (order-independent)
    expect([...list].reverse().sort(compareReviewedActionPlanRecency).map((x) => x.contractId)).toEqual(["aaa", "mmm", "zzz"]);
  });
});
