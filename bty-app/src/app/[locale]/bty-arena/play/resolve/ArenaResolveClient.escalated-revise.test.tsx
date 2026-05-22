/** @vitest-environment jsdom */
/**
 * STAB-08 Scope C — escalated-revise branch on the Resolve surface.
 *
 * An escalated contract maps to runtime_state ACTION_SUBMITTED
 * (arenaRuntimeSnapshot.server.ts runtimeStateFromBlockingContract) but the
 * submit-validation route permits resubmit (route.ts §A-3). ArenaResolveClient
 * therefore surfaces the reused ArenaActionValidationForm — preceded by an
 * escalation notice — instead of dead-ending in ArenaPendingContractGate.
 *
 * The validation form is mocked here to capture the props the parent binds
 * (contract id) without driving its async submit; the form's own behavior is
 * pinned by its own concerns, and the real-form mount is covered by
 * ArenaResolveClient.test.tsx. The pending gate stays real (false-positive
 * guard). Server body compatibility for the escalated source is proven in the
 * inventory §C and submit-validation/route.test.ts.
 */
import { cleanup, render, screen } from "@testing-library/react";
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

// Capture the props the parent binds to the reused form; keep every other
// barrel export real (including the pending gate used by the guard test).
vi.mock("@/components/bty-arena", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/bty-arena")>();
  return {
    ...actual,
    ArenaActionValidationForm: ({
      contractId,
      locale,
    }: {
      contractId: string;
      locale: string;
    }) => (
      <div
        data-testid="arena-action-validation-form"
        data-contract-id={contractId}
        data-locale={locale}
      />
    ),
  };
});

import ArenaResolveClient from "./ArenaResolveClient";

function snapshotWithStatus(
  rs: ArenaSessionRouterSnapshot["runtime_state"],
  status: string | null,
): ArenaSessionRouterSnapshot {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: rs,
    state_priority: 95,
    gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
    action_contract: {
      exists: status != null,
      id: status != null ? "c1" : null,
      status,
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
    runId: "run-resolve-esc",
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
    setActionTerminalCompletion: noop,
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

describe("ArenaResolveClient — STAB-08 Scope C escalated-revise branch", () => {
  it("surfaces the validation form + escalation notice and binds the contract id for an escalated contract (ACTION_SUBMITTED)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: snapshotWithStatus("ACTION_SUBMITTED", "escalated"),
    });
    render(<ArenaResolveClient locale="en" />);
    // Form branch wins over the pending gate for escalated; notice precedes it.
    const form = screen.getByTestId("arena-action-validation-form");
    expect(form).toBeTruthy();
    expect(form.getAttribute("data-contract-id")).toBe("c1");
    expect(screen.getByTestId("arena-resolve-escalated-revise-notice")).toBeTruthy();
    expect(screen.queryByTestId("arena-pending-action-contract-gate")).toBeNull();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("does NOT show the escalation notice on the standard ACTION_REQUIRED path (regression guard)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: snapshotWithStatus("ACTION_REQUIRED", "pending"),
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-action-validation-form")).toBeTruthy();
    expect(screen.queryByTestId("arena-resolve-escalated-revise-notice")).toBeNull();
  });

  it("renders the pending gate (not the form) for a non-escalated ACTION_SUBMITTED contract (false-positive guard)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBase(),
      arenaServerSnapshot: snapshotWithStatus("ACTION_SUBMITTED", "submitted"),
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-pending-action-contract-gate")).toBeTruthy();
    expect(screen.queryByTestId("arena-action-validation-form")).toBeNull();
    expect(screen.queryByTestId("arena-resolve-escalated-revise-notice")).toBeNull();
  });
});
