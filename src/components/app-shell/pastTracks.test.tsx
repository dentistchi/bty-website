/** @vitest-environment jsdom */
/**
 * ★ Me → PAST TRACKS: the door back to a Track that left Today.
 *
 * Today lets a person remove a settled Track, and every earlier slice made sure the record survives
 * that. Nothing showed it to them afterwards — and for a Track whose Host account has been deleted
 * that was permanent, because no new activity can ever lift it back onto Today. Preserving a row
 * nobody can reach is not preservation.
 *
 * These tests hold what the surface must be: retrieval, read-only, one door, and never a second
 * Today.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import PastTracks from "@/components/app-shell/PastTracks";

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

vi.mock("@/components/app-shell/TrackConversation", () => ({
  default: (p: { recipientId: string; readOnly?: boolean }) => (
    <div data-testid="convo" data-recipient={p.recipientId} data-readonly={p.readOnly ? "1" : "0"} />
  ),
}));

const RECIPIENT = {
  announcementId: "a1", recipientId: "r1", hostFraming: "Please read the intake steps",
  hostDisplay: "Dr. Chi", sourceUrl: null, response: "QUESTION", respondedAt: "2026-09-01T00:00:00Z",
  unreadCount: 0, messageCount: 2, hostAvailable: true,
};
const ORPHAN = { ...RECIPIENT, recipientId: "r2", hostDisplay: null, hostAvailable: false };
const HOSTRUN = {
  id: "h1", hostFraming: "New rota", createdAt: "2026-09-01T00:00:00Z", previewText: null, sourceUrl: null,
  status: "closed" as const,
  funnel: { announcedTo: 3, gotIt: 1, question: 1, needHelp: 0, noResponse: 1, notYetActivated: 0 },
  responders: {
    acknowledged: [{ recipientId: "r9", display: "Sam", messageCount: 0 }],
    question: [{ recipientId: "r8", display: null, messageCount: 4 }],
    needHelp: [], noResponse: [],
  },
};

let calls: string[] = [];
function mockFetch(mine: unknown[], host: unknown[], ok = true) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    if (!ok) return new Response("{}", { status: 500 });
    const items = url.includes("/mine") ? mine : host;
    return new Response(JSON.stringify({ items }), { status: 200 });
  }));
}

beforeEach(() => mockFetch([], []));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("★ it asks for the PAST half of the partition, from both sides", () => {
  it("★ both scopes are requested, both with scope=past, both with credentials", async () => {
    mockFetch([RECIPIENT], [HOSTRUN]);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toContain("/api/bty/announcements/mine?scope=past");
    expect(calls).toContain("/api/bty/announcements/host?scope=past");
    const f = vi.mocked(fetch);
    for (const c of f.mock.calls) expect((c[1] as RequestInit).credentials).toBe("include");
  });

  it("★ a partial answer is an ERROR, never a short list", async () => {
    // Someone hunting for a Track they know exists must not be shown half the archive and no sign.
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("/mine") ? new Response(JSON.stringify({ items: [RECIPIENT] }), { status: 200 })
                            : new Response("{}", { status: 500 })));
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-tracks-error")).toBeTruthy());
    expect(screen.queryByTestId("past-track-recipient")).toBeNull();
  });
});

describe("★ B — one surface, two sections", () => {
  it("renders both headings when both sides have history", async () => {
    mockFetch([RECIPIENT], [HOSTRUN]);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-tracks-from-others")).toBeTruthy());
    expect(screen.getByText("From others")).toBeTruthy();
    expect(screen.getByText("You tracked")).toBeTruthy();
  });

  it("a section with nothing in it is not rendered at all", async () => {
    mockFetch([RECIPIENT], []);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-tracks-from-others")).toBeTruthy());
    expect(screen.queryByTestId("past-tracks-you-tracked")).toBeNull();
  });

  it("Korean headings", async () => {
    mockFetch([RECIPIENT], [HOSTRUN]);
    render(<PastTracks locale="ko" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("받은 Track")).toBeTruthy());
    expect(screen.getByText("내가 Track한 항목")).toBeTruthy();
    expect(screen.getByText("지난 Track")).toBeTruthy();
  });
});

describe("★ K — the empty state is short and truthful", () => {
  it("EN", async () => {
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-tracks-empty").textContent).toBe("No past Tracks yet."));
  });
  it("KO", async () => {
    render(<PastTracks locale="ko" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-tracks-empty").textContent).toBe("아직 지난 Track이 없습니다."));
  });
  it("★ it explains nothing else — no onboarding, no definition of a Track", async () => {
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-tracks-empty")).toBeTruthy());
    expect(screen.getByTestId("past-tracks").textContent).not.toMatch(/what is|BTY helps|track lets you/i);
  });
});

describe("★ A/E — a LIVE conversation is not frozen; a dead one is", () => {
  const openConvo = async () => {
    fireEvent.click(await screen.findByTestId("past-track-conversation-toggle"));
    return screen.findByTestId("convo");
  };

  it("★ 1. live active recipient Track → the composer is THERE", async () => {
    mockFetch([{ ...RECIPIENT, status: "active" }], []);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    expect((await openConvo()).getAttribute("data-readonly")).toBe("0");
  });

  it("★ 2. live active Host Track → the composer is THERE", async () => {
    mockFetch([], [{ ...HOSTRUN, status: "active" as const }]);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId("past-track-responder")).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId("past-track-responder")[0]);
    expect((await screen.findByTestId("convo")).getAttribute("data-readonly")).toBe("0");
  });

  it("★ 3. ownerless → read-only, no composer", async () => {
    mockFetch([ORPHAN], []);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    expect((await openConvo()).getAttribute("data-readonly")).toBe("1");
  });

  it("★ 4. closed → read-only, no composer, on BOTH sides", async () => {
    mockFetch([{ ...RECIPIENT, status: "closed" }], []);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    expect((await openConvo()).getAttribute("data-readonly")).toBe("1");
    cleanup();
    mockFetch([], [HOSTRUN]); // HOSTRUN is status: "closed"
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId("past-track-responder")).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId("past-track-responder")[0]);
    expect((await screen.findByTestId("convo")).getAttribute("data-readonly")).toBe("1");
  });

  it("★ the derivation uses the CANONICAL fields, not a second status system", () => {
    const src = code(readFileSync("src/components/app-shell/PastTracks.tsx", "utf8"));
    expect(src).toMatch(/card\.hostAvailable === false \|\| card\.status === "closed"/);
    expect(src, "no invented lifecycle vocabulary").not.toMatch(/archived|frozenAt|isArchive/i);
  });

  it("★ a live Track with NO messages yet can still start one", async () => {
    mockFetch([{ ...RECIPIENT, messageCount: 0, status: "active" }], []);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    expect((await openConvo()).getAttribute("data-readonly")).toBe("0");
  });

  it("a FROZEN Track with no messages offers no door at all — there is nothing to read or write", async () => {
    mockFetch([{ ...ORPHAN, messageCount: 0 }], []);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-track-recipient")).toBeTruthy());
    expect(screen.queryByTestId("past-track-conversation-toggle")).toBeNull();
  });
});

describe("★ E/9 — Past offers the conversation and NOTHING else", () => {
  it("★ no obligation controls, no lifecycle controls, no Restore or Un-dismiss", async () => {
    mockFetch([RECIPIENT, ORPHAN], [HOSTRUN]);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId("past-track-recipient")).toHaveLength(2));
    const txt = screen.getByTestId("past-tracks").textContent ?? "";
    for (const gone of ["Got it", "I have a question", "I need help", "Remove", "Restore", "Reopen", "Un-dismiss", "Handled"]) {
      expect(txt, `"${gone}" must not be offered in Past`).not.toContain(gone);
    }
    expect(screen.queryByTestId("today-swipe-row"), "no swipe tray").toBeNull();
  });

  it("★ 9. the file writes NO state — the only writes it can cause are messages in a thread", () => {
    /*
      A Track moves between Today and Past because of ACTIVITY, never because somebody pressed
      something here. So this surface must not touch dismissals, responses, handled state or
      lifecycle — the conversation component owns the one write that is allowed.
    */
    const src = code(readFileSync("src/components/app-shell/PastTracks.tsx", "utf8"));
    expect(src, "no dismissal write").not.toMatch(/today\/dismiss/);
    expect(src, "no first-response write").not.toMatch(/\/respond\b/);
    expect(src, "no handle write").not.toMatch(/\/handle\b/);
    expect(src, "no restore/un-dismiss concept").not.toMatch(/restore|undismiss|un_dismiss|reopen/i);
    // Its OWN fetches are the two read-only scope reads; writing belongs to TrackConversation.
    const fetches = [...src.matchAll(/fetch\(\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(fetches.sort()).toEqual([
      "/api/bty/announcements/host?scope=past",
      "/api/bty/announcements/mine?scope=past",
    ]);
  });
});

describe("★ D/I — the ownerless Track, which is why this surface exists", () => {
  it("★ it is retrievable, carries the historical note, and names no identity", async () => {
    mockFetch([ORPHAN], []);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-track-recipient")).toBeTruthy());
    expect(screen.getByTestId("past-track-recipient").getAttribute("data-host-gone")).toBe("1");
    expect(screen.getByTestId("past-track-host-gone").textContent).toBe("Host account removed. This Track is read-only.");
    expect(screen.getByText("Host"), "the fallback label, never a name it cannot read").toBeTruthy();
  });

  it("★ KO note", async () => {
    mockFetch([ORPHAN], []);
    render(<PastTracks locale="ko" onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("past-track-host-gone").textContent).toBe(
        "Host 계정이 삭제되어 이 Track은 기록으로만 남아 있습니다.",
      ));
  });

  it("★ N — no snapshot, no email, no UPN can reach this screen", async () => {
    mockFetch([ORPHAN], [HOSTRUN]);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-track-recipient")).toBeTruthy());
    const txt = screen.getByTestId("past-tracks").textContent ?? "";
    expect(txt).not.toMatch(/@|snapshot|owner_user_id/i);
    const src = code(readFileSync("src/components/app-shell/PastTracks.tsx", "utf8"));
    for (const forbidden of ["owner_user_id_snapshot", "email", "upn", "userPrincipalName"]) {
      expect(src.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase());
    }
  });

  it("a live Track carries no historical note", async () => {
    mockFetch([RECIPIENT], []);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-track-recipient")).toBeTruthy());
    expect(screen.queryByTestId("past-track-host-gone")).toBeNull();
  });
});

describe("★ the Host section reads back an owned run", () => {
  it("shows the framing, who it went to, and the closed marker", async () => {
    mockFetch([], [HOSTRUN]);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("past-track-host")).toBeTruthy());
    const txt = screen.getByTestId("past-track-host").textContent ?? "";
    expect(txt).toContain("New rota");
    expect(txt).toContain("Sent to 3");
    expect(txt).toContain("Closed");
  });

  it("★ a responder with no conversation cannot be opened; one with a conversation can", async () => {
    mockFetch([], [HOSTRUN]);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId("past-track-responder")).toHaveLength(2));
    const [withMsgs, without] = screen.getAllByTestId("past-track-responder") as HTMLButtonElement[];
    expect(withMsgs.disabled, "the person who wrote 4 messages").toBe(false);
    expect(without.disabled, "the person who wrote none").toBe(true);
    fireEvent.click(withMsgs);
    expect((await screen.findByTestId("convo")).getAttribute("data-readonly")).toBe("1");
  });

  it("an unnamed bound recipient still appears, unnamed — never invented", async () => {
    mockFetch([], [HOSTRUN]);
    render(<PastTracks locale="en" onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId("past-track-responder")).toHaveLength(2));
    expect(screen.getAllByTestId("past-track-responder")[0].textContent).toBe("Host");
  });
});

describe("★ A — the entry point is one quiet row under Me", () => {
  const SHELL = readFileSync("src/components/app-shell/BtyDailyAppShell.tsx", "utf8");

  it("★ it lives in the existing 'My records' nav, not a new tab", () => {
    expect(SHELL).toContain('data-testid={r.id}');
    expect(SHELL).toContain('id: "me-row-past-tracks"');
    expect(SHELL).toContain('"지난 Track" : "Past Tracks"');
    expect(SHELL).toContain('setMeView("past-tracks")');
  });

  it("★ NO new top-level tab, and no Center/Arena/Foundry revival", () => {
    const c = code(SHELL);
    const tabs = c.match(/AppTabBar[\s\S]{0,200}/)?.[0] ?? "";
    expect(tabs).not.toMatch(/past/i);
    expect(c).not.toMatch(/setTab\("past/);
  });

  it("★ it uses the same meView pattern as the rows beside it", () => {
    expect(SHELL).toMatch(/"home" \| "center" \| "my-learning" \| "past-tracks" \| "account"/);
    expect(SHELL).toContain('meView === "past-tracks"');
    expect(SHELL).toContain('onBack={() => setMeView("home")}');
  });

  it("★ G — Remove keeps its name; this slice renames nothing", () => {
    const ui = readFileSync("src/components/app-shell/NeedsYourResponse.tsx", "utf8");
    expect(ui).toContain('remove: "Remove"');
    expect(ui).toContain('remove: "치우기"');
    expect(ui, "no confirmation dialog was added").not.toMatch(/window\.confirm|role="alertdialog"/);
  });
});
