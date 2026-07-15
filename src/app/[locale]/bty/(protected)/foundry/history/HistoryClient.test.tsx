/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import HistoryClient from "./HistoryClient";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ITEM = (over: Partial<Record<string, unknown>> & { eventId: string }) => ({
  eventTitle: "Training " + over.eventId,
  completedAt: "2026-05-01T10:00:00Z",
  responseText: "I delayed the conversation with my manager.",
  responseExcerpt: "I delayed the conversation with my manager.",
  aiReflection: null,
  aiReflectionLine: null,
  completionState: "pass",
  ...over,
});

function mockFetch(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const body = routes[key] ?? routes[url];
    return { ok: true, status: 200, json: async () => body };
  });
  // @ts-expect-error test shim
  global.fetch = fetchMock;
  return fetchMock;
}

describe("HistoryClient", () => {
  it("shows the quiet status line and NO thread claim when evidence is insufficient", async () => {
    mockFetch({
      "/api/bty/foundry/history": {
        ok: true,
        history: [ITEM({ eventId: "e1" }), ITEM({ eventId: "e2" })],
        thread: null,
        threadStatusCopy: "Two moments now sit beside each other.",
        threadNeedsGeneration: false,
      },
    });
    render(<HistoryClient locale="en" />);
    expect(await screen.findByText("Two moments now sit beside each other.")).toBeTruthy();
    expect(screen.queryByText(/a living thread/i)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull(); // no spinner
  });

  it("renders the Living Thread with supporting moments when eligible", async () => {
    mockFetch({
      "/api/bty/foundry/history": {
        ok: true,
        history: [
          ITEM({ eventId: "e1", eventTitle: "First", responseExcerpt: "I delayed it." }),
          ITEM({ eventId: "e3", eventTitle: "Third", completedAt: "2026-05-21T10:00:00Z", responseExcerpt: "It cost the team." }),
        ],
        thread: {
          thread: "Across these reflections, responsibility appears when delay reaches the team.",
          supportingMoments: [
            { eventId: "e1", excerpt: "I delayed it." },
            { eventId: "e3", excerpt: "It cost the team." },
          ],
          nextQuestion: "Where does responsibility become action before the cost reaches the team?",
        },
        threadStatusCopy: null,
        threadNeedsGeneration: false,
      },
    });
    render(<HistoryClient locale="en" />);
    expect(await screen.findByText(/A living thread/i)).toBeTruthy();
    expect(screen.getByText(/responsibility appears when delay reaches the team/i)).toBeTruthy();
    // The excerpt appears in the supporting moment (and again in the list) — both are correct.
    expect(screen.getAllByText(/It cost the team\./).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Where does responsibility become action/i)).toBeTruthy();
  });

  it("renders history first, then fills the thread from a follow-up request (no layout block)", async () => {
    mockFetch({
      "/api/bty/foundry/history": {
        ok: true,
        history: [ITEM({ eventId: "e1", eventTitle: "First" })],
        thread: null,
        threadStatusCopy: null,
        threadNeedsGeneration: true,
      },
      "POST /api/bty/foundry/history/thread": {
        ok: true,
        threadStatus: "eligible",
        thread: {
          thread: "A connection now visible across your reflections.",
          supportingMoments: [{ eventId: "e1", excerpt: "I delayed it." }],
          nextQuestion: null,
        },
      },
    });
    render(<HistoryClient locale="en" />);
    // History is on screen before the thread arrives.
    expect(await screen.findByText("First")).toBeTruthy();
    // Then the thread fills in quietly.
    expect(await screen.findByText(/A connection now visible/i)).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows a calm empty state, never a failure, when there is no history", async () => {
    mockFetch({
      "/api/bty/foundry/history": {
        ok: true,
        history: [],
        thread: null,
        threadStatusCopy: "No completed reflections yet.",
        threadNeedsGeneration: false,
      },
    });
    render(<HistoryClient locale="en" />);
    expect(await screen.findByText("No completed reflections yet.")).toBeTruthy();
  });
});
