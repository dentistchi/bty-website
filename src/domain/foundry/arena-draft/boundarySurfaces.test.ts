/**
 * CANONICAL DECISION-SURFACE MAP (Slice 3.2I-R5B1A.1-R2.29 Part 18 · SURFACE AUTHORITY).
 *
 * The server owns the coordinates. R2.28 measured four aggregate booleans standing in for fourteen
 * choices, and nothing at all standing in for the two resulting world states — so the count, the
 * order and the inclusion of both world states are all pinned here.
 */
import { describe, expect, it } from "vitest";
import {
  CANONICAL_SURFACE_COUNT,
  enumerateBoundarySurfaces,
  surfaceCoordinates,
  surfaceMapSha256,
  validateSurfaceMap,
} from "./boundarySurfaces";
import type { ArenaScenarioDraft } from "./types";

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

describe("canonical decision-surface map", () => {
  it("[1] enumerates exactly sixteen surfaces for the canonical generated shape", () => {
    const surfaces = enumerateBoundarySurfaces(draftFixture());
    expect(surfaces).toHaveLength(CANONICAL_SURFACE_COUNT);
    expect(CANONICAL_SURFACE_COUNT).toBe(16);
  });

  it("[2] produces a stable coordinate order — primary, flat, then each branch world-state first", () => {
    expect(surfaceCoordinates(enumerateBoundarySurfaces(draftFixture()))).toEqual([
      "primary[0]",
      "primary[1]",
      "flat_tradeoff[0]",
      "flat_tradeoff[1]",
      "flat_action[0]",
      "flat_action[1]",
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

  it("[2b] is deterministic — the same draft yields the same map and the same digest", () => {
    const a = enumerateBoundarySurfaces(draftFixture());
    const b = enumerateBoundarySurfaces(draftFixture());
    expect(surfaceMapSha256(a)).toBe(surfaceMapSha256(b));
  });

  it("[3] contains no duplicate coordinate", () => {
    const coords = surfaceCoordinates(enumerateBoundarySurfaces(draftFixture()));
    expect(new Set(coords).size).toBe(coords.length);
  });

  it("[4] includes EVERY branch resulting world state as a first-class surface", () => {
    const surfaces = enumerateBoundarySurfaces(draftFixture());
    const worlds = surfaces.filter((s) => s.kind === "resulting_world_state");
    expect(worlds.map((w) => w.coordinate)).toEqual(["branch[0].resulting_world_state", "branch[1].resulting_world_state"]);
    // The one R2.28 could not record: the state that asserts a patient was left unverified.
    expect(worlds[1]!.text).toContain("remains unverified");
    expect(worlds[1]!.selectedPrimaryLabel).toBe("Notify the families and proceed with one patient");
  });

  it("[5] changes the surface digest when any surface CONTENT mutates, even at the same coordinates", () => {
    const base = enumerateBoundarySurfaces(draftFixture());
    const mutated = draftFixture();
    mutated.branches!.p2!.resultingWorldState = "Both patients were verified before treatment.";
    const after = enumerateBoundarySurfaces(mutated);
    expect(surfaceCoordinates(after)).toEqual(surfaceCoordinates(base));
    expect(surfaceMapSha256(after)).not.toBe(surfaceMapSha256(base));
  });

  it("[5b] carries only boundary-relevant projection — no construction metadata leaks in", () => {
    const [primary] = enumerateBoundarySurfaces(draftFixture(), {
      p1: { legitimateValue: "safety", acceptedCost: "delay", competentIntent: "secret rationale", whyNotDominated: "secret" },
    });
    expect(primary!.acceptedCost).toBe("delay");
    expect(JSON.stringify(primary)).not.toContain("secret rationale");
    expect(Object.keys(primary!).sort()).toEqual(
      ["acceptedCost", "branchContext", "branchIndex", "coordinate", "index", "isActionCommitment", "kind", "phase", "selectedPrimaryLabel", "text"].sort(),
    );
  });

  it("marks the action-commitment surfaces, so a treatment commitment is visible to the reviewer", () => {
    const surfaces = enumerateBoundarySurfaces(draftFixture());
    expect(surfaces.filter((s) => s.isActionCommitment).map((s) => s.coordinate)).toEqual([
      "flat_action[0]",
      "branch[0].action[0]",
      "branch[1].action[0]",
    ]);
  });
});

describe("surface-map validation fails closed before a provider call", () => {
  it("rejects a cardinality mismatch", () => {
    const d = draftFixture();
    delete d.branches!.p2;
    const r = validateSurfaceMap(enumerateBoundarySurfaces(d));
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("surface_map_cardinality_mismatch");
  });

  it("falls back to the branch escalation when a draft states no resulting world state", () => {
    const d = draftFixture();
    d.branches!.p2!.resultingWorldState = "   ";
    const surfaces = enumerateBoundarySurfaces(d);
    expect(validateSurfaceMap(surfaces).ok).toBe(true);
    expect(surfaces.find((s) => s.coordinate === "branch[1].resulting_world_state")!.text).toBe(
      "The administrator pushes for an urgent process review.",
    );
  });

  it("rejects a branch with NO stated post-choice world at all, rather than asking the reviewer to judge nothing", () => {
    const d = draftFixture();
    d.branches!.p2!.resultingWorldState = "   ";
    d.branches!.p2!.escalationText = "";
    const r = validateSurfaceMap(enumerateBoundarySurfaces(d));
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("surface_map_missing_world_state");
  });

  it("rejects an empty choice label", () => {
    const d = draftFixture();
    d.primary.choices[1]!.label = "";
    const r = validateSurfaceMap(enumerateBoundarySurfaces(d));
    expect(r.ok).toBe(false);
    expect(r.codes).toContain("surface_map_empty_text");
  });

  it("accepts the canonical shape", () => {
    expect(validateSurfaceMap(enumerateBoundarySurfaces(draftFixture()))).toEqual({ ok: true, codes: [] });
  });
});
