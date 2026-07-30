import { describe, it, expect } from "vitest";
import { parseArenaScenarioDraft, validateArenaScenarioDraft } from "./validate";
import { validateBranchedScenario } from "./quality";
import { isBranchAware, type ArenaScenarioDraft, type ScenarioBranch } from "./types";

/** A defensible branch (passes the difficult-choice gate in branch mode). `p` prefixes ids. */
function goodBranch(p: string, escalation: string): ScenarioBranch {
  return {
    resultingWorldState: `${p} world state`,
    escalationText: escalation,
    tradeoffChoices: [
      { id: `${p}_t1`, label: "Hold to your approach and absorb the growing cost yourself, accepting the exposure" },
      { id: `${p}_t2`, label: "Change course now to limit the damage, accepting that it undercuts your earlier call" },
    ],
    actionDecision: {
      prompt: "Decide what you will actually do now.",
      choices: [
        { id: `${p}_a1`, label: "Act now and own the fallout that follows", isActionCommitment: true },
        { id: `${p}_a2`, label: "Narrow the scope to what you can verify and act on that part, leaving the rest open", isActionCommitment: false },
      ],
    },
  };
}

function branchedDraft(branches: Record<string, ScenarioBranch>): ArenaScenarioDraft {
  return {
    title: "Owning a missed commitment",
    opening: "A realistic opening where two legitimate values pull against each other.",
    primary: {
      choices: [
        { id: "primary_1", label: "Move now and hold the standard, accepting you act on incomplete information" },
        { id: "primary_2", label: "Confirm the facts first, accepting the risk keeps running meanwhile" },
      ],
    },
    tradeoff: {
      escalationText: "The pressure tightens for everyone, whichever way you moved.",
      choices: [
        { id: "flat_t1", label: "Hold to your first approach and absorb the growing cost yourself" },
        { id: "flat_t2", label: "Change course now to limit the damage, accepting it undercuts your earlier call" },
      ],
    },
    actionDecision: {
      prompt: "Decide what you will actually do now.",
      choices: [
        { id: "flat_a1", label: "Commit to the action now and own the fallout that follows", isActionCommitment: true },
        { id: "flat_a2", label: "Narrow the scope to what you can verify and act now, leaving the rest open", isActionCommitment: false },
      ],
    },
    branches,
  };
}

const GOOD = branchedDraft({
  primary_1: goodBranch("p1", "You moved fast and held the line — but a gap in what you knew now surfaces."),
  primary_2: goodBranch("p2", "Your check confirmed the facts — but the risk you left running did visible damage."),
});

describe("validateArenaScenarioDraft — branch structure (fail-closed)", () => {
  it("accepts a valid branch-aware draft (one branch per primary)", () => {
    const r = validateArenaScenarioDraft(GOOD);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("rejects an orphan branch key (no matching primary)", () => {
    const bad = branchedDraft({
      primary_1: goodBranch("p1", "e1"),
      primary_2: goodBranch("p2", "e2"),
      primary_9: goodBranch("p9", "e9"), // orphan
    });
    expect(validateArenaScenarioDraft(bad).errors).toContain("branch_orphan_key");
  });

  it("rejects a missing branch (a primary without one)", () => {
    const bad = branchedDraft({ primary_1: goodBranch("p1", "e1") }); // primary_2 has no branch
    expect(validateArenaScenarioDraft(bad).errors).toContain("branch_missing");
  });

  it("rejects a structurally invalid branch (no action commitment)", () => {
    const b = goodBranch("p2", "e2");
    b.actionDecision.choices = b.actionDecision.choices.map((c) => ({ ...c, isActionCommitment: false }));
    const bad = branchedDraft({ primary_1: goodBranch("p1", "e1"), primary_2: b });
    expect(validateArenaScenarioDraft(bad).errors).toContain("branch_no_action_commitment");
  });

  it("rejects an empty branch escalation", () => {
    const b = goodBranch("p2", "");
    const bad = branchedDraft({ primary_1: goodBranch("p1", "e1"), primary_2: b });
    expect(validateArenaScenarioDraft(bad).errors).toContain("branch_missing_escalation");
  });

  it("rejects duplicate choice ids across branches (must be globally unique)", () => {
    const bad = branchedDraft({
      primary_1: goodBranch("dup", "e1"),
      primary_2: goodBranch("dup", "e2"), // same id prefix → colliding ids
    });
    expect(validateArenaScenarioDraft(bad).errors).toContain("duplicate_choice_id");
  });
});

describe("parseArenaScenarioDraft — PRESERVES branches (the historical flattening bug)", () => {
  it("round-trips branch content instead of stripping it", () => {
    const parsed = parseArenaScenarioDraft(GOOD);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(isBranchAware(parsed.value)).toBe(true);
    expect(Object.keys(parsed.value.branches!)).toEqual(["primary_1", "primary_2"]);
    expect(parsed.value.branches!.primary_1.tradeoffChoices.map((c) => c.id)).toEqual(["p1_t1", "p1_t2"]);
    expect(parsed.value.branches!.primary_2.actionDecision.choices[0].id).toBe("p2_a1");
  });

  it("leaves a legacy flat draft with no branches", () => {
    const flat = branchedDraft({ primary_1: goodBranch("p1", "e1"), primary_2: goodBranch("p2", "e2") });
    delete flat.branches;
    const parsed = parseArenaScenarioDraft(flat);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(isBranchAware(parsed.value)).toBe(false);
    expect(parsed.value.branches).toBeUndefined();
  });
});

describe("validateBranchedScenario — difficult-choice gate per branch", () => {
  it("passes a good branched scenario", () => {
    const r = validateBranchedScenario(GOOD);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails the WHOLE draft when a single branch has an obvious throwaway option", () => {
    const b = goodBranch("p2", "e2");
    b.tradeoffChoices[1] = { id: "p2_t2", label: "Do nothing and hope it resolves itself" };
    const bad = branchedDraft({ primary_1: goodBranch("p1", "e1"), primary_2: b });
    const r = validateBranchedScenario(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith("branch:primary_2:"))).toBe(true);
  });

  it("ALLOWS a branch-specific escalation that references its own primary's action (flat-only rule skipped)", () => {
    // "because you waited" would trip the flat branch_incoherent_escalation rule; in a
    // branch keyed to the verify-first primary it is legitimately coherent.
    const b = goodBranch("p2", "The risk you left running did visible damage because you waited to verify.");
    const draft = branchedDraft({ primary_1: goodBranch("p1", "e1"), primary_2: b });
    expect(validateBranchedScenario(draft).ok).toBe(true);
  });
});
