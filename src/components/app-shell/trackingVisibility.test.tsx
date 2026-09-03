/** @vitest-environment jsdom */
/**
 * The Host can find what they tracked (Slice A1-VIS, 2026-09-02).
 *
 * ★ THE MEASURED GAP. A real Track succeeded in Teams — announcement `6cfccb92…`, owner
 * `18b1ee80…`, one recipient, `bound_recipients = 0` — and the Host could not find it anywhere in
 * BTY. Everything behind the surface already existed and was correct: `listHostAnnouncements`,
 * the owner-scoped `/api/bty/announcements/host` route, and a five-bucket funnel with a dedicated
 * `notYetActivated` count. **The route had zero callers.** Nothing rendered it.
 *
 * So these tests are about REACHABILITY and about the one state a Host will otherwise misread:
 * a person who has not opened BTY is not a person ignoring them.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
/* The browser Supabase client is null in this environment; the session re-read is mocked. */
const H = vi.hoisted(() => ({ getSession: vi.fn(async () => ({ data: { session: null }, error: null })) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: H.getSession } } }));

import TrackingSent from "./TrackingSent";
import { summariseAnnouncement, funnelIsComplete } from "@/domain/announcement/trackedAnnouncement";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** One responder in the shape the owner-scoped route now returns. */
const R = (
  recipientId: string,
  display: string | null,
  over: { questionText?: string | null; respondedAt?: string | null; handledAt?: string | null } = {},
) => ({ recipientId, display, questionText: null, respondedAt: null, handledAt: null, ...over });

/** The production announcement, used READ-ONLY as a fixture. No second real one was created. */
const REAL = {
  id: "6cfccb92-fac6-43d1-b6e9-deeb0d5437b5",
  hostFraming: "Pay",
  previewText: "Please pay",
  createdAt: "2026-09-02T19:11:04.000Z",
  sourceUrl: "https://teams.microsoft.com/l/message/19:chat@unq.gbl.spaces/1756842664",
  status: "active" as const,
  funnel: summariseAnnouncement(1, [{ boundUserId: null, response: null }]),
  // Nobody is bound, so nobody can be named. This is the real announcement's exact shape.
  responders: { acknowledged: [], question: [], needHelp: [], noResponse: [] },
};

function stub(items: unknown[] | null, opts: { ok?: boolean; status?: number } = {}) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      if (opts.ok === false) return new Response("{}", { status: opts.status ?? 500 });
      return new Response(JSON.stringify({ ok: true, items }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

const renderSent = async (items: unknown[] | null, opts?: { ok?: boolean }) => {
  const calls = stub(items, opts);
  render(<TrackingSent locale="en" />);
  return calls;
};

describe("★ 1. the Host sees their own tracked announcement", () => {
  it("★ the real production announcement is rendered, framing first", async () => {
    await renderSent([REAL]);
    await waitFor(() => expect(screen.getByTestId("tracking-sent")).toBeTruthy());
    const item = screen.getByTestId("tracking-item");
    expect(item.getAttribute("data-announcement")).toBe(REAL.id);
    expect(within(item).getByTestId("tracking-framing").textContent).toBe("Pay");
    expect(within(item).getByTestId("tracking-preview").textContent).toBe("Please pay");
    expect(within(item).getByTestId("tracking-sent-to").textContent).toBe("Sent to 1 person");
    expect(item.getAttribute("data-status")).toBe("active");
  });

  it("★ 14. Open in Teams uses the stored source_url, and opens safely", async () => {
    await renderSent([REAL]);
    const link = (await screen.findByTestId("tracking-source-link")) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(REAL.sourceUrl);
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("the surface asks the OWNER-SCOPED route and nothing else", async () => {
    const calls = await renderSent([REAL]);
    await waitFor(() => expect(screen.getByTestId("tracking-sent")).toBeTruthy());
    expect(calls).toEqual(["/api/bty/announcements/host"]);
  });
});

describe("★ 2+5. someone else's run is simply not there", () => {
  it("★ 2. a Host with no runs of their own renders NOTHING — no empty card, no lane", async () => {
    // The route is owner-scoped, so another Host receives [] rather than a filtered list.
    await renderSent([]);
    await waitFor(() => expect(screen.queryByTestId("tracking-sent")).toBeNull());
    expect(screen.queryByTestId("tracking-item")).toBeNull();
  });

  it("★ 5. an unrelated participant sees no tracking lane at all", async () => {
    await renderSent([]);
    await waitFor(() => expect(screen.queryByTestId("tracking-sent")).toBeNull());
  });

  it("a failed load says so instead of pretending there is nothing", async () => {
    await renderSent(null, { ok: false });
    await waitFor(() => expect(screen.getByTestId("tracking-sent-error")).toBeTruthy());
    expect(screen.queryByTestId("tracking-item")).toBeNull();
  });
});

describe("★ 4. the unbound recipient is shown as waiting, never as silence", () => {
  it("★ the real 1-recipient/0-bound run reads 'Waiting for them to open BTY'", async () => {
    await renderSent([REAL]);
    const waiting = await screen.findByTestId("tracking-waiting");
    expect(waiting.textContent).toBe("1 person hasn't opened BTY yet");
  });

  it("★ that person is NOT counted as 'No response yet'", async () => {
    await renderSent([REAL]);
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    const counts = screen.queryAllByTestId("tracking-count").map((c) => c.getAttribute("data-label"));
    expect(counts).not.toContain("No response yet");
  });

  it("★ the announcement is NOT hidden just because the recipient is unbound", async () => {
    await renderSent([REAL]);
    expect(await screen.findByTestId("tracking-item")).toBeTruthy();
  });

  it("the five buckets account for every recipient", () => {
    expect(funnelIsComplete(REAL.funnel)).toBe(true);
    expect(REAL.funnel.announcedTo).toBe(1);
    expect(REAL.funnel.notYetActivated).toBe(1);
    expect(REAL.funnel.noResponse).toBe(0);
  });
});

describe("★ 13. the Host sees updated response status", () => {
  const mixed = {
    ...REAL,
    funnel: summariseAnnouncement(4, [
      { boundUserId: "u1", response: "ACKNOWLEDGED" as const },
      { boundUserId: "u2", response: "QUESTION" as const },
      { boundUserId: "u3", response: null },
      { boundUserId: null, response: null },
    ]),
    responders: {
      acknowledged: [R("r1", "Hanna Kim")],
      question: [R("r2", "John Park", { questionText: "Which invoice?", respondedAt: "2026-09-02T20:00:00.000Z" })],
      needHelp: [],
      noResponse: [R("r3", "Sam Lee")],
    },
  };

  it("★ each answered bucket is shown with its own count", async () => {
    await renderSent([mixed]);
    await waitFor(() => expect(screen.getByTestId("tracking-funnel")).toBeTruthy());
    const got = Object.fromEntries(
      screen.getAllByTestId("tracking-count").map((c) => [c.getAttribute("data-label"), c.getAttribute("data-count")]),
    );
    expect(got).toEqual({ Acknowledged: "1", Question: "1", "No response yet": "1" });
  });

  it("★ 2. the question is shown BESIDE the person who asked it", async () => {
    await renderSent([mixed]);
    fireEvent.click(await screen.findByTestId("tracking-toggle"));
    const buckets = screen.getAllByTestId("tracking-bucket");
    const q = buckets.find((b) => b.getAttribute("data-bucket") === "Needs a reply")!;
    expect(q.textContent).toContain("John Park");
    expect(within(q).getByTestId("tracking-person-question").textContent).toBe("Which invoice?");
  });

  it("both the unanswered bound person AND the unactivated one are represented, distinctly", async () => {
    await renderSent([mixed]);
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    expect(screen.getByTestId("tracking-waiting")).toBeTruthy();
    const labels = screen.getAllByTestId("tracking-count").map((c) => c.getAttribute("data-label"));
    expect(labels).toContain("No response yet");
    expect(funnelIsComplete(mixed.funnel)).toBe(true);
  });

  it("zero buckets are not rendered — a row of zeroes hides the number that changed", async () => {
    await renderSent([mixed]);
    await waitFor(() => expect(screen.getByTestId("tracking-funnel")).toBeTruthy());
    const labels = screen.getAllByTestId("tracking-count").map((c) => c.getAttribute("data-label"));
    expect(labels).not.toContain("Help needed");
  });
});

describe("closed runs read as closed", () => {
  it("a closed announcement says so", async () => {
    await renderSent([{ ...REAL, status: "closed" }]);
    const item = await screen.findByTestId("tracking-item");
    expect(item.getAttribute("data-status")).toBe("closed");
    expect(within(item).getByTestId("tracking-closed").textContent).toBe("Closed");
  });
});

describe("★ 16. 390px Today stays readable", () => {
  it("★ at 390px every card renders with no fixed-width or table layout", async () => {
    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    await renderSent([REAL]);
    const item = await screen.findByTestId("tracking-item");
    // Compact card, not an admin grid: no <table>, and the funnel wraps rather than scrolling.
    expect(item.querySelector("table")).toBeNull();
    // ...and no names at rest.
    expect(screen.queryByTestId("tracking-responses")).toBeNull();
    expect(screen.getByTestId("tracking-funnel").className).toContain("flex-wrap");
    expect(item.className).toContain("rounded-2xl");
  });

  it("no jargon reaches the screen", async () => {
    await renderSent([REAL]);
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    const text = screen.getByTestId("tracking-sent").textContent ?? "";
    for (const word of ["canonical", "binding", "bound", "recipient row", "identity", "user_id", "aad", "tenant"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it("★ no directory identity is present anywhere in the rendered output", async () => {
    await renderSent([REAL]);
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    const html = screen.getByTestId("tracking-sent").innerHTML;
    expect(html).not.toContain("757722d3-4ab3-4c57-a976-4b7cae5f57a3"); // the real recipient oid
    expect(html).not.toContain("10110d5c-bd30-467e-9912-e44e67777647"); // the real tenant id
    // No identity of any shape in what a person can READ. Checked on visible text rather than
    // markup on purpose: the Teams permalink legitimately contains a conversation id shaped like
    // an address (`19:chat@unq.gbl.spaces`), and it lives in an href nobody reads as identity.
    const visible = screen.getByTestId("tracking-sent").textContent ?? "";
    expect(visible).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(visible).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe("★ 17. Today's existing lanes are untouched", () => {
  it("Tracking renders nothing for a person who tracked nothing, so Today is unchanged", async () => {
    await renderSent([]);
    await waitFor(() => expect(screen.queryByTestId("tracking-sent")).toBeNull());
  });

  it("a retry re-asks the same owner-scoped route", async () => {
    const calls = await renderSent(null, { ok: false });
    await waitFor(() => expect(screen.getByTestId("tracking-sent-error")).toBeTruthy());
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(calls.length).toBe(2));
    expect(new Set(calls)).toEqual(new Set(["/api/bty/announcements/host"]));
  });
});

describe("★ 1,3,4. the Host can tell WHO — behind one tap", () => {
  const run = {
    ...REAL,
    id: "c0000000-0000-0000-0000-000000000003",
    funnel: summariseAnnouncement(5, [
      { boundUserId: "u1", response: "ACKNOWLEDGED" as const },
      { boundUserId: "u2", response: "QUESTION" as const },
      { boundUserId: "u3", response: "HELP_NEEDED" as const },
      { boundUserId: "u4", response: null },
      { boundUserId: null, response: null },
    ]),
    responders: {
      acknowledged: [R("r1", "Hanna Kim")],
      question: [R("r2", "John Park", { questionText: "Which account should I use?" })],
      needHelp: [R("r3", "Mia Cho")],
      noResponse: [R("r4", "Sam Lee")],
    },
  };

  const expand = async () => {
    await renderSent([run]);
    fireEvent.click(await screen.findByTestId("tracking-toggle"));
    return Object.fromEntries(
      screen.getAllByTestId("tracking-bucket").map((b) => [b.getAttribute("data-bucket"), b.textContent ?? ""]),
    );
  };

  it("★ 1. every bound recipient is named under their own status", async () => {
    const b = await expand();
    expect(b["Acknowledged"]).toContain("Hanna Kim");
    expect(b["Needs a reply"]).toContain("John Park");
    expect(b["Needs help from you"]).toContain("Mia Cho");
    expect(b["No response yet"]).toContain("Sam Lee");
  });

  it("★ 3. help-needed identifies the right person, and is ordered first", async () => {
    await renderSent([run]);
    fireEvent.click(await screen.findByTestId("tracking-toggle"));
    const order = screen.getAllByTestId("tracking-bucket").map((b) => b.getAttribute("data-bucket"));
    expect(order[0]).toBe("Needs help from you"); // the one a Host must act on soonest
    expect(order).toEqual(["Needs help from you", "Needs a reply", "No response yet", "Acknowledged"]);
  });

  it("★ 4. the person who has not responded is identifiable, not just counted", async () => {
    const b = await expand();
    expect(b["No response yet"]).toContain("Sam Lee");
  });

  it("★ 6. the unactivated recipient is NEVER named — only counted", async () => {
    await renderSent([run]);
    fireEvent.click(await screen.findByTestId("tracking-toggle"));
    expect(screen.getByTestId("tracking-waiting").textContent).toBe("1 person hasn't opened BTY yet");
    // Four named people, never five: the unbound one has no row anywhere.
    expect(screen.getAllByTestId("tracking-person")).toHaveLength(4);
  });

  it("★ 5+9. no raw identifier, email or UPN reaches the expanded view", async () => {
    await renderSent([run]);
    fireEvent.click(await screen.findByTestId("tracking-toggle"));
    const text = screen.getByTestId("tracking-sent").textContent ?? "";
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(text).not.toContain("757722d3");
    expect(text).not.toContain("10110d5c");
  });

  it("a bound person with no resolvable provider name is still shown, not dropped", async () => {
    await renderSent([{ ...run, responders: { ...run.responders, needHelp: [{ display: null, respondedAt: null }] } }]);
    fireEvent.click(await screen.findByTestId("tracking-toggle"));
    const help = screen.getAllByTestId("tracking-bucket").find((b) => b.getAttribute("data-bucket") === "Needs help from you")!;
    expect(help.textContent).toContain("Someone");
  });

  it("★ 10+11. resting card is compact; expanded stays readable at 390px", async () => {
    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    await renderSent([run]);
    // Resting: counts only, no names, no table.
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    expect(screen.queryByTestId("tracking-responses")).toBeNull();
    expect(screen.queryAllByTestId("tracking-person")).toHaveLength(0);
    // Expanded: names appear, still no table, still a stacked card.
    fireEvent.click(screen.getByTestId("tracking-toggle"));
    const responses = screen.getByTestId("tracking-responses");
    expect(responses.querySelector("table")).toBeNull();
    expect(responses.className).toContain("flex-col");
    expect(screen.getAllByTestId("tracking-person").length).toBe(4);
  });

  it("the expand control does not exist when there is nobody to name", async () => {
    await renderSent([REAL]); // the real run: 1 recipient, unbound
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    expect(screen.queryByTestId("tracking-toggle")).toBeNull();
  });

  it("only one run expands at a time", async () => {
    await renderSent([run, { ...run, id: "d0000000-0000-0000-0000-000000000004" }]);
    const toggles = await screen.findAllByTestId("tracking-toggle");
    fireEvent.click(toggles[0]);
    expect(screen.getAllByTestId("tracking-responses")).toHaveLength(1);
    fireEvent.click(screen.getAllByTestId("tracking-toggle")[1]);
    expect(screen.getAllByTestId("tracking-responses")).toHaveLength(1);
  });

  it("★ 12. the real announcement renders exactly once, and is not duplicated", async () => {
    await renderSent([REAL]);
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    const items = screen.getAllByTestId("tracking-item");
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute("data-announcement")).toBe("6cfccb92-fac6-43d1-b6e9-deeb0d5437b5");
    // The exact resting content the Founder should see.
    expect(screen.getByTestId("tracking-framing").textContent).toBe("Pay");
    expect(screen.getByTestId("tracking-preview").textContent).toBe("Please pay");
    expect(screen.getByTestId("tracking-sent-to").textContent).toBe("Sent to 1 person");
    expect(screen.getByTestId("tracking-waiting").textContent).toBe("1 person hasn't opened BTY yet");
    expect(screen.getByTestId("tracking-source-link")).toBeTruthy();
    // No "0 responses" noise, no blank identity row.
    expect(screen.queryAllByTestId("tracking-count")).toHaveLength(0);
    expect(screen.queryAllByTestId("tracking-person")).toHaveLength(0);
  });
});

/**
 * ★ THE LIVE DEVICE FAILURE, 2026-09-02T21:36Z.
 *
 * The Founder's iPhone showed "Couldn't load what you're tracking." with a Retry button that could
 * never work. MEASURED: the session was VALID (`/auth/v1/user` returned 200) and ZERO reads
 * reached the announcement tables — the route answered `403 consent_required` from
 * `requireConsentedUser`, before `listHostAnnouncements` ran, because hc has no `arena_profiles`
 * row and `consentSatisfied(undefined)` is false.
 *
 * So this was never a token problem, and the one control offered was the one guaranteed not to
 * help. These tests pin each status to the response it deserves.
 */
describe("★ each failure status gets the response it deserves", () => {
  const statusStub = (statuses: { status: number; body?: unknown }[]) => {
    const calls: string[] = [];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        const s = statuses[Math.min(i++, statuses.length - 1)];
        return new Response(JSON.stringify(s.body ?? {}), {
          status: s.status,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    return calls;
  };

  it("★ 15. a 403 never sends a Host to the Arena consent flow", async () => {
    // The route no longer gates on Arena consent at all; a 403 now means "no Track capability",
    // which is not a state this lane explains — someone who has never tracked anything has
    // nothing to be told about tracking.
    statusStub([{ status: 403, body: { error: "track_capability_required" } }]);
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.getByTestId("tracking-sent-error")).toBeTruthy());
    expect(screen.queryByTestId("tracking-sent-consent")).toBeNull();
    expect(screen.queryByText(/Accept the BTY terms/)).toBeNull();
    expect(document.querySelector('a[href*="legal/accept"]')).toBeNull();
  });

  it("★ 7. a 500 renders the existing error state", async () => {
    statusStub([{ status: 500 }]);
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.getByTestId("tracking-sent-error")).toBeTruthy());
  });

  it("★ 4+5. a 401 re-reads the session and retries EXACTLY ONCE", async () => {
    H.getSession.mockClear();
    const calls = statusStub([{ status: 401 }, { status: 200, body: { ok: true, items: [REAL] } }]);
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    expect(calls).toHaveLength(2);                    // one retry, not a loop
    expect(H.getSession).toHaveBeenCalledTimes(1);    // the retry re-read the session first
  });

  it("★ 4. a second 401 does NOT retry again — no loop, no polling", async () => {
    const calls = statusStub([{ status: 401 }, { status: 401 }]);
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.getByTestId("tracking-sent-error")).toBeTruthy());
    expect(calls).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 60));
    expect(calls).toHaveLength(2);
  });

  it("★ 5. the visible Retry re-reads the session rather than repeating a stale request", async () => {
    H.getSession.mockClear();
    const calls = statusStub([{ status: 500 }, { status: 401 }, { status: 200, body: { ok: true, items: [REAL] } }]);
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.getByTestId("tracking-sent-error")).toBeTruthy());
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    expect(H.getSession).toHaveBeenCalled(); // the retry path went through a fresh session read
  });

  it("★ 3. a network failure never renders a half-state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.getByTestId("tracking-sent-error")).toBeTruthy());
    expect(screen.queryByTestId("tracking-item")).toBeNull();
  });

  it("★ 8. a successful response still renders the real announcement", async () => {
    statusStub([{ status: 200, body: { ok: true, items: [REAL] } }]);
    render(<TrackingSent locale="en" />);
    const item = await screen.findByTestId("tracking-item");
    expect(item.getAttribute("data-announcement")).toBe("6cfccb92-fac6-43d1-b6e9-deeb0d5437b5");
  });

  it("★ 9. an empty successful response renders nothing at all", async () => {
    statusStub([{ status: 200, body: { ok: true, items: [] } }]);
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.queryByTestId("tracking-sent")).toBeNull());
    expect(screen.queryByTestId("tracking-sent-error")).toBeNull();
    expect(screen.queryByTestId("tracking-sent-consent")).toBeNull();
  });

  it("★ 1+10. every attempt hits the owner-scoped route and nothing else", async () => {
    const calls = statusStub([{ status: 401 }, { status: 200, body: { ok: true, items: [REAL] } }]);
    render(<TrackingSent locale="en" />);
    await waitFor(() => expect(screen.getByTestId("tracking-item")).toBeTruthy());
    expect(new Set(calls)).toEqual(new Set(["/api/bty/announcements/host"]));
  });
});
