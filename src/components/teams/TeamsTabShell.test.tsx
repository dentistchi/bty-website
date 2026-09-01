/** @vitest-environment jsdom */
/**
 * The Teams Personal Tab bootstrap (Slice A0).
 *
 * The claims: it bootstraps ONCE per tab load and never per render (the `/auth/v1/verify` budget
 * is 360/hour with bursts of 30, per IP, non-configurable, and every BTY call egresses from one
 * Worker); it stores NOTHING durable; a first-ever user is offered one user-initiated button
 * rather than an automatic popup; and throttling produces a calm retry instead of a fabricated
 * session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  getAuthToken: vi.fn(async () => "teams-entra-token"),
  getContext: vi.fn(async () => ({ app: { locale: "en-us" }, user: { loginHint: "f@b.example" } })),
  authenticate: vi.fn(async () => "ok"),
  openLink: vi.fn(async () => {}),
  setSession: vi.fn(async () => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(),
}));
const { initialize, getAuthToken, getContext, authenticate, setSession, onAuthStateChange } = H;

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize, getContext: H.getContext, openLink: H.openLink },
  authentication: {
    getAuthToken: H.getAuthToken,
    authenticate: H.authenticate,
    notifySuccess: vi.fn(),
    notifyFailure: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } }),
  supabase: { auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } },
}));

vi.mock("@/components/app-shell/BtyDailyAppShell", () => ({
  default: ({ locale }: { locale: string }) => <div data-testid="shell" data-locale={locale} />,
}));

import TeamsTabShell from "@/components/teams/TeamsTabShell";

const SESSION = { access_token: "supa-access", refresh_token: "supa-refresh" };
let bootstrapCalls: number;
/** Kept as a handle so the request itself can be asserted, not just its effects. */
let fetchSpy: ReturnType<typeof vi.fn>;

function stubFetch(responder: () => Response) {
  fetchSpy = vi.fn(async (url: unknown) => {
    if (String(url).includes("/api/auth/teams-bootstrap")) {
      bootstrapCalls += 1;
      return responder();
    }
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchSpy);
}

const ok = () =>
  new Response(JSON.stringify({ session: SESSION }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  bootstrapCalls = 0;
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL("https://arena.btydaily.com/teams"),
  });
  localStorage.clear();
  sessionStorage.clear();
  getAuthToken.mockResolvedValue("teams-entra-token");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TeamsTabShell — the silent path", () => {
  it("bootstraps once, sets the session, and renders the SAME shell", async () => {
    stubFetch(ok);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(bootstrapCalls).toBe(1);
    expect(setSession).toHaveBeenCalledWith({
      access_token: "supa-access",
      refresh_token: "supa-refresh",
    });
  });

  it("sends the Teams Entra token as the bootstrap's only authority", async () => {
    stubFetch(ok);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    const call = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("/api/auth/teams-bootstrap"),
    );
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer teams-entra-token");
    // No body at all — there is no field a client could supply that the server would trust.
    expect(init.body).toBeUndefined();
  });

  it("(8) does NOT mount the shell until setSession has COMPLETED", async () => {
    /*
      Ordering is the whole reason the shell's authenticated consumers work. Every one of them
      fetches on mount; if the shell mounted while setSession was still in flight, the bearer would
      not exist yet and each would 401 -- which is exactly the class of failure that produced an
      endless "Loading your week...".
    */
    let releaseSetSession: (() => void) | null = null;
    setSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSetSession = () => resolve({ data: {}, error: null });
        }),
    );
    stubFetch(ok);
    render(<TeamsTabShell />);

    // Bootstrap has returned a session and setSession is pending: the shell must NOT be mounted.
    await waitFor(() => expect(setSession).toHaveBeenCalled());
    expect(screen.queryByTestId("shell")).toBeNull();
    expect(screen.getByTestId("teams-tab-gate")).toBeTruthy();

    releaseSetSession!();
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
  });

  it("does NOT re-bootstrap on re-render — the verify budget is org-wide", async () => {
    stubFetch(ok);
    const { rerender } = render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    rerender(<TeamsTabShell />);
    rerender(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(bootstrapCalls).toBe(1);
  });

  it("writes NOTHING durable — a cold load must re-bootstrap from Teams", async () => {
    stubFetch(ok);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    expect(window.location.href).not.toContain("supa-access");
    expect(window.name).toBe("");
  });

  it("keeps the transport's bearer current across a Supabase refresh", async () => {
    stubFetch(ok);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(onAuthStateChange).toHaveBeenCalledTimes(1);
  });
});

describe("TeamsTabShell — a pre-bootstrap failure names its own step (A0-RUNTIME)", () => {
  /*
    Without this, a failure before the token exists sends NO request, and a live tail sees nothing
    -- indistinguishable from nobody having tapped. Each step reports itself, with no token.
  */
  function beacons() {
    return fetchSpy.mock.calls
      .map((c) => (c[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined)
      .map((h) => h?.["X-BTY-Teams-Client-Error"])
      .filter(Boolean);
  }

  it("reports get_auth_token when Teams refuses the token", async () => {
    stubFetch(ok);
    getAuthToken.mockRejectedValue(new Error("resource disabled"));
    render(<TeamsTabShell />);
    await waitFor(() =>
      expect(screen.getByTestId("teams-tab-gate").getAttribute("data-phase")).toBe("failed"),
    );
    expect(beacons()).toEqual(["get_auth_token"]);
  });

  it("reports app_initialize when the tab is not really inside Teams", async () => {
    stubFetch(ok);
    initialize.mockRejectedValue(new Error("not in teams"));
    render(<TeamsTabShell />);
    await waitFor(() =>
      expect(screen.getByTestId("teams-tab-gate").getAttribute("data-phase")).toBe("failed"),
    );
    expect(beacons()).toEqual(["app_initialize"]);
  });

  it("the beacon carries NO Authorization header and never a token", async () => {
    stubFetch(ok);
    getAuthToken.mockRejectedValue(new Error("nope"));
    render(<TeamsTabShell />);
    await waitFor(() =>
      expect(screen.getByTestId("teams-tab-gate").getAttribute("data-phase")).toBe("failed"),
    );
    const call = fetchSpy.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.headers &&
        ((c[1] as RequestInit).headers as Record<string, string>)["X-BTY-Teams-Client-Error"],
    );
    const headers = (call?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.stringify(call)).not.toContain("teams-entra-token");
  });

  it("sends NO beacon when the bootstrap is actually reached", async () => {
    stubFetch(ok);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(beacons()).toEqual([]);
  });
});

describe("TeamsTabShell — first-ever user", () => {
  it("offers ONE user-initiated button and opens no popup by itself", async () => {
    stubFetch(() =>
      new Response(JSON.stringify({ needsFirstSignIn: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("teams-first-sign-in")).toBeTruthy());
    // Microsoft's own guidance: an auto-opened auth popup gets blocked and confuses the person.
    expect(authenticate).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it("on tap, opens the popup at /teams/link and re-bootstraps afterwards", async () => {
    let first = true;
    stubFetch(() => {
      if (first) {
        first = false;
        return new Response(JSON.stringify({ needsFirstSignIn: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return ok();
    });
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("teams-first-sign-in")).toBeTruthy());
    fireEvent.click(screen.getByTestId("teams-first-sign-in"));
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://arena.btydaily.com/teams/link" }),
    );
    expect(bootstrapCalls).toBe(2);
  });
});

describe("TeamsTabShell — throttling and failure fail closed", () => {
  it("a 429 shows a calm retry state and never fabricates a session", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }));
    render(<TeamsTabShell />);
    await waitFor(() =>
      expect(screen.getByTestId("teams-tab-gate").getAttribute("data-phase")).toBe("retry"),
    );
    expect(setSession).not.toHaveBeenCalled();
    expect(screen.queryByTestId("shell")).toBeNull();
  });

  it("a non-retryable refusal shows a calm failed state with a manual retry", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "no" }), { status: 401 }));
    render(<TeamsTabShell />);
    await waitFor(() =>
      expect(screen.getByTestId("teams-tab-gate").getAttribute("data-phase")).toBe("failed"),
    );
    expect(screen.getByTestId("teams-retry")).toBeTruthy();
    expect(setSession).not.toHaveBeenCalled();
  });
});
