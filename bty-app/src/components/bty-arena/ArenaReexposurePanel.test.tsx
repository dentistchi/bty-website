/** @vitest-environment jsdom */
/**
 * C5: Re-exposure gate surface is visible and primary CTA invokes entry (beginReexposurePlay wiring).
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArenaReexposurePanel } from "./ArenaReexposurePanel";

describe("ArenaReexposurePanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders and calls onEnterScenario with scenario + pending ids present on the panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, outcomes: [] }),
      }),
    );

    const onEnter = vi.fn();
    render(
      <ArenaReexposurePanel
        locale="en"
        reexposureScenarioId="core_01_training_system"
        pendingOutcomeId="pending-c5-1"
        onEnterScenario={onEnter}
        enterLoading={false}
      />,
    );

    expect(screen.getByTestId("arena-reexposure-panel")).toBeTruthy();
    const panel = screen.getByTestId("arena-reexposure-panel");
    expect(panel.getAttribute("data-arena-pending-outcome-id")).toBe("pending-c5-1");

    fireEvent.click(screen.getByRole("button"));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
