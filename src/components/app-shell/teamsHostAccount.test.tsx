/** @vitest-environment jsdom */
/**
 * Me → Account and This week, in the Teams host (Slice A0-RUNTIME2).
 *
 * Two device defects, one shared cause and one of its own:
 *   D1 the account row rendered "…" — it displays an email, and in the Teams tab the session route
 *      returned no user at all because it authenticates INLINE, outside `requireUser`.
 *   D2 "This week" span forever — same auth cause, plus a loader that returned early on a failed
 *      response without ever ending its loading state.
 *
 * These assert the UI contract. The transport repair that made the routes answer is asserted in
 * `src/lib/supabaseServerBearer.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import AccountBlock from "@/components/app-shell/AccountBlock";
import MeThisWeek from "@/components/app-shell/MeThisWeek";
import { clearWeeklyActivityCache } from "@/lib/bty/daily/weeklyActivityCache";

const ORIGIN = "https://arena.btydaily.com";

function at(pathname: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(`${ORIGIN}${pathname}`),
  });
}

function stubSession(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      if (String(url).includes("/api/auth/session")) {
        return new Response(JSON.stringify(body), {
          status: ok ? 200 : 401,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }),
  );
}

const REAL_USER = {
  ok: true,
  user: {
    email: "founder@bty.example",
    user_metadata: { full_name: "Dr. Hanbit Chi (hc)", name: "Hanbit Chi" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  // MeThisWeek seeds from a module-level cache (stale-while-refresh). Without clearing it, one
  // test's successful load makes the next start already-loaded and its assertions meaningless.
  clearWeeklyActivityCache();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ACCOUNT — web and native are unchanged", () => {
  it("(1) still renders the email and BOTH controls outside Teams", async () => {
    at("/en/app");
    stubSession(REAL_USER);
    render(<AccountBlock locale="en" />);
    await waitFor(() => expect(screen.getByTestId("account-email").textContent).toBe("founder@bty.example"));
    expect(screen.getByTestId("account-switch")).toBeTruthy();
    expect(screen.getByTestId("account-signout")).toBeTruthy();
    expect(screen.queryByTestId("account-identity")).toBeNull();
  });
});

describe("ACCOUNT — the Teams host", () => {
  it("(2) NEVER renders '…'", async () => {
    at("/teams");
    stubSession({ ok: true, user: {} });
    render(<AccountBlock locale="en" />);
    await waitFor(() => expect(screen.getByTestId("account-identity")).toBeTruthy());
    expect(screen.getByTestId("account-identity").textContent).not.toBe("…");
    expect(screen.getByTestId("account-block").textContent).not.toContain("…");
  });

  it("(3) does not require — or display — an email", async () => {
    at("/teams");
    stubSession(REAL_USER);
    render(<AccountBlock locale="en" />);
    await waitFor(() => expect(screen.getByTestId("account-identity")).toBeTruthy());
    // The email was available and is still deliberately not shown: it is not identity here.
    expect(screen.getByTestId("account-block").textContent).not.toContain("founder@bty.example");
    expect(screen.queryByTestId("account-email")).toBeNull();
  });

  it("(4) shows the canonical display name, and how they are connected", async () => {
    at("/teams");
    stubSession(REAL_USER);
    render(<AccountBlock locale="en" />);
    await waitFor(() =>
      expect(screen.getByTestId("account-identity").textContent).toBe("Dr. Hanbit Chi (hc)"),
    );
    expect(screen.getByTestId("account-connection").textContent).toBe("Connected with Microsoft Teams");
  });

  it("(5) falls back safely when the record carries no name", async () => {
    at("/teams");
    stubSession({ ok: true, user: { email: "founder@bty.example", user_metadata: {} } });
    render(<AccountBlock locale="en" />);
    await waitFor(() =>
      expect(screen.getByTestId("account-identity").textContent).toBe("Microsoft Teams account"),
    );
    expect(screen.getByTestId("account-connection").textContent).toBe("Connected with Microsoft Teams");
  });

  it("(5b) still names the person even when the session request itself fails", async () => {
    at("/teams");
    stubSession({ ok: false }, false);
    render(<AccountBlock locale="en" />);
    await waitFor(() => expect(screen.getByTestId("account-identity")).toBeTruthy());
    expect(screen.getByTestId("account-identity").textContent).toBe("Microsoft Teams account");
  });

  it("(6) hides Switch account — Teams owns the workplace account", async () => {
    at("/teams");
    stubSession(REAL_USER);
    render(<AccountBlock locale="en" />);
    await waitFor(() => expect(screen.getByTestId("account-identity")).toBeTruthy());
    expect(screen.queryByTestId("account-switch")).toBeNull();
  });

  it("(7) exposes no BTY-only Sign out, which could not keep its promise", async () => {
    // The session lives in this tab's memory; the next load silently bootstraps it back.
    at("/teams");
    stubSession(REAL_USER);
    render(<AccountBlock locale="en" />);
    await waitFor(() => expect(screen.getByTestId("account-identity")).toBeTruthy());
    expect(screen.queryByTestId("account-signout")).toBeNull();
  });
});

describe("THIS WEEK — the loading state always ends", () => {
  const rhythm = [] as never[];

  function stubWeek(responder: () => Response) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) =>
        String(url).includes("/weekly-activity") ? responder() : new Response("{}", { status: 200 }),
      ),
    );
  }

  it("(12) success ends loading and shows content", async () => {
    at("/teams");
    stubWeek(() =>
      new Response(JSON.stringify({ ok: true, summary: { weeklyPoints: 12, activeDays: 3 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<MeThisWeek locale="en" weeklyRhythm={rhythm} />);
    await waitFor(() => expect(screen.queryByTestId("me-week-loading")).toBeNull());
    expect(screen.getByTestId("me-this-week").textContent).toContain("12");
    expect(screen.queryByTestId("me-week-error")).toBeNull();
  });

  it("(13) an empty week ends loading with the honest quiet state", async () => {
    at("/teams");
    stubWeek(() =>
      new Response(JSON.stringify({ ok: true, summary: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<MeThisWeek locale="en" weeklyRhythm={rhythm} />);
    await waitFor(() => expect(screen.queryByTestId("me-week-loading")).toBeNull());
    expect(screen.getByTestId("me-this-week").textContent).toContain("A quiet week so far.");
    expect(screen.queryByTestId("me-week-error")).toBeNull();
  });

  it("(14/15) a 401 ends loading with a retry — never an endless spinner", async () => {
    // The exact Founder symptom: every inline-auth route was 401 in the Teams tab.
    at("/teams");
    stubWeek(() => new Response(JSON.stringify({ ok: false }), { status: 401 }));
    render(<MeThisWeek locale="en" weeklyRhythm={rhythm} />);
    await waitFor(() => expect(screen.getByTestId("me-week-error")).toBeTruthy());
    expect(screen.queryByTestId("me-week-loading")).toBeNull();
    expect(screen.getByTestId("me-week-retry")).toBeTruthy();
  });

  it("(15b) a rejected request also ends loading", async () => {
    at("/teams");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    render(<MeThisWeek locale="en" weeklyRhythm={rhythm} />);
    await waitFor(() => expect(screen.getByTestId("me-week-error")).toBeTruthy());
    expect(screen.queryByTestId("me-week-loading")).toBeNull();
  });

  it("(15c) Retry re-issues the request and recovers", async () => {
    at("/teams");
    let first = true;
    stubWeek(() => {
      if (first) {
        first = false;
        return new Response(JSON.stringify({ ok: false }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true, summary: { weeklyPoints: 7 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    render(<MeThisWeek locale="en" weeklyRhythm={rhythm} />);
    await waitFor(() => expect(screen.getByTestId("me-week-retry")).toBeTruthy());
    fireEvent.click(screen.getByTestId("me-week-retry"));
    await waitFor(() => expect(screen.queryByTestId("me-week-error")).toBeNull());
    expect(screen.getByTestId("me-this-week").textContent).toContain("7");
  });
});
