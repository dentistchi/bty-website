/** @vitest-environment jsdom */
/**
 * ★ INSIDE TEAMS, CHANGING LANGUAGE MUST NOT NAVIGATE — MEASURED DEVICE FAILURE.
 *
 * The previous repair sent Teams to the RIGHT url and the iPhone still failed: tapping KO opened
 * iOS's in-app browser, BTY loaded at arena.btydaily.com with no Teams host context, and the tab
 * said "BTY couldn't open yet."
 *
 * The destination was never consulted. `/teams` installs a CAPTURE-PHASE document click guard that
 * reads the anchor's OWN href and opens anything leaving `/teams` externally — correctly, since
 * every other BTY route is served `X-Frame-Options: DENY`. Our href was `/api/locale/set`, whose
 * pathname is not `/teams`, so the guard did exactly its job.
 *
 * These tests run the REAL guard — not a mock of it — over the REAL control, so they fail if the
 * language control ever becomes a link again.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { LangSwitch } from "@/components/LangSwitch";
import { installTeamsFrameContainment } from "@/lib/bty/teams/teamsTabTransport";
import { escapesTeamsFrame } from "@/domain/teams/tabRuntime";

vi.mock("next/navigation", () => ({
  usePathname: () => "/teams",
  useSearchParams: () => new URLSearchParams(""),
}));

const ORIGIN = "http://localhost:3000";
let openExternally: ReturnType<typeof vi.fn>;
let uninstall: () => void;
let fetchMock: ReturnType<typeof vi.fn>;
let windowOpen: ReturnType<typeof vi.fn>;
let pushState: ReturnType<typeof vi.spyOn>;
let replaceState: ReturnType<typeof vi.spyOn>;
let hrefBefore: string;

beforeEach(() => {
  openExternally = vi.fn();
  uninstall = installTeamsFrameContainment(openExternally);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, locale: "ko" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  windowOpen = vi.fn();
  vi.stubGlobal("open", windowOpen);
  /*
    A navigation attempt must be OBSERVABLE. jsdom's `location.assign` is non-configurable, so the
    address itself is the witness — recorded here and compared after — alongside the two history
    APIs a client-side `router.push`/`replace` would go through.
  */
  hrefBefore = window.location.href;
  pushState = vi.spyOn(window.history, "pushState");
  replaceState = vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  uninstall();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The exact reason the device failed, held as a fact rather than a memory. */
describe("★ 3 — WHY the browser opened", () => {
  it("the OLD href escapes the Teams frame; the destination is never consulted", () => {
    expect(escapesTeamsFrame("/api/locale/set?to=ko&next=%2Fteams%3Ftab%3Dme", ORIGIN)).toBe(true);
    expect(escapesTeamsFrame("/teams?tab=me", ORIGIN)).toBe(false);
  });
});

describe("★ 1-7 — the locale control in Teams is a command, and nothing navigates", () => {
  const renderCmd = (onChanged = vi.fn()) => {
    render(<LangSwitch ensureParams={{ tab: "me" }} current="en" onLocaleChanged={onChanged} />);
    return onChanged;
  };

  it("★ 1 — it renders NO link, so the capture-phase guard has nothing to find", () => {
    renderCmd();
    for (const id of ["lang-switch-en", "lang-switch-ko"]) {
      const el = screen.getByTestId(id);
      expect(el.tagName, `${id} must not be an anchor`).toBe("BUTTON");
      expect(el.getAttribute("href")).toBeNull();
      expect(el.getAttribute("target")).toBeNull();
    }
    expect(document.querySelectorAll("a[href]").length).toBe(0);
  });

  it("★ 2-3 — the canonical writer is called by fetch, non-navigating, with credentials", async () => {
    renderCmd();
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/locale/set?to=ko&mode=json");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    // It must not ask for a destination it will never follow.
    expect(url).not.toContain("next=");
  });

  it("★ 4-6 — no app.openLink, no window.open, no location change", async () => {
    renderCmd();
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(openExternally, "the Teams frame guard must never fire").not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("★ 7 — the document has not moved at all", async () => {
    renderCmd();
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(window.location.href).toBe(hrefBefore);
    expect(openExternally).not.toHaveBeenCalled();
  });

  it("★ 8 — the host is told the new locale, so the shell re-renders in place", async () => {
    const onChanged = renderCmd();
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("ko"));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("EN→KO and KO→EN both go through the same command path", async () => {
    const onChanged = vi.fn();
    render(<LangSwitch current="ko" onLocaleChanged={onChanged} />);
    fireEvent.click(screen.getByTestId("lang-switch-en"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("en"));
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/locale/set?to=en&mode=json");
    expect(openExternally).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it("the active language is marked from the resolved locale, since /teams carries none", () => {
    renderCmd();
    expect(screen.getByTestId("lang-switch-en").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("lang-switch-ko").getAttribute("aria-pressed")).toBe("false");
  });

  it("a second tap mid-flight cannot race two writes for one preference", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(
      () => new Promise((r) => { release = () => r(new Response("{}", { status: 200 })); }),
    );
    renderCmd();
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    fireEvent.click(screen.getByTestId("lang-switch-en"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect((screen.getByTestId("lang-switch-ko") as HTMLButtonElement).disabled).toBe(false));
  });
});

describe("★ 10 — a failed write stays exactly where it is", () => {
  for (const [name, impl] of [
    ["a rejected request", () => Promise.reject(new Error("offline"))],
    ["a server refusal", async () => new Response("{}", { status: 500 })],
  ] as const) {
    it(`${name}: no navigation, no browser, no login — and it says so, truthfully`, async () => {
      fetchMock.mockImplementation(impl as never);
      const onChanged = vi.fn();
      render(<LangSwitch current="en" onLocaleChanged={onChanged} />);
      fireEvent.click(screen.getByTestId("lang-switch-ko"));
      await waitFor(() => expect(screen.getByTestId("lang-switch-error")).toBeTruthy());
      expect(screen.getByTestId("lang-switch-error").textContent).toBe("Language couldn't be changed.");
      expect(onChanged, "the language did not change, so the shell must not be told it did").not.toHaveBeenCalled();
      expect(openExternally).not.toHaveBeenCalled();
      expect(windowOpen).not.toHaveBeenCalled();
      expect(window.location.href, "a failure must not move the document").toBe(hrefBefore);
      expect(pushState).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]'), "no modal").toBeNull();
      // The same control is the retry.
      expect((screen.getByTestId("lang-switch-ko") as HTMLButtonElement).disabled).toBe(false);
    });
  }

  it("the error is written in the language the person is currently reading", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    render(<LangSwitch current="ko" onLocaleChanged={vi.fn()} />);
    fireEvent.click(screen.getByTestId("lang-switch-en"));
    await waitFor(() => expect(screen.getByTestId("lang-switch-error").textContent).toBe("언어를 바꾸지 못했습니다."));
  });
});

describe("★ 12 — frame containment is UNCHANGED for genuine external links", () => {
  it("a real link off /teams is still opened externally by the guard", () => {
    render(<a href="/en/bty/leaderboard" data-testid="real-link">Leaderboard</a>);
    fireEvent.click(screen.getByTestId("real-link"), { button: 0 });
    expect(openExternally).toHaveBeenCalledTimes(1);
    expect(openExternally.mock.calls[0][0]).toContain("/en/bty/leaderboard");
  });

  it("a link that stays inside /teams is still left alone", () => {
    render(<a href="/teams?tab=me" data-testid="inside-link">Me</a>);
    fireEvent.click(screen.getByTestId("inside-link"), { button: 0 });
    expect(openExternally).not.toHaveBeenCalled();
  });
});

describe("★ 11 — standalone web is untouched: no callback, no command mode", () => {
  it("without onLocaleChanged it is still two links through the redirecting writer", () => {
    render(<LangSwitch ensureParams={{ tab: "me" }} />);
    for (const id of ["lang-switch-en", "lang-switch-ko"]) {
      const el = screen.getByTestId(id);
      expect(el.tagName).toBe("A");
      expect(el.getAttribute("href")).toContain("/api/locale/set?to=");
      expect(el.getAttribute("href")).not.toContain("mode=json");
    }
  });

  it("and clicking one performs NO fetch — the server redirect is still the transport", () => {
    render(<LangSwitch />);
    fireEvent.click(screen.getByTestId("lang-switch-ko"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
