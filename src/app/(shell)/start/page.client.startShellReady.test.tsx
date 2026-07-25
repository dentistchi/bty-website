/** @vitest-environment jsdom */
/**
 * StartShellClient — start-shell-ready hydration marker (Slice 3.1B-3N-5D.1C-N3).
 *
 * The native launch watchdog was force-reloading a healthy-but-slow cold start because its blank-page
 * predicate (empty body text/children) misfired at T+2s. This marker is the positive "web is alive"
 * progress signal: it is set the instant the client start shell hydrates — BEFORE auth resolves, the
 * splash, or the Orb — for BOTH the authenticated and the loading/redirecting (unauthenticated) paths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const authState = vi.hoisted(() => ({ value: { user: null as { id: string } | null, loading: true } }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState.value }));
vi.mock("@/components/orb/OrbLiving", () => ({ default: () => <div data-testid="orb" /> }));
vi.mock("@/components/bty-arena", () => ({ PageLoadingFallback: () => <div>loading</div> }));
vi.mock("@/lib/native/isNative", () => ({ isNative: () => false }));

import StartShellClient from "./page.client";

function readMarker() {
  return {
    ts: (window as unknown as { __btyStartShellReadyAt?: number }).__btyStartShellReadyAt,
    flag: document.documentElement.dataset.btyStartShellReady,
  };
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { __btyStartShellReadyAt?: number }).__btyStartShellReadyAt;
  delete document.documentElement.dataset.btyStartShellReady;
});
beforeEach(() => {
  delete (window as unknown as { __btyStartShellReadyAt?: number }).__btyStartShellReadyAt;
  delete document.documentElement.dataset.btyStartShellReady;
  authState.value = { user: null, loading: true };
});

describe("StartShellClient — start-shell-ready marker", () => {
  it("sets the hydration marker even while auth is still LOADING (pre-Orb, pre-redirect)", async () => {
    authState.value = { user: null, loading: true }; // renders StartNavySurface, no Orb
    render(<StartShellClient />);
    await waitFor(() => {
      const m = readMarker();
      expect(m.flag).toBe("1");
      expect(typeof m.ts).toBe("number");
    });
  });

  it("sets the marker for the authenticated startup too", async () => {
    authState.value = { user: { id: "u1" }, loading: false };
    render(<StartShellClient />);
    await waitFor(() => expect(document.documentElement.dataset.btyStartShellReady).toBe("1"));
  });

  it("clears the marker on true page unload (pagehide)", async () => {
    authState.value = { user: { id: "u1" }, loading: false };
    render(<StartShellClient />);
    await waitFor(() => expect(document.documentElement.dataset.btyStartShellReady).toBe("1"));
    window.dispatchEvent(new Event("pagehide"));
    expect(document.documentElement.dataset.btyStartShellReady).toBeUndefined();
  });
});
