import { describe, it, expect } from "vitest";
import { parseArenaScenarioDraft } from "./validate";
import { publishableSnapshot } from "./publish";
import type { ArenaScenarioDraft } from "./types";
import type { PracticeBoundary } from "./boundary";

const BOUNDARY: PracticeBoundary = {
  mode: "judgment_with_constraints",
  confirmed: true,
  constraints: [{ id: "c1_verify", statement: "Verify identity before treatment", provenance: "manager_entered" }],
};

function draft(over: Partial<ArenaScenarioDraft> = {}): ArenaScenarioDraft {
  return {
    title: "t",
    opening: "A teammate flags a problem while the client waits.",
    primary: { choices: [{ id: "primary_1", label: "Raise it now" }, { id: "primary_2", label: "Verify first" }] },
    tradeoff: { escalationText: "e", choices: [{ id: "t1", label: "Tell the lead" }, { id: "t2", label: "Escalate" }] },
    actionDecision: { prompt: "p", choices: [{ id: "a1", label: "Act now", isActionCommitment: true }, { id: "a2", label: "Confirm first", isActionCommitment: false }] },
    ...over,
  };
}

describe("parseArenaScenarioDraft — practiceBoundary serialization (Slice 3.2I-R5A)", () => {
  it("preserves a valid practiceBoundary", () => {
    const r = parseArenaScenarioDraft(draft({ practiceBoundary: BOUNDARY }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.practiceBoundary).toEqual(BOUNDARY);
  });

  it("legacy draft with no boundary parses (undefined)", () => {
    const r = parseArenaScenarioDraft(draft());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.practiceBoundary).toBeUndefined();
  });

  it("FAILS CLOSED on a malformed PRESENT boundary (rejects — never reinterpreted as legacy)", () => {
    // Slice 3.2I-R5A.1: a present-but-malformed safety authority must reject the draft,
    // NOT be silently dropped and treated as a legacy (boundary-absent) draft.
    const bad = { ...draft(), practiceBoundary: { mode: "nope", confirmed: "yes", constraints: "x" } };
    const r = parseArenaScenarioDraft(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("boundary_invalid");
  });

  it("NEVER persists provider constraintAssessments or semantic-review output", () => {
    const withHidden = { ...draft({ practiceBoundary: BOUNDARY }), constraintAssessments: { primary_1: [{ constraintId: "c1_verify", status: "satisfied", rationale: "x" }] }, semanticReview: { ok: true } };
    const r = parseArenaScenarioDraft(withHidden);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.value as Record<string, unknown>).constraintAssessments).toBeUndefined();
      expect((r.value as Record<string, unknown>).semanticReview).toBeUndefined();
      expect(r.value.practiceBoundary).toEqual(BOUNDARY);
    }
  });
});

describe("publishableSnapshot — practiceBoundary round-trip", () => {
  it("preserves the boundary and branches into the published snapshot", () => {
    const branched = draft({
      practiceBoundary: BOUNDARY,
      branches: {
        primary_1: { escalationText: "b1", tradeoffChoices: [{ id: "p1_t1", label: "x" }, { id: "p1_t2", label: "y" }], actionDecision: { prompt: "p", choices: [{ id: "p1_a1", label: "x", isActionCommitment: true }, { id: "p1_a2", label: "y", isActionCommitment: false }] } },
        primary_2: { escalationText: "b2", tradeoffChoices: [{ id: "p2_t1", label: "x" }, { id: "p2_t2", label: "y" }], actionDecision: { prompt: "p", choices: [{ id: "p2_a1", label: "x", isActionCommitment: true }, { id: "p2_a2", label: "y", isActionCommitment: false }] } },
      },
    });
    const r = publishableSnapshot(branched);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.snapshot.practiceBoundary).toEqual(BOUNDARY);
      expect(Object.keys(r.snapshot.branches!)).toEqual(["primary_1", "primary_2"]);
    }
  });

  it("legacy flat snapshot has no boundary", () => {
    const r = publishableSnapshot(draft());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.snapshot.practiceBoundary).toBeUndefined();
  });
});
