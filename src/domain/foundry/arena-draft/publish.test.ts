import { describe, it, expect } from "vitest";
import { publishableSnapshot } from "./publish";
import type { ArenaScenarioDraft } from "./types";

function validDraft(over: Partial<ArenaScenarioDraft> = {}): ArenaScenarioDraft {
  return {
    title: "Speak up when a shortcut is proposed",
    opening: "A teammate proposes skipping a check to hit the deadline. What do you do?",
    primary: {
      choices: [
        { id: "primary_1", label: "Raise the risk directly" },
        { id: "primary_2", label: "Ask a question first" },
      ],
    },
    tradeoff: {
      escalationText: "Your manager backs the shortcut and time is nearly up.",
      choices: [
        { id: "tradeoff_1", label: "Hold your position" },
        { id: "tradeoff_2", label: "Defer to keep the peace" },
      ],
    },
    actionDecision: {
      prompt: "What will you actually do?",
      choices: [
        { id: "action_1", label: "Send the written objection now", isActionCommitment: true },
        { id: "action_2", label: "Wait and watch", isActionCommitment: false },
      ],
    },
    ...over,
  };
}

describe("publishableSnapshot", () => {
  it("accepts a valid three-phase scenario and returns a normalized snapshot", () => {
    const r = publishableSnapshot(validDraft({ title: "  trim me  " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.snapshot.title).toBe("trim me");
  });

  it("rejects a null scenario (nothing to publish)", () => {
    const r = publishableSnapshot(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("no_scenario_to_publish");
  });

  it("rejects a malformed scenario with the failing codes (never published as valid)", () => {
    const broken = validDraft();
    broken.actionDecision.choices = broken.actionDecision.choices.map((c) => ({ ...c, isActionCommitment: false }));
    const r = publishableSnapshot(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("no_action_commitment");
  });
});
