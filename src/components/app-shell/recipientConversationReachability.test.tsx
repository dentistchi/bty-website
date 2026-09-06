/** @vitest-environment jsdom */
/**
 * RECIPIENT CONTINUATION MUST BE REACHABLE — the production device failure, as a fixture.
 *
 * ★ WHAT ACTUALLY HAPPENED (2026-09-06, real production row 7e979fc3).
 *
 * The backend was entirely correct: response=QUESTION, question_text stored, two thread messages
 * (RECIPIENT question, HOST reply), recipient unread=1, handled_at set by the Host. On the real
 * device the card rendered only the Host framing, "Open in Teams" and "You asked a question" — no
 * conversation, no unread, no Host reply, no composer, no way to continue.
 *
 * A conversation that exists but cannot be reached is not a working conversation.
 *
 * These tests pin the reachability contract at the exact state that failed, and at the neighbouring
 * states that must NOT gain a composer they never earned.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import NeedsYourResponse from "./NeedsYourResponse";

const R = "7e979fc3-43af-4893-80cf-84bd57186803";
const THREAD = `/api/bty/announcements/recipients/${R}/thread`;

type Msg = { id: string; authorRole: "HOST" | "RECIPIENT"; authorDisplay: string | null; body: string; createdAt: string };

/** The two messages that really exist on that row, verbatim. */
const PROD_MESSAGES: Msg[] = [
  { id: "m1", authorRole: "RECIPIENT", authorDisplay: null, body: "계속 대화가 되는지 확인하는 테스트 질문입니다.", createdAt: "2026-09-06T15:10:00Z" },
  { id: "m2", authorRole: "HOST", authorDisplay: "Host", body: "네, 질문 확인했습니다. 계속 답변해보겠습니다.", createdAt: "2026-09-06T15:14:00Z" },
];

let mine: unknown[];
let messages: Msg[];
let posted: { url: string; body: Record<string, unknown> }[];
let threadGets: number;

function stub() {
  posted = [];
  threadGets = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as Response;
      if (u.includes(THREAD)) {
        if (init?.method === "POST") {
          posted.push({ url: u, body: JSON.parse(String(init.body ?? "{}")) });
          messages = [
            ...messages,
            { id: `m${messages.length + 1}`, authorRole: "RECIPIENT", authorDisplay: null, body: String(JSON.parse(String(init.body)).body), createdAt: "2026-09-06T15:20:00Z" },
          ];
          return ok({ ok: true, messageId: "mx", role: "RECIPIENT", duplicate: false });
        }
        threadGets += 1;
        return ok({ ok: true, role: "RECIPIENT", messages });
      }
      if (u.includes("/api/bty/announcements/mine")) return ok({ ok: true, items: mine });
      return ok({ ok: true });
    }),
  );
}

/** The production row, projected exactly as /mine returns it. */
const card = (over: Record<string, unknown> = {}) => [
  {
    announcementId: "74ba1f44-f1a9-491e-8183-fcac07c3a1e0",
    recipientId: R,
    hostFraming: "메시지 확인하고 알려주세요",
    hostDisplay: null,
    sourceUrl: "https://teams.microsoft.com/l/message/19:x/1",
    response: "QUESTION",
    respondedAt: "2026-09-06T15:10:00Z",
    unreadCount: 1,
    messageCount: 2,
    ...over,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  messages = [...PROD_MESSAGES];
  mine = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ══════════ THE EXACT PRODUCTION STATE ══════════ */

describe("★ THE FAILING PRODUCTION STATE — QUESTION, handled by Host, 1 unread", () => {
  it("★ the Host's reply is ON SCREEN without any tap", async () => {
    mine = card();
    stub();
    render(<NeedsYourResponse locale="ko" />);
    const convo = await screen.findByTestId("track-conversation");
    expect(convo.textContent).toContain("네, 질문 확인했습니다. 계속 답변해보겠습니다.");
    // …and their own original question is still there, above it.
    expect(convo.textContent).toContain("계속 대화가 되는지 확인하는 테스트 질문입니다.");
  });

  it("★ unread is indicated, on the card and on the control", async () => {
    mine = card();
    stub();
    render(<NeedsYourResponse locale="ko" />);
    await screen.findByTestId("track-conversation");
    expect(screen.getByTestId("track-unread-badge").getAttribute("data-unread")).toBe("1");
    expect(screen.getByTestId("announcement-conversation-toggle").textContent).toContain("새 메시지 1개");
  });

  it("★ a reply composer and Send are present and usable", async () => {
    mine = card();
    stub();
    render(<NeedsYourResponse locale="ko" />);
    await screen.findByTestId("track-reply-input");
    fireEvent.change(screen.getByTestId("track-reply-input"), { target: { value: "네 확인했습니다" } });
    fireEvent.click(screen.getByTestId("track-reply-send"));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].url).toContain(THREAD);
    expect(posted[0].body.body).toBe("네 확인했습니다");
    await waitFor(() => expect(screen.getByTestId("track-conversation").textContent).toContain("네 확인했습니다"));
  });

  it("★ HANDLED DOES NOT GATE ANYTHING — the recipient projection cannot even see it", async () => {
    /*
      handled_at is the HOST's workflow state. It is not a field of RecipientProjection, so no
      branch on this surface is able to read it. Passing one changes nothing.
    */
    mine = card({ handledAt: "2026-09-06T15:18:35Z", handled: true });
    stub();
    render(<NeedsYourResponse locale="ko" />);
    const convo = await screen.findByTestId("track-conversation");
    expect(convo.textContent).toContain("네, 질문 확인했습니다");
    expect(screen.getByTestId("track-reply-input")).toBeTruthy();
    expect((screen.getByTestId("track-reply-send") as HTMLButtonElement).disabled).toBe(true); // empty draft only
  });
});

/* ══════════ AUTO-OPEN / MARK-READ ══════════ */

describe("★ auto-open on unread; reading is reaching, not listing", () => {
  it("unread = 0 still leaves the conversation REACHABLE behind one obvious control", async () => {
    mine = card({ unreadCount: 0 });
    stub();
    render(<NeedsYourResponse locale="ko" />);
    const toggle = await screen.findByTestId("announcement-conversation-toggle");
    expect(toggle.getAttribute("data-open")).toBe("0");
    expect(screen.queryByTestId("track-conversation")).toBeNull();
    // The label says what it does, in plain language, with no BTY concept in it.
    expect(toggle.textContent).toBe("대화 열기");
    fireEvent.click(toggle);
    expect((await screen.findByTestId("track-conversation")).textContent).toContain("네, 질문 확인했습니다");
  });

  it("★ collapsed means NOT FETCHED — a listed card must never mark a Host reply read", async () => {
    mine = card({ unreadCount: 0 });
    stub();
    render(<NeedsYourResponse locale="ko" />);
    await screen.findByTestId("announcement-conversation-toggle");
    await waitFor(() => expect(screen.getByTestId("announcement-item")).toBeTruthy());
    expect(threadGets, "the thread GET is the mark-read call").toBe(0);
    fireEvent.click(screen.getByTestId("announcement-conversation-toggle"));
    await screen.findByTestId("track-conversation");
    expect(threadGets, "reaching the content is what reads it").toBe(1);
  });

  it("a deliberate collapse wins over the unread default", async () => {
    mine = card();
    stub();
    render(<NeedsYourResponse locale="ko" />);
    await screen.findByTestId("track-conversation");
    fireEvent.click(screen.getByTestId("announcement-conversation-toggle"));
    await waitFor(() => expect(screen.queryByTestId("track-conversation")).toBeNull());
  });

  it("★ waiting is VISIBLE — a slow fetch never renders an empty, dead card", async () => {
    mine = card();
    let release: (v: unknown) => void = () => {};
    const pending = new Promise((r) => (release = r));
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes(THREAD)) { await pending; return { ok: true, status: 200, json: async () => ({ ok: true, role: "RECIPIENT", messages }) } as Response; }
      if (u.includes("/mine")) return { ok: true, status: 200, json: async () => ({ ok: true, items: mine }) } as Response;
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }));
    render(<NeedsYourResponse locale="ko" />);
    expect((await screen.findByTestId("track-conversation-loading")).textContent).toContain("대화를 불러오는 중");
    release(null);
    expect((await screen.findByTestId("track-conversation")).textContent).toContain("네, 질문 확인했습니다");
  });
});

/* ══════════ THE NEIGHBOURING STATES ══════════ */

describe("★ the other three states are unchanged, and ACKNOWLEDGED gains nothing", () => {
  it("response = NULL still shows exactly the three first-response buttons, and NO conversation", async () => {
    mine = card({ response: null, respondedAt: null, unreadCount: 0, messageCount: 0 });
    stub();
    render(<NeedsYourResponse locale="ko" />);
    const item = await screen.findByTestId("announcement-item");
    for (const id of ["announcement-got-it", "announcement-question", "announcement-help"]) {
      expect(within(item).getByTestId(id)).toBeTruthy();
    }
    expect(screen.queryByTestId("announcement-conversation-toggle")).toBeNull();
    expect(screen.queryByTestId("track-conversation")).toBeNull();
    expect(threadGets).toBe(0);
  });

  it("★ ACKNOWLEDGED with NO messages gets NO composer — 'Got it' is an ending", async () => {
    mine = card({ response: "ACKNOWLEDGED", unreadCount: 0, messageCount: 0 });
    stub();
    render(<NeedsYourResponse locale="ko" />);
    expect((await screen.findByTestId("announcement-answered")).textContent).toBe("답변: 확인했습니다");
    expect(screen.queryByTestId("announcement-conversation-toggle")).toBeNull();
    expect(screen.queryByTestId("track-reply-input")).toBeNull();
  });

  it("ACKNOWLEDGED DOES become reachable once the Host actually writes", async () => {
    mine = card({ response: "ACKNOWLEDGED", unreadCount: 1, messageCount: 1 });
    messages = [PROD_MESSAGES[1]];
    stub();
    render(<NeedsYourResponse locale="ko" />);
    expect((await screen.findByTestId("track-conversation")).textContent).toContain("네, 질문 확인했습니다");
  });

  it("★ HELP_NEEDED with ZERO messages is reachable and opens EMPTY — nothing is fabricated", async () => {
    mine = card({ response: "HELP_NEEDED", unreadCount: 0, messageCount: 0 });
    messages = [];
    stub();
    render(<NeedsYourResponse locale="ko" />);
    fireEvent.click(await screen.findByTestId("announcement-conversation-toggle"));
    const convo = await screen.findByTestId("track-conversation");
    expect(within(convo).getByTestId("track-conversation-empty")).toBeTruthy();
    expect(within(convo).getByTestId("track-reply-input")).toBeTruthy();
    // No invented "I need help applying this" message.
    expect(convo.textContent).not.toContain("적용에 도움이 필요합니다");
  });
});
