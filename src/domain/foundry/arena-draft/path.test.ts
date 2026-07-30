import { describe, it, expect } from "vitest";
import { validateSelectedPath, mergeSelectedPath, coerceStoredPath } from "./path";
import type { ArenaScenarioDraft } from "./types";

/** Minimal branch-aware scenario: two primaries, each with its own tradeoff/action ids. */
const BRANCHED: ArenaScenarioDraft = {
  title: "t",
  opening: "o",
  primary: { choices: [{ id: "primary_1", label: "A" }, { id: "primary_2", label: "B" }] },
  // legacy flat fallback (shared)
  tradeoff: { escalationText: "flat esc", choices: [{ id: "flat_t1", label: "x" }, { id: "flat_t2", label: "y" }] },
  actionDecision: { prompt: "p", choices: [{ id: "flat_a1", label: "x", isActionCommitment: true }, { id: "flat_a2", label: "y", isActionCommitment: false }] },
  branches: {
    primary_1: {
      escalationText: "e1",
      tradeoffChoices: [{ id: "p1_t1", label: "x" }, { id: "p1_t2", label: "y" }],
      actionDecision: { prompt: "p1", choices: [{ id: "p1_a1", label: "x", isActionCommitment: true }, { id: "p1_a2", label: "y", isActionCommitment: false }] },
    },
    primary_2: {
      escalationText: "e2",
      tradeoffChoices: [{ id: "p2_t1", label: "x" }, { id: "p2_t2", label: "y" }],
      actionDecision: { prompt: "p2", choices: [{ id: "p2_a1", label: "x", isActionCommitment: true }, { id: "p2_a2", label: "y", isActionCommitment: false }] },
    },
  },
};

const FLAT: ArenaScenarioDraft = {
  title: "t",
  opening: "o",
  primary: { choices: [{ id: "primary_1", label: "A" }, { id: "primary_2", label: "B" }] },
  tradeoff: { escalationText: "esc", choices: [{ id: "t1", label: "x" }, { id: "t2", label: "y" }] },
  actionDecision: { prompt: "p", choices: [{ id: "a1", label: "x", isActionCommitment: true }, { id: "a2", label: "y", isActionCommitment: false }] },
};

describe("validateSelectedPath — branch-aware", () => {
  it("accepts a full valid path within one branch", () => {
    const r = validateSelectedPath(BRANCHED, { primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t2", actionChoiceId: "p1_a1" });
    expect(r).toEqual({ ok: true, value: { v: 1, primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t2", actionChoiceId: "p1_a1" } });
  });

  it("rejects an unknown primary", () => {
    expect(validateSelectedPath(BRANCHED, { primaryChoiceId: "nope" })).toMatchObject({ ok: false, reason: "unknown_primary" });
  });

  it("rejects a tradeoff from a DIFFERENT branch (cross-branch)", () => {
    // p2_t1 belongs to primary_2, not primary_1
    expect(validateSelectedPath(BRANCHED, { primaryChoiceId: "primary_1", tradeoffChoiceId: "p2_t1" })).toMatchObject({ ok: false, reason: "tradeoff_not_in_branch" });
  });

  it("rejects an action from a DIFFERENT branch", () => {
    expect(validateSelectedPath(BRANCHED, { primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t1", actionChoiceId: "p2_a1" })).toMatchObject({ ok: false, reason: "action_not_in_branch" });
  });

  it("rejects an action submitted before a tradeoff (phase order)", () => {
    expect(validateSelectedPath(BRANCHED, { primaryChoiceId: "primary_1", actionChoiceId: "p1_a1" })).toMatchObject({ ok: false, reason: "phase_order" });
  });

  it("requires a primary", () => {
    expect(validateSelectedPath(BRANCHED, {})).toMatchObject({ ok: false, reason: "primary_required" });
  });
});

describe("validateSelectedPath — legacy flat uses the shared continuation", () => {
  it("accepts shared tradeoff/action ids", () => {
    expect(validateSelectedPath(FLAT, { primaryChoiceId: "primary_1", tradeoffChoiceId: "t1", actionChoiceId: "a2" })).toMatchObject({ ok: true });
  });
});

describe("mergeSelectedPath — monotonic, primary fixed", () => {
  it("rejects a primary change mid-run", () => {
    const existing = { v: 1 as const, primaryChoiceId: "primary_1" };
    expect(mergeSelectedPath(existing, { v: 1, primaryChoiceId: "primary_2" })).toMatchObject({ ok: false, reason: "primary_changed" });
  });
  it("rejects dropping an already-recorded phase", () => {
    const existing = { v: 1 as const, primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t1" };
    expect(mergeSelectedPath(existing, { v: 1, primaryChoiceId: "primary_1" })).toMatchObject({ ok: false, reason: "phase_regression" });
  });
  it("accepts advancing the path", () => {
    const existing = { v: 1 as const, primaryChoiceId: "primary_1" };
    expect(mergeSelectedPath(existing, { v: 1, primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t1" })).toMatchObject({ ok: true });
  });
});

describe("coerceStoredPath", () => {
  it("accepts a valid stored object", () => {
    expect(coerceStoredPath({ v: 1, primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t1" })).toEqual({ v: 1, primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t1" });
  });
  it("rejects a wrong version / shape", () => {
    expect(coerceStoredPath({ v: 2, primaryChoiceId: "primary_1" })).toBeNull();
    expect(coerceStoredPath("nope")).toBeNull();
    expect(coerceStoredPath(null)).toBeNull();
  });
});
