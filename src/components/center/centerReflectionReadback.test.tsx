/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import CenterRealityFeed from "./CenterRealityFeed";
import { listUserFoundryHistory } from "@/lib/bty/foundry/events/foundryHistoryService";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE 3.2R-R8D-R1 — THE LEARNER COULD NOT READ WHAT THEY WROTE.
 *
 * R8B gave the learner a dedicated REFLECT answer and stored it in `learner_reflection_text`.
 * Nothing read it. On the real device the Center card reached by "View my private reflection in
 * Center →" focused the right entry and then showed:
 *
 *   "I will say: Mina owns the supplier call, by Thursday 5pm."
 *
 * — which is `response_text`, the BEFORE YOU FINISH commitment. The reflection itself,
 * "Usually nobody is named, so the item drifts until someone notices it days later.", existed
 * durably and was visible to no one, including its author.
 *
 * ═══ TWO ANSWERS, TWO BLOCKS, ONE OWNER ═══
 *
 * Center is the canonical home for a learner's own private writing — it says so on the screen
 * ("Your reflections are private. Only you can see them.") and it already reuses the
 * owner-scoped history endpoint and the `entry=<progressId>` deep link. So the repair is a
 * projection widening plus a card that stops implying the learner wrote one thing when they
 * wrote two. My Learning still shows neither; the Host still sees neither.
 */

const REFLECT = "Usually nobody is named, so the item drifts until someone notices it days later.";
const FINISH = "I will say: Mina owns the supplier call, by Thursday 5pm.";
const SHARED = "Every agreed item leaves the huddle with one owner and one deadline.";

function mockFetch(history: unknown[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    void init;
    const u = String(url);
    if (u.includes("/api/bty/foundry/history")) return { ok: true, status: 200, json: async () => ({ ok: true, history }) };
    if (u.includes("/api/me/conversation-preferences")) return { ok: true, status: 200, json: async () => ({ personalizeTodayFromReflections: false }) };
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

/** The canonical live entry, exactly as the route now emits it. */
const R8B_ENTRY = {
  entryId: "2ea834ab-a7ea-48c1-ba71-0b5c06e79b0c",
  eventTitle: "Building Accountability in Huddles",
  contentType: "document",
  completedAt: "2026-08-14T15:40:12.107Z",
  responseText: FINISH,
  learnerReflection: REFLECT,
};
const LEGACY_ENTRY = {
  entryId: "11111111-1111-1111-1111-111111111111",
  eventTitle: "An older training",
  contentType: "youtube",
  completedAt: "2026-07-22T04:00:00Z",
  responseText: "What I wrote back then.",
  learnerReflection: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("[3.2R-R8D-R1] D/E/F — the learner reads both of their own answers", () => {
  it("renders the REFLECT answer and the BEFORE YOU FINISH answer as separate, labelled blocks", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch([R8B_ENTRY]);
    render(<CenterRealityFeed locale="en" focusEntryId={R8B_ENTRY.entryId} />);
    await waitFor(() => expect(screen.getByTestId("center-entry-reflect")).toBeTruthy());

    const reflect = screen.getByTestId("center-entry-reflect");
    const finish = screen.getByTestId("center-entry-before-you-finish");

    // F — NOT SWAPPED. Each answer under the heading that names its own question.
    expect(reflect.textContent).toContain("REFLECT");
    expect(reflect.textContent).toContain(REFLECT);
    expect(reflect.textContent).not.toContain(FINISH);
    expect(finish.textContent).toContain("BEFORE YOU FINISH");
    expect(finish.textContent).toContain(FINISH);
    expect(finish.textContent).not.toContain(REFLECT);

    // I — the deep link still focuses this exact progress row.
    const card = screen.getByTestId("center-reflection-item");
    expect(card.getAttribute("data-entry-id")).toBe(R8B_ENTRY.entryId);
    expect(card.getAttribute("data-focused")).toBe("1");
  });

  it("G — a legacy entry keeps the presentation it has always had, unlabelled", async () => {
    /*
      No fabricated REFLECT block, and no relabelling of a historical answer as something it
      never was: that event asked ONE private question, so one block with no heading is the
      truthful rendering — exactly what it looked like before this slice.
    */
    // @ts-expect-error test shim
    global.fetch = mockFetch([LEGACY_ENTRY]);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(screen.getByTestId("center-entry-legacy")).toBeTruthy());
    expect(screen.getByText("What I wrote back then.")).toBeTruthy();
    expect(screen.queryByTestId("center-entry-reflect")).toBeNull();
    expect(screen.queryByTestId("center-entry-before-you-finish")).toBeNull();
    expect(screen.queryByText("REFLECT")).toBeNull();
  });

  it("H — an entry with ONLY a reflection is no longer filtered out of the one surface for it", async () => {
    // The old rule was `responseText.length > 0`, correct until R8B made a second answer possible.
    // @ts-expect-error test shim
    global.fetch = mockFetch([{ ...R8B_ENTRY, responseText: "" }]);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(screen.getByTestId("center-entry-reflect")).toBeTruthy());
    expect(screen.getByText(REFLECT)).toBeTruthy();
    expect(screen.queryByTestId("center-entry-before-you-finish"), "nothing to show, so no empty heading").toBeNull();
  });

  it("an entry with neither answer still stays out — the filter widened, it did not open", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch([{ ...R8B_ENTRY, responseText: "", learnerReflection: null }]);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(screen.queryByTestId("center-reflection-item")).toBeNull());
  });

  it("both entries coexist — the feed does not become all-or-nothing", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch([R8B_ENTRY, LEGACY_ENTRY]);
    render(<CenterRealityFeed locale="en" />);
    await waitFor(() => expect(screen.getAllByTestId("center-reflection-item").length).toBe(2));
    expect(screen.getByTestId("center-entry-reflect")).toBeTruthy();
    expect(screen.getByTestId("center-entry-legacy")).toBeTruthy();
  });

  it("K/L — opening Center calls no provider and writes nothing", async () => {
    const fetchMock = mockFetch([R8B_ENTRY]);
    // @ts-expect-error test shim
    global.fetch = fetchMock;
    render(<CenterRealityFeed locale="en" focusEntryId={R8B_ENTRY.entryId} />);
    await waitFor(() => expect(screen.getByTestId("center-entry-reflect")).toBeTruthy());
    for (const call of fetchMock.mock.calls) {
      const [url, init] = call as unknown as [string, RequestInit | undefined];
      expect(init?.method ?? "GET", `${url} must be a read`).toBe("GET");
      expect(/generate|reflect\/create|anthropic|openai/i.test(String(url)), url).toBe(false);
    }
  });
});

describe("[3.2R-R8D-R1] A/B/C — who can read it", () => {
  function admin(rows: unknown[], calls: [string, unknown][]): SupabaseClient {
    const b = {
      from: () => b,
      select: () => b,
      eq: (c: string, v: unknown) => { calls.push([c, v]); return b; },
      not: () => b,
      in: () => b,
      order: () => b,
      returns: () => b,
      then: (f: (v: { data: unknown[] }) => unknown) => Promise.resolve(f({ data: rows })),
    };
    return b as unknown as SupabaseClient;
  }

  it("A/B — the projection returns learnerReflection and is scoped to the CALLER", async () => {
    const calls: [string, unknown][] = [];
    const items = await listUserFoundryHistory(
      admin(
        [{ id: "p1", event_id: "e1", completed_at: "2026-08-14T15:40:12.107Z", response_text: FINISH, learner_reflection_text: REFLECT, shared_understanding_response: SHARED, reflection: null, completion_state: null }],
        calls,
      ),
      "ea07f5bc-cc87-45f9-a67f-d92e2fbc8b25",
    );
    expect(items[0].learnerReflection).toBe(REFLECT);
    expect(items[0].responseText, "not swapped").toBe(FINISH);
    // B — another learner cannot read it because the query is bound to linked_user_id = caller.
    expect(calls).toContainEqual(["linked_user_id", "ea07f5bc-cc87-45f9-a67f-d92e2fbc8b25"]);
  });

  it("a legacy row yields null rather than an empty string pretending to be an answer", async () => {
    const items = await listUserFoundryHistory(
      admin([{ id: "p2", event_id: "e1", completed_at: "2026-07-22T04:00:00Z", response_text: "old", learner_reflection_text: null, shared_understanding_response: null, reflection: null, completion_state: null }], []),
      "u1",
    );
    expect(items[0].learnerReflection).toBeNull();
  });

  it("C/J — no Host surface and no My Learning surface names the column", () => {
    /*
      The widening is one owner-scoped query. Host projections are SEPARATE queries with their
      own allow-lists, and My Learning deliberately shows no private answer at all — it links
      here instead. Asserted on the source because that is where a leak would be introduced.
    */
    const fs = require("node:fs") as typeof import("node:fs");
    for (const f of [
      "src/lib/bty/foundry/events/foundryHostHistoryService.ts",
      "src/lib/bty/foundry/events/hostAttentionService.ts",
      "src/lib/bty/foundry/events/foundrySharedReviewService.ts",
      "src/lib/bty/foundry/events/foundryDocumentService.ts",
      "src/components/foundry/event-rooms/FoundryMyLearning.tsx",
    ]) {
      const src = fs.readFileSync(f, "utf8");
      // `[^)]` already spans newlines, so no dotall flag is needed (and none is available here).
      expect(/select\([^)]*learner_reflection_text/.test(src), `${f} must not project it`).toBe(false);
      expect(src.includes("learnerReflection"), `${f} must not render it`).toBe(false);
    }
  });
});
