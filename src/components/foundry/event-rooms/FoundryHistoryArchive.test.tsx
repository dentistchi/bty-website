/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FoundryHistoryArchive from "./FoundryHistoryArchive";

type RouteBody = { ok: boolean; status: number; body: unknown };

/** URL-aware fetch shim: routes list vs detail requests to seeded responses. */
function mockFetch(routes: (url: string) => RouteBody) {
  const fn = vi.fn(async (url: string) => {
    const r = routes(url);
    return { ok: r.ok, status: r.status, json: async () => r.body };
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return fn;
}

const LIST = [
  {
    eventId: "ev-2",
    title: "Safety Manual Review",
    status: "closed",
    contentType: "document",
    createdAt: "2026-07-02T00:00:00.000Z",
    endedAt: "2026-07-10T00:00:00.000Z",
    participantCount: 4,
    completionCount: 3,
  },
  {
    eventId: "ev-1",
    title: "Difficult Conversations",
    status: "closed",
    contentType: "youtube",
    createdAt: "2026-07-01T00:00:00.000Z",
    endedAt: "2026-07-05T00:00:00.000Z",
    participantCount: 2,
    completionCount: 1,
  },
];

const DETAIL_EV1 = {
  eventId: "ev-1",
  title: "Difficult Conversations",
  status: "closed",
  contentType: "youtube",
  createdAt: "2026-07-01T00:00:00.000Z",
  endedAt: "2026-07-05T00:00:00.000Z",
  participantCount: 2,
  completionCount: 1,
  material: { kind: "youtube", videoId: "abc", title: "The Video", completionPrompt: "What will you change?" },
  participants: [
    { id: "p1", displayName: "Alice", joinedAt: "x", status: "complete" },
    { id: "p2", displayName: "Bob", joinedAt: "y", status: "watching" },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryHistoryArchive", () => {
  it("renders a populated history list, most-recently-ended first", async () => {
    mockFetch(() => ({ ok: true, status: 200, body: { events: LIST } }));
    render(<FoundryHistoryArchive locale="en" onBack={() => {}} />);
    expect(await screen.findByText("Safety Manual Review")).toBeTruthy();
    expect(screen.getByText("Difficult Conversations")).toBeTruthy();
    expect(screen.getByText("4 participants")).toBeTruthy();
    expect(screen.getByText("3 completed")).toBeTruthy();
  });

  it("shows a neutral, forward-looking empty state", async () => {
    mockFetch(() => ({ ok: true, status: 200, body: { events: [] } }));
    render(<FoundryHistoryArchive locale="en" onBack={() => {}} />);
    expect(await screen.findByText("No past training yet")).toBeTruthy();
  });

  it("recovers from a list load error via retry", async () => {
    const fn = mockFetch(() => ({ ok: false, status: 500, body: {} }));
    render(<FoundryHistoryArchive locale="en" onBack={() => {}} />);
    expect(await screen.findByText(/Could not load history/i)).toBeTruthy();
    await waitFor(() => expect(fn).toHaveBeenCalled());
  });

  it("opens a read-only detail with sections, counts, and completion-only roster", async () => {
    mockFetch((url) =>
      url.includes("/history/ev-1")
        ? { ok: true, status: 200, body: { event: DETAIL_EV1 } }
        : { ok: true, status: 200, body: { events: LIST } },
    );
    render(<FoundryHistoryArchive locale="en" onBack={() => {}} />);
    fireEvent.click(await screen.findByText("Difficult Conversations"));

    expect(await screen.findByText("Session details")).toBeTruthy();
    expect(screen.getByText("Participation")).toBeTruthy();
    expect(screen.getByText("Training materials")).toBeTruthy();
    // roster shows names + completion status, never response text
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    // no edit/reopen/rerun/delete controls exist on the read-only surface
    expect(screen.queryByText(/reopen/i)).toBeNull();
    expect(screen.queryByText(/rerun/i)).toBeNull();
    expect(screen.queryByText(/delete/i)).toBeNull();
  });

  it("shows a not-found state when the detail 404s", async () => {
    mockFetch((url) =>
      url.includes("/history/ev-1")
        ? { ok: false, status: 404, body: { error: "not_found" } }
        : { ok: true, status: 200, body: { events: LIST } },
    );
    render(<FoundryHistoryArchive locale="en" onBack={() => {}} />);
    fireEvent.click(await screen.findByText("Difficult Conversations"));
    expect(await screen.findByText(/could not be found/i)).toBeTruthy();
  });
});
