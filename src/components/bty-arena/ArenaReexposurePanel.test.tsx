/** @vitest-environment jsdom */
/**
 * C5: Re-exposure gate surface is visible and primary CTA invokes entry (beginReexposurePlay wiring).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(onEnter).toHaveBeenCalledWith({
      pendingOutcomeId: "pending-c5-1",
      scenarioId: "core_01_training_system",
    });
  });

  it("enables Enter scenario from delayed no_change_reexposure fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            outcomes: [
              {
                pendingOutcomeId: "po-delayed-1",
                choiceTypeKey: "no_change_reexposure",
                titleKo: "재노출",
                titleEn: "Re-exposure round",
                bodyKo: "{\"scenario_id\":\"core_01_training_system_exposure\"}",
                bodyEn: "{\"scenario_id\":\"core_01_training_system_exposure\"}",
                title: "Re-exposure round",
                body: "{\"scenario_id\":\"core_01_training_system_exposure\"}",
                templateId: "no_change_reexposure",
                scheduledFor: new Date().toISOString(),
                choiceHistoryId: "hist-1",
              },
            ],
          }),
      }),
    );

    const onEnter = vi.fn();
    render(
      <ArenaReexposurePanel
        locale="en"
        reexposureScenarioId={null}
        pendingOutcomeId={null}
        onEnterScenario={onEnter}
        enterLoading={false}
      />,
    );

    const button = screen.getByRole("button", { name: /enter scenario/i });
    await waitFor(() => {
      expect(button.hasAttribute("disabled")).toBe(false);
    });
    fireEvent.click(button);
    expect(onEnter).toHaveBeenCalledWith({
      pendingOutcomeId: "po-delayed-1",
      scenarioId: "core_01_training_system_exposure",
    });
  });

  it("shows disabled reason when outcome context is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, outcomes: [] }),
      }),
    );

    render(
      <ArenaReexposurePanel
        locale="en"
        reexposureScenarioId={null}
        pendingOutcomeId={null}
        onEnterScenario={vi.fn()}
        enterLoading={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("reexposure-disabled-reason").textContent).toContain("missing_pending_outcome_id");
    });
  });

  it("enables Enter scenario from raw DB-shaped delayed outcome fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            outcomes: [
              {
                id: "po-raw-1",
                choiceTypeKey: "no_change_reexposure",
                title: "Re-exposure round",
                body: "raw-body",
                validation_payload: {
                  scenario_id: "core_02_new_doctor_reexposure_compromise_loop",
                },
              },
            ],
          }),
      }),
    );

    const onEnter = vi.fn();
    render(
      <ArenaReexposurePanel
        locale="en"
        reexposureScenarioId={null}
        pendingOutcomeId={null}
        onEnterScenario={onEnter}
        enterLoading={false}
      />,
    );

    const button = screen.getByRole("button", { name: /enter scenario/i });
    await waitFor(() => {
      expect(button.hasAttribute("disabled")).toBe(false);
    });
    fireEvent.click(button);
    expect(onEnter).toHaveBeenCalledWith({
      pendingOutcomeId: "po-raw-1",
      scenarioId: "core_02_new_doctor_reexposure_compromise_loop",
    });
  });

  it("shows loading reason while delayed outcomes request is pending", async () => {
    let resolveFetch: ((v: unknown) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    render(
      <ArenaReexposurePanel
        locale="en"
        reexposureScenarioId={null}
        pendingOutcomeId={null}
        onEnterScenario={vi.fn()}
        enterLoading={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("reexposure-disabled-reason").textContent).toContain("loading");
    });

    resolveFetch?.({
      ok: true,
      json: () => Promise.resolve({ ok: true, outcomes: [] }),
    });
  });
});
