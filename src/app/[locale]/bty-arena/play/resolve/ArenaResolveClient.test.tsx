/** @vitest-environment jsdom */
/**
 * ArenaResolveClient unit test (Stage 2 step 2 sub-phase 2C).
 *
 * Pins the Resolve surface behavior per v1.1 §5.3 / FD-6:
 * - ACTION_REQUIRED / ACTION_SUBMITTED / ACTION_AWAITING_VERIFICATION → render Action Gate
 * - NEXT_SCENARIO_READY / REEXPOSURE_DUE → render null + redirect to /play
 * - FORCED_RESET_PENDING → render null + redirect to Center forced-reset entry
 * - Fresh state (no gate snapshot) → render null + redirect to /play
 * - scenarioLoading → minimal placeholder (no redirect race)
 *
 * Component is mocked via {@link useArenaSession}; next/navigation is mocked so router.replace
 * is observable. Aligns with the snapshot-gates migration done in the same sub-phase.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ARENA_SESSION_MODE,
  type ArenaSessionRouterSnapshot,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

const mockUseArenaSession = vi.fn();
const mockRouterReplace = vi.fn();

vi.mock("../../hooks/useArenaSession", () => ({
  useArenaSession: () => mockUseArenaSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en/bty-arena/play/resolve",
}));

import ArenaResolveClient from "./ArenaResolveClient";

function baseSnapshot(rs: ArenaSessionRouterSnapshot["runtime_state"]): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: 90,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: false,
      id: null,
      status: null,
      verification_type: null,
      deadline_at: null,
    },
  };
}

function noop() {}

function sessionBase() {
  return {
    locale: "en" as const,
    t: {} as Record<string, string>,
    scenarioLoading: false,
    arenaRuntimeBanner: null,
    step: 5 as const,
    phase: "DONE" as const,
    runId: "run-resolve-1",
    pause: noop,
    resetRun: noop,
    arenaIdentity: { codeName: "X", subName: "Y" } as Record<string, unknown>,
    pendingActionContract: {
      id: "c1",
      action_text: "act",
      deadline_at: new Date().toISOString(),
      verification_type: "photo",
      created_at: new Date().toISOString(),
    },
    retryArenaSession: noop,
    startPendingContractQrFlow: noop,
    pendingContractQrLoading: false,
    toast: null as string | null,
    arenaServerSnapshot: null as ArenaSessionRouterSnapshot | null,
    effectiveArenaSnapshot: null as ArenaSessionRouterSnapshot | null,
  };
}

afterEach(() => {
  cleanup();
  mockUseArenaSession.mockReset();
  mockRouterReplace.mockReset();
});

describe("ArenaResolveClient — active Resolve states render Action Gate", () => {
  it("renders the action validation form for ACTION_REQUIRED", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("ACTION_REQUIRED"),
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-resolve-main-pending-contract")).toBeTruthy();
    // Canonical (MVP-FIX-ACTION-01): ACTION_REQUIRED gates on validation,
    // not the QR contract gate.
    expect(screen.getByTestId("arena-action-validation-form")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("renders ArenaPendingContractGate for ACTION_SUBMITTED", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("ACTION_SUBMITTED"),
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-resolve-main-pending-contract")).toBeTruthy();
    expect(screen.getByTestId("arena-pending-action-contract-gate")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("renders ArenaPendingContractGate for ACTION_AWAITING_VERIFICATION", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("ACTION_AWAITING_VERIFICATION"),
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-resolve-main-pending-contract")).toBeTruthy();
    expect(screen.getByTestId("arena-pending-action-contract-gate")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("prefers effectiveArenaSnapshot over arenaServerSnapshot when both present", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("NEXT_SCENARIO_READY"),
      effectiveArenaSnapshot: baseSnapshot("ACTION_REQUIRED"),
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-resolve-main-pending-contract")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});

describe("ArenaResolveClient — non-Resolve states redirect out", () => {
  it("redirects to /play and renders null on NEXT_SCENARIO_READY", async () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("NEXT_SCENARIO_READY"),
    });
    const { container } = render(<ArenaResolveClient locale="en" />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/en/bty-arena/play");
    });
    expect(screen.queryByTestId("arena-resolve-main-pending-contract")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("redirects to /play and renders null on REEXPOSURE_DUE (Play-mode flag per v1.1 FD-4)", async () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("REEXPOSURE_DUE"),
    });
    const { container } = render(<ArenaResolveClient locale="en" />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/en/bty-arena/play");
    });
    expect(container.firstChild).toBeNull();
  });

  it("redirects to Center forced-reset entry on FORCED_RESET_PENDING", async () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("FORCED_RESET_PENDING"),
    });
    render(<ArenaResolveClient locale="en" />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    });
    const target = mockRouterReplace.mock.calls[0]?.[0] as string;
    expect(target).toBe("/en/center");
    expect(target).not.toContain("/bty-arena/play");
  });
});

describe("ArenaResolveClient — locale flows through redirect target", () => {
  it("uses ko locale when prop is ko", async () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: baseSnapshot("NEXT_SCENARIO_READY"),
    });
    render(<ArenaResolveClient locale="ko" />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/ko/bty-arena/play");
    });
  });
});

describe("ArenaResolveClient — hydration / loading", () => {
  it("renders loading placeholder when scenarioLoading is true (no redirect race)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      scenarioLoading: true,
      arenaServerSnapshot: null,
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-resolve-loading")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
