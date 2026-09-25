/** @vitest-environment jsdom */
/**
 * Slice B-R1 — the host is told "ready" only once the ready UI has COMMITTED.
 *
 * The handshake used to fire in the bootstrap callback, right after `setPhase({k:"ready"})`. Every
 * readiness FACT was established by then, but `setPhase` only schedules a render — so Teams was told
 * "ready for user interaction" before any ready UI existed. The decisive test below is the one that
 * could not pass under the old code: a boot that fully succeeds and then throws on render must NOT
 * notify the host.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { APP_INITIALIZE_TIMEOUT_MS } from "@/domain/teams/bootDiagnostics";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  getAuthToken: vi.fn(async () => "entra-token"),
  getContext: vi.fn(async () => ({ app: { locale: "en-us" }, page: {} })),
  notifySuccess: vi.fn(async () => ({})),
  notifyFailure: vi.fn((_r: { reason: string }) => {}),
  openLink: vi.fn(async () => {}),
  setSession: vi.fn(async (): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(),
  /** Flipped per test so the ready RENDER can be made to fail without remocking the module. */
  shellThrows: { value: false },
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize, getContext: H.getContext, openLink: H.openLink, notifySuccess: H.notifySuccess, notifyFailure: H.notifyFailure },
  authentication: { getAuthToken: H.getAuthToken, authenticate: vi.fn(async () => "ok") },
}));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } }),
  supabase: { auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } },
}));
vi.mock("@/components/app-shell/BtyDailyAppShell", () => ({
  default: ({ locale }: { locale: string }) => {
    if (H.shellThrows.value) throw new Error("ready render failed");
    return <div data-testid="shell" data-locale={locale} />;
  },
}));

import TeamsTabShell from "@/components/teams/TeamsTabShell";

const SESSION = { access_token: "supa-access", refresh_token: "supa-refresh" };
type Diag = { terminalStage: string; events: { stage: string; elapsedMs: number; errorClass?: string }[] };
let diagnostics: Diag[];

function stubFetch(responder: () => Response) {
  diagnostics = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("/api/auth/teams-bootstrap")) {
      /*
        Read through `Headers`, not as a plain object. A PRE-ready diagnostic is sent before the
        Teams transport wrapper is installed and arrives as the literal the shell wrote; a POST-ready
        one goes through that wrapper, which normalises init.headers into a Headers instance. Reading
        `hdr["X-..."]` silently saw nothing in the second case — the test, not the product, was wrong.
      */
      if (new Headers((init?.headers ?? {}) as HeadersInit).get("X-BTY-Teams-Client-Error")) {
        if (init?.body) diagnostics.push(JSON.parse(String(init.body)) as Diag);
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      return responder();
    }
    return new Response("{}", { status: 200 });
  }));
}
const ok = () => new Response(JSON.stringify({ session: SESSION }), { status: 200 });
const allStages = () => diagnostics.flatMap((d) => d.events.map((e) => e.stage));

beforeEach(() => {
  vi.clearAllMocks();
  H.shellThrows.value = false;
  H.initialize.mockImplementation(async () => {});
  H.getAuthToken.mockImplementation(async () => "entra-token");
  H.notifySuccess.mockImplementation(async () => ({}));
  H.setSession.mockImplementation(async () => ({ data: {}, error: null }));
  stubFetch(ok);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("1 — bootstrap success alone does not notify the host", () => {
  /** Catches the ready render's throw so the assertion below can be made at all. */
  class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <div data-testid="crashed" /> : this.props.children; }
  }

  it("a boot that succeeds and then FAILS TO RENDER never notifies", async () => {
    // Under the old implementation notifySuccess had already been sent by this point.
    H.shellThrows.value = true;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Boundary><TeamsTabShell /></Boundary>);
    await waitFor(() => expect(screen.getByTestId("crashed")).toBeTruthy());
    quiet.mockRestore();
    // Every readiness FACT was established…
    expect(H.setSession).toHaveBeenCalledTimes(1);
    // …and the host was still not told, because no ready UI ever committed.
    expect(H.notifySuccess).not.toHaveBeenCalled();
  });
});

describe("2/3 — exactly once per mount", () => {
  it("2 — notifySuccess is called once after the ready commit", async () => {
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalledTimes(1));
  });

  it("3 — a rerender while still ready does not notify twice", async () => {
    const view = render(<TeamsTabShell />);
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalledTimes(1));
    view.rerender(<TeamsTabShell />);
    view.rerender(<TeamsTabShell />);
    await new Promise((r) => setTimeout(r, 20));
    expect(H.notifySuccess).toHaveBeenCalledTimes(1);
  });

  it("3b — the guard is claimed before any await, so a replayed effect cannot pass it twice", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "src/components/teams/TeamsTabShell.tsx"), "utf8",
    );
    const effect = src.slice(src.indexOf("hostReadyNotificationAttemptedRef.current) return"));
    const claim = effect.indexOf("hostReadyNotificationAttemptedRef.current = true");
    const firstAwait = effect.indexOf("await withTimeout");
    expect(claim).toBeGreaterThan(-1);
    expect(firstAwait).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(firstAwait);
  });
});

describe("4 — react_ready means committed", () => {
  it("a pre-ready failure never reports react_ready", async () => {
    H.getAuthToken.mockImplementation(async () => { throw new Error("denied"); });
    render(<TeamsTabShell />);
    await waitFor(() => expect(diagnostics.length).toBeGreaterThan(0));
    expect(allStages()).not.toContain("react_ready");
    expect(allStages()).not.toContain("notify_success_sent");
  });

  it("is not emitted from the bootstrap callback any more", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "src/components/teams/TeamsTabShell.tsx"), "utf8",
    );
    const bootstrapBody = src.slice(src.indexOf("const bootstrap = useCallback"), src.indexOf("const run = useCallback"));
    expect(bootstrapBody).not.toContain('mark("react_ready")');
    expect(bootstrapBody).not.toContain("notifySuccess");
  });
});

describe("5/6/7 — the handshake cannot harm a rendered shell", () => {
  it("5 — notify_success_sent only follows a resolved SDK promise", async () => {
    let resolveIt: (() => void) | null = null;
    H.notifySuccess.mockImplementation(() => new Promise<Record<string, never>>((res) => { resolveIt = () => res({}); }));
    render(<TeamsTabShell />);
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalledTimes(1));
    // Still pending → nothing claims it was sent, and the shell is already usable.
    expect(allStages()).not.toContain("notify_success_sent");
    expect(screen.getByTestId("shell")).toBeTruthy();
    resolveIt!();
  });

  it("6 — a rejection is captured and the shell keeps working", async () => {
    H.notifySuccess.mockImplementation(async () => { throw new TypeError("host refused"); });
    render(<TeamsTabShell />);
    await waitFor(() => expect(diagnostics.length).toBeGreaterThan(0));
    const d = diagnostics.find((x) => x.events.some((e) => e.stage === "notify_success_failure"));
    expect(d).toBeTruthy();
    expect(d!.events.find((e) => e.stage === "notify_success_failure")?.errorClass).toBe("TypeError");
    // The learner already had a working shell; the failed handshake did not take it away.
    expect(screen.getByTestId("shell")).toBeTruthy();
  });

  it("7 — a silent host is bounded, not a hang", async () => {
    vi.useFakeTimers();
    H.notifySuccess.mockImplementation(() => new Promise<Record<string, never>>(() => {}));
    render(<TeamsTabShell />);
    // Let the boot chain's own promises settle first; only then jump past the bound.
    for (let i = 0; i < 50 && H.notifySuccess.mock.calls.length === 0; i += 1) await vi.advanceTimersByTimeAsync(1);
    expect(H.notifySuccess).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(APP_INITIALIZE_TIMEOUT_MS + 50);
    vi.useRealTimers();
    await waitFor(() => expect(diagnostics.length).toBeGreaterThan(0));
    expect(allStages()).toContain("notify_success_failure");
    expect(screen.getByTestId("shell")).toBeTruthy();
    // Bounded once, never retried into a loop.
    expect(H.notifySuccess).toHaveBeenCalledTimes(1);
  });
});

describe("8 — pre-ready failure semantics are unchanged", () => {
  it("still tells the host a terminal pre-ready failure, with a real reason", async () => {
    H.getAuthToken.mockImplementation(async () => { throw new Error("denied"); });
    render(<TeamsTabShell />);
    await waitFor(() => expect(H.notifyFailure).toHaveBeenCalledTimes(1));
    expect(H.notifyFailure.mock.calls[0][0]).toEqual({ reason: "AuthFailed" });
    expect(H.notifySuccess).not.toHaveBeenCalled();
  });
});
