/** @vitest-environment jsdom */
// @vitest-environment-options { "url": "https://arena.btydaily.com/teams" }
/**
 * THE iOS FALLBACK SHAPE, REPRODUCED. Slice Teams iOS webUrl Fallback.
 *
 * Measured on a real iPhone: tapping the invitation opened the BTY personal app FULL-SCREEN —
 * Teams app routing succeeded — and the tab landed on ordinary Today. `page.subPageId` never
 * arrived, so the previous resume fix (re-reading the context) had nothing to re-read.
 *
 * Microsoft documents `webUrl` as the fallback a client uses when it cannot render or navigate the
 * tab target, and ours named the bare tab. It now carries the SAME signed target as a query
 * parameter, and these tests drive exactly that: NO context target, a `?training=` URL, and a
 * successful bootstrap.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  getAuthToken: vi.fn(async () => "teams-entra-token"),
  getContext: vi.fn(async () => ({ app: { locale: "en-us" }, page: {} }) as Record<string, unknown>),
  openLink: vi.fn(async () => {}),
  setSession: vi.fn(async () => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(),
  isSupported: vi.fn(() => true),
  navigateTo: vi.fn(async () => {}),
  navigateToDefaultPage: vi.fn(async () => {}),
  shellProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize, getContext: H.getContext, openLink: H.openLink },
  authentication: { getAuthToken: H.getAuthToken, authenticate: vi.fn(), notifySuccess: vi.fn(), notifyFailure: vi.fn() },
  pages: { currentApp: { isSupported: H.isSupported, navigateTo: H.navigateTo, navigateToDefaultPage: H.navigateToDefaultPage } },
}));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } }),
  supabase: { auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } },
}));
/** A faithful stand-in applying the REAL request rules — see teamsResumedDeepLink.test.tsx. */
vi.mock("@/components/app-shell/BtyDailyAppShell", async () => {
  const React = await import("react");
  const { shouldOpenTrainingRequest } = await import("@/domain/teams/trainingRequest");
  return {
    default: (props: Record<string, unknown>) => {
      H.shellProps.push(props);
      const request = props.trainingRequest as import("@/domain/teams/trainingRequest").TrainingRequest | null;
      const [open, setOpen] = React.useState<string | null>(() => request?.target.joinToken ?? null);
      const handled = React.useRef<string | null>(request?.requestKey ?? null);
      const openRef = React.useRef<string | null>(request?.target.joinToken ?? null);
      React.useEffect(() => {
        if (!shouldOpenTrainingRequest({ request, handledKey: handled.current, openJoinToken: openRef.current })) {
          if (request) handled.current = request.requestKey;
          return;
        }
        handled.current = request!.requestKey;
        openRef.current = request!.target.joinToken;
        setOpen(request!.target.joinToken);
      }, [request]);
      return (
        <div data-testid="shell">
          {open ? (
            <div data-testid="in-shell-training" data-token={open}>
              <button
                type="button"
                data-testid="back-to-learn"
                onClick={() => {
                  openRef.current = null;
                  setOpen(null);
                  (props.onTrainingExit as (() => void) | undefined)?.();
                }}
              >
                Back to Learn
              </button>
            </div>
          ) : (
            <div data-testid="learn-home" />
          )}
        </div>
      );
    },
  };
});

import TeamsTabShell from "@/components/teams/TeamsTabShell";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
const TOKEN_B = "btyfr1.eyJiIjoxfQ.c2Vjb25kLXNpZ25hdHVyZQ";
const TARGET = (t: string) => `foundry-training:${t}`;
const SESSION = { access_token: "supa-access", refresh_token: "supa-refresh" };

let bootstrapCalls: number;
let subPageId: unknown;
let fetchSpy: ReturnType<typeof vi.fn>;

/** Put the tab at a `/teams` URL, exactly as the iOS webUrl fallback would. */
function setUrl(search: string) {
  window.history.replaceState({}, "", `/teams${search}`);
}

beforeEach(() => {
  /*
    `clearAllMocks` clears CALLS but keeps implementations, and several tests below install
    rejecting ones. Re-establish the happy path explicitly so order cannot decide an outcome.
  */
  vi.clearAllMocks();
  H.initialize.mockResolvedValue(undefined);
  H.getAuthToken.mockResolvedValue("teams-entra-token");
  H.openLink.mockResolvedValue(undefined);
  H.navigateTo.mockResolvedValue(undefined);
  H.navigateToDefaultPage.mockResolvedValue(undefined);
  H.shellProps.length = 0;
  bootstrapCalls = 0;
  subPageId = undefined;
  setUrl("");
  H.isSupported.mockReturnValue(true);
  H.getContext.mockImplementation(async () => ({
    app: { locale: "en-us" },
    page: subPageId === undefined ? {} : { subPageId },
  }));
  H.setSession.mockResolvedValue({ data: {}, error: null });
  fetchSpy = vi.fn(async (url: unknown) => {
    if (String(url).includes("/api/auth/teams-bootstrap")) {
      bootstrapCalls += 1;
      return new Response(JSON.stringify({ session: SESSION }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setUrl("");
});

async function returnToTab() {
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("★ the exact iOS shape: no subPageId, a ?training= URL", () => {
  it("opens the named training from the webUrl fallback alone", async () => {
    subPageId = undefined; // the measured device behaviour
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);

    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    expect(screen.getByTestId("in-shell-training").getAttribute("data-token")).toBe(TOKEN);
    expect(H.shellProps[0]!.trainingRequest).toMatchObject({ transport: "query" });
    // No browser handoff, and the document never left /teams.
    expect(H.openLink).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/teams");
  });

  it("arrives on a RESUMED tab too — the URL is re-read on focus, not only at mount", async () => {
    setUrl("");
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());

    // iOS reopens the tab at the fallback address while it is already running.
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    await returnToTab();

    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    expect(screen.getByTestId("in-shell-training").getAttribute("data-token")).toBe(TOKEN);
  });

  it("still works when the context read THROWS — the fallback is the whole point", async () => {
    H.getContext.mockRejectedValue(new Error("no context on this client"));
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
  });
});

describe("precedence and refusal", () => {
  it("the CONTEXT target wins when both are present", async () => {
    subPageId = TARGET(TOKEN);
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN_B))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    expect(screen.getByTestId("in-shell-training").getAttribute("data-token")).toBe(TOKEN);
    expect(H.shellProps[0]!.trainingRequest).toMatchObject({ transport: "context" });
  });

  it("a malformed query target is ignored and ordinary BTY opens", async () => {
    for (const bad of [
      "?training=",
      "?training=/en/app",
      "?training=conversations",
      `?training=${encodeURIComponent("foundry-training:../../admin")}`,
      `?training=${encodeURIComponent("foundry-training:not-a-token")}`,
      `?training=${encodeURIComponent("https://evil.example/f/btyfr1.a.b")}`,
      `?other=${encodeURIComponent(TARGET(TOKEN))}`,
    ]) {
      cleanup();
      setUrl(bad);
      render(<TeamsTabShell />);
      await waitFor(() => expect(screen.getByTestId("shell")).toBeTruthy());
      expect(screen.queryByTestId("in-shell-training"), bad).toBeNull();
    }
    expect(H.openLink).not.toHaveBeenCalled();
  });
});

describe("★ a query target is not permission — the Teams gate still decides", () => {
  it("a bootstrap that FAILS opens no training, however the URL is addressed", async () => {
    H.getAuthToken.mockRejectedValue(new Error("not in a Teams host"));
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("teams-tab-gate")).toBeTruthy());
    expect(screen.queryByTestId("in-shell-training")).toBeNull();
    expect(screen.queryByTestId("shell")).toBeNull();
  });

  it("a first-time user is offered the Microsoft gate, never the training", async () => {
    fetchSpy.mockImplementation(async (url: unknown) => {
      if (String(url).includes("/api/auth/teams-bootstrap")) {
        bootstrapCalls += 1;
        return new Response(JSON.stringify({ needsFirstSignIn: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    });
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("teams-first-sign-in")).toBeTruthy());
    expect(screen.queryByTestId("in-shell-training")).toBeNull();
  });

  it("no session means the room is never asked for — no anonymous substitution", async () => {
    H.getAuthToken.mockRejectedValue(new Error("no host"));
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("teams-tab-gate")).toBeTruthy());
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/teams/room/open"))).toBe(false);
    expect(urls.some((u) => u.includes("/f/"))).toBe(false);
  });
});

describe("★ Back to Learn removes the fallback target from the URL", () => {
  it("clears ?training= without navigating, so focus cannot reopen it", async () => {
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());

    await act(async () => {
      screen.getByTestId("back-to-learn").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/teams");
    // The Teams host was asked to drop its subpage too.
    expect(H.navigateTo).toHaveBeenCalledWith({ pageId: "btyHome" });

    // THE REGRESSION THIS GUARDS: a later focus must NOT put the learner back inside it.
    await returnToTab();
    await returnToTab();
    expect(screen.queryByTestId("in-shell-training")).toBeNull();
  });

  it("preserves unrelated parameters while removing only the target", async () => {
    setUrl(`?diag=1&training=${encodeURIComponent(TARGET(TOKEN))}&keep=yes`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    await act(async () => {
      screen.getByTestId("back-to-learn").click();
      await Promise.resolve();
    });
    await waitFor(() => expect(window.location.search).not.toContain("training="));
    expect(window.location.search).toContain("diag=1");
    expect(window.location.search).toContain("keep=yes");
  });

  it("fails soft when the host cannot navigate — the URL is still cleaned", async () => {
    H.isSupported.mockReturnValue(false);
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    await act(async () => {
      screen.getByTestId("back-to-learn").click();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());
    expect(window.location.search).toBe("");
    expect(H.navigateTo).not.toHaveBeenCalled();
  });
});

describe("★ the same invitation, tapped again", () => {
  it("reopens the training after Back to Learn cleared the query", async () => {
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());

    await act(async () => {
      screen.getByTestId("back-to-learn").click();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());
    expect(window.location.search).toBe("");

    // Back in the chat, the learner taps the SAME invitation: the fallback URL arrives again.
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    await returnToTab();
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    expect(screen.getByTestId("in-shell-training").getAttribute("data-token")).toBe(TOKEN);
  });

  it("a focus WHILE the quiz is open does not remount the room", async () => {
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    const node = screen.getByTestId("in-shell-training");

    await returnToTab();
    await returnToTab();

    expect(screen.getByTestId("in-shell-training")).toBe(node);
  });
});

describe("the invariants the previous slices established still hold", () => {
  it("bootstrap is called exactly once, however many refreshes happen", async () => {
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    await returnToTab();
    await returnToTab();
    await returnToTab();
    expect(bootstrapCalls).toBe(1);
    expect(H.getAuthToken).toHaveBeenCalledTimes(1);
    expect(H.setSession).toHaveBeenCalledTimes(1);
  });

  it("never opens a browser and never touches the public /f room", async () => {
    setUrl(`?training=${encodeURIComponent(TARGET(TOKEN))}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    await returnToTab();
    expect(H.openLink).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls.map((c) => String(c[0])).some((u) => u.includes("/f/"))).toBe(false);
  });
});
