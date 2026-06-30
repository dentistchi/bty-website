/** @vitest-environment jsdom */
/**
 * D5 Orb entry — handleCommit navigate-once.
 *
 * The Orb is stubbed to expose `onCommit` as a button so the test isolates the
 * today-side navigate-once guard (navigatedRef) from the rAF gather loop. Two
 * commit invocations must yield exactly ONE router.push, and the Day-0 hint
 * flag must be persisted on first commit.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, prefetchMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  prefetchMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: pushMock, prefetch: prefetchMock }),
}));

// Entry resolution authority — settled, non-default href (reused as beginHref).
vi.mock("@/lib/bty/arena/useArenaEntryResolution", () => ({
  useArenaEntryResolution: () => ({ contract: { href: "/en/bty-arena" }, resolving: false }),
}));

// Stub the Orb: surface onCommit as a clickable button (gather loop not exercised here).
vi.mock("@/components/orb/Orb", () => ({
  Orb: (props: { onCommit?: () => void; ariaLabel?: string }) => (
    <button type="button" data-testid="orb-commit" onClick={() => props.onCommit?.()}>
      {props.ariaLabel}
    </button>
  ),
}));

// Layout/data chrome — render-through / inert so the test isolates the CTA wiring.
vi.mock("@/components/bty/layout/ScreenShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/bty/ui/InfoCard", () => ({
  InfoCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/bty-arena", () => ({
  CardSkeleton: () => null,
  AvatarComposite: () => null,
  UserAvatar: () => null,
}));
vi.mock("@/lib/bty/arena/avatarCharacters", () => ({ getAvatarCharacter: () => undefined }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: { user_metadata: {} } } }) } },
}));
vi.mock("@/lib/http/arenaFetch", () => ({
  // All five tiles resolve empty; each call-site has its own .catch fallback.
  arenaFetch: vi.fn().mockResolvedValue({}),
}));

import TodayHomeClient from "./page.client";

const store: Record<string, string> = {};

beforeEach(() => {
  pushMock.mockClear();
  prefetchMock.mockClear();
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete store[k];
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TodayHomeClient — handleCommit navigate-once", () => {
  it("two commits → exactly one router.push(beginHref); hint flag persisted", async () => {
    render(<TodayHomeClient />);
    // Wait past the async load() so the non-loading branch (Orb) mounts.
    const orb = await waitFor(() => screen.getByTestId("orb-commit"));

    await act(async () => {
      fireEvent.click(orb); // commit
      fireEvent.click(orb); // re-press / double-commit attempt
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/en/bty-arena");
    // Day-0 one-time hint cleared on first successful begin.
    expect(store["btyOrbHintSeen:v1"]).toBe("1");
  });

  it("prefetches the resolved destination once entry resolution settles", async () => {
    render(<TodayHomeClient />);
    await waitFor(() => screen.getByTestId("orb-commit"));
    expect(prefetchMock).toHaveBeenCalledWith("/en/bty-arena");
  });
});
