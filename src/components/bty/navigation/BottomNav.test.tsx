/** @vitest-environment jsdom */
/**
 * BottomNav suppression — Stage 2 step 4 sub-phase 2D.
 *
 * Tests the 2C-2 suppression in `src/components/bty/navigation/BottomNav.tsx`
 * during FORCED_RESET sub-mode (v1.1.1 §5.5.2 + §8-7). Covers:
 * - Forced-reset inactive → grid-cols-3 with Center / Arena / My Page tabs
 * - Forced-reset active → grid-cols-1 with only Center tab
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
  it("renders 3 tabs (Center / btyARENA / My Page) with grid-cols-3 when forced-reset inactive", () => {
    mockUseForcedResetActive.mockReturnValue(false);
    render(<BottomNav locale="en" />);
    expect(screen.getByText("Center")).toBeTruthy();
    expect(screen.getByText("btyARENA")).toBeTruthy();
    expect(screen.getByText("My Page")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(findGridContainer().className).toContain("grid-cols-3");
    expect(findGridContainer().className).not.toContain("grid-cols-1");
  });

  it("renders only Center tab with grid-cols-1 when forced-reset active (Arena + My Page suppressed)", () => {
    mockUseForcedResetActive.mockReturnValue(true);
    render(<BottomNav locale="en" />);
    expect(screen.getByText("Center")).toBeTruthy();
    expect(screen.queryByText("btyARENA")).toBeNull();
    expect(screen.queryByText("My Page")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(findGridContainer().className).toContain("grid-cols-1");
    expect(findGridContainer().className).not.toContain("grid-cols-3");
  });

  it("loading state renders 3 tabs (NOT-suppressed default; hook returns false initially)", () => {
    mockUseForcedResetActive.mockReturnValue(false);
    render(<BottomNav locale="en" />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(findGridContainer().className).toContain("grid-cols-3");
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
    expect(screen.queryByText("btyARENA")).toBeNull();
    expect(screen.queryByText("My Page")).toBeNull();
  });
});
