import { describe, it, expect } from "vitest";
import { publishableSnapshot } from "./publish";
import type { ArenaScenarioDraft, ScenarioBranch } from "./types";

function branch(p: string): ScenarioBranch {
  return {
    resultingWorldState: `${p} world`,
    escalationText: `${p} escalation that raises the cost of this specific path`,
    tradeoffChoices: [
      { id: `${p}_t1`, label: "Hold to your approach and absorb the growing cost yourself" },
      { id: `${p}_t2`, label: "Change course now to limit the damage, accepting it undercuts your earlier call" },
    ],
    actionDecision: {
      prompt: "Decide what you will actually do now.",
      choices: [
        { id: `${p}_a1`, label: "Act now and own the fallout that follows", isActionCommitment: true },
        { id: `${p}_a2`, label: "Narrow the scope to what you can verify and act now, leaving the rest open", isActionCommitment: false },
      ],
    },
  };
}

const DRAFT: ArenaScenarioDraft = {
  title: "Owning a missed commitment",
  opening: "A realistic opening with two legitimate values in tension.",
  primary: { choices: [{ id: "primary_1", label: "Move now" }, { id: "primary_2", label: "Verify first" }] },
  tradeoff: { escalationText: "Shared fallback escalation.", choices: [{ id: "flat_t1", label: "x" }, { id: "flat_t2", label: "y" }] },
  actionDecision: { prompt: "p", choices: [{ id: "flat_a1", label: "x", isActionCommitment: true }, { id: "flat_a2", label: "y", isActionCommitment: false }] },
  branches: { primary_1: branch("p1"), primary_2: branch("p2") },
};

describe("publishableSnapshot — branches survive the publish round-trip", () => {
  it("preserves every branch (draft → snapshot), not flattened or stripped", () => {
    const r = publishableSnapshot(DRAFT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.branches).toBeDefined();
    expect(Object.keys(r.snapshot.branches!).sort()).toEqual(["primary_1", "primary_2"]);
    // Deep-equality on the branch content (trimmed but structurally identical).
    expect(r.snapshot.branches!.primary_1).toEqual(DRAFT.branches!.primary_1);
    expect(r.snapshot.branches!.primary_2.actionDecision.choices[0].id).toBe("p2_a1");
  });

  it("still publishes a legacy flat draft with no branches", () => {
    const flat: ArenaScenarioDraft = { ...DRAFT };
    delete flat.branches;
    const r = publishableSnapshot(flat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.branches).toBeUndefined();
  });
});
