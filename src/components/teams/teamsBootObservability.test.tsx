/** @vitest-environment jsdom */
/**
 * Slice B — Teams boot observability + host handshake.
 *
 * Three claims: no await can hang forever, the host is told when the tab is genuinely ready, and
 * whatever happens becomes attributable to one stage. The stage timeline is asserted through the
 * request BODY, because that is the thing that now survives the request — the header alone reached
 * a Worker log with no retention, which is why the last host failure could not be explained.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { APP_INITIALIZE_TIMEOUT_MS, GET_AUTH_TOKEN_TIMEOUT_MS } from "@/domain/teams/bootDiagnostics";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  getAuthToken: vi.fn(async () => "entra-token"),
  getContext: vi.fn(async () => ({ app: { locale: "en-us" }, page: {} })),
  notifySuccess: vi.fn(async () => ({})),
  notifyFailure: vi.fn((_req: { reason: string }) => {}),
  openLink: vi.fn(async () => {}),
  setSession: vi.fn(async (): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(),
}));

vi.mock("@microsoft/teams-js", () => ({
  app: {
    initialize: H.initialize,
    getContext: H.getContext,
    openLink: H.openLink,
    notifySuccess: H.notifySuccess,
    notifyFailure: H.notifyFailure,
  },
  authentication: { getAuthToken: H.getAuthToken, authenticate: vi.fn(async () => "ok") },
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
type Diag = { bootAttemptId: string; terminalStage: string; events: { stage: string; elapsedMs: number; errorClass?: string }[]; buildSha: unknown; platform: unknown };
let diagnostics: Diag[];

function stubFetch(responder: () => Response) {
  diagnostics = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("/api/auth/teams-bootstrap")) {
      const hdr = (init?.headers ?? {}) as Record<string, string>;
      if (hdr["X-BTY-Teams-Client-Error"]) {
        if (init?.body) diagnostics.push(JSON.parse(String(init.body)) as Diag);
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      return responder();
    }
    return new Response("{}", { status: 200 });
  }));
}
const ok = () => new Response(JSON.stringify({ session: SESSION }), { status: 200 });
const stages = () => diagnostics[0]?.events.map((e) => e.stage) ?? [];

beforeEach(() => {
  vi.clearAllMocks();
  H.initialize.mockImplementation(async () => {});
  H.getAuthToken.mockImplementation(async () => "entra-token");
  H.notifySuccess.mockImplementation(async () => ({}));
  H.setSession.mockImplementation(async () => ({ data: {}, error: null }));
  stubFetch(ok);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("1/4/9/10 — the successful path", () => {
  it("1+4 — initialize and getAuthToken resolve, so the shell renders", async () => {
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(H.initialize).toHaveBeenCalledTimes(1);
    expect(H.getAuthToken).toHaveBeenCalledTimes(1);
  });

  it("9 — notifySuccess is sent exactly once", async () => {
    render(<TeamsTabShell />);
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalledTimes(1));
    expect(H.notifyFailure).not.toHaveBeenCalled();
  });

  it("10 — notifySuccess is NOT sent before the session exists", async () => {
    let sessionResolved = false;
    H.setSession.mockImplementation(async () => {
      // The host must not have been told "ready" at the moment the session is still being set.
      expect(H.notifySuccess).not.toHaveBeenCalled();
      sessionResolved = true;
      return { data: {}, error: null };
    });
    render(<TeamsTabShell />);
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalledTimes(1));
    expect(sessionResolved).toBe(true);
  });

  it("a successful boot files no diagnostic row", async () => {
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(diagnostics).toHaveLength(0);
  });
});

describe("2/5 — a rejection becomes BTY's own failure, with a stage", () => {
  it("2 — initialize rejects", async () => {
    H.initialize.mockImplementation(async () => { throw new TypeError("no host"); });
    render(<TeamsTabShell />);
    await waitFor(() => expect(diagnostics).toHaveLength(1));
    expect(stages()).toContain("app_initialize_failure");
    expect(diagnostics[0].events.find((e) => e.stage === "app_initialize_failure")?.errorClass).toBe("TypeError");
    expect(H.notifySuccess).not.toHaveBeenCalled();
  });

  it("5 — getAuthToken rejects", async () => {
    H.getAuthToken.mockImplementation(async () => { throw new RangeError("nope"); });
    render(<TeamsTabShell />);
    await waitFor(() => expect(diagnostics).toHaveLength(1));
    expect(stages()).toEqual(expect.arrayContaining(["app_initialize_success", "get_auth_token_failure"]));
    expect(H.notifySuccess).not.toHaveBeenCalled();
  });
});

describe("3/6 — a promise that never settles now fails", () => {
  it("3 — initialize never resolves → timeout stage", async () => {
    vi.useFakeTimers();
    H.initialize.mockImplementation(() => new Promise<void>(() => {}));
    render(<TeamsTabShell />);
    await vi.advanceTimersByTimeAsync(APP_INITIALIZE_TIMEOUT_MS + 50);
    vi.useRealTimers();
    await waitFor(() => expect(diagnostics).toHaveLength(1));
    expect(stages()).toContain("app_initialize_timeout");
    expect(stages()).not.toContain("app_initialize_success");
  });

  it("6 — getAuthToken never resolves → timeout stage", async () => {
    vi.useFakeTimers();
    H.getAuthToken.mockImplementation(() => new Promise<string>(() => {}));
    render(<TeamsTabShell />);
    await vi.advanceTimersByTimeAsync(GET_AUTH_TOKEN_TIMEOUT_MS + 50);
    vi.useRealTimers();
    await waitFor(() => expect(diagnostics).toHaveLength(1));
    expect(stages()).toContain("get_auth_token_timeout");
  });
});

describe("7/8 — server-side refusals are recorded and surfaced", () => {
  it("7 — a non-success bootstrap HTTP is recorded with its status class", async () => {
    stubFetch(() => new Response("{}", { status: 403 }));
    render(<TeamsTabShell />);
    await waitFor(() => expect(diagnostics).toHaveLength(1));
    expect(stages()).toEqual(expect.arrayContaining(["bootstrap_http_start", "bootstrap_http_response", "bootstrap_http_failure"]));
    expect(diagnostics[0].events.find((e) => e.stage === "bootstrap_http_failure")?.errorClass).toBe("Http403");
  });

  it("8 — a setSession failure is recorded", async () => {
    H.setSession.mockImplementation(async () => ({ data: {}, error: { message: "bad" } }));
    render(<TeamsTabShell />);
    await waitFor(() => expect(diagnostics).toHaveLength(1));
    expect(stages()).toEqual(expect.arrayContaining(["set_session_start", "set_session_failure"]));
    expect(H.notifySuccess).not.toHaveBeenCalled();
  });

  it("the host is told the failure so its own retry is not a dead end", async () => {
    H.getAuthToken.mockImplementation(async () => { throw new Error("denied"); });
    render(<TeamsTabShell />);
    await waitFor(() => expect(H.notifyFailure).toHaveBeenCalledTimes(1));
    expect(H.notifyFailure.mock.calls[0][0]).toEqual({ reason: "AuthFailed" });
  });
});

describe("11/12 — diagnostics are safe and never load-bearing", () => {
  it("11 — a diagnostic write failure does not break boot", async () => {
    diagnostics = [];
    vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
      const hdr = (init?.headers ?? {}) as Record<string, string>;
      if (hdr["X-BTY-Teams-Client-Error"]) throw new Error("diagnostic sink down");
      if (String(url).includes("/api/auth/teams-bootstrap")) return ok();
      return new Response("{}", { status: 200 });
    }));
    H.initialize.mockImplementation(async () => { throw new Error("x"); });
    render(<TeamsTabShell />);
    // The shell still reaches its own failure state rather than throwing out of the effect.
    await waitFor(() => expect(document.body.textContent ?? "").not.toBe(""));
    expect(H.notifySuccess).not.toHaveBeenCalled();
  });

  it("12 — no token or sensitive value appears in the payload", async () => {
    H.getAuthToken.mockImplementation(async () => { throw new Error("x"); });
    render(<TeamsTabShell />);
    await waitFor(() => expect(diagnostics).toHaveLength(1));
    const json = JSON.stringify(diagnostics[0]);
    for (const secret of ["entra-token", "supa-access", "supa-refresh", "@", "Authorization", "Bearer", "cookie"]) {
      expect(json, secret).not.toContain(secret);
    }
    // Only these keys, and only stage + elapsed (+ a symbolic class) inside events.
    expect(Object.keys(diagnostics[0]).sort()).toEqual(["bootAttemptId", "buildSha", "events", "platform", "terminalStage"]);
    for (const e of diagnostics[0].events) {
      expect(Object.keys(e).sort().join(",")).toMatch(/^(elapsedMs,stage|elapsedMs,errorClass,stage)$/);
    }
  });

  it("the correlation id is one uuid for the whole attempt", async () => {
    H.initialize.mockImplementation(async () => { throw new Error("x"); });
    render(<TeamsTabShell />);
    await waitFor(() => expect(diagnostics).toHaveLength(1));
    expect(diagnostics[0].bootAttemptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
