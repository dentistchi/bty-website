/** @vitest-environment jsdom */
/**
 * P5 — shell ordering across the Play / Resolve / Lobby routes.
 *
 * Sub-phase 2C migration:
 * - **P5 A / P5 D** (ACTION_REQUIRED / ACTION_SUBMITTED) render `ArenaResolveClient` directly
 *   per the Resolve route separation (Stage 2 step 2 sub-phase 2C, Q-2B-4).
 * - **P5 E** (NEXT_SCENARIO_READY) renders `ArenaEntryClient` directly per the D1-b decision
 *   (Stage 2 step 6 sub-phase 2C). Lobby (`/[locale]/bty-arena`) now owns NEXT_SCENARIO_READY
 *   rendering with `arena-lobby-snapshot-*` testids. A thin coexistence smoke at the end of
 *   P5 E confirms BtyArenaRunPageClient.tsx:1067-1167 still renders the legacy Play-side
 *   `arena-play-snapshot-*` testids during the 2B→2D window; 2D removes both the block and
 *   the smoke test.
 * - **P5 B / P5 C / P5 F** (forced reset / re-exposure / internal status copy) keep rendering
 *   BtyArenaRunPageClient — those shells still live on `/play`.
 *
 * Mocks {@link useArenaSession} only.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Scenario } from "@/lib/bty/scenario/types";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import type { ArenaSessionRouterSnapshot } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import { getMessages } from "@/lib/i18n";

const mockUseArenaSession = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock("./hooks/useArenaSession", () => ({
  useArenaSession: () => mockUseArenaSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush, prefetch: vi.fn() }),
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en/bty-arena/play/resolve",
}));

import BtyArenaRunPageClient from "./BtyArenaRunPageClient";
import ArenaResolveClient from "./play/resolve/ArenaResolveClient";
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
    recoverStaleReexposureShell: noop,
    startPendingContractQrFlow: noop,
    pendingContractQrLoading: false,
    commitElitePrimaryChoice: async () => {},
    submitSecondChoice: noop,
    continueNextScenario: noop,
    closeMilestoneModal: noop,
    onRenameSubName: noop,
    secondChoiceSubmitting: false,
    bindingRuntimeSnapshot: null,
    effectiveArenaSnapshot: null,
    playContext: "normal" as const,
    primaryChoiceInteractive: false,
    beginReexposurePlay: async () => {},
    reexposureEnterLoading: false,
    lastReexposureTransition: null,
    arenaRuntimeBanner: null,
  };
}

afterEach(() => {
  cleanup();
  mockUseArenaSession.mockReset();
  mockRouterReplace.mockReset();
  mockRouterPush.mockReset();
  vi.unstubAllGlobals();
});

/**
 * P5 A — Resolve route Action Gate (ACTION_REQUIRED).
 *
 * Sub-phase 2C migration: renders `ArenaResolveClient` directly (the new production
 * Resolve surface at `/play/resolve`). Before 2B these scenarios rendered through
 * BtyArenaRunPageClient and asserted `arena-play-main-pending-contract`; after 2B the
 * Resolve surface emits `arena-resolve-main-pending-contract`.
 */
describe("P5 A — blocking contract gate renders on Resolve route (ArenaResolveClient)", () => {
  it("renders Resolve pending-contract shell for ACTION_REQUIRED snapshot", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaActionBlocking: true,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      arenaServerSnapshot: baseSnapshot("ACTION_REQUIRED"),
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-resolve-main-pending-contract")).toBeTruthy();
    expect(screen.queryByTestId("arena-play-main")).toBeNull();
    expect(screen.queryByTestId("arena-play-snapshot-next-scenario-ready")).toBeNull();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("starts QR flow from ACTION_SUBMITTED gate without retry-session fetch path", () => {
    const onRetry = vi.fn();
    const onQr = vi.fn();
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaActionBlocking: true,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      arenaServerSnapshot: {
        ...baseSnapshot("ACTION_SUBMITTED"),
        gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
      },
      retryArenaSession: onRetry,
      startPendingContractQrFlow: onQr,
    });
    render(<ArenaResolveClient locale="en" />);
    const qrBtn = screen.getByTestId("arena-pending-contract-complete-by-qr");
    expect(qrBtn).toBeTruthy();
    (qrBtn as HTMLButtonElement).click();
    expect(onQr).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("provides refresh status CTA that triggers session refetch", () => {
    const onRetry = vi.fn();
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaActionBlocking: true,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      arenaServerSnapshot: {
        ...baseSnapshot("ACTION_SUBMITTED"),
        gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
      },
      retryArenaSession: onRetry,
    });
    render(<ArenaResolveClient locale="en" />);
    const refreshBtn = screen.getByTestId("arena-pending-contract-refresh-status");
    fireEvent.click(refreshBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
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

  it("keeps REEXPOSURE_DUE shell even when contract status is completed", () => {
    const rexWithCompletedContract = {
      ...baseSnapshot("REEXPOSURE_DUE"),
      action_contract: {
        exists: true,
        id: "ac-completed-1",
        status: "completed",
        verification_type: "hybrid",
        deadline_at: new Date().toISOString(),
      },
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p2" },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      scenario: eliteScenario,
      arenaServerSnapshot: rexWithCompletedContract,
      effectiveArenaSnapshot: rexWithCompletedContract,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
    });
    render(<BtyArenaRunPageClient />);
    expect(screen.getByTestId("arena-play-snapshot-reexposure")).toBeTruthy();
    expect(screen.getByTestId("arena-reexposure-panel")).toBeTruthy();
    expect(screen.queryByTestId("arena-play-main")).toBeNull();
  });

  it("renders REEXPOSURE_DUE shell from effective snapshot even when server snapshot is ready", () => {
    const rexFromBinding = {
      ...baseSnapshot("REEXPOSURE_DUE"),
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p3" },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("ARENA_SCENARIO_READY"),
      effectiveArenaSnapshot: rexFromBinding,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
    });
    render(<BtyArenaRunPageClient />);
    expect(screen.getByTestId("arena-play-snapshot-reexposure")).toBeTruthy();
    expect(screen.getByTestId("arena-reexposure-panel")).toBeTruthy();
    expect(screen.queryByTestId("arena-play-main")).toBeNull();
  });

  it("does not hijack loaded next scenario play when playContext is next_scenario", () => {
    const dueSnapshot = {
      ...baseSnapshot("REEXPOSURE_DUE"),
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p4" },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      playContext: "next_scenario" as const,
      arenaServerSnapshot: dueSnapshot,
      effectiveArenaSnapshot: dueSnapshot,
      arenaPlaySurfaceAllowed: true,
      canRenderScenarioProgressionUi: true,
      playUiSegment: "primary_choice" as const,
      phase: "CHOOSING" as const,
      step: 2 as const,
    });
    render(<BtyArenaRunPageClient />);
    expect(screen.queryByTestId("arena-play-snapshot-reexposure")).toBeNull();
    expect(screen.getByTestId("arena-play-main")).toBeTruthy();
  });

  it("does not render re-exposure panel when due is set but pending_outcome_id is missing", async () => {
    const recover = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, outcomes: [] }),
      }),
    );
    const stale = {
      ...baseSnapshot("REEXPOSURE_DUE"),
      re_exposure: { due: true as const, scenario_id: "core_01_training_system" },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      t: getMessages("en").arenaRun,
      scenario: null,
      arenaServerSnapshot: stale,
      effectiveArenaSnapshot: stale,
      arenaPlaySurfaceAllowed: false,
      recoverStaleReexposureShell: recover,
    });
    render(<BtyArenaRunPageClient />);
    await waitFor(() => expect(screen.getByTestId("arena-reexposure-stale-recovery")).toBeTruthy());
    expect(screen.queryByTestId("arena-play-snapshot-reexposure")).toBeNull();
    expect(screen.queryByTestId("arena-reexposure-panel")).toBeNull();
    await waitFor(() => expect(recover).toHaveBeenCalled());
  });
});

/**
 * P5 D — local DONE cannot beat server blocking. Migrated to ArenaResolveClient in 2C
 * (ACTION_SUBMITTED is a Resolve runtime state; the Action Gate now lives on `/play/resolve`).
 */
describe("P5 D — Resolve gate beats stale local DONE on ACTION_SUBMITTED (ArenaResolveClient)", () => {
  it("shows Resolve contract gate even if canRenderScenarioProgressionUi is true in mock (stale local)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaActionBlocking: true,
      /** Intentionally inconsistent: simulates stale client view — Resolve surface must still gate. */
      canRenderScenarioProgressionUi: true,
      arenaPlaySurfaceAllowed: false,
      arenaServerSnapshot: baseSnapshot("ACTION_SUBMITTED"),
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-resolve-main-pending-contract")).toBeTruthy();
    expect(screen.queryByTestId("arena-play-main")).toBeNull();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});

/**
 * P5 E — NEXT_SCENARIO_READY shell rules.
 *
 * Sub-phase 2C migration (Stage 2 step 6, D1-b): Lobby (`ArenaEntryClient`) now owns
 * NEXT_SCENARIO_READY rendering with `arena-lobby-snapshot-*` testids. These 7 tests
 * migrated from rendering `BtyArenaRunPageClient` + asserting `arena-play-snapshot-*`
 * (pre-2C) to rendering `ArenaEntryClient` + asserting `arena-lobby-snapshot-*`
 * (post-2C). A thin coexistence smoke after these 7 confirms BtyArenaRunPageClient
 * still emits the legacy testids during 2B→2D; 2D removes both the L1067-1167 Play
 * block and the smoke test together.
 */
describe("P5 E — NEXT_SCENARIO_READY defensive block rules (Lobby — ArenaEntryClient)", () => {
  it("renders NEXT_SCENARIO_READY shell when contract/re-exposure blockers are absent", () => {
    const nextReady = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
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
      t: getMessages("en").arenaRun,
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      arenaActionBlocking: false,
      scenario: null,
      runId: null,
      phase: "CHOOSING",
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeTruthy();
  });

  it("blocks NEXT_SCENARIO_READY when action contract is still pending (not submitted/approved/completed)", () => {
    const nextReady = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
      action_contract: {
        exists: true,
        id: "c1",
        status: "pending",
        verification_type: "hybrid",
        deadline_at: new Date().toISOString(),
      },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      t: getMessages("en").arenaRun,
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      arenaActionBlocking: false,
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByTestId("arena-lobby-snapshot-next-scenario-blocked")).toBeTruthy();
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeNull();
  });

  it("allows NEXT_SCENARIO_READY when contract is submitted (MVP progression after QR); Continue navigates to /play", async () => {
    const nextReady = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
      action_contract: {
        exists: true,
        id: "c1",
        status: "submitted",
        verification_type: "hybrid",
        deadline_at: new Date().toISOString(),
      },
    };
    const mockContinue = vi.fn().mockResolvedValue(undefined);
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      t: getMessages("en").arenaRun,
      scenario: null,
      runId: null,
      phase: "CHOOSING" as const,
      playUiSegment: "none" as const,
      canRenderScenarioProgressionUi: false,
      pendingActionContract: null,
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      arenaActionBlocking: false,
      nextScenarioLoading: false,
      continueNextScenario: mockContinue,
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeTruthy();
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-blocked")).toBeNull();
    const continueBtn = screen.getByTestId("arena-lobby-next-scenario-continue");
    expect(continueBtn).toBeTruthy();

    /** 2B-introduced navigation handoff: await continueNextScenario() → router.push to /play. */
    fireEvent.click(continueBtn);
    await waitFor(() => {
      expect(mockContinue).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith("/en/bty-arena/play");
    });
  });

  it("NEXT_SCENARIO_READY + next_allowed renders Lobby ready shell, not mode-select (elite mid-run state)", () => {
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
      t: getMessages("en").arenaRun,
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      arenaActionBlocking: false,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      playUiSegment: "action_decision" as const,
      phase: "ACTION_DECISION" as const,
      step: 5 as const,
      runId: "run-mid",
      scenario: eliteScenario,
      pendingActionContract: null,
      nextScenarioLoading: false,
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeTruthy();
    expect(screen.getByTestId("arena-lobby-next-scenario-continue")).toBeTruthy();
    /** Mode-select gate (default Lobby UI) must NOT appear when next-ready shell is active. */
    expect(screen.queryByText("Full Arena")).toBeNull();
    expect(screen.queryByText("Quick Decision")).toBeNull();
  });

  it("NEXT_SCENARIO_READY + next_allowed renders Lobby ready shell even with canRender false + stale local mismatch (phase=DONE)", () => {
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
      t: getMessages("en").arenaRun,
      arenaServerSnapshot: nextReady,
      effectiveArenaSnapshot: nextReady,
      arenaActionBlocking: false,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      playUiSegment: "none" as const,
      phase: "DONE" as const,
      step: 6 as const,
      runId: "run-1",
      scenario: eliteScenario,
      pendingActionContract: null,
      nextScenarioLoading: false,
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeTruthy();
    expect(screen.queryByText("Full Arena")).toBeNull();
  });

  it("renders re-exposure panel when NEXT_SCENARIO_READY still carries due re-exposure (precedence over canonical CTA)", () => {
    const nextReadyWithReexposure = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
      action_contract: {
        exists: true,
        id: "c1",
        status: "approved",
        verification_type: "hybrid",
        deadline_at: new Date().toISOString(),
      },
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p1" },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      t: getMessages("en").arenaRun,
      arenaServerSnapshot: nextReadyWithReexposure,
      effectiveArenaSnapshot: nextReadyWithReexposure,
      arenaActionBlocking: false,
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.getByTestId("arena-lobby-snapshot-reexposure")).toBeTruthy();
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeNull();
    expect(screen.queryByTestId("arena-lobby-snapshot-next-scenario-blocked")).toBeNull();
  });

  it("playContext === next_scenario + due re-exposure → next-scenario wins (re-exposure does NOT hijack)", () => {
    const nextReadyWithReexposure = {
      ...baseSnapshot("NEXT_SCENARIO_READY"),
      action_contract: {
        exists: false,
        id: null,
        status: null,
        verification_type: null,
        deadline_at: null,
      },
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p2" },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      t: getMessages("en").arenaRun,
      playContext: "next_scenario" as const,
      arenaServerSnapshot: nextReadyWithReexposure,
      effectiveArenaSnapshot: nextReadyWithReexposure,
      arenaActionBlocking: false,
      scenario: null,
      runId: null,
      phase: "CHOOSING",
    });
    render(<ArenaEntryClient locale="en" />);
    expect(screen.queryByTestId("arena-lobby-snapshot-reexposure")).toBeNull();
    expect(screen.getByTestId("arena-lobby-snapshot-next-scenario-ready")).toBeTruthy();
  });
});

/**
 * Coexistence smoke describe removed in Stage 2 step 6 sub-phase 2D — the L1067-1167
 * NEXT_SCENARIO_READY block in `BtyArenaRunPageClient.tsx` was removed in the same
 * commit, completing the 2C TASK 2 (a) lifecycle (smoke + block removed together).
 * NEXT_SCENARIO_READY now renders exclusively on Lobby via `ArenaEntryClient`; the
 * P5 E describe above is the canonical test pin.
 */

describe("P5 F — re-exposure internal status copy", () => {
  it("shows internal status copy when intervention sensitivity is up", () => {
    const rex = {
      ...baseSnapshot("REEXPOSURE_DUE"),
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p5" },
    };
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      t: getMessages("en").arenaRun,
      arenaServerSnapshot: rex,
      effectiveArenaSnapshot: rex,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      lastReexposureTransition: {
        next_runtime_state: "REEXPOSURE_DUE",
        re_exposure_clear_candidate: false,
        intervention_sensitivity_up: true,
      },
    });
    render(<BtyArenaRunPageClient />);
    expect(screen.getByTestId("arena-play-snapshot-reexposure")).toBeTruthy();
    expect(screen.getByTestId("arena-reexposure-internal-status")).toBeTruthy();
  });

  it("renders EN i18n internal status copy without raw counts", () => {
    const rex = {
      ...baseSnapshot("REEXPOSURE_DUE"),
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p6" },
    };
    const en = getMessages("en").arenaRun;
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      locale: "en",
      t: en,
      arenaServerSnapshot: rex,
      effectiveArenaSnapshot: rex,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      lastReexposureTransition: {
        next_runtime_state: "REEXPOSURE_DUE",
        re_exposure_clear_candidate: false,
        intervention_sensitivity_up: true,
      },
    });
    render(<BtyArenaRunPageClient />);
    const status = screen.getByTestId("arena-reexposure-internal-status");
    expect(status.textContent).toBe(en.arenaReexposureInternalStatusInterventionSensitivityUp);
    expect(status.textContent ?? "").not.toMatch(/\d/);
  });

  it("renders KO i18n internal status copy without raw counts", () => {
    const rex = {
      ...baseSnapshot("REEXPOSURE_DUE"),
      re_exposure: { due: true as const, scenario_id: "core_01_training_system", pending_outcome_id: "p7" },
    };
    const ko = getMessages("ko").arenaRun;
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      locale: "ko",
      t: ko,
      arenaServerSnapshot: rex,
      effectiveArenaSnapshot: rex,
      arenaPlaySurfaceAllowed: false,
      canRenderScenarioProgressionUi: false,
      lastReexposureTransition: {
        next_runtime_state: "REEXPOSURE_DUE",
        re_exposure_clear_candidate: false,
        intervention_sensitivity_up: true,
      },
    });
    render(<BtyArenaRunPageClient />);
    const status = screen.getByTestId("arena-reexposure-internal-status");
    expect(status.textContent).toBe(ko.arenaReexposureInternalStatusInterventionSensitivityUp);
    expect(status.textContent ?? "").not.toMatch(/\d/);
  });
});
