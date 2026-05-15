/** @vitest-environment jsdom */
/**
 * Nav suppression — Stage 2 step 4 sub-phase 2D.
 *
 * Tests the 2C-2 suppression of sibling navigation in `src/components/Nav.tsx`
 * during FORCED_RESET sub-mode (v1.1.1 §5.5.2 + §8-7). `useForcedResetActive`
 * is mocked so we drive the suppression branch directly; `useArenaEntryResolution`
 * is mocked to a stable default.
 *
 * Note: Nav.tsx currently has zero live consumers (defensive suppression added
 * for future-proofing per 2C-2). These tests guard the suppression contract.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseForcedResetActive = vi.fn();

vi.mock("@/components/bty/navigation/useForcedResetActive", () => ({
  useForcedResetActive: () => mockUseForcedResetActive(),
}));

vi.mock("@/lib/bty/arena/useArenaEntryResolution", () => ({
  useArenaEntryResolution: () => ({
    contract: { href: "/en/bty-arena", source: "default", surfaceKey: "lobby" },
    resolving: false,
  }),
}));

import { Nav } from "./Nav";

afterEach(() => {
  cleanup();
  mockUseForcedResetActive.mockReset();
});

describe("Nav — FORCED_RESET sub-mode suppression (v1.1.1 §5.5.2 + §8-7)", () => {
  it("renders Center, Foundry, Arena, and language toggle when forced-reset inactive", () => {
    mockUseForcedResetActive.mockReturnValue(false);
    render(<Nav locale="en" pathname="/en/center" />);
    expect(screen.getByLabelText("Go to Center")).toBeTruthy();
    expect(screen.getByLabelText("Go to Foundry")).toBeTruthy();
    expect(screen.getByLabelText("Go to Arena")).toBeTruthy();
    /** Language toggle is the sibling link (locale === en → "한국어" label). */
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("renders only the Center link when forced-reset active (Foundry / Arena / toggle suppressed)", () => {
    mockUseForcedResetActive.mockReturnValue(true);
    render(<Nav locale="en" pathname="/en/center" />);
    expect(screen.getByLabelText("Go to Center")).toBeTruthy();
    expect(screen.queryByLabelText("Go to Foundry")).toBeNull();
    expect(screen.queryByLabelText("Go to Arena")).toBeNull();
    /** Only Center remains. */
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("loading state (initial hook value = false) renders full nav (NOT-suppressed default)", () => {
    /** First render returns false from the hook — full nav visible until fetch resolves. */
    mockUseForcedResetActive.mockReturnValue(false);
    render(<Nav locale="en" pathname="/en/center" />);
    expect(screen.getByLabelText("Go to Foundry")).toBeTruthy();
    expect(screen.getByLabelText("Go to Arena")).toBeTruthy();
  });

  it("ko locale + forced-reset active → suppresses sibling nav (locale-agnostic suppression)", () => {
    mockUseForcedResetActive.mockReturnValue(true);
    render(<Nav locale="ko" pathname="/ko/center" />);
    expect(screen.getByLabelText("Center로 이동")).toBeTruthy();
    expect(screen.queryByLabelText("훈련장(Foundry)으로 이동")).toBeNull();
    expect(screen.queryByLabelText("아레나로 이동")).toBeNull();
  });
});
