/**
 * LEARNER-REACHABLE SURFACE MAP (Slice 3.2I-R5B1A.1-R2.30 Parts 1-3).
 *
 * Reachability is MEASURED from `ArenaPracticePlayer`, not inferred from the generated schema:
 * a branch-aware draft resolves `branches[selectedPrimaryId]`, so the flat continuation is never
 * rendered. These tests pin that fact, and pin that a missing resulting world state fails closed
 * instead of silently borrowing the escalation.
 */
import { describe, expect, it } from "vitest";
import {
  BRANCH_AWARE_REACHABLE_SURFACE_COUNT,
  FLAT_REACHABLE_SURFACE_COUNT,
  compatibilitySurfaces,
  enumerateBoundarySurfaces,
  lineageSha256,
  reviewableSurfaces,
  surfaceCoordinates,
  surfaceMapSha256,
  validateSurfaceMap,
} from "./boundarySurfaces";
import { isBranchAware, type ArenaScenarioDraft } from "./types";

const choice = (id: string, label: string) => ({ id, label });
const actionChoice = (id: string, label: string, commit: boolean) => ({ id, label, isActionCommitment: commit });

export function draftFixture(overrides: Partial<ArenaScenarioDraft> = {}): ArenaScenarioDraft {
  return {
    title: "Managing a Backed-Up Ward",
    opening: "You are a charge nurse and two patients need treatment.",
    primary: { choices: [choice("p1", "Verify identifiers for both patients now"), choice("p2", "Notify the families and proceed with one patient")] },
    tradeoff: {
      escalationText: "The administrator calls about the delays.",
      choices: [choice("ft1", "Explain the plan to the administrator"), choice("ft2", "Escalate by requesting additional staff")],
    },
    actionDecision: {
      prompt: "Choose how to proceed:",
      choices: [actionChoice("fa1", "Continue verification for both patients", true), actionChoice("fa2", "Proceed with treatment for the first patient only", false)],
    },
    branches: {
      p1: {
        resultingWorldState: "Both patients are verified and treated safely, but the ward is delayed.",
        escalationText: "The administrator requests a detailed report within the hour.",
        tradeoffChoices: [choice("p1-t1", "Prepare a detailed report"), choice("p1-t2", "Focus on patient care and delay the report")],
        actionDecision: {
          prompt: "Decide how to balance priorities:",
          choices: [actionChoice("p1-a1", "Finalize the report", true), actionChoice("p1-a2", "Continue prioritizing patient care", false)],
        },
      },
      p2: {
        resultingWorldState: "One patient was treated while the second patient remains unverified.",
        escalationText: "The administrator pushes for an urgent process review.",
        tradeoffChoices: [choice("p2-t1", "Prepare a summary of events"), choice("p2-t2", "Focus on caring for the second patient immediately")],
        actionDecision: {
          prompt: "Choose your next step:",
          choices: [actionChoice("p2-a1", "Finish the summary and send it", true), actionChoice("p2-a2", "Immediately treat the second patient", false)],
        },
      },
    },
    ...overrides,
  } as ArenaScenarioDraft;
}

/** A legacy snapshot with no branches — the ONLY shape in which the flat fields are rendered. */
export const flatDraftFixture = (): ArenaScenarioDraft => {
  const d = draftFixture();
  delete (d as { branches?: unknown }).branches;
  return d;
};

describe("[1][4] runtime reachability decides product authority", () => {
  it("a branch-aware draft yields TWELVE reachable surfaces and FOUR compatibility projections", () => {
    const all = enumerateBoundarySurfaces(draftFixture());
    expect(isBranchAware(draftFixture())).toBe(true);
    expect(reviewableSurfaces(all)).toHaveLength(BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
    expect(BRANCH_AWARE_REACHABLE_SURFACE_COUNT).toBe(12);
    expect(compatibilitySurfaces(all)).toHaveLength(4);
  });

  it("[5] the reachable coordinates are exactly the learner path, world states included", () => {
    expect(surfaceCoordinates(reviewableSurfaces(enumerateBoundarySurfaces(draftFixture())))).toEqual([
      "primary[0]",
      "primary[1]",
      "branch[0].resulting_world_state",
      "branch[0].tradeoff[0]",
      "branch[0].tradeoff[1]",
      "branch[0].action[0]",
      "branch[0].action[1]",
      "branch[1].resulting_world_state",
      "branch[1].tradeoff[0]",
      "branch[1].tradeoff[1]",
      "branch[1].action[0]",
      "branch[1].action[1]",
    ]);
  });

  it("[4] flat_tradeoff / flat_action are COMPATIBILITY PROJECTIONS for a branch-aware draft", () => {
    const flat = compatibilitySurfaces(enumerateBoundarySurfaces(draftFixture()));
    expect(flat.map((s) => s.coordinate)).toEqual(["flat_tradeoff[0]", "flat_tradeoff[1]", "flat_action[0]", "flat_action[1]"]);
    for (const s of flat) {
      expect(s.userReachable).toBe(false);
      expect(s.independentlySelectable).toBe(false);
      // Derivation linkage is retained as compatibility evidence, not discarded.
      expect(s.compatibilitySource).toMatch(/^branch\[\*\]\./);
    }
  });

  it("[12] a LEGACY flat draft renders the flat fields, so they become learner decisions", () => {
    const all = enumerateBoundarySurfaces(flatDraftFixture());
    expect(isBranchAware(flatDraftFixture())).toBe(false);
    expect(reviewableSurfaces(all)).toHaveLength(FLAT_REACHABLE_SURFACE_COUNT);
    expect(surfaceCoordinates(reviewableSurfaces(all))).toEqual([
      "primary[0]",
      "primary[1]",
      "flat_tradeoff[0]",
      "flat_tradeoff[1]",
      "flat_action[0]",
      "flat_action[1]",
    ]);
    expect(compatibilitySurfaces(all)).toHaveLength(0);
    // Reachability is COMPUTED, never hardcoded to twelve.
    expect(reviewableSurfaces(all).length).not.toBe(BRANCH_AWARE_REACHABLE_SURFACE_COUNT);
  });

  it("classifies the resulting world state as an asserted STATE, never a selectable decision", () => {
    const worlds = enumerateBoundarySurfaces(draftFixture()).filter((s) => s.kind === "resulting_world_state");
    expect(worlds).toHaveLength(2);
    for (const w of worlds) {
      expect(w.reachability).toBe("generated_state");
      expect(w.independentlySelectable).toBe(false);
      expect(w.userReachable).toBe(true);
    }
    expect(worlds[1]!.text).toContain("remains unverified");
  });
});

describe("[16] causal lineage", () => {
  it("gives every branch surface its world state and primary as ancestors, nearest-first", () => {
    const byRef = new Map(enumerateBoundarySurfaces(draftFixture()).map((s) => [s.coordinate, s]));
    expect(byRef.get("primary[1]")!.lineage).toEqual([]);
    expect(byRef.get("branch[1].resulting_world_state")!.lineage).toEqual(["primary[1]"]);
    expect(byRef.get("branch[1].action[1]")!.lineage).toEqual(["branch[1].resulting_world_state", "primary[1]"]);
    expect(byRef.get("branch[1].tradeoff[0]")!.parentPrimaryCoordinate).toBe("primary[1]");
  });

  it("carries the inherited world state onto every descendant, so a premise is quotable", () => {
    const a = enumerateBoundarySurfaces(draftFixture()).find((s) => s.coordinate === "branch[1].action[1]")!;
    expect(a.inheritedWorldState).toContain("remains unverified");
    expect(a.branchContext).toBe("The administrator pushes for an urgent process review.");
  });

  it("has its own digest, so a re-parented surface is detectable independently of content", () => {
    const base = enumerateBoundarySurfaces(draftFixture());
    expect(lineageSha256(base)).toBe(lineageSha256(enumerateBoundarySurfaces(draftFixture())));
    expect(lineageSha256(base)).not.toBe(lineageSha256(enumerateBoundarySurfaces(flatDraftFixture())));
  });
});

describe("[13][14] resulting-world-state authority — no silent fallback", () => {
  it("uses the stated resulting world state when present", () => {
    const w = enumerateBoundarySurfaces(draftFixture()).find((s) => s.coordinate === "branch[1].resulting_world_state")!;
    expect(w.text).toBe("One patient was treated while the second patient remains unverified.");
  });

  it("[13][14] NEVER substitutes the escalation — a missing world state fails closed", () => {
    const d = draftFixture();
    d.branches!.p2!.resultingWorldState = "   ";
    const surfaces = enumerateBoundarySurfaces(d);
    const w = surfaces.find((s) => s.coordinate === "branch[1].resulting_world_state")!;
    // The escalation is still CARRIED as context, but it is not promoted to the state.
    expect(w.text.trim()).toBe("");
    expect(w.branchContext).toBe("The administrator pushes for an urgent process review.");
    const r = validateSurfaceMap(surfaces, { branchAware: true });
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("boundary_world_state_missing");
  });

  it("the missing-world-state code is an AUTHORITY failure, not a boundary violation", () => {
    const d = draftFixture();
    delete d.branches!.p2!.resultingWorldState;
    const r = validateSurfaceMap(enumerateBoundarySurfaces(d), { branchAware: true });
    expect(r.codes).toEqual(["boundary_world_state_missing"]);
    expect(r.codes).not.toContain("choice_bypasses_boundary");
  });
});

describe("surface-map validation fails closed before a provider call", () => {
  it("accepts the canonical branch-aware shape", () => {
    expect(validateSurfaceMap(enumerateBoundarySurfaces(draftFixture()), { branchAware: true })).toEqual({ ok: true, codes: [] });
  });

  it("accepts the legacy flat shape at its own cardinality", () => {
    expect(validateSurfaceMap(enumerateBoundarySurfaces(flatDraftFixture()), { branchAware: false })).toEqual({ ok: true, codes: [] });
  });

  it("rejects a reachable cardinality mismatch", () => {
    const d = draftFixture();
    delete d.branches!.p2;
    const r = validateSurfaceMap(enumerateBoundarySurfaces(d), { branchAware: true });
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("surface_map_cardinality_mismatch");
  });

  it("rejects an empty reachable choice label", () => {
    const d = draftFixture();
    d.branches!.p2!.tradeoffChoices[0]!.label = "";
    const r = validateSurfaceMap(enumerateBoundarySurfaces(d), { branchAware: true });
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("surface_map_empty_text");
  });

  it("an empty COMPATIBILITY label never gates the product", () => {
    const d = draftFixture();
    d.tradeoff.choices[0]!.label = "";
    expect(validateSurfaceMap(enumerateBoundarySurfaces(d), { branchAware: true })).toEqual({ ok: true, codes: [] });
  });
});

describe("surface-map digest", () => {
  it("is deterministic", () => {
    expect(surfaceMapSha256(enumerateBoundarySurfaces(draftFixture()))).toBe(surfaceMapSha256(enumerateBoundarySurfaces(draftFixture())));
  });

  it("changes when surface CONTENT mutates at the same coordinates", () => {
    const base = surfaceMapSha256(enumerateBoundarySurfaces(draftFixture()));
    const mutated = draftFixture();
    mutated.branches!.p2!.resultingWorldState = "Both patients were verified before treatment.";
    expect(surfaceMapSha256(enumerateBoundarySurfaces(mutated))).not.toBe(base);
  });

  it("changes when REACHABILITY changes, even with identical text", () => {
    expect(surfaceMapSha256(enumerateBoundarySurfaces(flatDraftFixture()))).not.toBe(surfaceMapSha256(enumerateBoundarySurfaces(draftFixture())));
  });

  it("carries only boundary-relevant projection — no construction metadata leaks in", () => {
    const [primary] = enumerateBoundarySurfaces(draftFixture(), {
      p1: { legitimateValue: "safety", acceptedCost: "delay", competentIntent: "secret rationale" },
    });
    expect(primary!.acceptedCost).toBe("delay");
    expect(JSON.stringify(primary)).not.toContain("secret rationale");
  });
});
