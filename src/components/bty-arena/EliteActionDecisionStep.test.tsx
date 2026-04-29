/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EliteActionDecisionStep } from "./EliteActionDecisionStep";
import type { ActionDecisionBlock } from "@/lib/bty/scenario/types";

describe("EliteActionDecisionStep", () => {
  const block: ActionDecisionBlock = {
    prompt: "Pick a path.",
    choices: [
      {
        id: "AD1",
        label: "Do the thing",
        meaning: { is_action_commitment: true },
      },
      {
        id: "AD2",
        label: "Wait",
        meaning: { is_action_commitment: false },
      },
    ],
  };

  it("renders commitment vs defer trait lists", () => {
    const onChoice = vi.fn();
    render(<EliteActionDecisionStep locale="en" block={block} onChoice={onChoice} />);
    expect(screen.getByTestId("elite-action-decision-kind-AD1").textContent).toContain("Observable action");
    expect(screen.getByTestId("elite-action-decision-traits-AD1")).toBeTruthy();
    expect(screen.getByTestId("elite-action-decision-kind-AD2").textContent).toContain("Delay / non-commitment");
    expect(screen.getByTestId("elite-action-decision-traits-AD2")).toBeTruthy();
    fireEvent.click(screen.getByTestId("elite-action-decision-AD1"));
    expect(onChoice).toHaveBeenCalledWith("AD1");
  });
});
