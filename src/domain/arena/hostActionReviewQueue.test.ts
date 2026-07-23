import { describe, it, expect } from "vitest";
import { orderHostActionReviewQueue } from "./hostActionReviewQueue";

describe("orderHostActionReviewQueue", () => {
  it("orders oldest submittedAt first", () => {
    const out = orderHostActionReviewQueue([
      { actionContractId: "b", submittedAt: "2026-07-10T00:00:00Z", createdAt: null },
      { actionContractId: "a", submittedAt: "2026-07-01T00:00:00Z", createdAt: null },
      { actionContractId: "c", submittedAt: "2026-07-20T00:00:00Z", createdAt: null },
    ]);
    expect(out.map((r) => r.actionContractId)).toEqual(["a", "b", "c"]);
  });

  it("falls back to createdAt when submittedAt is null", () => {
    const out = orderHostActionReviewQueue([
      { actionContractId: "x", submittedAt: null, createdAt: "2026-07-15T00:00:00Z" },
      { actionContractId: "y", submittedAt: null, createdAt: "2026-07-05T00:00:00Z" },
    ]);
    expect(out.map((r) => r.actionContractId)).toEqual(["y", "x"]);
  });

  it("rows with no timestamp sort last, not first", () => {
    const out = orderHostActionReviewQueue([
      { actionContractId: "none", submittedAt: null, createdAt: null },
      { actionContractId: "dated", submittedAt: "2026-07-05T00:00:00Z", createdAt: null },
    ]);
    expect(out.map((r) => r.actionContractId)).toEqual(["dated", "none"]);
  });

  it("deduplicates by actionContractId (keeps first)", () => {
    const out = orderHostActionReviewQueue([
      { actionContractId: "dup", submittedAt: "2026-07-05T00:00:00Z", createdAt: null },
      { actionContractId: "dup", submittedAt: "2026-07-01T00:00:00Z", createdAt: null },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].actionContractId).toBe("dup");
  });

  it("uses stable actionContractId tie-break for equal timestamps", () => {
    const out = orderHostActionReviewQueue([
      { actionContractId: "m", submittedAt: "2026-07-05T00:00:00Z", createdAt: null },
      { actionContractId: "a", submittedAt: "2026-07-05T00:00:00Z", createdAt: null },
    ]);
    expect(out.map((r) => r.actionContractId)).toEqual(["a", "m"]);
  });
});
