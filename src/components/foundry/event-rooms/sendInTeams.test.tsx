/** @vitest-environment jsdom */
// @vitest-environment-options { "url": "https://arena.btydaily.com/teams" }
/**
 * "SEND IN TEAMS" — the Host's side. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * ★ WHAT REPLACED WHAT. This used to pick people and then open a Teams chat with a DRAFTED
 * invitation containing a personal-tab deep link. Real-iPhone evidence showed Teams iOS does not
 * reliably preserve that destination, so the invitation stopped being a link: the People Picker
 * stays, and BTY's bot delivers the training into each employee's own chat.
 *
 * The claims here: nothing is sent on selection alone, only Entra object ids leave the browser,
 * and outside Teams the ordinary web fallbacks are untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { FoundryShareControls } from "./FoundryShareControls";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerEvent } from "./types";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  peopleSupported: vi.fn(() => true),
  selectPeople: vi.fn<(i?: unknown) => Promise<unknown[]>>(async () => [
    { objectId: "oid-A", displayName: "Ari Kim", email: "ari@contoso.com" },
    { objectId: "oid-B", displayName: "Bo Lee", email: "bo@contoso.com" },
  ]),
  openChat: vi.fn(),
  openGroupChat: vi.fn(),
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize, getContext: vi.fn(async () => ({})) },
  people: { isSupported: H.peopleSupported, selectPeople: H.selectPeople },
  chat: { isSupported: () => true, openChat: H.openChat, openGroupChat: H.openGroupChat },
}));
vi.mock("@/lib/native/isNative", () => ({ isNative: () => false }));

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
const en = EVENT_ROOMS_COPY.en;

function event(): ManagerEvent {
  return {
    id: "ev-1",
    title: "Morning Office Opening",
    status: "open",
    content_type: "written_guidance",
    join_url: `https://arena.btydaily.com/f/${TOKEN}`,
    created_at: "2026-09-21T00:00:00Z",
    closed_at: null,
  } as ManagerEvent;
}

const setPath = (p: string) => window.history.replaceState({}, "", p);
let fetchSpy: ReturnType<typeof vi.fn>;
let sendResponse: () => Response;
let clipboard: string[];

beforeEach(() => {
  vi.clearAllMocks();
  H.peopleSupported.mockReturnValue(true);
  H.selectPeople.mockResolvedValue([
    { objectId: "oid-A", displayName: "Ari Kim", email: "ari@contoso.com" },
    { objectId: "oid-B", displayName: "Bo Lee", email: "bo@contoso.com" },
  ]);
  clipboard = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (t: string) => void clipboard.push(t) },
  });
  sendResponse = () =>
    new Response(JSON.stringify({ ok: true, sent: 2, alreadySent: 0, undeliverable: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  fetchSpy = vi.fn(async (url: unknown) =>
    String(url).includes("/teams/training/send") ? sendResponse() : new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setPath("/");
});

async function inTeams() {
  setPath("/teams");
  render(<FoundryShareControls event={event()} locale="en" t={en} />);
  await waitFor(() => expect(screen.getByTestId("send-in-teams")).toBeTruthy());
}

describe("★ nothing is sent until the Host confirms", () => {
  it("selecting people shows a confirmation and sends NOTHING", async () => {
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-confirm")).toBeTruthy());
    expect(screen.getByTestId("send-in-teams-confirm").textContent).toBe(en.sendInTeamsConfirm(2));
    expect(fetchSpy.mock.calls.filter((c) => String(c[0]).includes("/send"))).toHaveLength(0);
  });

  it("cancelling sends nothing and returns to the button", async () => {
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-cancel")).toBeTruthy());
    fireEvent.click(screen.getByTestId("send-in-teams-cancel"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams")).toBeTruthy());
    expect(fetchSpy.mock.calls.filter((c) => String(c[0]).includes("/send"))).toHaveLength(0);
  });

  it("confirming posts the send, and the Host is told the result", async () => {
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-confirm-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("send-in-teams-confirm-cta"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-status").textContent).toContain(en.sendInTeamsSent(2)));
  });
});

describe("★ only Entra object ids leave the browser", () => {
  it("the request carries the event and the object ids — no email, UPN or name", async () => {
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-confirm-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("send-in-teams-confirm-cta"));

    await waitFor(() => expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes("/send"))).toBe(true));
    const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/send"))!;
    expect(String(call[0])).toBe("/api/bty/foundry/teams/training/send");
    const body = JSON.parse(String((call[1] as RequestInit).body));
    expect(body).toEqual({ eventId: "ev-1", aadObjectIds: ["oid-A", "oid-B"] });
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/@/);
    expect(raw).not.toMatch(/Ari|Bo|contoso/);
  });

  it("the picker is org-wide and multi-select, as a personal app scope requires", async () => {
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(H.selectPeople).toHaveBeenCalled());
    expect(H.selectPeople.mock.calls[0]![0]).toMatchObject({
      openOrgWideSearchInChatOrChannel: true,
      singleSelect: false,
    });
  });
});

describe("★ the chat-compose and deep-link invitation are gone", () => {
  it("no Teams chat is ever opened for a training", async () => {
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-confirm-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("send-in-teams-confirm-cta"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-status")).toBeTruthy());
    expect(H.openChat).not.toHaveBeenCalled();
    expect(H.openGroupChat).not.toHaveBeenCalled();
  });

  it("nothing on screen offers a web room URL or the Microsoft share page", async () => {
    await inTeams();
    expect(document.body.innerHTML).not.toContain("teams.microsoft.com/share");
    expect(document.body.innerHTML).not.toContain("/f/btyfr1");
    expect(document.body.innerHTML).not.toContain("l/entity/");
  });
});

describe("a mixed or failed send is reported honestly", () => {
  it("names who could not receive it, without a Microsoft error string", async () => {
    sendResponse = () =>
      new Response(
        JSON.stringify({ ok: true, sent: 2, alreadySent: 1, undeliverable: [{ displayName: "Cam Doe", reason: "not_installed" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-confirm-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("send-in-teams-confirm-cta"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-status")).toBeTruthy());
    const status = screen.getByTestId("send-in-teams-status").textContent ?? "";
    expect(status).toContain(en.sendInTeamsMixed(2, 1));
    expect(status).toContain("Cam Doe");
    expect(status).not.toMatch(/not_installed|403|forbidden/i);
  });

  it("a refused send says so rather than claiming success", async () => {
    sendResponse = () => new Response(JSON.stringify({ error: "graph_unavailable" }), { status: 503 });
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams-confirm-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("send-in-teams-confirm-cta"));
    await waitFor(() =>
      expect(screen.getByTestId("send-in-teams-status").textContent).toBe(en.sendInTeamsUnavailable),
    );
  });

  it("an older client without the People Picker says so", async () => {
    H.peopleSupported.mockReturnValue(false);
    await inTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() =>
      expect(screen.getByTestId("send-in-teams-status").textContent).toBe(en.sendInTeamsUnavailable),
    );
  });
});

describe("★ outside Teams nothing changed", () => {
  it("the web room keeps Copy link and Share to Teams, and offers no bot send", async () => {
    setPath("/en/app");
    render(<FoundryShareControls event={event()} locale="en" t={en} />);
    await waitFor(() => expect(screen.getByLabelText(en.copyInvitation)).toBeTruthy());
    expect(screen.getByLabelText(en.shareToTeams)).toBeTruthy();
    expect(screen.queryByTestId("send-in-teams")).toBeNull();
    expect(H.selectPeople).not.toHaveBeenCalled();
  });

  it("Copy link still copies the canonical PUBLIC room URL for QR/external participation", async () => {
    setPath("/en/app");
    render(<FoundryShareControls event={event()} locale="en" t={en} />);
    fireEvent.click(screen.getByLabelText(en.copyInvitation));
    await waitFor(() => expect(clipboard.length).toBe(1));
    expect(clipboard[0]).toBe(`https://arena.btydaily.com/f/${TOKEN}`);
  });
});
