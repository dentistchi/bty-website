/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { selectPrimaryAction, type PrimaryActionCandidate } from "./todayPrimaryAction";

const mk = (over: Partial<PrimaryActionCandidate> & Pick<PrimaryActionCandidate, "stableId" | "category" | "state">): PrimaryActionCandidate => ({
  title: over.stableId,
  deepLink: `/x/${over.stableId}`,
  ...over,
});

describe("selectPrimaryAction — deterministic one-action selector", () => {
  it("returns null when there is nothing actionable", () => {
    expect(selectPrimaryAction([])).toBeNull();
  });

  it("needs_revision (blocking correction) wins over every other category", () => {
    const picked = selectPrimaryAction([
      mk({ stableId: "learn", category: "REQUIRED_LEARNING", state: "incomplete_required" }),
      mk({ stableId: "due", category: "ACTION_DUE", state: "overdue" }),
      mk({ stableId: "rev", category: "ACTION_REVISION", state: "needs_revision" }),
    ]);
    expect(picked?.stableId).toBe("rev");
  });

  it("follows the fixed priority order when there is no revision", () => {
    // ACTION_DUE beats REQUIRED_LEARNING beats PRACTICE_DUE beats FOLLOW_UP_DUE.
    expect(
      selectPrimaryAction([
        mk({ stableId: "follow", category: "FOLLOW_UP_DUE", state: "due_today" }),
        mk({ stableId: "practice", category: "PRACTICE_DUE", state: "due_today" }),
        mk({ stableId: "learn", category: "REQUIRED_LEARNING", state: "incomplete_required" }),
        mk({ stableId: "due", category: "ACTION_DUE", state: "due_today" }),
      ])?.stableId,
    ).toBe("due");
    expect(
      selectPrimaryAction([
        mk({ stableId: "follow", category: "FOLLOW_UP_DUE", state: "due_today" }),
        mk({ stableId: "practice", category: "PRACTICE_DUE", state: "due_today" }),
      ])?.stableId,
    ).toBe("practice");
  });

  it("within a category, more urgent state wins (overdue > due_today > upcoming)", () => {
    expect(
      selectPrimaryAction([
        mk({ stableId: "up", category: "ACTION_DUE", state: "upcoming" }),
        mk({ stableId: "overdue", category: "ACTION_DUE", state: "overdue" }),
        mk({ stableId: "due", category: "ACTION_DUE", state: "due_today" }),
      ])?.stableId,
    ).toBe("overdue");
  });

  it("is fully deterministic — identical input yields the identical single result, order-independent", () => {
    const a = mk({ stableId: "aaa", category: "ACTION_DUE", state: "due_today" });
    const b = mk({ stableId: "bbb", category: "ACTION_DUE", state: "due_today" });
    // Same rank/state → stableId tiebreak → "aaa" regardless of input order.
    expect(selectPrimaryAction([a, b])?.stableId).toBe("aaa");
    expect(selectPrimaryAction([b, a])?.stableId).toBe("aaa");
  });

  it("does not mutate the input array", () => {
    const input = [
      mk({ stableId: "z", category: "FOLLOW_UP_DUE", state: "due_today" }),
      mk({ stableId: "a", category: "ACTION_REVISION", state: "needs_revision" }),
    ];
    const snapshot = input.map((c) => c.stableId);
    selectPrimaryAction(input);
    expect(input.map((c) => c.stableId)).toEqual(snapshot);
  });
});
