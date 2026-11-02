/** @vitest-environment jsdom */
/**
 * BottomNav suppression — Stage 2 step 4 sub-phase 2D.
 *
 * Tests the 2C-2 suppression in `src/components/bty/navigation/BottomNav.tsx`
 * during FORCED_RESET sub-mode (v1.1.1 §5.5.2 + §8-7). Covers:
 * - Forced-reset inactive → five contained legacy tabs (Today / Center / Arena / Foundry / Me)
 * - Forced-reset active → grid-cols-1 with only Center tab; all other four suppressed
 * - Loading state → renders normally (NOT-suppressed default)
 * - `<nav>` element + aria-label preserved for a11y in both states
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseForcedResetActive = vi.fn();
const mockPathname = vi.fn(() => "/en/center");

vi.mock("@/components/bty/navigation/useForcedResetActive", () => ({
  useForcedResetActive: () => mockUseForcedResetActive(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

vi.mock("@/lib/bty/arena/useArenaEntryResolution", () => ({
  useArenaEntryResolution: () => ({
    contract: { href: "/en/bty-arena", source: "default", surfaceKey: "lobby" },
    resolving: false,
  }),
}));

import BottomNav from "./BottomNav";

afterEach(() => {
  cleanup();
  mockUseForcedResetActive.mockReset();
  mockPathname.mockReset();
  mockPathname.mockReturnValue("/en/center");
});

function findGridContainer(): HTMLElement {
  const navEl = screen.getByRole("navigation", { name: /Main navigation/i });
  /** Direct child div carries the grid-cols class. */
  const grid = navEl.querySelector(":scope > div");
  if (!(grid instanceof HTMLElement)) throw new Error("grid container not found");
  return grid;
}

describe("BottomNav — FORCED_RESET sub-mode suppression (v1.1.1 §5.5.2 + §8-7)", () => {
  it("renders the current five contained legacy tabs with grid-cols-5 when forced-reset inactive", () => {
    mockUseForcedResetActive.mockReturnValue(false);
    render(<BottomNav locale="en" />);
    expect(screen.getByText("Center")).toBeTruthy();
    expect(screen.getByText("Arena")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Foundry")).toBeTruthy();
    expect(screen.getByText("Me")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(findGridContainer().className).toContain("grid-cols-5");
    expect(findGridContainer().className).not.toContain("grid-cols-1");
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([
      "/en/today", "/en/center", "/en/bty-arena", "/en/bty/foundry", "/en/my-page",
    ]);
  });

  it("renders only Center tab with grid-cols-1 when forced-reset active (all other routes suppressed)", () => {
    mockUseForcedResetActive.mockReturnValue(true);
    render(<BottomNav locale="en" />);
    expect(screen.getByText("Center")).toBeTruthy();
    expect(screen.queryByText("Arena")).toBeNull();
    expect(screen.queryByText("Me")).toBeNull();
    expect(screen.queryByText("Today")).toBeNull();
    expect(screen.queryByText("Foundry")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(findGridContainer().className).toContain("grid-cols-1");
    expect(findGridContainer().className).not.toContain("grid-cols-5");
  });

  it("loading state renders five legacy tabs (NOT-suppressed default; hook returns false initially)", () => {
    mockUseForcedResetActive.mockReturnValue(false);
    render(<BottomNav locale="en" />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(findGridContainer().className).toContain("grid-cols-5");
  });

  it("preserves <nav> element + aria-label in suppressed state (a11y)", () => {
    mockUseForcedResetActive.mockReturnValue(true);
    render(<BottomNav locale="en" />);
    expect(screen.getByRole("navigation", { name: /Main navigation/i })).toBeTruthy();
  });

  it("ko locale + forced-reset active → suppression locale-agnostic, only Center tab", () => {
    mockUseForcedResetActive.mockReturnValue(true);
    mockPathname.mockReturnValue("/ko/center");
    render(<BottomNav locale="ko" />);
    expect(screen.getByText("Center")).toBeTruthy();
    expect(screen.queryByText("Arena")).toBeNull();
    expect(screen.queryByText("Me")).toBeNull();
    expect(screen.queryByText("Today")).toBeNull();
    expect(screen.queryByText("Foundry")).toBeNull();
  });
});
