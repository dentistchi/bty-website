/** @vitest-environment jsdom */
/**
 * B2 launch destination — after the Orb hold, the door lands on /{locale}/app. Locale is read
 * from document.documentElement.lang (the same currentLocale() the push uses). OrbLiving is
 * stubbed to a button that fires onCommit, so the test isolates the destination from the
 * canvas/hold loop.
 *
 * THE WEB ASSERTION WAS INVERTED, DELIBERATELY (Slice R4-R4B-R1, found at the Founder gate).
 *
 * It used to require `/en/today` for web, pinning B2's platform split as contract. Two weeks
 * after B2, Slice 3.1B-3E.3 moved the canonical entry to the app shell — "canonical root +
 * bare-locale enter app shell, not legacy portal" — and this branch was never updated with it.
 * `/{locale}/today` is the legacy portal: the one call site in the repository that passes
 * `surface="navy"` to `ScreenShell`, wearing the 5-tab `BottomNav` whose other tabs cross into
 * that same shell's beige default. The old expectation was pinning the defect in place, so it
 * now states the rule instead: one door, one product. The platform branch is gone entirely.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));
const nativeState = vi.hoisted(() => ({ value: false }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));
vi.mock("@/components/orb/OrbLiving", () => ({
  default: ({ onCommit }: { onCommit: () => void }) => (
    <button data-testid="orb-door" onClick={() => onCommit()}>
      orb
    </button>
  ),
}));
vi.mock("@/components/bty-arena", () => ({
  PageLoadingFallback: () => <div>loading</div>,
}));
vi.mock("@/lib/native/isNative", () => ({
  isNative: () => nativeState.value,
}));

import StartShellClient from "./page.client";

beforeEach(() => {
  pushMock.mockClear();
  nativeState.value = false;
  document.documentElement.lang = "en";
});
afterEach(() => cleanup());

/** Render, wait past the 0.5s splash for the (stubbed) Orb, and commit the door once. */
async function holdDoor() {
  render(<StartShellClient />);
  const door = await screen.findByTestId("orb-door");
  fireEvent.click(door);
}

describe("B2 launch destination on /start", () => {
  it("native (BTYNative) → /{locale}/app", async () => {
    nativeState.value = true;
    await holdDoor();
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/en/app");
  });

  it("web (no BTYNative) → /{locale}/app — the SAME product, never the legacy portal", async () => {
    nativeState.value = false;
    await holdDoor();
    expect(pushMock).toHaveBeenCalledWith("/en/app");
    expect(pushMock).not.toHaveBeenCalledWith("/en/today");
  });

  it("reuses currentLocale() (document.lang) for interpolation", async () => {
    document.documentElement.lang = "ko";
    nativeState.value = true;
    await holdDoor();
    expect(pushMock).toHaveBeenCalledWith("/ko/app");
  });

  it("never routes to a bare /app", async () => {
    nativeState.value = true;
    await holdDoor();
    const arg = pushMock.mock.calls[0]?.[0];
    expect(arg).not.toBe("/app");
    expect(arg).toMatch(/^\/(en|ko)\/app$/);
  });
});
