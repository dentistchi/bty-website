/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseArenaSession = vi.fn();
const mockLoadScenario = vi.fn();

vi.mock("./hooks/useArenaSession", () => ({
  useArenaSession: () => mockUseArenaSession(),
}));

vi.mock("@/lib/bty/scenario/browserLoader", () => ({
  loadScenario: (...args: unknown[]) => mockLoadScenario(...args),
}));

import BtyArenaRunPageClient from "./BtyArenaRunPageClient";

const scenario = {
  scenarioId: "core_01_problem_framing",
  dbScenarioId: "INCIDENT-01-OWN-01",
  title: "Scenario",
  role: "Role",
  pressure: "Pressure",
  context: "Pressure",
  choices: [
    { id: "A", choiceId: "A", label: "Primary A" },
    { id: "B", choiceId: "B", label: "Primary B" },
    { id: "C", choiceId: "C", label: "Primary C" },
    { id: "D", choiceId: "D", label: "Primary D" },
  ],
  escalationBranches: {
    A: {
      escalation_text: "Escalation A",
      second_choices: [
        { id: "X", label: "Tradeoff X" },
        { id: "Y", label: "Tradeoff Y" },
      ],
      action_decision: {
        prompt: "Action decision",
        choices: [
          { id: "AD1", label: "Action AD1", meaning: { is_action_commitment: true } },
          { id: "AD2", label: "Action AD2", meaning: { is_action_commitment: false } },
        ],
      },
    },
    B: { escalation_text: "", second_choices: [], action_decision: { choices: [] } },
    C: { escalation_text: "", second_choices: [], action_decision: { choices: [] } },
    D: { escalation_text: "", second_choices: [], action_decision: { choices: [] } },
  },
};

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    locale: "en",
    t: { arenaRunPageMainRegionAria: "arena-main" },
    runId: "run-json-1",
    arenaServerSnapshot: null,
    effectiveArenaSnapshot: null,
    ...overrides,
  };
}

async function goToActionDecision() {
  await waitFor(() => expect(screen.getByTestId("json-primary-panel")).toBeTruthy());
  fireEvent.click(screen.getByTestId("json-primary-choice-A"));
  fireEvent.click(screen.getByTestId("json-tradeoff-choice-X"));
  await waitFor(() => expect(screen.getByTestId("json-action-decision-panel")).toBeTruthy());
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BTY_DEV_JSON_RUNTIME_TEST", "true");
  mockLoadScenario.mockResolvedValue(scenario);
  mockUseArenaSession.mockReturnValue(baseSession());
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ reExposureDueCandidate: false }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  mockUseArenaSession.mockReset();
  mockLoadScenario.mockReset();
});

describe("JSON runtime re-exposure promotion", () => {
  it("AD2 + reExposureDueCandidate=true shows REEXPOSURE_DUE surface", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ reExposureDueCandidate: true }),
      })),
    );
    render(<BtyArenaRunPageClient />);
    await goToActionDecision();
    fireEvent.click(screen.getByTestId("json-action-choice-AD2"));
    await waitFor(() => expect(screen.getByTestId("json-engine-reexposure-due")).toBeTruthy());
    expect(screen.queryByTestId("json-engine-next-scenario-ready")).toBeNull();
  });

  it("AD2 + reExposureDueCandidate=false keeps NEXT_SCENARIO_READY", async () => {
    render(<BtyArenaRunPageClient />);
    await goToActionDecision();
    fireEvent.click(screen.getByTestId("json-action-choice-AD2"));
    await waitFor(() => expect(screen.getByTestId("json-engine-next-scenario-ready")).toBeTruthy());
    expect(screen.queryByTestId("json-engine-reexposure-due")).toBeNull();
  });

  it("AD1 keeps ACTION_REQUIRED", async () => {
    render(<BtyArenaRunPageClient />);
    await goToActionDecision();
    fireEvent.click(screen.getByTestId("json-action-choice-AD1"));
    await waitFor(() => expect(screen.getByTestId("json-engine-action-required")).toBeTruthy());
    expect(screen.queryByTestId("json-engine-reexposure-due")).toBeNull();
  });

  it("blocks normal next scenario when REEXPOSURE_DUE is active", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ reExposureDueCandidate: true }),
      })),
    );
    render(<BtyArenaRunPageClient />);
    await goToActionDecision();
    fireEvent.click(screen.getByTestId("json-action-choice-AD2"));
    await waitFor(() =>
      expect(screen.getByTestId("json-placeholder-load-next-scenario-blocked-reexposure")).toBeTruthy(),
    );
    expect(screen.queryByTestId("json-placeholder-load-next-scenario")).toBeNull();
  });
});
