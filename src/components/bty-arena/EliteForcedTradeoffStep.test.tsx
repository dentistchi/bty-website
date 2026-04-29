/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EliteForcedTradeoffStep } from "./EliteForcedTradeoffStep";

describe("EliteForcedTradeoffStep", () => {
  it("renders highlighted cost and optional protects/risks", () => {
    const onChoice = vi.fn();
    render(
      <EliteForcedTradeoffStep
        situationSectionTitle="Situation"
        escalationLine="Things got harder."
        decisionSectionTitle="Choose"
        secondChoices={[
          {
            id: "X",
            label: "Option X",
            cost: "You pay in clarity.",
            direction: "exit",
            protects: "Short-term relief",
            risks: "Long-term drift",
          },
        ]}
        costLabel="COST"
        protectsLabel="Protects"
        risksLabel="Risks"
        difficultyLevel={3}
        onChoice={onChoice}
      />,
    );
    expect(screen.getByTestId("elite-tradeoff-cost-X").textContent).toContain("You pay in clarity.");
    expect(screen.getByText("Short-term relief")).toBeTruthy();
    expect(screen.getByText("Long-term drift")).toBeTruthy();
    fireEvent.click(screen.getByTestId("elite-forced-tradeoff-X"));
    expect(onChoice).toHaveBeenCalledWith("X");
  });
});
