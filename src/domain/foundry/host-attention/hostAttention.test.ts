import { describe, it, expect } from "vitest";
import { sortHostAttention, type HostAttentionItem } from "./hostAttention";

/**
 * Host Leadership Attention — deterministic priority (Slice 3.1B-3L, required tests 21–26).
 * Priority: FOLLOW_UP_OVERDUE → FOLLOW_UP_NEEDED → SHARED_REVIEW_DUE; tie-break oldest sourceTimestamp,
 * then stableId. Pure + total order — AI can neither add, remove, nor reorder.
 */

function item(over: Partial<HostAttentionItem>): HostAttentionItem {
  return {
    stableId: over.stableId ?? "s",
    category: over.category ?? "SHARED_REVIEW_DUE",
    eventId: over.eventId ?? "e1",
    focusId: over.focusId ?? "f1",
    participantDisplayName: over.participantDisplayName ?? "Kim",
    trainingTitle: over.trainingTitle ?? "Training",
    reason: over.reason ?? "reason",
    sourceTimestamp: over.sourceTimestamp ?? "2026-07-20T05:00:00.000Z",
    deepLink: over.deepLink ?? "/en/app?tab=foundry",
  };
}

describe("sortHostAttention — category priority", () => {
  it("(21–23) orders FOLLOW_UP_OVERDUE, then FOLLOW_UP_NEEDED, then SHARED_REVIEW_DUE", () => {
    const out = sortHostAttention([
      item({ stableId: "c", category: "SHARED_REVIEW_DUE" }),
      item({ stableId: "b", category: "FOLLOW_UP_NEEDED" }),
      item({ stableId: "a", category: "FOLLOW_UP_OVERDUE" }),
    ]);
    expect(out.map((i) => i.category)).toEqual([
      "FOLLOW_UP_OVERDUE",
      "FOLLOW_UP_NEEDED",
      "SHARED_REVIEW_DUE",
    ]);
  });

  it("(24) within a category, oldest sourceTimestamp sorts first", () => {
    const out = sortHostAttention([
      item({ stableId: "new", category: "FOLLOW_UP_OVERDUE", sourceTimestamp: "2026-07-21T05:00:00.000Z" }),
      item({ stableId: "old", category: "FOLLOW_UP_OVERDUE", sourceTimestamp: "2026-07-10T05:00:00.000Z" }),
    ]);
    expect(out.map((i) => i.stableId)).toEqual(["old", "new"]);
  });

  it("(25) equal category + timestamp fall back to stableId lexical order", () => {
    const ts = "2026-07-15T05:00:00.000Z";
    const out = sortHostAttention([
      item({ stableId: "zeta", category: "SHARED_REVIEW_DUE", sourceTimestamp: ts }),
      item({ stableId: "alpha", category: "SHARED_REVIEW_DUE", sourceTimestamp: ts }),
    ]);
    expect(out.map((i) => i.stableId)).toEqual(["alpha", "zeta"]);
  });

  it("(26) is a pure total order — same input always yields the same order, input not mutated", () => {
    const input = [
      item({ stableId: "b", category: "SHARED_REVIEW_DUE", sourceTimestamp: "2026-07-12T05:00:00.000Z" }),
      item({ stableId: "a", category: "FOLLOW_UP_OVERDUE", sourceTimestamp: "2026-07-19T05:00:00.000Z" }),
      item({ stableId: "c", category: "FOLLOW_UP_NEEDED", sourceTimestamp: "2026-07-01T05:00:00.000Z" }),
    ];
    const snapshot = input.map((i) => i.stableId);
    const a = sortHostAttention(input).map((i) => i.stableId);
    const b = sortHostAttention(input).map((i) => i.stableId);
    expect(a).toEqual(b);
    expect(a).toEqual(["a", "c", "b"]);
    expect(input.map((i) => i.stableId)).toEqual(snapshot); // no in-place mutation
  });
});
