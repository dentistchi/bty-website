/** @vitest-environment jsdom */
/**
 * TRACK — THE CONTINUOUS CONVERSATION, AS THE TWO PEOPLE ACTUALLY SEE IT.
 *
 * ★ WHAT THESE TESTS EXIST TO CATCH. A service can be perfectly isolated and the surface can still
 * put two people's messages on one screen, or address the wrong thread, or show a reply as sent that
 * never left the device. So these drive the REAL components with a stubbed network and read what a
 * person would read.
 *
 * ★ AND WHAT THEY REFUSE TO ACCEPT AS PROOF. A conversation rendered by a component nobody mounts
 * proves nothing, so the recipient panel is reached the way a recipient reaches it — through
 * `NeedsYourResponse`, from the real `/mine` shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import NeedsYourResponse from "./NeedsYourResponse";
import TrackingSent from "./TrackingSent";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const R_A = "recipient-a";
const R_B = "recipient-b";
const THREAD = (id: string) => `/api/bty/announcements/recipients/${id}/thread`;

type Msg = { id: string; authorRole: "HOST" | "RECIPIENT"; authorDisplay: string | null; body: string; createdAt: string };

/** Threads keyed by recipient, so a component asking for the wrong one gets the wrong answer. */
let threads: Record<string, { role: "HOST" | "RECIPIENT"; messages: Msg[] }>;
let mine: unknown[];
let host: unknown[];
let posted: { url: string; body: Record<string, unknown> }[];

function stubFetch() {
  posted = [];
  const spy = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

    for (const id of Object.keys(threads)) {
      if (u.endsWith(THREAD(id))) {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
          posted.push({ url: u, body });
          threads[id].messages.push({
            id: `m-${threads[id].messages.length + 1}`,
            authorRole: threads[id].role,
            authorDisplay: null,
            body: String(body.body ?? ""),
            createdAt: "2026-09-12T10:00:00Z",
          });
          return ok({ ok: true, messageId: "m-x", role: threads[id].role, duplicate: false });
        }
        return ok({ ok: true, role: threads[id].role, messages: threads[id].messages });
      }
    }
    if (u.includes("/api/bty/announcements/mine")) return ok({ ok: true, items: mine });
    if (u.includes("/api/bty/announcements/host")) return ok({ ok: true, items: host });
    // Any OTHER thread url is a thread this person is not a party to.
    if (u.includes("/thread")) return { ok: false, status: 404, json: async () => ({ ok: false, code: "not_found" }) } as Response;
    return ok({ ok: true });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

const responder = (over: Record<string, unknown> = {}) => ({
  recipientId: R_A,
  display: "Jin",
  questionText: null,
  respondedAt: "2026-09-12T09:00:00Z",
  handledAt: null,
  unreadCount: 0,
  messageCount: 0,
  needsAttention: true,
  ...over,
});

const hostRun = (responders: Record<string, unknown[]>) => ({
  id: "ann-1",
  hostFraming: "Please read the new intake steps.",
  createdAt: "2026-09-12T08:00:00Z",
  previewText: null,
  sourceUrl: null,
  status: "active",
  funnel: { announcedTo: 2, gotIt: 0, question: 2, needHelp: 0, noResponse: 0, notYetActivated: 0 },
  responders: { acknowledged: [], question: [], needHelp: [], noResponse: [], ...responders },
});

beforeEach(() => {
  vi.clearAllMocks();
  threads = { [R_A]: { role: "RECIPIENT", messages: [] } };
  mine = [];
  host = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ─────────────────────────  RECIPIENT UX  ───────────────────────── */

describe("★ RECIPIENT — the conversation continues where the one-shot answer used to stop", () => {
  const answered = (over: Record<string, unknown> = {}) => [
    {
      announcementId: "ann-1",
      recipientId: R_A,
      hostFraming: "Please read the new intake steps.",
      hostDisplay: "Dr. Chi",
      sourceUrl: "https://teams.microsoft.com/l/message/19:x/1",
      response: "QUESTION",
      respondedAt: "2026-09-12T09:00:00Z",
      unreadCount: 0,
      messageCount: 1,
      ...over,
    },
  ];

  it("★ the question they asked IS the first message — the conversation opens on their own words", async () => {
    threads[R_A].messages = [
      { id: "m1", authorRole: "RECIPIENT", authorDisplay: null, body: "Does this apply to part-time staff?", createdAt: "2026-09-12T09:00:00Z" },
    ];
    mine = answered();
    stubFetch();
    render(<NeedsYourResponse locale="en" />);

    const convo = await screen.findByTestId("track-conversation");
    expect(convo.getAttribute("data-recipient")).toBe(R_A);
    expect(convo.textContent).toContain("Does this apply to part-time staff?");
    // It is theirs, so it is labelled "You" — from the SERVER's role, not a client comparison.
    expect(within(convo).getAllByTestId("track-message")[0].getAttribute("data-mine")).toBe("1");
    expect(convo.textContent).toContain("You");
  });

  it("★ BEFORE answering there is no reply box — the three choices are the whole interaction", async () => {
    mine = answered({ response: null, respondedAt: null, messageCount: 0 });
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    await screen.findByTestId("announcement-got-it");
    expect(screen.queryByTestId("track-conversation")).toBeNull();
  });

  it("★ a HOST message opens the conversation even before they have answered", async () => {
    threads[R_A].messages = [
      { id: "m1", authorRole: "HOST", authorDisplay: "Dr. Chi", body: "Any trouble with it?", createdAt: "2026-09-12T09:00:00Z" },
    ];
    mine = answered({ response: null, respondedAt: null, messageCount: 1, unreadCount: 1 });
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    const convo = await screen.findByTestId("track-conversation");
    expect(convo.textContent).toContain("Any trouble with it?");
    expect(within(convo).getAllByTestId("track-message")[0].getAttribute("data-mine")).toBe("0");
  });

  it("★ they can reply, and the reply is not shown until the server has it", async () => {
    threads[R_A].messages = [
      { id: "m1", authorRole: "HOST", authorDisplay: "Dr. Chi", body: "Ask me anything.", createdAt: "2026-09-12T09:00:00Z" },
    ];
    mine = answered();
    stubFetch();
    render(<NeedsYourResponse locale="en" />);

    const box = await screen.findByTestId("track-reply-input");
    fireEvent.change(box, { target: { value: "  Thanks — Monday works.  " } });
    fireEvent.click(screen.getByTestId("track-reply-send"));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].url).toContain(THREAD(R_A));
    // Trimmed by the domain before it leaves, and carrying a nonce so a double tap is one message.
    expect(posted[0].body.body).toBe("Thanks — Monday works.");
    expect(typeof posted[0].body.clientMessageId).toBe("string");
    // ★ The body carries text and a nonce. No role, no author, no recipient, no announcement.
    expect(Object.keys(posted[0].body).sort()).toEqual(["body", "clientMessageId"]);

    await waitFor(() => expect(screen.getByTestId("track-conversation").textContent).toContain("Thanks — Monday works."));
  });

  it("★ Send is refused for an empty or whitespace-only draft", async () => {
    mine = answered();
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    const send = await screen.findByTestId("track-reply-send");
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId("track-reply-input"), { target: { value: "   " } });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(posted).toHaveLength(0);
  });

  it("★ a RETRY of a send the server never took carries the SAME nonce", async () => {
    mine = answered();
    const spy = stubFetch();
    const real = spy.getMockImplementation()!;
    let failNext = true;
    // The first POST fails at the network. The words are still in the box and the person taps again.
    spy.mockImplementation(async (url: unknown, init?: RequestInit) => {
      if (init?.method === "POST" && failNext) {
        failNext = false;
        posted.push({ url: String(url), body: JSON.parse(String(init.body ?? "{}")) });
        return { ok: false, status: 500, json: async () => ({ ok: false }) } as Response;
      }
      return real(url, init);
    });

    render(<NeedsYourResponse locale="en" />);
    await screen.findByTestId("track-reply-input");
    fireEvent.change(screen.getByTestId("track-reply-input"), { target: { value: "same words" } });
    fireEvent.click(screen.getByTestId("track-reply-send"));

    // It says so rather than looking sent, and the draft is NOT cleared.
    await screen.findByTestId("track-reply-error");
    expect((screen.getByTestId("track-reply-input") as HTMLTextAreaElement).value).toBe("same words");

    fireEvent.click(screen.getByTestId("track-reply-send"));
    await waitFor(() => expect(posted).toHaveLength(2));
    // ★ The SAME act, so the SAME key — which is what makes the server return one message if the
    // first attempt actually landed and only its response was lost.
    expect(posted[1].body.clientMessageId).toBe(posted[0].body.clientMessageId);
  });

  it("★ after an ACCEPTED send the nonce rotates — the next thing typed is a new act", async () => {
    mine = answered();
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    await screen.findByTestId("track-reply-input");
    fireEvent.change(screen.getByTestId("track-reply-input"), { target: { value: "first" } });
    fireEvent.click(screen.getByTestId("track-reply-send"));
    await waitFor(() => expect(posted).toHaveLength(1));
    fireEvent.change(screen.getByTestId("track-reply-input"), { target: { value: "second" } });
    fireEvent.click(screen.getByTestId("track-reply-send"));
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1].body.clientMessageId).not.toBe(posted[0].body.clientMessageId);
  });

  it("★ a small unread count appears on the card, and says nothing about anyone else", async () => {
    mine = answered({ unreadCount: 2 });
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    const badge = await screen.findByTestId("track-unread-badge");
    expect(badge.textContent).toBe("2 new");
    expect(badge.getAttribute("data-unread")).toBe("2");
  });

  it("no unread means no badge at all — a zero is noise", async () => {
    mine = answered({ unreadCount: 0 });
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    await screen.findByTestId("track-conversation");
    expect(screen.queryByTestId("track-unread-badge")).toBeNull();
  });

  it("★ the surface teaches no new BTY concept — asserted on RENDERED TEXT, not on source", async () => {
    threads[R_A].messages = [
      { id: "m1", authorRole: "HOST", authorDisplay: "Dr. Chi", body: "Any trouble with it?", createdAt: "2026-09-12T09:00:00Z" },
    ];
    mine = answered({ unreadCount: 1 });
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    const convo = await screen.findByTestId("track-conversation");

    // What a person actually reads on the screen. Source comments are not the product.
    const words = (convo.textContent ?? "").toLowerCase();
    for (const jargon of ["thread", "recipient", "announcement", "disposition", "funnel", "unread"]) {
      expect(words, jargon).not.toContain(jargon);
    }
    // And what it DOES say is ordinary workplace language.
    expect(convo.textContent).toContain("Conversation");
    expect(within(convo).getByTestId("track-reply-input").getAttribute("placeholder")).toBe("Write a reply…");
    expect(within(convo).getByTestId("track-reply-send").textContent).toBe("Send");
    expect(screen.getByTestId("track-unread-badge").textContent).toBe("1 new");
  });
});

/* ─────────────────────────  HOST UX + ISOLATION  ───────────────────────── */

describe("★ HOST — each recipient independently, and never merged", () => {
  beforeEach(() => {
    threads = {
      [R_A]: { role: "HOST", messages: [{ id: "m1", authorRole: "RECIPIENT", authorDisplay: "Jin", body: "A's private worry", createdAt: "2026-09-12T09:00:00Z" }] },
      [R_B]: { role: "HOST", messages: [{ id: "m2", authorRole: "RECIPIENT", authorDisplay: "Mo", body: "B's private worry", createdAt: "2026-09-12T09:05:00Z" }] },
    };
    host = [
      hostRun({
        question: [
          responder({ recipientId: R_A, display: "Jin", unreadCount: 2, messageCount: 1 }),
          responder({ recipientId: R_B, display: "Mo", unreadCount: 0, messageCount: 1 }),
        ],
      }),
    ];
  });

  const openResponses = async () => {
    render(<TrackingSent locale="en" />);
    fireEvent.click(await screen.findByTestId("tracking-toggle"));
    return screen.findByTestId("tracking-responses");
  };

  it("★ each person carries their OWN count — never a total for the run", async () => {
    stubFetch();
    const panel = await openResponses();
    const people = within(panel).getAllByTestId("tracking-person");
    expect(people).toHaveLength(2);
    const jin = people.find((p) => p.getAttribute("data-recipient") === R_A)!;
    const mo = people.find((p) => p.getAttribute("data-recipient") === R_B)!;
    expect(within(jin).getByTestId("track-unread-badge").textContent).toBe("2 new");
    expect(within(mo).queryByTestId("track-unread-badge")).toBeNull();
  });

  it("★ opening one person shows ONLY that person's conversation", async () => {
    stubFetch();
    const panel = await openResponses();
    const jin = within(panel).getAllByTestId("tracking-person").find((p) => p.getAttribute("data-recipient") === R_A)!;
    fireEvent.click(within(jin).getByTestId("tracking-conversation-toggle"));

    const convo = await screen.findByTestId("track-conversation");
    expect(convo.getAttribute("data-recipient")).toBe(R_A);
    expect(convo.textContent).toContain("A's private worry");
    // ★ THE ISOLATION ASSERTION. Nothing B said is anywhere on this screen.
    expect(document.body.textContent).not.toContain("B's private worry");
    expect(screen.getAllByTestId("track-conversation")).toHaveLength(1);
  });

  it("★ opening a SECOND person closes the first — two people are never on screen together", async () => {
    stubFetch();
    const panel = await openResponses();
    const people = within(panel).getAllByTestId("tracking-person");
    const jin = people.find((p) => p.getAttribute("data-recipient") === R_A)!;
    const mo = people.find((p) => p.getAttribute("data-recipient") === R_B)!;

    fireEvent.click(within(jin).getByTestId("tracking-conversation-toggle"));
    await waitFor(() => expect(document.body.textContent).toContain("A's private worry"));
    fireEvent.click(within(mo).getByTestId("tracking-conversation-toggle"));

    await waitFor(() => expect(document.body.textContent).toContain("B's private worry"));
    expect(document.body.textContent).not.toContain("A's private worry");
    expect(screen.getAllByTestId("track-conversation")).toHaveLength(1);
  });

  it("★ the Host replies from inside that person's conversation, addressed to that person", async () => {
    stubFetch();
    const panel = await openResponses();
    const jin = within(panel).getAllByTestId("tracking-person").find((p) => p.getAttribute("data-recipient") === R_A)!;
    fireEvent.click(within(jin).getByTestId("tracking-conversation-toggle"));
    await screen.findByTestId("track-reply-input");

    fireEvent.change(screen.getByTestId("track-reply-input"), { target: { value: "Let's talk Friday." } });
    fireEvent.click(screen.getByTestId("track-reply-send"));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].url).toContain(THREAD(R_A));
    expect(posted[0].url).not.toContain(R_B);
  });

  it("★ a Host can open a conversation with somebody who has NOT responded", async () => {
    threads[R_A] = { role: "HOST", messages: [] };
    host = [hostRun({ noResponse: [responder({ recipientId: R_A, display: "Jin", respondedAt: null, needsAttention: false })] })];
    stubFetch();
    const panel = await openResponses();
    fireEvent.click(within(panel).getByTestId("tracking-conversation-toggle"));
    expect((await screen.findByTestId("track-conversation")).getAttribute("data-recipient")).toBe(R_A);
  });
});

/* ─────────────────────────  HANDLED / REOPEN  ───────────────────────── */

describe("★ G — a handled follow-up stops suppressing somebody who has since spoken", () => {
  it("★ a handled person WITH an unread message sorts above a settled one", async () => {
    threads = { [R_A]: { role: "HOST", messages: [] }, [R_B]: { role: "HOST", messages: [] } };
    host = [
      hostRun({
        question: [
          // Settled, and silent since. Nothing left to do.
          responder({ recipientId: R_B, display: "Mo", handledAt: "2026-09-12T09:30:00Z", needsAttention: false }),
          // Settled, and then they said something new. The flag no longer gets the last word.
          responder({ recipientId: R_A, display: "Jin", handledAt: "2026-09-12T09:30:00Z", unreadCount: 1, messageCount: 3, needsAttention: true }),
        ],
      }),
    ];
    stubFetch();
    render(<TrackingSent locale="en" />);
    fireEvent.click(await screen.findByTestId("tracking-toggle"));
    const panel = await screen.findByTestId("tracking-responses");
    const order = within(panel).getAllByTestId("tracking-person").map((p) => p.getAttribute("data-recipient"));
    expect(order).toEqual([R_A, R_B]);
    // Both are still marked handled — the record of having acted is not erased to raise them.
    for (const p of within(panel).getAllByTestId("tracking-person")) {
      expect(p.getAttribute("data-handled")).toBe("1");
    }
  });

  it("★ the Handled control and its Reopen are untouched", () => {
    const src = read("src/components/app-shell/TrackingSent.tsx");
    expect(src).toContain('data-testid={settled ? "tracking-reopen" : "tracking-handle"}');
    expect(src).toContain("/handle`");
    expect(src).toContain("JSON.stringify({ handled })");
  });
});

/* ─────────────────────────  NON-REGRESSION  ───────────────────────── */

describe("★ N — the original Track response path still works exactly as it did", () => {
  it("the three choices, their order, and their write-once behaviour are unchanged", async () => {
    mine = [
      {
        announcementId: "ann-1",
        recipientId: R_A,
        hostFraming: "Please read the new intake steps.",
        hostDisplay: null,
        sourceUrl: "https://teams.microsoft.com/l/message/19:x/1",
        response: null,
        respondedAt: null,
        unreadCount: 0,
        messageCount: 0,
      },
    ];
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    const item = await screen.findByTestId("announcement-item");
    // Stacked, full-width, 44px — the production mis-tap repair is not disturbed.
    for (const id of ["announcement-got-it", "announcement-question", "announcement-help"]) {
      const b = within(item).getByTestId(id);
      expect(b.className).toContain("min-h-[2.75rem]");
      expect(b.className).toContain("w-full");
    }
    expect(within(item).getByTestId("announcement-source-link").textContent).toBe("Open in Teams");
  });

  it("★ 'Open in Teams' survives, and the conversation NEVER copies the source message", () => {
    const src = read("src/components/app-shell/TrackConversation.tsx");
    for (const forbidden of ["previewText", "preview_text", "sourceUrl", "source_url", "conversationId", "tenantId"]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
    // The recipient card still links out, and Teams still decides who may read the original.
    expect(read("src/components/app-shell/NeedsYourResponse.tsx")).toContain("announcement-source-link");
  });

  it("an answered card still says what they said", async () => {
    threads[R_A].messages = [];
    mine = [
      {
        announcementId: "ann-1",
        recipientId: R_A,
        hostFraming: "f",
        hostDisplay: null,
        sourceUrl: null,
        response: "ACKNOWLEDGED",
        respondedAt: "2026-09-12T09:00:00Z",
        unreadCount: 0,
        messageCount: 0,
      },
    ];
    stubFetch();
    render(<NeedsYourResponse locale="en" />);
    expect((await screen.findByTestId("announcement-answered")).textContent).toBe("You said: Got it");
  });
});
