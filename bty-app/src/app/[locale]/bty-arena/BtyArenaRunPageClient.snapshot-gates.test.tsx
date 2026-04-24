/** @vitest-environment jsdom */
/**
 * P5 — BtyArenaRunPageClient shell ordering: contract / forced-reset / re-exposure / next-ready
 * beat local scenario progression. Mocks {@link useArenaSession} only.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Scenario } from "@/lib/bty/scenario/types";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import type { ArenaSessionRouterSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

const mockUseArenaSession = vi.fn();

vi.mock("./hooks/useArenaSession", () => ({
  useArenaSession: () => mockUseArenaSession(),
}));

import BtyArenaRunPageClient from "./BtyArenaRunPageClient";

function baseSnapshot(rs: ArenaSessionRouterSnapshot["runtime_state"]): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: 10,
    gates: { next_allowed: true, choice_allowed: true, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

const eliteScenario: Scenario = {
  scenarioId: "p5_elite",
  title: "T",
  context: "c",
  choices: [
    {
      choiceId: "A",
      label: "a",
      intent: "a",
      xpBase: 10,
      difficulty: 0.5,
      hiddenDelta: { integrity: 1, communication: 1 },
      result: "",
      microInsight: "",
    },
  ],
  coachNotes: { whatThisTrains: [], whyItMatters: "" },
  eliteSetup: { role: "r", pressure: "p", tradeoff: "t" },
};

function noop() {}

function sessionBase() {
  return {
    locale: "en" as const,
    t: {} as Record<string, string>,
    levelChecked: true,
    requiresBeginnerPath: false,
    scenarioLoading: false,
    scenarioInitError: null as string | null,
    scenario: eliteScenario,
    recallPrompt: null,
    arenaIdentity: { codeName: "X", subName: "Y" } as Record<string, unknown>,
    step: 5 as const,
    phase: "DONE" as const,
    selectedChoiceId: "A" as const,
    choice: eliteScenario.choices[0] ?? null,
    displayTitle: "T",
    contextForUser: "c",
    pendingActionContract: {
      id: "c1",
      action_text: "act",
      deadline_at: new Date().toISOString(),
      verification_type: "photo",
      created_at: new Date().toISOString(),
    },
    arenaServerSnapshot: baseSnapshot("ARENA_SCENARIO_READY"),
    arenaActionBlocking: false,
    arenaPlaySurfaceAllowed: true,
    canRenderScenarioProgressionUi: true,
    playUiSegment: "run_complete" as const,
    nextScenarioLoading: false,
    confirmingChoice: false,
    resetRunLoading: false,
    completeError: null as string | null,
    toast: null as string | null,
    milestoneModal: null,
    runId: "run-1",
    pause: noop,
    resetRun: noop,
    retryArenaSession: noop,
    commitElitePrimaryChoice: async () => {},
    submitSecondChoice: noop,
    continueNextScenario: noop,
    closeMilestoneModal: noop,
    onRenameSubName: noop,
    secondChoiceSubmitting: false,
    bindingRuntimeSnapshot: null,
    effectiveArenaSnapshot: null,
    primaryChoiceInteractive: false,
    beginReexposurePlay: async () => {},
    reexposureEnterLoading: false,
    arenaRuntimeBanner: null,
  };
}

afterEach(() => {
  cleanup();
  mockUseArenaSession.mockReset();
});

describe("P5 A — blocking contract gate renders; progression / next-scenario shells do not", () => {
  it("renders pending contract shell, not main play or next-scenario-ready", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaActionBlocking: true,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      arenaServerSnapshot: baseSnapshot("ACTION_REQUIRED"),
    });
    render(<BtyArenaRunPageClient />);
    expect(screen.getByTestId("arena-play-main-pending-contract")).toBeTruthy();
    expect(screen.queryByTestId("arena-play-main")).toBeNull();
    expect(screen.queryByTestId("arena-play-snapshot-next-scenario-ready")).toBeNull();
  });
});

describe("P5 B — forced reset shell (not Arena play main)", () => {
  it("renders forced-reset placeholder, not arena-play-main", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaActionBlocking: false,
      arenaServerSnapshot: baseSnapshot("FORCED_RESET_PENDING"),
    });
    render(<BtyArenaRunPageClient />);
    expect(screen.getByTestId("arena-play-snapshot-forced-reset")).toBeTruthy();
    expect(screen.queryByTestId("arena-play-main")).toBeNull();
  });
});

describe("P5 C — re-exposure shell beats progression", () => {
  it("renders re-exposure placeholder, not main play", () => {
    const rex = {
      ...baseSnapshot("REEXPOSURE_DUE"),
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p1" },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: rex,
      effectiveArenaSnapshot: rex,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
    });
    render(<BtyArenaRunPageClient />);
    expect(screen.getByTestId("arena-play-snapshot-reexposure")).toBeTruthy();
    expect(screen.getByTestId("arena-reexposure-panel")).toBeTruthy();
    expect(screen.queryByTestId("arena-play-main")).toBeNull();
  });
});

describe("P5 D — local DONE cannot beat server blocking (contract branch first)", () => {
  it("shows contract gate even if canRenderScenarioProgressionUi is true in mock (stale local)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaActionBlocking: true,
      /** Intentionally inconsistent: simulates stale client view — page must still gate. */
      canRenderScenarioProgressionUi: true,
      arenaPlaySurfaceAllowed: false,
      arenaServerSnapshot: baseSnapshot("ACTION_SUBMITTED"),
    });
    render(<BtyArenaRunPageClient />);
    expect(screen.getByTestId("arena-play-main-pending-contract")).toBeTruthy();
    expect(screen.queryByTestId("arena-play-main")).toBeNull();
  });
});
