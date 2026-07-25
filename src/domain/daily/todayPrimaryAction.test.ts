/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  selectPrimaryAction,
  type PrimaryActionCandidate,
  type PrimaryActionFallbackContext,
} from "./todayPrimaryAction";

const mk = (over: Partial<PrimaryActionCandidate> & Pick<PrimaryActionCandidate, "stableId" | "category" | "state">): PrimaryActionCandidate => ({
  title: over.stableId,
  deepLink: `/x/${over.stableId}`,
  ...over,
});

const fb = (over: Partial<PrimaryActionFallbackContext> = {}): PrimaryActionFallbackContext => ({
  hasActiveProgram: false,
  hasAvailablePractice: false,
  ...over,
});

describe("selectPrimaryAction — deterministic one-action selector (tiers 1–8)", () => {
  it("needs_revision (blocking correction) wins over every other category and every fallback", () => {
    const r = selectPrimaryAction(
      [
        mk({ stableId: "learn", category: "REQUIRED_LEARNING", state: "incomplete_required" }),
        mk({ stableId: "due", category: "ACTION_DUE", state: "overdue" }),
        mk({ stableId: "rev", category: "ACTION_REVISION", state: "needs_revision" }),
      ],
      fb({ hasActiveProgram: true, hasAvailablePractice: true }),
    );
    expect(r).toEqual({ kind: "reminder", candidate: expect.objectContaining({ stableId: "rev" }) });
  });

  it("Test 1 — due work outranks ALL fallbacks (active program + available practice present)", () => {
    const r = selectPrimaryAction(
      [mk({ stableId: "due", category: "ACTION_DUE", state: "due_today" })],
      fb({ hasActiveProgram: true, hasAvailablePractice: true }),
    );
    expect(r.kind).toBe("reminder");
  });

  it("follows the fixed reminder priority when there is no revision", () => {
    expect(
      selectPrimaryAction([
        mk({ stableId: "follow", category: "FOLLOW_UP_DUE", state: "due_today" }),
        mk({ stableId: "practice", category: "PRACTICE_DUE", state: "due_today" }),
        mk({ stableId: "learn", category: "REQUIRED_LEARNING", state: "incomplete_required" }),
        mk({ stableId: "due", category: "ACTION_DUE", state: "due_today" }),
      ]),
    ).toEqual({ kind: "reminder", candidate: expect.objectContaining({ stableId: "due" }) });
  });

  it("within a category, more urgent state wins (overdue > due_today > upcoming)", () => {
    const r = selectPrimaryAction([
      mk({ stableId: "up", category: "ACTION_DUE", state: "upcoming" }),
      mk({ stableId: "overdue", category: "ACTION_DUE", state: "overdue" }),
      mk({ stableId: "due", category: "ACTION_DUE", state: "due_today" }),
    ]);
    expect(r).toEqual({ kind: "reminder", candidate: expect.objectContaining({ stableId: "overdue" }) });
  });

  it("Test 2 — an active program outranks an available practice", () => {
    expect(selectPrimaryAction([], fb({ hasActiveProgram: true, hasAvailablePractice: true })).kind).toBe(
      "continue_program",
    );
  });

  it("Test 3 — an available practice (no active program) returns exactly one start-practice action", () => {
    expect(selectPrimaryAction([], fb({ hasAvailablePractice: true })).kind).toBe("start_practice");
  });

  it("Test 4 — no practice and no active program returns find-a-program", () => {
    expect(selectPrimaryAction([], fb()).kind).toBe("find_program");
    // Default fallback context (nothing) also resolves to the always-valid final fallback.
    expect(selectPrimaryAction([]).kind).toBe("find_program");
  });

  it("Test 5 — fully deterministic: identical input → identical single result, order-independent", () => {
    const a = mk({ stableId: "aaa", category: "ACTION_DUE", state: "due_today" });
    const b = mk({ stableId: "bbb", category: "ACTION_DUE", state: "due_today" });
    expect(selectPrimaryAction([a, b])).toEqual(selectPrimaryAction([b, a]));
    expect(selectPrimaryAction([a, b])).toEqual({ kind: "reminder", candidate: expect.objectContaining({ stableId: "aaa" }) });
    // Fallback determinism.
    expect(selectPrimaryAction([], fb({ hasActiveProgram: true }))).toEqual(
      selectPrimaryAction([], fb({ hasActiveProgram: true })),
    );
  });

  it("Tests 6/7 — NEVER returns null/empty and NEVER more than one action, across all inputs", () => {
    const inputs: Array<[PrimaryActionCandidate[], PrimaryActionFallbackContext]> = [
      [[], fb()],
      [[], fb({ hasActiveProgram: true })],
      [[], fb({ hasAvailablePractice: true })],
      [[], fb({ hasActiveProgram: true, hasAvailablePractice: true })],
      [[mk({ stableId: "x", category: "ACTION_DUE", state: "due_today" })], fb()],
    ];
    for (const [c, f] of inputs) {
      const r = selectPrimaryAction(c, f);
      expect(r).toBeTruthy();
      expect(["reminder", "continue_program", "start_practice", "find_program"]).toContain(r.kind);
    }
  });

  it("does not mutate the input array", () => {
    const input = [
      mk({ stableId: "z", category: "FOLLOW_UP_DUE", state: "due_today" }),
      mk({ stableId: "a", category: "ACTION_REVISION", state: "needs_revision" }),
    ];
    const snapshot = input.map((c) => c.stableId);
    selectPrimaryAction(input, fb({ hasActiveProgram: true }));
    expect(input.map((c) => c.stableId)).toEqual(snapshot);
  });
});
