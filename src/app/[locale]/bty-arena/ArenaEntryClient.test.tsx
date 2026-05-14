/** @vitest-environment jsdom */
/**
 * ArenaEntryClient unit tests — Stage 2 step 6 sub-phase 2C.
 *
 * Pins the Lobby surface behavior (per Commander D1-b 2026-05-14, v1.1.1 §5.6
 * spec correction landing in 2F):
 * - Default render is the mode-select gate (Full Arena / Quick Decision).
 * - When `runtime_state === "NEXT_SCENARIO_READY"`, the relocated 3 sub-branches
 *   render (covered by snapshot-gates P5 E migration tests).
 * - Fresh-state / null snapshot → mode-select gate (defensive).
 * - Mid-run-elite fall-through (`!nextUnlocked && midRunEliteNextReady`) → mode-select.
 * - Full Arena click clears `btyArenaState:v1` localStorage + navigates to /play.
 * - Continue click awaits `s.continueNextScenario()` then navigates to /play.
 *
 * P5 E migration (snapshot-gates.test.tsx) covers the canonical NEXT_SCENARIO_READY
 * render paths; this file pins the default-state edges + navigation handlers.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Scenario } from "@/lib/bty/scenario/types";
import {
  ARENA_SESSION_MODE,
  type ArenaSessionRouterSnapshot,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import { getMessages } from "@/lib/i18n";

const mockUseArenaSession = vi.fn();
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock("./hooks/useArenaSession", () => ({
  useArenaSession: () => mockUseArenaSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace, prefetch: vi.fn() }),
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en/bty-arena",
}));

import ArenaEntryClient from "./ArenaEntryClient";

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
  scenarioId: "lobby_elite_fixture",
  title: "T",
  context: "c",
  choices: [
    {
      choiceId: "A",
      label: "a",
      intent: "a",
      xpBase: 10,
      difficulty: 0.5,
      hiddenDelta: { integrity: 1 },
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
    t: getMessages("en").arenaRun,
    levelChecked: true,
    requiresBeginnerPath: false,
    scenarioLoading: false,
    scenarioInitError: null as string | null,
    scenario: null as Scenario | null,
    recallPrompt: null,
    arenaIdentity: { codeName: "X", subName: "Y" } as Record<string, unknown>,
    step: 1 as const,
    phase: "CHOOSING" as const,
    selectedChoiceId: null as string | null,
    choice: null,
    displayTitle: "",
    contextForUser: "",
    pendingActionContract: null,
    arenaServerSnapshot: null as ArenaSessionRouterSnapshot | null,
    effectiveArenaSnapshot: null as ArenaSessionRouterSnapshot | null,
    arenaActionBlocking: false,
    arenaPlaySurfaceAllowed: true,
    canRenderScenarioProgressionUi: true,
    playUiSegment: "none" as const,
    nextScenarioLoading: false,
    confirmingChoice: false,
    resetRunLoading: false,
    completeError: null as string | null,
    toast: null as string | null,
    milestoneModal: null,
    runId: null as string | null,
    pause: noop,
    resetRun: noop,
    retryArenaSession: noop,
    recoverStaleReexposureShell: noop,
    startPendingContractQrFlow: noop,
    pendingContractQrLoading: false,
    commitElitePrimaryChoice: async () => {},
    submitSecondChoice: noop,
    continueNextScenario: vi.fn().mockResolvedValue(undefined),
    closeMilestoneModal: noop,
    onRenameSubName: noop,
    secondChoiceSubmitting: false,
    bindingRuntimeSnapshot: null,
    playContext: "normal" as const,
    primaryChoiceInteractive: false,
    beginReexposurePlay: async () => {},
    reexposureEnterLoading: false,
    lastReexposureTransition: null,
    arenaRuntimeBanner: null,
  };
}

beforeEach(() => {
  if (typeof window !== "undefined") {
    localStorage.clear();
  }
});

afterEach(() => {
  cleanup();
  mockUseArenaSession.mockReset();
  mockRouterPush.mockReset();
  mockRouterReplace.mockReset();
});

describe("ArenaEntryClient — default mode-select gate (no NEXT_SCENARIO_READY)", () => {
  it("renders mode-select gate (Full Arena / Quick Decision) when snapshot is null (fresh-state safety)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: null,
      effectiveArenaSnapshot: null,
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByText("Full Arena")).toBeTruthy();
    expect(screen.getByText("Quick Decision")).toBeTruthy();
    /** No Lobby NEXT_SCENARIO_READY shell. */
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeNull();
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-blocked")).toBeNull();
    expect(screen.queryByTestId("arena-lobby-snapshot-reexposure")).toBeNull();
  });

  it("renders mode-select when runtime_state is ARENA_SCENARIO_READY (not NEXT_SCENARIO_READY)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("ARENA_SCENARIO_READY"),
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByText("Full Arena")).toBeTruthy();
    expect(screen.getByText("Quick Decision")).toBeTruthy();
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeNull();
  });

  it("renders mode-select when runtime_state is PRIMARY_CHOICE_ACTIVE (Play state — Lobby ignores)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("PRIMARY_CHOICE_ACTIVE"),
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByText("Full Arena")).toBeTruthy();
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeNull();
  });

  it("Korean locale renders KO mode-select gate copy", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: null,
    });
    render(<ArenaEntryClient locale="ko" />);
    expect(screen.getByText("어떻게 훈련하겠습니까?")).toBeTruthy();
    expect(screen.getByText("Full Arena")).toBeTruthy(); // English title, KO desc — matches prod copy
  });
});

describe("ArenaEntryClient — Full Arena click handler", () => {
  it("clears btyArenaState:v1 localStorage + navigates to /[locale]/bty-arena/play", () => {
    localStorage.setItem("btyArenaState:v1", "{\"some\":\"stale\"}");
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: null,
    });
    render(<ArenaEntryClient locale="en" />);
    fireEvent.click(screen.getByText("Full Arena"));
    expect(localStorage.getItem("btyArenaState:v1")).toBeNull();
    expect(mockRouterPush).toHaveBeenCalledWith("/en/bty-arena/play");
  });

  it("ko locale Full Arena → /ko/bty-arena/play", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: null,
    });
    render(<ArenaEntryClient locale="ko" />);
    fireEvent.click(screen.getByText("Full Arena"));
    expect(mockRouterPush).toHaveBeenCalledWith("/ko/bty-arena/play");
  });
});

describe("ArenaEntryClient — mid-run-elite fall-through to mode-select", () => {
  it("NEXT_SCENARIO_READY + !next_allowed + midRunEliteNextReady=true → falls through to mode-select (defensive)", () => {
    /**
     * gates.next_allowed=false + scenario.eliteSetup + runId + phase ∈ {DONE, ACTION_DECISION}
     * → nextUnlocked=false && midRunEliteNextReady=true → canonical CTA NOT rendered →
     * falls through past the NEXT_SCENARIO_READY guarded branch to mode-select gate.
     * Verifies the prod L181 fall-through comment ("Mid-run elite without next_allowed →
     * fall through to mode-select (defensive fresh-state).").
     */
    const nextReady = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
      gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
      action_contract: {
        exists: false,
        id: null,
        status: null,
        verification_type: null,
        deadline_at: null,
      },
      re_exposure: { due: false as const, scenario_id: null },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      scenario: eliteScenario,
      runId: "run-elite-mid",
      phase: "ACTION_DECISION" as const,
    });
    render(<ArenaEntryClient locale="en" />);
    /** Mode-select rendered (fall-through), NOT the Lobby NEXT_SCENARIO_READY shell. */
    expect(screen.getByText("Full Arena")).toBeTruthy();
    expect(screen.getByText("Quick Decision")).toBeTruthy();
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeNull();
    expect(screen.queryByTestId("arena-lobby-next-scenario-continue")).toBeNull();
  });
});

describe("ArenaEntryClient — Continue button navigation handler", () => {
  it("awaits s.continueNextScenario() then router.push to /[locale]/bty-arena/play", async () => {
    const mockContinue = vi.fn().mockResolvedValue(undefined);
    const nextReady = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
      gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
      action_contract: {
        exists: false,
        id: null,
        status: null,
        verification_type: null,
        deadline_at: null,
      },
      re_exposure: { due: false as const, scenario_id: null },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      continueNextScenario: mockContinue,
      nextScenarioLoading: false,
    });
    render(<ArenaEntryClient locale="en" />);
    const continueBtn = screen.getByTestId("arena-lobby-next-scenario-continue");
    fireEvent.click(continueBtn);
    await waitFor(() => {
      expect(mockContinue).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith("/en/bty-arena/play");
    });
  });

  it("ko locale Continue → /ko/bty-arena/play", async () => {
    const mockContinue = vi.fn().mockResolvedValue(undefined);
    const nextReady = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
      gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
      action_contract: {
        exists: false,
        id: null,
        status: null,
        verification_type: null,
        deadline_at: null,
      },
      re_exposure: { due: false as const, scenario_id: null },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      continueNextScenario: mockContinue,
    });
    render(<ArenaEntryClient locale="ko" />);
    fireEvent.click(screen.getByTestId("arena-lobby-next-scenario-continue"));
    await waitFor(() => {
      expect(mockContinue).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith("/ko/bty-arena/play");
    });
  });

  it("Continue button replaced by skeleton when nextScenarioLoading=true (no click target)", () => {
    const nextReady = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
      gates: { next_allowed: true, choice_allowed: false, qr_allowed: false },
      action_contract: {
        exists: false,
        id: null,
        status: null,
        verification_type: null,
        deadline_at: null,
      },
      re_exposure: { due: false as const, scenario_id: null },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      nextScenarioLoading: true,
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeTruthy();
    expect(screen.queryByTestId("arena-lobby-next-scenario-continue")).toBeNull();
  });
});
