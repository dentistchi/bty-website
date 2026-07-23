import { describe, it, expect } from "vitest";
import { classifyActionContract, sortActionStatus, type ActionStatusItem } from "./actionStatus";

/**
 * Action Hygiene classification + ordering (Slice 3.1B-3M). Classify by STORED status, deterministic,
 * AI-free. (Required tests 1–10 bucket mapping; 12/13 distinctness; ordering.)
 */

describe("classifyActionContract — stored status → Today bucket", () => {
  it("(1) pending → action_due (the only overdue-eligible bucket)", () => {
    expect(classifyActionContract("pending")).toBe("action_due");
  });
  it("(8) rejected → action_revision", () => {
    expect(classifyActionContract("rejected")).toBe("action_revision");
  });
  it("(4/5) submitted → verification_pending (never overdue)", () => {
    expect(classifyActionContract("submitted")).toBe("verification_pending");
  });
  it("(6/7) escalated → awaiting_resolution (escalation is NOT verification)", () => {
    expect(classifyActionContract("escalated")).toBe("awaiting_resolution");
  });
  it("(9/10) approved and missed → none (never emitted into Today)", () => {
    expect(classifyActionContract("approved")).toBe("none");
    expect(classifyActionContract("missed")).toBe("none");
  });
  it("draft / committed / unknown / null → none", () => {
    for (const s of ["draft", "committed", "something_else", null, undefined]) {
      expect(classifyActionContract(s as string)).toBe("none");
    }
  });
});

function item(over: Partial<ActionStatusItem>): ActionStatusItem {
  return {
    stableId: over.stableId ?? "s",
    contractId: over.contractId ?? "c",
    status: over.status ?? "verification_pending",
    title: over.title ?? "t",
    patternFamily: over.patternFamily ?? "fam",
    sourceTitle: over.sourceTitle ?? null,
    originalDeadline: "originalDeadline" in over ? (over.originalDeadline ?? null) : "2026-05-05T00:00:00.000Z",
    deepLink: over.deepLink ?? "/en/app?tab=arena",
  };
}

describe("sortActionStatus — deterministic", () => {
  it("verification_pending sorts before awaiting_resolution (fixed documented rank)", () => {
    const out = sortActionStatus([
      item({ stableId: "b", status: "awaiting_resolution" }),
      item({ stableId: "a", status: "verification_pending" }),
    ]);
    expect(out.map((i) => i.status)).toEqual(["verification_pending", "awaiting_resolution"]);
  });
  it("within a status, oldest original deadline first; null deadline sorts last", () => {
    const out = sortActionStatus([
      item({ stableId: "none", originalDeadline: null }),
      item({ stableId: "new", originalDeadline: "2026-06-01T00:00:00.000Z" }),
      item({ stableId: "old", originalDeadline: "2026-05-01T00:00:00.000Z" }),
    ]);
    expect(out.map((i) => i.stableId)).toEqual(["old", "new", "none"]);
  });
  it("stable tie-break by stableId; input not mutated", () => {
    const input = [
      item({ stableId: "z", originalDeadline: "2026-05-05T00:00:00.000Z" }),
      item({ stableId: "a", originalDeadline: "2026-05-05T00:00:00.000Z" }),
    ];
    const snap = input.map((i) => i.stableId);
    expect(sortActionStatus(input).map((i) => i.stableId)).toEqual(["a", "z"]);
    expect(input.map((i) => i.stableId)).toEqual(snap);
  });
});
