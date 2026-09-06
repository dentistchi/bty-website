/** @vitest-environment jsdom */
/**
 * The Host settles one person at a time (Slice A1-CLOSURE), inside the expanded view.
 *
 * ★ ORDERED BY WHAT IT DEMANDS, not by status name. A Host opening Today asks "what do I have to
 * do?", so the buckets run help -> reply -> silence -> finished, and within the two actionable
 * buckets the still-open people come first. Nobody should read past settled rows to find the next
 * action.
 *
 * ★ ACKNOWLEDGED HAS NO CONTROL. "Got it" is already the end of that exchange; adding a button a
 * Host must also press would invent work the product does not have. Same for a person who has not
 * answered — there is nothing to settle.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) } } }));

import TrackingSent from "./TrackingSent";
import { summariseAnnouncement } from "@/domain/announcement/trackedAnnouncement";
import { recipientNeedsHostAttention } from "@/domain/announcement/announcementThread";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * One responder, in the shape the owner-scoped route actually returns.
 *
 * ★ `needsAttention` IS DERIVED HERE THE WAY THE SERVER DERIVES IT (Track conversation V1).
 *
 * The Host list now carries it, computed by `recipientNeedsHostAttention`, and the surface sorts on
 * it. A fixture that hard-coded the flag — or omitted it — would let this suite pass while the real
 * projection disagreed, so it calls the SAME domain function the service calls.
 */
const withAttention = <T extends { response?: string | null; handledAt: string | null; unreadCount: number }>(p: T) => ({
  ...p,
  needsAttention: recipientNeedsHostAttention({
    response: p.response ?? null,
    handledAt: p.handledAt,
    unreadForHost: p.unreadCount,
  }),
});

const R = (
  recipientId: string,
  display: string | null,
  over: {
    questionText?: string | null;
    handledAt?: string | null;
    response?: string | null;
    unreadCount?: number;
    messageCount?: number;
  } = {},
) =>
  withAttention({
    recipientId,
    display,
    questionText: null,
    respondedAt: null,
    handledAt: null,
    // These fixtures populate the two ACTIONABLE buckets, whose members answered QUESTION or
    // HELP_NEEDED; either satisfies the open-request half of the rule identically.
    response: "QUESTION" as string | null,
    unreadCount: 0,
    messageCount: 0,
    ...over,
  });

const RUN = {
  id: "0e11d0bf-0000-0000-0000-000000000001",
  hostFraming: "너가 제대로 이해했나 확인",
  previewText: "확인 부탁",
  createdAt: new Date().toISOString(),
  sourceUrl: "https://teams.microsoft.com/l/message/19:chat@unq.gbl.spaces/1",
  status: "active" as const,
  funnel: summariseAnnouncement(4, [
    { boundUserId: "u1", response: "HELP_NEEDED" as const },
    { boundUserId: "u2", response: "QUESTION" as const },
    { boundUserId: "u3", response: "ACKNOWLEDGED" as const },
    { boundUserId: "u4", response: null },
  ]),
  responders: {
    needHelp: [R("rh", "Mia Cho")],
    question: [R("rq", "John Park", { questionText: "내가 이해했냐고?" })],
    acknowledged: [R("ra", "Hanna Kim")],
    noResponse: [R("rn", "Sam Lee")],
  },
};

function stub(run = RUN) {
  const posts: { url: string; body: unknown }[] = [];
  let current = run;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/handle")) {
      posts.push({ url: u, body: JSON.parse(String(init?.body)) });
      // The server is the authority: reflect the write back through the owner-scoped read.
      const handled = (JSON.parse(String(init?.body)) as { handled: boolean }).handled;
      const id = u.split("/recipients/")[1].split("/")[0];
      // The server RE-DERIVES needsAttention on every owner-scoped read, so the stub must too —
      // otherwise the flag and the timestamp could drift apart in a way production cannot.
      const patch = (list: typeof run.responders.needHelp) =>
        list.map((p) =>
          p.recipientId === id ? withAttention({ ...p, handledAt: handled ? "2026-09-03T00:00:00Z" : null }) : p,
        );
      current = { ...current, responders: {
        needHelp: patch(current.responders.needHelp), question: patch(current.responders.question),
        acknowledged: current.responders.acknowledged, noResponse: current.responders.noResponse } };
      return new Response(JSON.stringify({ ok: true, handled }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, items: [current] }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return posts;
}

const expand = async () => {
  render(<TrackingSent locale="en" />);
  fireEvent.click(await screen.findByTestId("tracking-toggle"));
  return screen.getAllByTestId("tracking-bucket");
};

describe("★ action need is the ordering", () => {
  it("★ help, then reply, then silence, then finished", async () => {
    stub();
    const buckets = await expand();
    expect(buckets.map((b) => b.getAttribute("data-bucket"))).toEqual([
      "Needs help from you", "Needs a reply", "No response yet", "Acknowledged",
    ]);
  });

  it("★ each person shows their own state and the next action", async () => {
    stub();
    const buckets = await expand();
    const help = buckets[0];
    expect(help.textContent).toContain("Mia Cho");
    expect(within(help).getByTestId("tracking-handle").textContent).toBe("Mark handled");
    const reply = buckets[1];
    expect(reply.textContent).toContain("John Park");
    expect(within(reply).getByTestId("tracking-person-question").textContent).toBe("내가 이해했냐고?");
  });

  it("★ ACKNOWLEDGED and No-response carry NO control — there is nothing to settle", async () => {
    stub();
    const buckets = await expand();
    for (const label of ["Acknowledged", "No response yet"]) {
      const b = buckets.find((x) => x.getAttribute("data-bucket") === label)!;
      expect(within(b).queryByTestId("tracking-handle"), label).toBeNull();
      expect(within(b).queryByTestId("tracking-reopen"), label).toBeNull();
    }
  });
});

describe("★ settling one person", () => {
  it("★ posts to that recipient only, with handled:true", async () => {
    const posts = stub();
    const buckets = await expand();
    fireEvent.click(within(buckets[0]).getByTestId("tracking-handle"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].url).toContain("/recipients/rh/handle");
    expect(posts[0].body).toEqual({ handled: true });
  });

  it("★ nothing is shown as settled until the server says so", async () => {
    const posts = stub();
    const buckets = await expand();
    fireEvent.click(within(buckets[0]).getByTestId("tracking-handle"));
    await waitFor(() => {
      const p = screen.getAllByTestId("tracking-person").find((x) => x.getAttribute("data-recipient") === "rh")!;
      expect(p.getAttribute("data-handled")).toBe("1");
    });
    expect(posts).toHaveLength(1);   // one write, then a re-read — never optimistic
  });

  it("★ a settled person stays VISIBLE, with the question preserved", async () => {
    stub();
    const buckets = await expand();
    fireEvent.click(within(buckets[1]).getByTestId("tracking-handle"));   // the question
    await waitFor(() => expect(screen.getByTestId("tracking-person-handled")).toBeTruthy());
    const p = screen.getAllByTestId("tracking-person").find((x) => x.getAttribute("data-recipient") === "rq")!;
    expect(p.textContent).toContain("John Park");
    expect(within(p).getByTestId("tracking-person-question").textContent).toBe("내가 이해했냐고?");
  });

  it("★ a settled person can be re-opened — the same authority, both directions", async () => {
    const posts = stub();
    const buckets = await expand();
    fireEvent.click(within(buckets[0]).getByTestId("tracking-handle"));
    await waitFor(() => expect(screen.getByTestId("tracking-reopen")).toBeTruthy());
    fireEvent.click(screen.getByTestId("tracking-reopen"));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].body).toEqual({ handled: false });
  });

  it("★ still-open people sort above settled ones", async () => {
    stub({ ...RUN, responders: { ...RUN.responders,
      needHelp: [R("done", "Settled Person", { handledAt: "2026-09-03T00:00:00Z" }), R("open", "Open Person")] } });
    const buckets = await expand();
    const names = within(buckets[0]).getAllByTestId("tracking-person").map((p) => p.getAttribute("data-recipient"));
    expect(names).toEqual(["open", "done"]);
  });
});

describe("★ 390px and no new tab", () => {
  it("★ the whole thing lives inside View responses — no extra navigation", async () => {
    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    stub();
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    // At rest: counts only. No names, no controls.
    expect(screen.queryByTestId("tracking-person")).toBeNull();
    expect(screen.queryByTestId("tracking-handle")).toBeNull();
    fireEvent.click(screen.getByTestId("tracking-toggle"));
    expect(screen.getAllByTestId("tracking-person").length).toBe(4);
    expect(screen.getByTestId("tracking-responses").querySelector("table")).toBeNull();
    expect(document.querySelectorAll("nav").length).toBe(0);
  });

  it("★ no identity of any kind is rendered", async () => {
    stub();
    await expand();
    const text = screen.getByTestId("tracking-sent").textContent ?? "";
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it("the control is a 36px+ target and disabled while its own write is in flight", () => {
    const src = require("node:fs").readFileSync("src/components/app-shell/TrackingSent.tsx", "utf8");
    expect(src).toContain("min-h-[2.25rem]");
    expect(src).toMatch(/disabled=\{busyId === p\.recipientId\}/);
  });
});
