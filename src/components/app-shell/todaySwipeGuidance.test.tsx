/** @vitest-environment jsdom */
/**
 * "I SWIPED AND BTY TOLD ME WHAT TO DO" — the six real production states.
 *
 * ★ THE DEFECT THESE PIN. On the Founder's device some Track cards slid open and offered Remove
 * while others would not move at all, with nothing anywhere explaining the difference. The cause
 * was not eligibility — that rule was right and is UNCHANGED here — it was that a blocked card
 * refused the gesture instead of answering it. `enabled: false` returned from `onTouchStart`
 * before the finger was even recorded, so the row physically could not travel.
 *
 * Fixtures A–F are the states that actually exist in production, including the two the Founder
 * named by id. Every expectation is driven by the ONE canonical domain rule, so a component can
 * never grow a second opinion about what a card is allowed to do.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import NeedsYourResponse from "./NeedsYourResponse";
import TrackingSent from "./TrackingSent";

const R_A = "7e979fc3-43af-4893-80cf-84bd57186803";
const ANN = "74ba1f44-f1a9-491e-8183-fcac07c3a1e0";

let mine: unknown[];
let host: unknown[];
let posted: { url: string; body: unknown }[];
let threadGets: string[];

function stub() {
  posted = [];
  threadGets = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as Response;
    if (u.includes("/api/me/today/dismiss")) {
      posted.push({ url: u, body: JSON.parse(String(init?.body ?? "{}")) });
      mine = []; host = [];
      return ok({ ok: true, dismissedAt: "2026-09-13T00:00:00Z", activityVersion: 1 });
    }
    if (u.includes("/thread")) {
      threadGets.push(u);
      return ok({ ok: true, role: "RECIPIENT", messages: [
        { id: "m1", authorRole: "HOST", authorDisplay: "Host", body: "네, 질문 확인했습니다.", createdAt: "2026-09-06T15:14:00Z" },
      ] });
    }
    if (u.includes("/handle")) { posted.push({ url: u, body: JSON.parse(String(init?.body ?? "{}")) }); return ok({ ok: true, handled: true }); }
    if (u.includes("/api/bty/announcements/mine")) return ok({ ok: true, items: mine });
    if (u.includes("/api/bty/announcements/host")) return ok({ ok: true, items: host });
    return ok({ ok: true });
  }));
}

const rcard = (over: Record<string, unknown> = {}) => [{
  announcementId: ANN, recipientId: R_A, hostFraming: "메시지 확인하고 알려주세요",
  hostDisplay: null, sourceUrl: null, response: "QUESTION", respondedAt: "2026-09-06T15:10:00Z",
  unreadCount: 0, messageCount: 2, ...over,
}];

const responder = (over: Record<string, unknown> = {}) => ({
  recipientId: R_A, display: "Jin", questionText: "계속 대화가 되는지 확인하는 테스트 질문입니다.",
  respondedAt: "2026-09-06T15:10:00Z", handledAt: null, unreadCount: 0, messageCount: 2,
  needsAttention: true, ...over,
});
const hrun = (responders: Record<string, unknown[]>) => [{
  id: ANN, hostFraming: "메시지 확인하고 알려주세요", createdAt: "2026-09-06T08:00:00Z",
  previewText: null, sourceUrl: null, status: "active",
  funnel: { announcedTo: 1, gotIt: 0, question: 1, needHelp: 0, noResponse: 0, notYetActivated: 0 },
  responders: { acknowledged: [], question: [], needHelp: [], noResponse: [], ...responders },
}];

const swipeLeft = (el: HTMLElement) => {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 90, clientY: 100 }] });
  fireEvent.touchEnd(el, {});
};
const tray = async () => {
  const row = await screen.findByTestId("today-swipe-row");
  swipeLeft(within(row).getByTestId("today-swipe-surface"));
  return within(row).findByTestId("today-swipe-action");
};

beforeEach(() => { vi.clearAllMocks(); mine = []; host = []; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/* ══════════ HOST FIXTURES A · B · C ══════════ */

describe("★ HOST — the two states the Founder named, and the settled one", () => {
  it("★ FIXTURE A — QUESTION, host unread 1, not handled → Read reply, and it OPENS that conversation", async () => {
    host = hrun({ question: [responder({ unreadCount: 1, needsAttention: true })] });
    stub();
    render(<TrackingSent locale="en" />);
    const btn = await tray();
    expect(btn.textContent).toBe("Read reply");
    expect(btn.getAttribute("data-tone")).toBe("guidance");
    expect(btn.className, "guidance is never red").not.toContain("bg-[#B3261E]");

    fireEvent.click(btn);
    // It opens THAT recipient's conversation — the existing surface, not a new modal.
    const convo = await screen.findByTestId("track-conversation");
    expect(convo.getAttribute("data-recipient")).toBe(R_A);
    // ★ and it does NOT mark handled.
    expect(posted.filter((p) => p.url.includes("/handle"))).toHaveLength(0);
  });

  it("★ FIXTURE B — QUESTION, unread 0, not handled → Handle first, opening the existing controls", async () => {
    host = hrun({ question: [responder({ unreadCount: 0, needsAttention: true })] });
    stub();
    render(<TrackingSent locale="en" />);
    const btn = await tray();
    expect(btn.textContent).toBe("Handle first");
    expect(btn.getAttribute("data-tone")).toBe("guidance");

    fireEvent.click(btn);
    // The run's own responses expand, where the existing Mark handled control already lives.
    const panel = await screen.findByTestId("tracking-responses");
    expect(within(panel).getByTestId("tracking-handle")).toBeTruthy();
    // ★ nothing was handled BY THE SWIPE.
    expect(posted.filter((p) => p.url.includes("/handle"))).toHaveLength(0);
    expect(posted.filter((p) => p.url.includes("dismiss"))).toHaveLength(0);
  });

  it("★ FIXTURE C — QUESTION, unread 0, HANDLED → red Remove", async () => {
    host = hrun({ question: [responder({ handledAt: "2026-09-06T08:18:35Z", needsAttention: false })] });
    stub();
    render(<TrackingSent locale="en" />);
    const btn = await tray();
    expect(btn.textContent).toBe("Remove");
    expect(btn.getAttribute("data-tone")).toBe("destructive");
    expect(btn.className).toContain("bg-[#B3261E]");
    fireEvent.click(btn);
    await waitFor(() => expect(posted.filter((p) => p.url.includes("dismiss"))).toHaveLength(1));
    expect(posted[0].body).toEqual({ itemKind: "track_host", itemId: ANN });
  });
});

/* ══════════ RECIPIENT FIXTURES D · E · F ══════════ */

describe("★ RECIPIENT — unanswered, unread, and settled", () => {
  it("★ FIXTURE D — response NULL → Respond first, and the three choices stay primary", async () => {
    mine = rcard({ response: null, respondedAt: null, messageCount: 0, unreadCount: 0 });
    stub();
    render(<NeedsYourResponse locale="en" />);
    const item = await screen.findByTestId("announcement-item");
    // The existing first-response UI is untouched and remains the primary path.
    for (const id of ["announcement-got-it", "announcement-question", "announcement-help"]) {
      expect(within(item).getByTestId(id)).toBeTruthy();
    }
    const btn = await tray();
    expect(btn.textContent).toBe("Respond first");
    expect(btn.getAttribute("data-tone")).toBe("guidance");

    fireEvent.click(btn);
    // It submits NOTHING and leaves the choices in front of them.
    expect(posted).toHaveLength(0);
    for (const id of ["announcement-got-it", "announcement-question", "announcement-help"]) {
      expect(within(await screen.findByTestId("announcement-item")).getByTestId(id)).toBeTruthy();
    }
  });

  it("★ FIXTURE E — answered, recipient unread 1 → Read reply, and it opens the conversation", async () => {
    mine = rcard({ unreadCount: 1 });
    stub();
    render(<NeedsYourResponse locale="en" />);
    const btn = await tray();
    expect(btn.textContent).toBe("Read reply");
    expect(btn.getAttribute("data-tone")).toBe("guidance");
    fireEvent.click(btn);
    expect((await screen.findByTestId("track-conversation")).getAttribute("data-recipient")).toBe(R_A);
    expect(posted, "guidance dismisses nothing").toHaveLength(0);
  });

  it("★ FIXTURE F — answered, unread 0 → red Remove", async () => {
    mine = rcard({ unreadCount: 0 });
    stub();
    render(<NeedsYourResponse locale="en" />);
    const btn = await tray();
    expect(btn.textContent).toBe("Remove");
    expect(btn.getAttribute("data-tone")).toBe("destructive");
    fireEvent.click(btn);
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].body).toEqual({ itemKind: "track_recipient", itemId: R_A });
  });
});

/* ══════════ THE DEFECT ITSELF, AND THE QUIET RESTING CARD ══════════ */

describe("★ no card is silent, and no card gains resting clutter", () => {
  it("★ EVERY state moves and says something — none refuses the gesture", async () => {
    for (const [label, over] of [
      ["needs_response", { response: null, respondedAt: null }],
      ["unread", { unreadCount: 1 }],
      ["removable", { unreadCount: 0 }],
    ] as const) {
      cleanup();
      mine = rcard(over);
      stub();
      render(<NeedsYourResponse locale="en" />);
      const btn = await tray();
      expect(btn.textContent, label).toBeTruthy();
      expect(btn.className, `${label}: 44px target`).toContain("items-center");
    }
  });

  it("★ AT REST there is no tray, no Remove, and no explanatory row", async () => {
    for (const over of [{ response: null, respondedAt: null }, { unreadCount: 1 }, { unreadCount: 0 }]) {
      cleanup();
      mine = rcard(over);
      stub();
      render(<NeedsYourResponse locale="en" />);
      await screen.findByTestId("announcement-item");
      expect(screen.queryByTestId("today-swipe-tray"), "no resting tray").toBeNull();
      // The accessibility control is present but visually absent until focused.
      const a11y = screen.getByTestId("announcement-remove");
      expect(a11y.className).toContain("sr-only");
      expect(a11y.className).toContain("focus:not-sr-only");
      // No lock icon, no "can't remove" copy, no disabled button.
      const text = screen.getByTestId("announcement-item").textContent ?? "";
      for (const noise of ["can't remove", "cannot be removed", "locked", "🔒"]) {
        expect(text.toLowerCase(), noise).not.toContain(noise);
      }
    }
  });

  it("★ the accessibility control carries the SAME canonical action, never a divergent one", async () => {
    for (const [over, label] of [
      [{ response: null, respondedAt: null }, "Respond first"],
      [{ unreadCount: 1 }, "Read reply"],
      [{ unreadCount: 0 }, "Remove"],
    ] as const) {
      cleanup();
      mine = rcard(over);
      stub();
      render(<NeedsYourResponse locale="en" />);
      const a11y = await screen.findByTestId("announcement-remove");
      expect(a11y.tagName).toBe("BUTTON");
      expect(a11y.textContent, JSON.stringify(over)).toBe(label);
    }
  });

  it("Korean carries the same four words", async () => {
    mine = rcard({ unreadCount: 1 });
    stub();
    render(<NeedsYourResponse locale="ko" />);
    expect((await tray()).textContent).toBe("답장 확인");
    cleanup();
    mine = rcard({ response: null, respondedAt: null });
    stub();
    render(<NeedsYourResponse locale="ko" />);
    expect((await tray()).textContent).toBe("먼저 답하기");
    cleanup();
    mine = rcard({ unreadCount: 0 });
    stub();
    render(<NeedsYourResponse locale="ko" />);
    expect((await tray()).textContent).toBe("치우기");
  });
});
