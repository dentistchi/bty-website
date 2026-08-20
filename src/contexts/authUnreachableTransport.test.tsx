/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/**
 * R4-R4B-R1 — SILENCE IS NOT THE ONLY WAY TO GET NO ANSWER.
 *
 * R4-R4B-R1 bounded the boot read so a request that never settles becomes "we could not reach
 * BTY". But `fetchJson` CATCHES a transport failure and resolves `{ ok: false, status: 0 }` — a
 * value, not a rejection — so the far more common failures (no network, DNS, connection reset, a
 * 502 from the edge) never reached the bound at all. They fell to `AuthContext`'s generic catch,
 * which sets `user = null`: the app then states that a signed-in person has no session, on the
 * evidence that we could not ask.
 *
 * `status === 0` is `fetchJson`'s own sentinel for "the request never reached a server", and it is
 * set nowhere else. A 5xx is the server failing to answer rather than answering "no session".
 * Neither is a reply ABOUT the session, so neither may be read as one.
 */

const fetchJson = vi.fn();
vi.mock("@/lib/read-json", () => ({ fetchJson: (...a: unknown[]) => fetchJson(...a) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/start" }));
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
  const { user, loading, unreachable, error } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="unreachable">{String(unreachable)}</span>
      <span data-testid="user">{user ? "USER" : "none"}</span>
      <span data-testid="error">{error ?? "none"}</span>
    </div>
  );
}

beforeEach(() => fetchJson.mockReset());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function bootWith(reply: Record<string, unknown>) {
  fetchJson.mockResolvedValue(reply);
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
}

describe("R4-R4B-R1 · M3 · a failure to reach the server is not an answer about the session", () => {
  it("network unavailable (fetch threw → status 0) reports UNREACHABLE, not signed out", async () => {
    await bootWith({ ok: false, status: 0, raw: "Load failed" });
    expect(screen.getByTestId("unreachable").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(screen.getByTestId("error").textContent).toBe("none");
  });

  it("a 502 from the edge reports UNREACHABLE — the server never answered about the session", async () => {
    await bootWith({ ok: false, status: 502, raw: "Bad gateway" });
    expect(screen.getByTestId("unreachable").textContent).toBe("true");
    expect(screen.getByTestId("error").textContent).toBe("none");
  });

  it("a 500 reports UNREACHABLE too", async () => {
    await bootWith({ ok: false, status: 500, raw: "boom" });
    expect(screen.getByTestId("unreachable").textContent).toBe("true");
  });

  it("401 is a REAL answer — still signed out, still not unreachable", async () => {
    await bootWith({ ok: false, status: 401 });
    expect(screen.getByTestId("unreachable").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("200 with no session is a REAL answer — still signed out, still not unreachable", async () => {
    await bootWith({ ok: true, status: 200, json: { ok: false } });
    expect(screen.getByTestId("unreachable").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("a 400 stays an ordinary error — this repair does not swallow client faults", async () => {
    await bootWith({ ok: false, status: 400, raw: "bad request" });
    expect(screen.getByTestId("unreachable").textContent).toBe("false");
    expect(screen.getByTestId("error").textContent).toBe("bad request");
  });

  it("a real session still signs in normally", async () => {
    await bootWith({ ok: true, status: 200, json: { ok: true, user: { id: "u1" } } });
    expect(screen.getByTestId("unreachable").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("USER");
  });
});
