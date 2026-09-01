/** @vitest-environment jsdom */
/**
 * Slice A0 — NOTHING THE FOUR TABS DO NAVIGATES THE TEAMS FRAME.
 *
 * `/teams` is the only BTY path served without `X-Frame-Options: DENY`. So a tab switch that
 * navigated the document — a raw anchor, a `router.push`, a `location.assign` — would not "go
 * somewhere else" inside Teams. It would blank the tab, with no error thrown and nothing to go
 * back to, which is the failure this file exists to make impossible.
 *
 * This mounts the REAL `BtyDailyAppShell` (the same component `/teams` renders) and proves that
 * moving between Today, Learn, Practice and Me changes only in-component state: the document's
 * location never moves, and neither the router nor `assign`/`replace` is ever called.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import BtyDailyAppShell from "@/components/app-shell/BtyDailyAppShell";

const push = vi.fn();
const replaceRoute = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: replaceRoute, prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/teams",
}));

const ORIGIN = "https://arena.btydaily.com";
let assign: ReturnType<typeof vi.fn>;
let locationReplace: ReturnType<typeof vi.fn>;

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      const body = u.includes("/api/auth/session")
        ? { ok: true, user: { email: "founder@bty.example" } }
        : u.includes("/api/me/today/brief")
          ? { ok: true, brief: null, reminders: [], hostAttention: [] }
          : { ok: true };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

beforeEach(() => {
  assign = vi.fn();
  locationReplace = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: Object.assign(new URL(`${ORIGIN}/teams`), {
      assign,
      replace: locationReplace,
      toString: () => `${ORIGIN}/teams`,
    }),
  });
  stubFetch();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TABS = ["Today", "Learn", "Practice", "Me"] as const;

describe("the four shell tabs are local state, not navigation", () => {
  it("switching every tab moves the document nowhere", async () => {
    render(<BtyDailyAppShell locale="en" />);
    const tabbar = () => screen.getByLabelText("App navigation");
    await waitFor(() => expect(tabbar()).toBeTruthy());

    for (const label of TABS) {
      const btn = screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") });
      fireEvent.click(btn);
      // The tab bar survives every switch — the document was never replaced.
      expect(tabbar()).toBeTruthy();
    }

    // NOTHING navigated: not the App Router, not the document.
    expect(push).not.toHaveBeenCalled();
    expect(replaceRoute).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(locationReplace).not.toHaveBeenCalled();
    // And the address is still the tab's own path — the frame exception still applies.
    expect(window.location.pathname).toBe("/teams");
  });

  it("EVERY outward anchor any tab renders is caught by the guard, not followed", async () => {
    /*
      The shell legitimately renders outward links — Today brief cards, practice hrefs, host
      deep links. They are allowed to exist; what is NOT allowed is for one of them to navigate
      the frame. So rather than assert none exist (which would be false, and would break the
      moment a card is added), this walks every tab, clicks every anchor that `escapesTeamsFrame`
      identifies, and requires the guard to have intercepted it.
    */
    const { escapesTeamsFrame } = await import("@/domain/teams/tabRuntime");
    const { installTeamsFrameContainment } = await import("@/lib/bty/teams/teamsTabTransport");
    const opened: string[] = [];
    const uninstall = installTeamsFrameContainment((u) => opened.push(u));

    render(<BtyDailyAppShell locale="en" />);
    await waitFor(() => expect(screen.getByLabelText("App navigation")).toBeTruthy());

    let checked = 0;
    for (const label of TABS) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") }));
      const anchors = Array.from(document.querySelectorAll("a[href]")).filter((a) =>
        escapesTeamsFrame(a.getAttribute("href") ?? "", ORIGIN),
      );
      for (const a of anchors) {
        const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
        a.dispatchEvent(ev);
        expect(
          ev.defaultPrevented,
          `tab ${label}: anchor ${a.getAttribute("href")} was NOT contained and would blank the frame`,
        ).toBe(true);
        checked += 1;
      }
      // Whatever the tabs rendered, nothing escaped the frame.
      expect(assign).not.toHaveBeenCalled();
      expect(locationReplace).not.toHaveBeenCalled();
    }
    // Every intercepted anchor was handed to the external opener instead.
    expect(opened).toHaveLength(checked);
    uninstall();
  });
});

describe("the containment guard is what makes an outward anchor safe", () => {
  it("an anchor to a DENY route is intercepted rather than followed", async () => {
    const { installTeamsFrameContainment } = await import("@/lib/bty/teams/teamsTabTransport");
    const opened: string[] = [];
    const uninstall = installTeamsFrameContainment((u) => opened.push(u));

    const a = document.createElement("a");
    a.setAttribute("href", "/en/app?tab=foundry");
    document.body.appendChild(a);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    a.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(opened).toEqual([`${ORIGIN}/en/app?tab=foundry`]);
    document.body.removeChild(a);
    uninstall();
  });
});

describe("navigateWithinFrame — the shell's one programmatic navigation", () => {
  it("pushes normally on the web", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: Object.assign(new URL(`${ORIGIN}/en/app`), { assign, replace: locationReplace }),
    });
    const { navigateWithinFrame } = await import("@/lib/bty/teams/teamsAwareNavigate");
    const localPush = vi.fn();
    navigateWithinFrame(localPush, "/en/observe/abc");
    expect(localPush).toHaveBeenCalledWith("/en/observe/abc");
  });

  it("does NOT push into the frame from /teams — that would blank the tab", async () => {
    const { navigateWithinFrame } = await import("@/lib/bty/teams/teamsAwareNavigate");
    const localPush = vi.fn();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    navigateWithinFrame(localPush, "/en/observe/abc");
    expect(localPush).not.toHaveBeenCalled();
  });

  it("still pushes a destination that stays inside /teams", async () => {
    const { navigateWithinFrame } = await import("@/lib/bty/teams/teamsAwareNavigate");
    const localPush = vi.fn();
    navigateWithinFrame(localPush, "/teams/link");
    expect(localPush).toHaveBeenCalledWith("/teams/link");
  });
});
