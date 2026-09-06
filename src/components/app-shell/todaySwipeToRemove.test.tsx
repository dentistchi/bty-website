/** @vitest-environment jsdom */
/**
 * TODAY SWIPE TO REMOVE — the gesture, and everything it must not do.
 *
 * ★ REMOVE FROM TODAY IS NOT DELETE. What these tests hold is mostly the second half of that
 * sentence: the request that leaves the browser carries a card KIND and a card ID and nothing else,
 * it goes to a dismissal endpoint that names no Track table, and no announcement, recipient row,
 * thread message, receipt or handled state is reachable from it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import NeedsYourResponse from "./NeedsYourResponse";
import TrackingSent from "./TrackingSent";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** Comments stripped: a promise written in prose is not a promise the code keeps. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sqlCode = (p: string) => read(p).split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
const R_A = "recipient-a";
const R_B = "recipient-b";

let mine: unknown[];
let host: unknown[];
let posted: { url: string; body: Record<string, unknown> }[];

function stub() {
  posted = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as Response;
    if (u.includes("/api/me/today/dismiss")) {
      posted.push({ url: u, body: JSON.parse(String(init?.body ?? "{}")) });
      // The server is the authority: the card only leaves once the list is re-read without it.
      mine = [];
      host = [];
      return ok({ ok: true, dismissedAt: "2026-09-13T00:00:00Z" });
    }
    if (u.includes("/thread")) return ok({ ok: true, role: "RECIPIENT", messages: [] });
    if (u.includes("/api/bty/announcements/mine")) return ok({ ok: true, items: mine });
    if (u.includes("/api/bty/announcements/host")) return ok({ ok: true, items: host });
    return ok({ ok: true });
  }));
}

const card = (over: Record<string, unknown> = {}) => ({
  announcementId: "ann-1",
  recipientId: R_A,
  hostFraming: "Please read the new intake steps.",
  hostDisplay: null,
  sourceUrl: null,
  response: "ACKNOWLEDGED",
  respondedAt: "2026-09-12T09:00:00Z",
  unreadCount: 0,
  messageCount: 0,
  ...over,
});

const responder = (over: Record<string, unknown> = {}) => ({
  recipientId: R_A, display: "Jin", questionText: null, respondedAt: "2026-09-12T09:00:00Z",
  handledAt: null, unreadCount: 0, messageCount: 0, needsAttention: false, ...over,
});
const run = (responders: Record<string, unknown[]>, id = "ann-1") => ({
  id, hostFraming: "Please read this.", createdAt: "2026-09-12T08:00:00Z", previewText: null,
  sourceUrl: null, status: "active",
  funnel: { announcedTo: 1, gotIt: 1, question: 0, needHelp: 0, noResponse: 0, notYetActivated: 0 },
  responders: { acknowledged: [], question: [], needHelp: [], noResponse: [], ...responders },
});

/** A left drag past the reveal threshold. */
const swipeLeft = (el: HTMLElement, dx = -110) => {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 200 + dx, clientY: 100 }] });
  fireEvent.touchEnd(el, {});
};

beforeEach(() => { vi.clearAllMocks(); mine = []; host = []; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/* ══════════ 1-4. THE GESTURE ══════════ */

describe("★ 1-4 — swipe reveals, tap decides, one at a time, scroll untouched", () => {
  it("★ 1 — swiping LEFT reveals a Remove action on the RIGHT", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    expect(within(row).queryByTestId("today-swipe-tray"), "nothing behind a resting row").toBeNull();
    swipeLeft(within(row).getByTestId("today-swipe-surface"));
    const tray = await within(row).findByTestId("today-swipe-tray");
    expect(tray.className).toContain("right-0");
    expect(within(tray).getByTestId("today-swipe-action").textContent).toBe("Remove");
  });

  it("★ 2 — the action LOOKS destructive but the request is a dismissal, not a delete", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    swipeLeft(within(row).getByTestId("today-swipe-surface"));
    const btn = await within(row).findByTestId("today-swipe-action");
    expect(btn.className, "red").toContain("bg-[#B3261E]");
    expect(btn.getAttribute("data-tone")).toBe("destructive");
    fireEvent.click(btn);
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].url).toContain("/api/me/today/dismiss");
    expect(posted[0].url).not.toContain("announcements");
    // ★ The whole payload: a kind and an id. No user, no delete, no record identity beyond the card.
    expect(Object.keys(posted[0].body).sort()).toEqual(["itemId", "itemKind"]);
    expect(posted[0].body).toEqual({ itemKind: "track_recipient", itemId: R_A });
  });

  it("★ 2 — the WORD is Remove / 치우기, never Delete", () => {
    const src = read("src/components/app-shell/NeedsYourResponse.tsx");
    expect(src).toContain('remove: "Remove"');
    expect(src).toContain('remove: "치우기"');
    expect(src).not.toMatch(/remove: "Delete"|remove: "삭제"/);
  });

  it("★ 3 — a VERTICAL drag moves nothing and reveals nothing", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    const surface = within(row).getByTestId("today-swipe-surface");
    fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(surface, { touches: [{ clientX: 196, clientY: 220 }] });
    fireEvent.touchEnd(surface, {});
    expect(within(row).queryByTestId("today-swipe-tray")).toBeNull();
    expect(row.getAttribute("data-open")).toBe("0");
    // The browser keeps vertical panning; nothing here ever claims it.
    expect(surface.style.touchAction).toBe("pan-y");
    // Asserted on CODE, not prose: the file's own comment says it never preventDefaults.
    expect(code("src/components/app-shell/TodaySwipeAction.tsx")).not.toContain("preventDefault");
  });

  it("★ 3 — the row is clamped, so the page can never scroll sideways", () => {
    const src = code("src/components/app-shell/TodaySwipeAction.tsx");
    expect(src).toContain("Math.max(-MAX_PX, Math.min(0, resting + drag))");
    expect(src).toContain("overflow-hidden");
  });

  it("★ 4 — opening a second card closes the first", async () => {
    mine = [card(), card({ recipientId: R_B, announcementId: "ann-2" })];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const rows = await screen.findAllByTestId("today-swipe-row");
    swipeLeft(within(rows[0]).getByTestId("today-swipe-surface"));
    await waitFor(() => expect(rows[0].getAttribute("data-open")).toBe("1"));
    swipeLeft(within(rows[1]).getByTestId("today-swipe-surface"));
    await waitFor(() => expect(rows[1].getAttribute("data-open")).toBe("1"));
    expect(rows[0].getAttribute("data-open"), "only one open at a time").toBe("0");
  });

  it("a short drag under the threshold settles back and decides nothing", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    swipeLeft(within(row).getByTestId("today-swipe-surface"), -20);
    expect(row.getAttribute("data-open")).toBe("0");
    expect(posted).toHaveLength(0);
  });

  it("★ revealing alone NEVER removes — only the tap does", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    swipeLeft(within(row).getByTestId("today-swipe-surface"), -300);
    await within(row).findByTestId("today-swipe-action");
    expect(posted, "a decisive swipe must not commit").toHaveLength(0);
  });
});

/* ══════════ 5-9. WHAT REMOVE DOES NOT DO ══════════ */

describe("★ 5-9 — it hides, and it deletes nothing", () => {
  it("★ 5 — the card is gone only after the SERVER-scoped list is re-read", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    fireEvent.click(await screen.findByTestId("announcement-remove"));
    await waitFor(() => expect(screen.queryByTestId("announcement-item")).toBeNull());
    // Nothing was optimistically hidden — the list refetched and the server omitted it.
    expect(posted).toHaveLength(1);
  });

  it("★ 6/7/8/9 — the server READS Track tables to check ownership, and WRITES to none of them", () => {
    /*
      The service does read `bty_tracked_announcements` and `..._recipients` — it must, to verify the
      card is on this person's Today and to count activity. What it must never do is WRITE to them.
      So the assertion is about write verbs per table, not about the table names appearing at all.
    */
    const svc = read("src/lib/bty/daily/todayDismissal.server.ts");
    const WRITES = [".insert(", ".update(", ".delete(", ".upsert(", ".rpc("];
    const segments = svc.split('.from("').slice(1);
    for (const seg of segments) {
      const table = seg.slice(0, seg.indexOf('"'));
      const body = seg.slice(0, seg.indexOf(".from(") === -1 ? seg.length : seg.indexOf(".from("));
      for (const w of WRITES) {
        if (body.includes(w)) {
          expect(table, `${w} may only ever target the dismissal table`).toBe("bty_today_dismissals");
        }
      }
    }
    // And nothing anywhere deletes.
    expect(svc).not.toContain(".delete(");

    const route = read("src/app/api/me/today/dismiss/route.ts");
    for (const forbidden of ["bty_tracked_announcements", "bty_announcement_thread", "bty_action_captures", "handled_at", "core_xp"]) {
      expect(route, forbidden).not.toContain(forbidden);
    }
    // ★ the caller can only ever write under their OWN id.
    expect(route).toContain("userId: user.id");
    expect(route).not.toContain("body?.userId");
    expect(svc).toContain("user_id: params.userId");

    // ★ OWNERSHIP IS VERIFIED BEFORE THE WRITE.
    expect(svc).toContain('.eq("user_id", userId)');
    expect(svc).toContain('.eq("owner_user_id", userId)');
    expect(svc).toContain('return { ok: false, reason: "not_found" }');

    // The migration creates one table and has no FK to anything it hides.
    const sql = sqlCode("supabase/migrations/20260913000000_bty_today_dismissal_v1.sql");
    expect(sql).toContain("create table if not exists public.bty_today_dismissals");
    expect(sql).not.toMatch(/references public\.bty_tracked|references public\.bty_announcement|references public\.bty_action/);
    expect(sql).not.toMatch(/drop |alter table public\.bty_tracked|alter table public\.bty_announcement/);
    // ★ column-scoped UPDATE: an existing dismissal can never be re-pointed.
    expect(sql).toContain("grant update (dismissed_at, dismissed_activity_version) on public.bty_today_dismissals to service_role;");
    expect(sql).toContain("grant select, insert on public.bty_today_dismissals to service_role;");
  });

});

/* ══════════ 10-11. RESURFACE + NON-REMOVABLE ══════════ */

describe("★ 10-11 — attention outranks tidiness", () => {
  it("★ 11 — an UNANSWERED card exposes no REMOVE; it explains itself instead", async () => {
    mine = [card({ response: null, respondedAt: null })];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    const item = within(row).getByTestId("announcement-item");
    expect(item.getAttribute("data-removable")).toBe("0");
    expect(item.getAttribute("data-blocker")).toBe("needs_response");
    swipeLeft(within(row).getByTestId("today-swipe-surface"));
    const btn = await within(row).findByTestId("today-swipe-action");
    expect(btn.textContent).toBe("Respond first");
    expect(btn.getAttribute("data-tone")).toBe("guidance");
    expect(btn.className, "guidance is never red").not.toContain("bg-[#B3261E]");
    fireEvent.click(btn);
    expect(posted, "guidance submits nothing").toHaveLength(0);
  });

  it("★ 11 — an answered card with an UNREAD reply offers Read reply, not Remove", async () => {
    mine = [card({ response: "QUESTION", unreadCount: 1, messageCount: 2 })];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    expect(within(row).getByTestId("announcement-item").getAttribute("data-blocker")).toBe("unread");
    swipeLeft(within(row).getByTestId("today-swipe-surface"));
    const btn = await within(row).findByTestId("today-swipe-action");
    expect(btn.textContent).toBe("Read reply");
    expect(btn.getAttribute("data-tone")).toBe("guidance");
  });

  it("★ 11 — a Host run where somebody needs attention offers guidance, not Remove", async () => {
    host = [run({ question: [responder({ needsAttention: true })] })];
    stub();
    render(<TrackingSent locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    const item = within(row).getByTestId("tracking-item");
    expect(item.getAttribute("data-removable")).toBe("0");
    expect(item.getAttribute("data-blocker")).toBe("needs_handling");
    swipeLeft(within(row).getByTestId("today-swipe-surface"));
    const btn = await within(row).findByTestId("today-swipe-action");
    expect(btn.textContent).toBe("Handle first");
    expect(btn.getAttribute("data-tone")).toBe("guidance");
  });

  it("a settled Host run IS removable, and posts the host kind", async () => {
    host = [run({ acknowledged: [responder()] })];
    stub();
    render(<TrackingSent locale="en" />);
    fireEvent.click(await screen.findByTestId("tracking-remove"));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].body).toEqual({ itemKind: "track_host", itemId: "ann-1" });
  });

  it("★ 10 — RESURFACING is a SERVER rule, not a client one", () => {
    // The client never decides what is hidden; it renders what the owner-scoped route returns.
    const svc = read("src/lib/bty/announcement/announcementService.server.ts");
    expect(svc).toContain("isHiddenFromToday");
    // A monotonic COUNT is the authority — never a timestamp. See the MVCC note in the domain.
    expect(svc).toContain("recipientActivityVersion");
    expect(svc).toContain("hostActivityVersion");
    expect(svc).not.toContain("latestActivity");
    expect(read("src/components/app-shell/NeedsYourResponse.tsx")).not.toContain("isHiddenFromToday");
    expect(read("src/components/app-shell/TrackingSent.tsx")).not.toContain("isHiddenFromToday");
  });
});

/* ══════════ 12-13. ACCESSIBILITY + VIEWPORT ══════════ */

describe("★ 12-13 — a hidden gesture is never the only path", () => {
  it("★ A — the Remove action is NOT visibly present at rest, on either surface", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const btn = await screen.findByTestId("announcement-remove");
    // Present in the accessibility tree and in tab order, but not on screen.
    expect(btn.className).toContain("sr-only");
    expect(btn.className).toContain("focus:not-sr-only");
    // …and revealing it on focus shifts no layout.
    expect(btn.className).toContain("focus:absolute");
    // The swipe tray is likewise absent until the row is dragged.
    expect(screen.queryByTestId("today-swipe-tray")).toBeNull();
  });

  it("★ 12 — it is still a real focusable button that does the same thing", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const btn = await screen.findByTestId("announcement-remove");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toContain("focus:min-h-[2.75rem]"); // 44px once revealed
    fireEvent.click(btn);
    await waitFor(() => expect(posted).toHaveLength(1));
  });

  it("★ A — the Host surface hides its resting Remove the same way", async () => {
    host = [run({ acknowledged: [responder()] })];
    stub();
    render(<TrackingSent locale="en" />);
    const btn = await screen.findByTestId("tracking-remove");
    expect(btn.className).toContain("sr-only");
    expect(btn.className).toContain("focus:not-sr-only");
    expect(screen.queryByTestId("today-swipe-tray")).toBeNull();
  });

  it("★ 12 — the revealed action is itself a real button with a 44px+ target", async () => {
    mine = [card()];
    stub();
    render(<NeedsYourResponse locale="en" />);
    const row = await screen.findByTestId("today-swipe-row");
    swipeLeft(within(row).getByTestId("today-swipe-surface"));
    const btn = await within(row).findByTestId("today-swipe-action");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toContain("w-28"); // 112px wide, full row height
  });

  it("★ 13 — no hover dependency anywhere in the gesture surface", () => {
    const src = code("src/components/app-shell/TodaySwipeAction.tsx");
    expect(src).not.toContain("hover:");
    expect(src).not.toContain("onMouseEnter");
    // No window-level listeners and no gesture library — the Teams WebView constraint.
    expect(src).not.toContain("window.addEventListener");
    expect(src).not.toMatch(/from "react-|from "framer/);
  });
});
