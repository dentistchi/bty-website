/** @vitest-environment jsdom */
/**
 * HubTopNav suppression — Stage 2 step 4 sub-phase 2D.
 *
 * Tests the 2C-2 suppression in `src/components/bty/HubTopNav.tsx` for both
 * the `arena` theme branch and the `dear` theme branch (both must enforce
 * §8-7). Covers:
 * - Forced-reset inactive → all primary pills + sub-pills + divider + trailing
 * - Forced-reset active → only Center pill + trailing (LangSwitch + LogoutButton)
 *   stay; Arena + Foundry + sub-pills + divider hidden
 * - Both theme branches gated symmetrically
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

vi.mock("@/components/LangSwitch", () => ({
  LangSwitch: () => <span data-testid="lang-switch-stub">LANG</span>,
}));

import HubTopNav from "./HubTopNav";

afterEach(() => {
  cleanup();
  mockUseForcedResetActive.mockReset();
  mockPathname.mockReset();
  mockPathname.mockReturnValue("/en/center");
});

describe("HubTopNav — arena theme suppression (v1.1.1 §5.5.2 + §8-7)", () => {
  it("renders Center + Arena + Foundry pills + sub-pills + trailing when forced-reset inactive", () => {
    mockUseForcedResetActive.mockReturnValue(false);
    render(
      <HubTopNav theme="arena" trailing={<button type="button">LOGOUT_STUB</button>} />,
    );
    expect(screen.getByText("Center")).toBeTruthy();
    expect(screen.getByText("Arena")).toBeTruthy();
    expect(screen.getByText("Foundry")).toBeTruthy();
    /** Sub-pills */
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Leaderboard")).toBeTruthy();
    expect(screen.getByText("My Page")).toBeTruthy();
    expect(screen.getByText("My Account")).toBeTruthy();
    /** Trailing slot (e.g. LangSwitch + LogoutButton in real layout). */
    expect(screen.getByText("LOGOUT_STUB")).toBeTruthy();
  });

  it("renders only Center pill + trailing when forced-reset active (Arena/Foundry/sub-pills/divider suppressed)", () => {
    mockUseForcedResetActive.mockReturnValue(true);
    render(
      <HubTopNav theme="arena" trailing={<button type="button">LOGOUT_STUB</button>} />,
    );
    expect(screen.getByText("Center")).toBeTruthy();
    /** Sibling pills hidden. */
    expect(screen.queryByText("Arena")).toBeNull();
    expect(screen.queryByText("Foundry")).toBeNull();
    /** Sub-pills hidden. */
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText("Leaderboard")).toBeNull();
    expect(screen.queryByText("My Page")).toBeNull();
    expect(screen.queryByText("My Account")).toBeNull();
    /** trailing (LangSwitch + LogoutButton) MUST stay — language + security exempt per 2C-2 inventory. */
    expect(screen.getByText("LOGOUT_STUB")).toBeTruthy();
  });
});

describe("HubTopNav — dear theme suppression (symmetric with arena theme)", () => {
  it("renders Center + Arena + Foundry pills + sub-pills + LangSwitch when forced-reset inactive (showLangSwitch)", () => {
    mockUseForcedResetActive.mockReturnValue(false);
    render(<HubTopNav theme="dear" showLangSwitch />);
    expect(screen.getByText("Center")).toBeTruthy();
    expect(screen.getByText("Arena")).toBeTruthy();
    expect(screen.getByText("Foundry")).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Leaderboard")).toBeTruthy();
    expect(screen.getByTestId("lang-switch-stub")).toBeTruthy();
  });

  it("renders only Center pill + LangSwitch when forced-reset active (dear theme symmetric)", () => {
    mockUseForcedResetActive.mockReturnValue(true);
    render(<HubTopNav theme="dear" showLangSwitch />);
    expect(screen.getByText("Center")).toBeTruthy();
    expect(screen.queryByText("Arena")).toBeNull();
    expect(screen.queryByText("Foundry")).toBeNull();
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.queryByText("Leaderboard")).toBeNull();
    expect(screen.queryByText("My Page")).toBeNull();
    expect(screen.queryByText("My Account")).toBeNull();
    /** showLangSwitch keeps LangSwitch visible (locale flip, not surface escape). */
    expect(screen.getByTestId("lang-switch-stub")).toBeTruthy();
  });
});

describe("HubTopNav — loading state (NOT-suppressed default)", () => {
  it("renders full nav when hook returns false (loading / unauthenticated / open-on-failure)", () => {
    mockUseForcedResetActive.mockReturnValue(false);
    render(<HubTopNav theme="arena" />);
    expect(screen.getByText("Arena")).toBeTruthy();
    expect(screen.getByText("Foundry")).toBeTruthy();
  });
});
