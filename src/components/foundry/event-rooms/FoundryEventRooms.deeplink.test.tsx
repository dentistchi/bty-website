/** @vitest-environment jsdom */
/**
 * Host Leadership Attention deep-link handoff into FoundryEventRooms (Slice 3.1B-3L device gate B fix).
 * Reproduces the cold-navigation race: the deep-link target can arrive as a PROP UPDATE (after the
 * component first mounts with no target, e.g. the owned-event list still loading / tab restored to
 * foundry first). A useState lazy-initializer reads initialEventId only once and would leave the view
 * stuck on home; the target must open the exact control room whenever it becomes available, and be
 * consumed ONLY after the handoff.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import FoundryEventRooms from "./FoundryEventRooms";
import FoundrySharedReview from "./FoundrySharedReview";
import FoundryFollowupStatus from "./FoundryFollowupStatus";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Broad fetch stub: owned events list + drafts + snapshot all resolve empty-ok so the surface settles.
function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bty/foundry/events") && !u.match(/events\/[^/]+/)) {
        return new Response(JSON.stringify({ events: [] }), { status: 200 });
      }
      if (u.includes("/api/bty/foundry/modules")) {
        return new Response(JSON.stringify({ drafts: [] }), { status: 200 });
      }
      // event snapshot / followups / shared-understanding / required-learning → empty ok
      return new Response(JSON.stringify({ ok: true, event: null, rows: [], responses: [] }), { status: 200 });
    }),
  );
}

const EVENT = "ca596ce0-00ab-4973-9fd4-0d4452c4fa6b";
const FOCUS = "d661fa70-68bb-4ad2-8b58-32ef54fa88b1";

describe("FoundryEventRooms — Host deep-link target arriving as a prop update", () => {
  it("opens the exact control room when initialEventId arrives AFTER first mount (was null)", async () => {
    stubFetch();
    const onConsumed = vi.fn();
    const { rerender } = render(
      <FoundryEventRooms locale="en" initialEventId={null} onInitialConsumed={onConsumed} />,
    );
    // First mount with no target → home surface (NOT the control room). The control room shows a
    // "← Back" affordance; assert it is absent initially.
    await waitFor(() => expect(screen.queryByText(/←/)).toBeNull());

    // The deep-link target now arrives as a prop update (the race the Commander observed).
    rerender(
      <FoundryEventRooms
        locale="en"
        initialEventId={EVENT}
        initialFocusSection="shared-understanding"
        initialFocusId={FOCUS}
        onInitialConsumed={onConsumed}
      />,
    );

    // The exact control room must open (back affordance appears) and the target is consumed once.
    await waitFor(() => expect(screen.getByText(/←/)).toBeTruthy());
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  it("opens the control room when initialEventId is present at first mount", async () => {
    stubFetch();
    const onConsumed = vi.fn();
    render(
      <FoundryEventRooms
        locale="en"
        initialEventId={EVENT}
        initialFocusSection="shared-understanding"
        initialFocusId={FOCUS}
        onInitialConsumed={onConsumed}
      />,
    );
    await waitFor(() => expect(screen.getByText(/←/)).toBeTruthy());
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  it("does not reopen the target after the user backs out (consumed once, not sticky)", async () => {
    stubFetch();
    const onConsumed = vi.fn();
    const { rerender } = render(
      <FoundryEventRooms
        locale="en"
        initialEventId={EVENT}
        initialFocusSection="followups"
        initialFocusId={FOCUS}
        onInitialConsumed={onConsumed}
      />,
    );
    await waitFor(() => expect(screen.getByText(/←/)).toBeTruthy());
    // Shell clears the one-shot params after consume; a re-render with null must not force-reopen.
    rerender(<FoundryEventRooms locale="en" initialEventId={null} onInitialConsumed={onConsumed} />);
    expect(onConsumed).toHaveBeenCalledTimes(1); // still exactly once
  });

  it("(#4) does not consume the target while there is none (no null-state consume)", async () => {
    stubFetch();
    const onConsumed = vi.fn();
    render(<FoundryEventRooms locale="en" initialEventId={null} onInitialConsumed={onConsumed} />);
    await waitFor(() => expect(screen.queryByText(/←/)).toBeNull());
    expect(onConsumed).not.toHaveBeenCalled();
  });

  it("(#11) Back from the deep-linked control room returns to the Foundry home/event list", async () => {
    stubFetch();
    render(
      <FoundryEventRooms
        locale="en"
        initialEventId={EVENT}
        initialFocusSection="shared-understanding"
        initialFocusId={FOCUS}
        onInitialConsumed={vi.fn()}
      />,
    );
    const back = await screen.findByText(/←/);
    fireEvent.click(back);
    // Control room's back affordance is gone → we are back on the home surface (not a dead end).
    await waitFor(() => expect(screen.queryByText(/←/)).toBeNull());
  });
});

describe("row focus targeting (Slice 3.1B-3L — #8/#9/#10)", () => {
  it("(#8/#9) FoundrySharedReview highlights the row whose progressId matches focus", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true, sharedQuestion: "What will you apply?",
      responses: [
        { participantId: "pa", progressId: "prog-1", displayName: "Kim", completed: true, sharedResponse: "x", submittedAt: "2026-07-18T06:00:00Z", reviewStatus: "NOT_REVIEWED", reviewNote: null, reviewedAt: null },
        { participantId: "pb", progressId: "prog-2", displayName: "Lee", completed: true, sharedResponse: "y", submittedAt: "2026-07-18T06:00:00Z", reviewStatus: "NOT_REVIEWED", reviewNote: null, reviewedAt: null },
      ],
    }), { status: 200 })));
    render(<FoundrySharedReview eventId="e1" locale="en" focusProgressId="prog-2" />);
    const rows = await screen.findAllByTestId("shared-review-row");
    expect(rows).toHaveLength(2);
    const focused = rows.filter((r) => r.getAttribute("data-focused") === "true");
    expect(focused).toHaveLength(1);
    // The focused row is the second one (prog-2) — the deep-link target, not the learner Reflection.
    expect(focused[0].textContent).toContain("Lee");
  });

  it("(#10) FoundryFollowupStatus highlights the row whose followupId matches focus", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true, rows: [
        { followupId: "fu-1", displayName: "Kim", followUpDays: 7, dueAt: "2026-07-21T05:00:00-07:00", state: "overdue", outcome: null, respondedAt: null },
        { followupId: "fu-2", displayName: "Lee", followUpDays: 7, dueAt: "2026-07-21T05:00:00-07:00", state: "overdue", outcome: null, respondedAt: null },
      ],
    }), { status: 200 })));
    render(<FoundryFollowupStatus eventId="e1" locale="en" focusFollowupId="fu-1" />);
    const rows = await screen.findAllByTestId("followup-status-row");
    const focused = rows.filter((r) => r.getAttribute("data-focused") === "true");
    expect(focused).toHaveLength(1);
    expect(focused[0].textContent).toContain("Kim");
  });

  it("no row is highlighted when no focus is provided", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true, rows: [{ followupId: "fu-1", displayName: "Kim", followUpDays: 7, dueAt: "2026-07-21T05:00:00-07:00", state: "overdue", outcome: null, respondedAt: null }],
    }), { status: 200 })));
    render(<FoundryFollowupStatus eventId="e1" locale="en" />);
    const rows = await screen.findAllByTestId("followup-status-row");
    expect(rows.filter((r) => r.getAttribute("data-focused") === "true")).toHaveLength(0);
  });
});
