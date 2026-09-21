/** @vitest-environment jsdom */
/*
  A REAL ORIGIN, because the deep-link builder requires https — an http origin yields no link at
  all, which is the correct production behaviour and would otherwise make this suite test nothing.
*/
// @vitest-environment-options { "url": "https://arena.btydaily.com/teams" }
/**
 * "SEND IN TEAMS" — the Host's side. Slice Teams-Native Delivery V1.
 *
 * The acceptance conditions this file holds:
 *   - inside Teams the old web Share-to-Teams URL is never used and never offered;
 *   - the invitation carries the PERSONAL-TAB deep link, never a raw `/f/<token>` web URL;
 *   - people are chosen in Teams' own org-wide picker and a chat is opened with a DRAFT;
 *   - an older client that cannot do either falls back honestly — still to the deep link;
 *   - outside Teams, everything is exactly as it was.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { FoundryShareControls } from "./FoundryShareControls";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerEvent } from "./types";

const H = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  getContext: vi.fn(async () => ({ user: { displayName: "Hanbit" } })),
  peopleSupported: vi.fn(() => true),
  chatSupported: vi.fn(() => true),
  selectPeople: vi.fn<(inputs?: unknown) => Promise<unknown[]>>(async () => [
    { objectId: "oid-A", displayName: "Ari Kim", email: "ari@contoso.com" },
  ]),
  openChat: vi.fn<(req: unknown) => Promise<void>>(async () => {}),
  openGroupChat: vi.fn<(req: unknown) => Promise<void>>(async () => {}),
}));

vi.mock("@microsoft/teams-js", () => ({
  app: { initialize: H.initialize, getContext: H.getContext },
  people: { isSupported: H.peopleSupported, selectPeople: H.selectPeople },
  chat: { isSupported: H.chatSupported, openChat: H.openChat, openGroupChat: H.openGroupChat },
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

function setPath(pathname: string) {
  window.history.replaceState({}, "", pathname);
}

let clipboard: string[];
beforeEach(() => {
  vi.clearAllMocks();
  clipboard = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (t: string) => void clipboard.push(t) },
  });
  H.peopleSupported.mockReturnValue(true);
  H.chatSupported.mockReturnValue(true);
  H.selectPeople.mockResolvedValue([{ objectId: "oid-A", displayName: "Ari Kim", email: "ari@contoso.com" }]);
});
afterEach(() => {
  cleanup();
  setPath("/");
});

async function renderInTeams() {
  setPath("/teams");
  render(<FoundryShareControls event={event()} locale="en" t={en} />);
  await waitFor(() => expect(screen.getByTestId("send-in-teams")).toBeTruthy());
}

describe("inside Teams the Host never leaves Teams", () => {
  it("offers Send in Teams, and NOT the old web Share-to-Teams action", async () => {
    await renderInTeams();
    expect(screen.getByTestId("send-in-teams").textContent).toBe(en.sendInTeams);
    expect(screen.queryByLabelText(en.shareToTeams)).toBeNull();
    // Nothing on screen points at Microsoft's web share page.
    expect(document.body.innerHTML).not.toContain("teams.microsoft.com/share");
  });

  it("picks people ORG-WIDE and multi-select, as a personal app scope requires", async () => {
    await renderInTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(H.selectPeople).toHaveBeenCalled());
    expect(H.selectPeople.mock.calls[0]![0]).toMatchObject({
      openOrgWideSearchInChatOrChannel: true,
      singleSelect: false,
    });
  });

  it("opens a chat with the invitation DRAFTED — and BTY never sends it", async () => {
    await renderInTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(H.openChat).toHaveBeenCalled());
    const req = H.openChat.mock.calls[0]![0] as unknown as { user: string; message: string };
    expect(req.user).toBe("ari@contoso.com");
    expect(req.message).toContain("Hanbit shared training with you:");
    expect(req.message).toContain("Morning Office Opening");
    expect(req.message).toContain("https://teams.microsoft.com/l/entity/");
    // THE ACCEPTANCE CONDITION.
    expect(req.message).not.toMatch(/\/f\/btyfr1/);
    await waitFor(() => expect(screen.getAllByText(en.sendInTeamsComposed).length).toBeGreaterThan(0));
  });

  it("uses a GROUP chat for several people, addressed by their chat addresses", async () => {
    H.selectPeople.mockResolvedValue([
      { objectId: "oid-A", displayName: "Ari", email: "ari@contoso.com" },
      { objectId: "oid-B", displayName: "Bo", email: "bo@contoso.com" },
    ]);
    await renderInTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(H.openGroupChat).toHaveBeenCalled());
    expect((H.openGroupChat.mock.calls[0]![0] as unknown as { users: string[] }).users).toEqual([
      "ari@contoso.com",
      "bo@contoso.com",
    ]);
  });

  it("the secondary action copies the DEEP LINK, never the web room URL", async () => {
    await renderInTeams();
    fireEvent.click(screen.getByTestId("copy-teams-link"));
    await waitFor(() => expect(clipboard.length).toBe(1));
    expect(clipboard[0]).toContain("https://teams.microsoft.com/l/entity/");
    expect(clipboard[0]).not.toContain("/f/");
  });
});

describe("capability checks fail honestly, and still Teams-native", () => {
  it.each([
    ["people", () => H.peopleSupported.mockReturnValue(false)],
    ["chat", () => H.chatSupported.mockReturnValue(false)],
  ])("an older client without %s support copies the deep link and says so", async (_which, disable) => {
    disable();
    await renderInTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getAllByText(en.sendInTeamsUnsupported).length).toBeGreaterThan(0));
    expect(clipboard[0]).toContain("https://teams.microsoft.com/l/entity/");
    expect(clipboard[0]).not.toContain("/f/");
  });

  it("a dismissed picker is a cancellation, not an error and not a share", async () => {
    H.selectPeople.mockRejectedValue(new Error("user cancelled"));
    await renderInTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getByTestId("send-in-teams").textContent).toBe(en.sendInTeams));
    expect(H.openChat).not.toHaveBeenCalled();
    expect(screen.queryAllByText(en.sendInTeamsComposed)).toHaveLength(0);
    expect(clipboard).toEqual([]);
  });

  it("a person with no chat address cannot be messaged — and is not silently dropped into one", async () => {
    H.selectPeople.mockResolvedValue([{ objectId: "oid-A", displayName: "Ari Kim" }]);
    await renderInTeams();
    fireEvent.click(screen.getByTestId("send-in-teams"));
    await waitFor(() => expect(screen.getAllByText(en.sendInTeamsUnsupported).length).toBeGreaterThan(0));
    expect(H.openChat).not.toHaveBeenCalled();
    expect(H.openGroupChat).not.toHaveBeenCalled();
  });
});

describe("outside Teams nothing changed", () => {
  it("the web room still offers Copy link + Share to Teams, and no Teams-native button", async () => {
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
