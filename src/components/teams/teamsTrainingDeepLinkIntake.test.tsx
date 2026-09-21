/** @vitest-environment jsdom */
/**
 * TEAMS DEEP-LINK INTAKE. Slice Teams-Native Delivery V1.
 *
 * A personal-tab invitation carries `context.subEntityId`; the Teams client hands it back as
 * `page.subPageId`. The claims proved here:
 *
 *   - the training is committed to the shell AT MOUNT, so the learner never sees Today flash first;
 *   - it is read AFTER the bootstrap, so a training never opens before we know who is opening it;
 *   - a forged or malformed `subPageId` opens the ordinary tab and nothing else;
 *   - the tab NEVER navigates: the document stays `/teams` and nothing is handed to `openLink`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  getAuthToken: vi.fn(async () => "teams-entra-token"),
  getContext: vi.fn(async () => ({ app: { locale: "en-us" }, page: {} }) as Record<string, unknown>),
  openLink: vi.fn(async () => {}),
  setSession: vi.fn(async () => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(),
  shellProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize, getContext: H.getContext, openLink: H.openLink },
  authentication: { getAuthToken: H.getAuthToken, authenticate: vi.fn(), notifySuccess: vi.fn(), notifyFailure: vi.fn() },
}));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } }),
  supabase: { auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } },
}));
vi.mock("@/components/app-shell/BtyDailyAppShell", () => ({
  default: (props: Record<string, unknown>) => {
    H.shellProps.push(props);
    const req = props.trainingRequest as { target: { joinToken: string }; requestKey: string } | null;
    return (
      <div
        data-testid="shell"
        data-training={req ? req.target.joinToken : "none"}
        data-request-key={req ? req.requestKey : "none"}
      />
    );
  },
}));

import TeamsTabShell from "@/components/teams/TeamsTabShell";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
const SESSION = { access_token: "supa-access", refresh_token: "supa-refresh" };

/** Ordered log of what happened, so "bootstrap BEFORE training" is a measured sequence. */
let events: string[];
/** The spy itself, kept because the tab installs a fetch WRAPPER over it. */
let fetchSpy: ReturnType<typeof vi.fn>;

function stubFetch() {
  fetchSpy = vi.fn(async (url: unknown) => {
      if (String(url).includes("/api/auth/teams-bootstrap")) {
        events.push("bootstrap");
        return new Response(JSON.stringify({ session: SESSION }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchSpy);
}

beforeEach(() => {
  events = [];
  H.shellProps.length = 0;
  vi.clearAllMocks();
  H.getContext.mockImplementation(async () => {
    events.push("getContext");
    return { app: { locale: "en-us" }, page: {} };
  });
  H.setSession.mockResolvedValue({ data: {}, error: null });
  stubFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function withSubPageId(value: unknown, field: "subPageId" | "subEntityId" = "subPageId") {
  H.getContext.mockImplementation(async () => {
    events.push("getContext");
    return { app: { locale: "en-us" }, page: { [field]: value } };
  });
}

describe("an invitation opens the training inside the tab", () => {
  it("commits the training to the shell at mount", async () => {
    withSubPageId(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(screen.getByTestId("shell").getAttribute("data-training")).toBe(TOKEN);
    // The shell received it on its FIRST render — never as a later update.
    expect(H.shellProps[0]!.trainingRequest).toEqual({
      target: { joinToken: TOKEN },
      requestKey: "bootstrap:0",
    });
  });

  it("reads the pre-v2 subEntityId too, for older clients", async () => {
    withSubPageId(`foundry-training:${TOKEN}`, "subEntityId");
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell").getAttribute("data-training")).toBe(TOKEN));
  });

  it("BOOTSTRAPS FIRST — the training is never opened before identity exists", async () => {
    withSubPageId(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(events.indexOf("bootstrap")).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("bootstrap")).toBeLessThan(events.indexOf("getContext"));
    expect(H.setSession).toHaveBeenCalledTimes(1);
  });

  it("NEVER navigates: no openLink, and the document stays /teams", async () => {
    withSubPageId(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(H.openLink).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
    const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((u) => u.includes("/f/"))).toBe(false);
  });
});

describe("a malformed or forged subPageId opens the ordinary tab", () => {
  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["a route", "/en/app"],
    ["an origin", "https://evil.example/f/btyfr1.a.b"],
    ["a traversal", "foundry-training:../../admin"],
    ["a bad token", "foundry-training:not-a-token"],
    ["another entity", "conversations"],
    ["an object", { subEntityId: "foundry-training:x" }],
  ])("%s → no training, and the shell still renders", async (_label, value) => {
    withSubPageId(value);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(screen.getByTestId("shell").getAttribute("data-training")).toBe("none");
    expect(H.shellProps[0]!.trainingRequest ?? null).toBeNull();
  });

  it("a context read that THROWS still opens the tab rather than failing the bootstrap", async () => {
    H.getContext.mockImplementation(async () => {
      throw new Error("no context");
    });
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
    expect(screen.getByTestId("shell").getAttribute("data-training")).toBe("none");
  });
});
