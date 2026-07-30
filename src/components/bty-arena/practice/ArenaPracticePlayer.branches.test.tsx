/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ArenaPracticePlayer } from "./ArenaPracticePlayer";
import type { ArenaScenarioDraft, ScenarioBranch } from "@/domain/foundry/arena-draft/types";

function branch(p: string, esc: string, actionPrompt: string): ScenarioBranch {
  return {
    escalationText: esc,
    tradeoffChoices: [{ id: `${p}_t1`, label: `${p} tradeoff one` }, { id: `${p}_t2`, label: `${p} tradeoff two` }],
    actionDecision: { prompt: actionPrompt, choices: [{ id: `${p}_a1`, label: `${p} act`, isActionCommitment: true }, { id: `${p}_a2`, label: `${p} narrow`, isActionCommitment: false }] },
  };
}

const BRANCHED: ArenaScenarioDraft = {
  title: "Branched",
  opening: "Opening.",
  primary: { choices: [{ id: "primary_1", label: "Choose ONE" }, { id: "primary_2", label: "Choose TWO" }] },
  tradeoff: { escalationText: "SHARED FLAT ESCALATION", choices: [{ id: "ft1", label: "f1" }, { id: "ft2", label: "f2" }] },
  actionDecision: { prompt: "shared prompt", choices: [{ id: "fa1", label: "f", isActionCommitment: true }, { id: "fa2", label: "g", isActionCommitment: false }] },
  branches: {
    primary_1: branch("p1", "BRANCH ONE ESCALATION", "BRANCH ONE ACTION"),
    primary_2: branch("p2", "BRANCH TWO ESCALATION", "BRANCH TWO ACTION"),
  },
};

afterEach(cleanup);

describe("ArenaPracticePlayer — per-primary branching", () => {
  it("Primary 1 renders ONLY branch 1's escalation; branch 2 text is absent", () => {
    render(<ArenaPracticePlayer scenario={BRANCHED} locale="en" mode="test" onExit={() => {}} />);
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Choose ONE"));
    expect(screen.getByText("BRANCH ONE ESCALATION")).toBeTruthy();
    expect(screen.queryByText("BRANCH TWO ESCALATION")).toBeNull();
    expect(screen.queryByText("SHARED FLAT ESCALATION")).toBeNull();
  });

  it("Primary 2 renders ONLY branch 2's continuation", () => {
    render(<ArenaPracticePlayer scenario={BRANCHED} locale="en" mode="test" onExit={() => {}} />);
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Choose TWO"));
    expect(screen.getByText("BRANCH TWO ESCALATION")).toBeTruthy();
    expect(screen.queryByText("BRANCH ONE ESCALATION")).toBeNull();
    // advance into branch 2's action decision
    fireEvent.click(screen.getByText("p2 tradeoff one"));
    expect(screen.getByText("BRANCH TWO ACTION")).toBeTruthy();
    expect(screen.queryByText("BRANCH ONE ACTION")).toBeNull();
  });

  it("writes the cumulative decision path via onPath (play mode)", () => {
    const onPath = vi.fn();
    render(<ArenaPracticePlayer scenario={BRANCHED} locale="en" mode="play" onExit={() => {}} onPath={onPath} onComplete={() => {}} />);
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Choose ONE"));
    expect(onPath).toHaveBeenLastCalledWith({ primaryChoiceId: "primary_1" });
    fireEvent.click(screen.getByText("p1 tradeoff two"));
    expect(onPath).toHaveBeenLastCalledWith({ primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t2" });
    fireEvent.click(screen.getByText("p1 act"));
    expect(onPath).toHaveBeenLastCalledWith({ primaryChoiceId: "primary_1", tradeoffChoiceId: "p1_t2", actionChoiceId: "p1_a1" });
  });

  it("restores the selected branch + phase from a stored path (reload)", () => {
    render(
      <ArenaPracticePlayer
        scenario={BRANCHED}
        locale="en"
        mode="play"
        onExit={() => {}}
        onComplete={() => {}}
        initialPath={{ v: 1, primaryChoiceId: "primary_2", tradeoffChoiceId: "p2_t1" }}
      />,
    );
    // Restored straight into branch 2's ACTION phase (no opening/primary re-shown).
    expect(screen.getByText("BRANCH TWO ACTION")).toBeTruthy();
    expect(screen.queryByText("Choose ONE")).toBeNull();
  });

  it("falls back safely to the opening when a stored path's primary no longer exists", () => {
    render(
      <ArenaPracticePlayer
        scenario={BRANCHED}
        locale="en"
        mode="play"
        onExit={() => {}}
        onComplete={() => {}}
        initialPath={{ v: 1, primaryChoiceId: "ghost" }}
      />,
    );
    expect(screen.getByText("Begin")).toBeTruthy();
  });

  it("legacy flat scenario still plays the shared continuation", () => {
    const flat: ArenaScenarioDraft = { ...BRANCHED };
    delete flat.branches;
    render(<ArenaPracticePlayer scenario={flat} locale="en" mode="test" onExit={() => {}} />);
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Choose ONE"));
    expect(screen.getByText("SHARED FLAT ESCALATION")).toBeTruthy();
  });
});
