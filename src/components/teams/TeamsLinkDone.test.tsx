/** @vitest-environment jsdom */
/**
 * The first-ever sign-in popup's callback page (Slice A0-FIRST-TIME-ACTIVATION).
 *
 * ONE CLAIM ABOVE THE REST: a completed activation is reported as SUCCESS even when this window
 * cannot mint its own session. Supabase creates `auth.users` and the azure identity while handling
 * Microsoft's callback — before this page runs — so by the time a `code` is on the URL the popup's
 * job is already done. The exchange below only produces a session this window then discards.
 *
 * Getting that wrong is not cosmetic. It is measured: one real employee's identity existed from
 * 22:12:13 and the app stayed shut to them until 01:58, because the parent tab was told the
 * activation had failed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  notifySuccess: vi.fn(),
  notifyFailure: vi.fn(),
  exchangeCodeForSession: vi.fn(
    async (): Promise<{ data: { session: { access_token: string } | null }; error: { message: string } | null }> => ({
      data: { session: { access_token: "s" } },
      error: null,
    }),
  ),
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize },
  authentication: { notifySuccess: H.notifySuccess, notifyFailure: H.notifyFailure },
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { exchangeCodeForSession: H.exchangeCodeForSession } },
}));

import TeamsLinkDone from "@/components/teams/TeamsLinkDone";

function atUrl(search: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(`https://arena.btydaily.com/teams/link/done${search}`),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  H.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: "s" } }, error: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a completed activation reports SUCCESS", () => {
  it("the ordinary path notifies success", async () => {
    atUrl("?code=abc");
    render(<TeamsLinkDone />);
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalled());
    expect(H.notifyFailure).not.toHaveBeenCalled();
  });

  it("★ a FAILED code exchange still notifies success — the identity already exists", async () => {
    atUrl("?code=abc");
    H.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: "pkce" } });
    render(<TeamsLinkDone />);
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalledWith("ok"));
    expect(H.notifyFailure).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("teams-link-done").dataset.state).toBe("done"));
  });

  it("★ a THROWN code exchange still notifies success", async () => {
    atUrl("?code=abc");
    H.exchangeCodeForSession.mockRejectedValue(new Error("network"));
    render(<TeamsLinkDone />);
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalledWith("ok"));
    expect(H.notifyFailure).not.toHaveBeenCalled();
  });

  it("the payload is the literal \"ok\" and carries no token, email or user id", async () => {
    atUrl("?code=abc");
    render(<TeamsLinkDone />);
    await waitFor(() => expect(H.notifySuccess).toHaveBeenCalled());
    expect(H.notifySuccess.mock.calls).toEqual([["ok"]]);
  });
});

describe("a genuinely failed activation still reports FAILURE", () => {
  it("a provider error on the URL is a failure, and no success is claimed", async () => {
    atUrl("?error=access_denied&error_description=nope");
    render(<TeamsLinkDone />);
    await waitFor(() => expect(H.notifyFailure).toHaveBeenCalled());
    expect(H.notifySuccess).not.toHaveBeenCalled();
    // Nothing was exchanged, because there was nothing to exchange.
    expect(H.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("no code at all is a failure", async () => {
    atUrl("");
    render(<TeamsLinkDone />);
    await waitFor(() => expect(H.notifyFailure).toHaveBeenCalled());
    expect(H.notifySuccess).not.toHaveBeenCalled();
  });

  it("an error_code (rather than error) is also a failure", async () => {
    atUrl("?error_code=server_error");
    render(<TeamsLinkDone />);
    await waitFor(() => expect(H.notifyFailure).toHaveBeenCalled());
    expect(H.notifySuccess).not.toHaveBeenCalled();
  });
});
