/** @vitest-environment jsdom */
/**
 * ITEM 2 EDGE CASE — Resolve surface behavior when the snapshot is missing while
 * `arenaActionBlocking` is true (Stage 2 step 2 sub-phase 2C).
 *
 * **Behavior difference pinned for sub-phase 2D:**
 * - Old `BtyArenaRunPageClient` L988–1066 (still present in 2C) had a 3-way fallback:
 *   pendingContract → ArenaPendingContractGate / gateSnapshot → ArenaBlockedSurface /
 *   else → `arena-play-action-block-no-contract-payload` EmptyState. That EmptyState
 *   branch existed because BtyArenaRunPageClient kept rendering after entering the
 *   blocking branch — it had no early return to redirect away.
 * - New `ArenaResolveClient` (sub-phase 2B) collapses to a 2-way fallback. When
 *   `effectiveArenaSnapshot ?? arenaServerSnapshot` is null (or runtime_state is not
 *   ACTION_*), it early-returns `null` and the useEffect redirects to
 *   `/${locale}/bty-arena/play`. The EmptyState branch is **unreachable by design**.
 *
 * This test codifies the new behavior — `router.replace('/${locale}/bty-arena/play')`
 * is the intended outcome for the missing-snapshot edge case, not an accidental drop.
 * When sub-phase 2D removes BtyArenaRunPageClient L988–1066 along with the
 * `arena-play-action-block-no-contract-payload` testid, this test guarantees the
 * Resolve route still handles the edge case deliberately rather than crashing.
 *
 * Judgment call: codifying redirect-to-Play (not EmptyState preservation) per
 * dispatch — Commander direction. The fallback EmptyState was a safety net for a
 * logically impossible hook state (arenaActionBlocking true with null snapshot),
 * and the redirect-to-Play behavior is more semantically correct under v1.1 §4.3.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function noop() {}

function sessionBaseEdgeCase() {
  return {
    locale: "en" as const,
    t: {} as Record<string, string>,
    scenarioLoading: false,
    arenaRuntimeBanner: null,
    step: 5 as const,
    phase: "DONE" as const,
    runId: "run-resolve-edge-1",
    pause: noop,
    resetRun: noop,
    arenaIdentity: { codeName: "X", subName: "Y" } as Record<string, unknown>,
    /** Edge case core: blocking is asserted by hook but no contract payload arrived. */
    arenaActionBlocking: true,
    pendingActionContract: null as null,
    /** Edge case core: snapshot is missing on both sources. */
    arenaServerSnapshot: null,
    effectiveArenaSnapshot: null,
    retryArenaSession: noop,
    startPendingContractQrFlow: noop,
    pendingContractQrLoading: false,
    toast: null as string | null,
  };
}

afterEach(() => {
  cleanup();
  mockUseArenaSession.mockReset();
  mockRouterReplace.mockReset();
});

describe("ArenaResolveClient — ITEM 2 EmptyState edge case (arenaActionBlocking + null snapshot)", () => {
  it("renders null and redirects to /play (does NOT show legacy arena-play-action-block-no-contract-payload EmptyState)", async () => {
    mockUseArenaSession.mockReturnValue(sessionBaseEdgeCase());

    const { container } = render(<ArenaResolveClient locale="en" />);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/en/bty-arena/play");
    });

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("arena-resolve-main-pending-contract")).toBeNull();
    /** Legacy BtyArenaRunPageClient testid — 2D removes it; Resolve surface never emits it. */
    expect(screen.queryByTestId("arena-play-action-block-no-contract-payload")).toBeNull();
  });

  it("redirect target honors locale prop (ko)", async () => {
    mockUseArenaSession.mockReturnValue(sessionBaseEdgeCase());
    render(<ArenaResolveClient locale="ko" />);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith("/ko/bty-arena/play");
    });
  });

  it("does not redirect while scenarioLoading is true even with null snapshot (hydration guard)", () => {
    mockUseArenaSession.mockReturnValue({
      ...sessionBaseEdgeCase(),
      scenarioLoading: true,
    });
    render(<ArenaResolveClient locale="en" />);
    expect(screen.getByTestId("arena-resolve-loading")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
