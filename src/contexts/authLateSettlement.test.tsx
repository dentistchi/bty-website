/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

/**
 * R4-R4B-R1 — A LATE ANSWER MUST NOT OVERWRITE A BOUND THAT ALREADY WON.
 *
 * `readWithBound` races the runner against a timeout, and a `fetch` that ignores its signal — or
 * one already past the point of cancellation — can still settle AFTERWARDS. By then the UI has
 * moved on: the launch is showing "Couldn't reach BTY" with a retry. If that abandoned invocation
 * could still write React state it would produce exactly the failures this slice exists to
 * prevent: the retry vanishing under the user's finger, `loading` restarting, or — worst — a
 * stale "no session" reply landing as a sign-out on someone who is signed in.
 *
 * The guarantee is STRUCTURAL and no production code was changed to obtain it:
 *
 *   1. `Promise.race` fixes its outcome at first settle. The loser's value is read by nobody, and
 *      because race attaches handlers to both, a later rejection is still handled — no unhandled
 *      rejection escapes.
 *   2. `refresh()` RETURNS immediately after `setUnreachable(true)`, so no statement later in that
 *      invocation can run when the late value eventually arrives.
 *   3. `sessionInflight` is cleared in the cached promise's `finally`, so a retry issues a genuinely
 *      new request rather than re-awaiting the abandoned one.
 *
 * These tests exist so a future edit cannot quietly remove any of the three.
 */

let resolveLate: ((v: unknown) => void) | null = null;
const fetchJson = vi.fn();

vi.mock("@/lib/read-json", () => ({ fetchJson: (...a: unknown[]) => fetchJson(...a) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/app" }));
vi.mock("@/lib/native/isNative", () => ({ isNative: () => false }));
vi.mock("@/lib/native/durableSession", () => ({
  restoreNativeSession: vi.fn(async () => false),
  syncNativeSessionFromClient: vi.fn(),
  storeNativeSession: vi.fn(),
  clearNativeSession: vi.fn(),
}));
vi.mock("@/components/foundry/event-rooms/proposalContinuity", () => ({ clearAllCachedProposals: vi.fn() }));

import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const { user, loading, unreachable } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="unreachable">{String(unreachable)}</span>
      <span data-testid="user">{user ? "USER" : "none"}</span>
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resolveLate = null;
  fetchJson.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A request that ignores cancellation entirely and settles only when we say so. */
function uncancellableRead() {
  fetchJson.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveLate = resolve;
      }),
  );
}

describe("R4-R4B-R1 · late settlement cannot mutate auth state", () => {
  it("the bound wins, and a LATE success does not clear unreachable, restore user or restart loading", async () => {
    uncancellableRead();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    // Let the bound expire.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000);
    });
    await waitFor(() => expect(screen.getByTestId("unreachable").textContent).toBe("true"));
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");

    // NOW the abandoned request finally answers — with a valid session, the most tempting case.
    await act(async () => {
      resolveLate?.({ ok: true, status: 200, json: { ok: true, user: { id: "u1", email: "a@b.c" } } });
      await vi.advanceTimersByTimeAsync(50);
    });

    // Nothing moved. The screen the person is looking at is still the one they can act on.
    expect(screen.getByTestId("unreachable").textContent).toBe("true");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("a LATE 'no session' reply cannot turn the timeout into a signed-out state", async () => {
    uncancellableRead();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000);
    });
    await waitFor(() => expect(screen.getByTestId("unreachable").textContent).toBe("true"));

    await act(async () => {
      // The exact shape that means "you have no session".
      resolveLate?.({ ok: false, status: 401, json: { ok: false } });
      await vi.advanceTimersByTimeAsync(50);
    });

    // Still "we don't know", never "you are signed out".
    expect(screen.getByTestId("unreachable").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("a LATE rejection does not surface as an error or escape unhandled", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    uncancellableRead();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000);
    });
    await waitFor(() => expect(screen.getByTestId("unreachable").textContent).toBe("true"));

    await act(async () => {
      resolveLate?.(Promise.reject(new Error("connection died, late")));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByTestId("unreachable").textContent).toBe("true");
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("the abandoned invocation never navigates", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/en/app", search: "", assign, href: "" },
    });
    uncancellableRead();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000);
    });
    await act(async () => {
      resolveLate?.({ ok: true, status: 200, json: { ok: true, user: { id: "u1" } } });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("R4-R4B-R1 · the three structural guarantees stay in place", () => {
  const AUTH = readFileSync("src/contexts/AuthContext.tsx", "utf8");
  const BOUND = readFileSync("src/lib/auth/boundedSessionRead.ts", "utf8");

  it("1 — the bound is a race, so the loser's value is read by nobody", () => {
    expect(BOUND).toContain("Promise.race");
  });

  it("2 — refresh() RETURNS on timeout, so nothing later in that invocation can run", () => {
    const branch = AUTH.slice(AUTH.indexOf("if (isAuthReadTimeout(e))"));
    const body = branch.slice(0, branch.indexOf("}") + 1);
    expect(body).toContain("setUnreachable(true)");
    expect(body).toContain("return;");
    // It must NOT fall through into the signed-out branch.
    expect(body).not.toContain("setUser(null)");
  });

  it("3 — the cached inflight promise is cleared, so a retry issues a NEW request", () => {
    const cached = AUTH.slice(AUTH.indexOf("sessionInflight = (async ()"), AUTH.indexOf("return sessionInflight;"));
    // The cached promise must clear itself on settle — timeout included — or Retry would re-await
    // the very request that already lost the race.
    expect(cached).toContain(".finally(");
    expect(cached).toContain("sessionInflight = null;");
  });

  it("a late settlement path cannot exist in the helper: it holds no state and no setter", () => {
    for (const forbidden of ["useState", "setUser", "setLoading", "setUnreachable", "location.assign"]) {
      expect(BOUND).not.toContain(forbidden);
    }
  });
});
