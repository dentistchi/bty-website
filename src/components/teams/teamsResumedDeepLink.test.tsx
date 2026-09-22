/** @vitest-environment jsdom */
/**
 * THE DEVICE FAILURE, REPRODUCED. Slice Teams iOS Deep-Link Resume.
 *
 * Measured on a real iPhone: the Host's "Send in Teams" worked, the picker worked, the learner
 * tapped the invitation and BTY opened INSIDE Teams — and then showed ordinary Learn instead of the
 * named training.
 *
 * The cause was a boundary, not a route. `app.getContext()` was read once during the one-time
 * bootstrap, and the shell copied the target into state in a mount-time initialiser. Teams iOS
 * RESUMES the running personal-tab WebView rather than remounting it, so a target arriving after
 * that first mount reached nobody.
 *
 * The A–H sequence below is that exact production shape.
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
  currentAppIsSupported: vi.fn(() => true),
  navigateTo: vi.fn(async () => {}),
  navigateToDefaultPage: vi.fn(async () => {}),
  shellProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize, getContext: H.getContext, openLink: H.openLink },
  authentication: { getAuthToken: H.getAuthToken, authenticate: vi.fn(), notifySuccess: vi.fn(), notifyFailure: vi.fn() },
  pages: {
    currentApp: {
      isSupported: H.currentAppIsSupported,
      navigateTo: H.navigateTo,
      navigateToDefaultPage: H.navigateToDefaultPage,
    },
  },
}));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } }),
  supabase: { auth: { setSession: H.setSession, onAuthStateChange: H.onAuthStateChange } },
}));
/*
  A FAITHFUL STAND-IN FOR THE SHELL: it applies the REAL request rules, so what this file proves is
  the whole boundary (tab → request → open), not merely that a prop changed.
*/
vi.mock("@/components/app-shell/BtyDailyAppShell", async () => {
  const React = await import("react");
  // The REAL rules, imported rather than restated — a stand-in that invented its own would prove nothing.
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
const TOKEN_B = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIiwiYiI6MX0.c2Vjb25kLXNpZ25hdHVyZQ";
const SESSION = { access_token: "supa-access", refresh_token: "supa-refresh" };

let bootstrapCalls: number;
let subPageId: unknown;
/** The spy itself, because the tab installs a fetch WRAPPER over `window.fetch`. */
let fetchSpy: ReturnType<typeof vi.fn>;

function setContext(value: unknown) {
  subPageId = value;
}

beforeEach(() => {
  vi.clearAllMocks();
  H.shellProps.length = 0;
  bootstrapCalls = 0;
  subPageId = undefined;
  H.currentAppIsSupported.mockReturnValue(true);
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
});

/** D + F: the tab loses the foreground and comes back — what a deep-link tap actually produces. */
async function returnToTab(via: "focus" | "visibility" = "focus") {
  await act(async () => {
    if (via === "focus") {
      window.dispatchEvent(new Event("focus"));
    } else {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    }
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("A–H · the exact production failure", () => {
  it.each([["focus"], ["visibility"]] as const)(
    "resumed tab (%s) consumes a training delivered after mount",
    async (via) => {
      // A. mount /teams with NO subPageId
      setContext(undefined);
      render(<TeamsTabShell />);
      // B + C. bootstrap succeeds, shell shows ordinary Learn
      await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());
      expect(screen.queryByTestId("in-shell-training")).toBeNull();

      // D + E. the tab goes away; Teams delivers a training while it is gone
      setContext(`foundry-training:${TOKEN}`);

      // F + G. it comes back — the ALREADY MOUNTED shell opens the room
      await returnToTab(via);
      await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
      expect(screen.getByTestId("in-shell-training").getAttribute("data-token")).toBe(TOKEN);

      // H. no document navigation occurred.
      expect(H.openLink).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe("/");
    },
  );

  it("refreshing navigation does NOT spend another bootstrap", async () => {
    setContext(undefined);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());
    expect(bootstrapCalls).toBe(1);

    setContext(`foundry-training:${TOKEN}`);
    await returnToTab();
    await returnToTab();
    await returnToTab();

    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    // Navigation state was refreshed; identity was not re-derived.
    expect(bootstrapCalls).toBe(1);
    expect(H.setSession).toHaveBeenCalledTimes(1);
    expect(H.getAuthToken).toHaveBeenCalledTimes(1);
  });

  it("a cold deep link still opens the training on the FIRST render", async () => {
    setContext(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    // No Learn flash: the first shell render already carried the request.
    expect(H.shellProps[0]!.trainingRequest).toEqual({
      target: { joinToken: TOKEN },
      requestKey: "bootstrap:0",
      transport: "context",
    });
  });

  it("a malformed RESUMED target is ignored — the learner stays on Learn", async () => {
    setContext(undefined);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());

    for (const bad of ["", "/en/app", "foundry-training:", "foundry-training:../../admin", "conversations", "https://evil.example/f/btyfr1.a.b"]) {
      setContext(bad);
      await returnToTab();
      expect(screen.queryByTestId("in-shell-training"), bad).toBeNull();
    }
    expect(H.openLink).not.toHaveBeenCalled();
  });
});

describe("the same invitation can be tapped again", () => {
  it("reopens the SAME training after Back to Learn", async () => {
    setContext(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());

    // Back to Learn — the room closes and the host is asked to drop the subpage.
    await act(async () => {
      screen.getByTestId("back-to-learn").click();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());

    // The learner returns to the chat and taps the SAME invitation.
    setContext(`foundry-training:${TOKEN}`);
    await returnToTab();
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    expect(screen.getByTestId("in-shell-training").getAttribute("data-token")).toBe(TOKEN);
  });

  it("a refocus MID-TRAINING does not remount the room the learner is already in", async () => {
    setContext(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    const node = screen.getByTestId("in-shell-training");

    // Switching apps mid-quiz and coming back reports the same subpage.
    await returnToTab();
    await returnToTab();

    // The SAME DOM node — nothing remounted, so no attempt was destroyed.
    expect(screen.getByTestId("in-shell-training")).toBe(node);
  });

  it("a DIFFERENT training delivered while open replaces it", async () => {
    setContext(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());

    setContext(`foundry-training:${TOKEN_B}`);
    await returnToTab();
    await waitFor(() =>
      expect(screen.getByTestId("in-shell-training").getAttribute("data-token")).toBe(TOKEN_B),
    );
  });
});

describe("Back to Learn returns the Teams host to the BTY root", () => {
  it("asks currentApp to navigate to the personal tab's own page", async () => {
    setContext(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());

    await act(async () => {
      screen.getByTestId("back-to-learn").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(H.navigateTo).toHaveBeenCalledWith({ pageId: "btyHome" }));
    expect(screen.getByTestId("learn-home")).toBeTruthy();
  });

  it("FAILS SOFT when the capability is unavailable — the local exit still works", async () => {
    H.currentAppIsSupported.mockReturnValue(false);
    setContext(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());

    await act(async () => {
      screen.getByTestId("back-to-learn").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());
    expect(H.navigateTo).not.toHaveBeenCalled();
    expect(H.openLink).not.toHaveBeenCalled();
  });

  it("a host that REFUSES the navigation is not an error for the learner", async () => {
    H.navigateTo.mockRejectedValue(new Error("host refused"));
    setContext(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());

    await act(async () => {
      screen.getByTestId("back-to-learn").click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("learn-home")).toBeTruthy());
  });
});

describe("no browser handoff, ever", () => {
  it("never calls openLink and never fetches the public /f room", async () => {
    setContext(`foundry-training:${TOKEN}`);
    render(<TeamsTabShell />);
    await waitFor(() => expect(screen.getByTestId("in-shell-training")).toBeTruthy());
    await returnToTab();
    expect(H.openLink).not.toHaveBeenCalled();
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.some((u) => u.includes("/f/"))).toBe(false);
  });
});
