/** @vitest-environment jsdom */
/**
 * Swipe IS the decision (Founder interaction review, 2026-09-02).
 *
 * Left commits the left choice, right commits the right choice — the same two words the card
 * already shows, in the same order, so the gesture's vocabulary is the one already on screen.
 *
 * WHAT THIS REPLACED. Swiping used to reveal a tray holding a SECOND copy of the card's own Soon
 * and Later buttons: a longer road to the same place, and it parked the card in an open state on
 * the way. There is now one road per choice, and no parked state to leave behind.
 *
 * The refusals are asserted first and hardest, because a gesture that decides too eagerly is far
 * worse than one that does nothing — the visible buttons already do the whole job, so this may
 * only ever be a shortcut for someone who meant it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SavedForLater, { type SavedCapture } from "./SavedForLater";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const CONV_A = { tenant_id: "T1", conversation_id: "19:chat-a@unq.gbl.spaces", sender_display: "Ana" };
const CONV_B = { tenant_id: "T1", conversation_id: "19:chat-b@unq.gbl.spaces", sender_display: "Bo" };

const item = (id: string, meta: Record<string, unknown>, over: Partial<SavedCapture> = {}): SavedCapture => ({
  id,
  sourceType: "teams_message",
  previewText: `preview ${id}`,
  sourceUrl: `https://teams.microsoft.com/l/message/${id}`,
  sourceMetadata: { provider: "teams", ...meta },
  status: "captured",
  capturedAt: "2026-08-31T10:00:00Z",
  triageChoice: null,
  triagedAt: null,
  ...over,
});

function stub(items: SavedCapture[], triage: { ok: boolean } = { ok: true }) {
  const calls: { id: string; choice: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/triage")) {
        const choice = JSON.parse(String(init?.body ?? "{}")).choice as string;
        const id = decodeURIComponent(u.split("/action-capture/")[1].split("/triage")[0]);
        calls.push({ id, choice });
        if (!triage.ok) return new Response(JSON.stringify({ ok: false }), { status: 500 });
        const base = items.find((i) => i.id === id)!;
        return new Response(
          JSON.stringify({
            ok: true,
            changed: true,
            capture: { ...base, triageChoice: choice, triagedAt: "2026-09-01T00:00:00Z" },
          }),
          { status: 200 },
        );
      }
      if (u.includes("/api/bty/action-capture/mine")) {
        return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
  return calls;
}

async function renderReady(items: SavedCapture[], triage?: { ok: boolean }) {
  const calls = stub(items, triage);
  render(<SavedForLater locale="en" />);
  await screen.findByTestId("saved-list");
  return calls;
}

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });
const surfaceOf = (row: HTMLElement) => within(row).getByTestId("swipe-surface");
const indicatorOf = (row: HTMLElement) => within(row).queryByTestId("swipe-indicator");

/** Finger down and moving, still held. */
function press(row: HTMLElement, path: [number, number][]) {
  const s = surfaceOf(row);
  fireEvent.touchStart(s, touch(path[0][0], path[0][1]));
  for (const [x, y] of path.slice(1)) fireEvent.touchMove(s, touch(x, y));
}
/** Finger down, moving, then lifted — the only thing that can decide anything. */
function drag(row: HTMLElement, path: [number, number][]) {
  press(row, path);
  fireEvent.touchEnd(surfaceOf(row));
}
const rows = () => screen.getAllByTestId("swipe-row");
const only = () => screen.getByTestId("swipe-row");

/* Commit distance is 96px, so 100 decides and 40 does not. */
const LEFT_COMMIT: [number, number][] = [[300, 100], [260, 100], [200, 100]];
const RIGHT_COMMIT: [number, number][] = [[300, 100], [340, 100], [400, 100]];
const SHORT: [number, number][] = [[300, 100], [260, 100]];
const VERTICAL: [number, number][] = [[300, 100], [298, 160], [297, 220]];

describe("1-4. the gesture decides, and decides only what was meant", () => {
  it("★ 1. a left swipe past the threshold performs Soon, exactly once", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), LEFT_COMMIT);
    await waitFor(() => expect(calls).toEqual([{ id: "a", choice: "soon" }]));
    expect(calls).toHaveLength(1);
  });

  it("★ 2. a right swipe past the threshold performs Later, exactly once", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), RIGHT_COMMIT);
    await waitFor(() => expect(calls).toEqual([{ id: "a", choice: "later" }]));
    expect(calls).toHaveLength(1);
  });

  it("★ 3. a left swipe NEVER performs Later", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), LEFT_COMMIT);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls.every((c) => c.choice === "soon")).toBe(true);
    await waitFor(() => expect(screen.getByTestId("saved-group-soon")).toBeTruthy());
    expect(screen.queryByTestId("saved-group-later")).toBeNull();
  });

  it("★ 4. a right swipe NEVER performs Soon", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), RIGHT_COMMIT);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls.every((c) => c.choice === "later")).toBe(true);
    await waitFor(() => expect(screen.getByTestId("saved-group-later")).toBeTruthy());
    expect(screen.queryByTestId("saved-group-soon")).toBeNull();
  });

  it("the card lands in the group its direction named", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    drag(rows()[0], LEFT_COMMIT);
    await waitFor(() => expect(screen.getByTestId("saved-group-soon")).toBeTruthy());
    drag(screen.getAllByTestId("swipe-row")[0], RIGHT_COMMIT);
    await waitFor(() => expect(screen.getByTestId("saved-group-later")).toBeTruthy());
    expect(within(screen.getByTestId("saved-group-soon")).getAllByTestId("saved-item")).toHaveLength(1);
    expect(within(screen.getByTestId("saved-group-later")).getAllByTestId("saved-item")).toHaveLength(1);
  });
});

describe("5-7. the refusals", () => {
  it("★ 5. a drag short of the threshold performs nothing and resets", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), SHORT);
    expect(calls).toEqual([]);
    expect(surfaceOf(only()).style.transform).toBe("translateX(0px)");
    expect(indicatorOf(only())).toBeNull();
  });

  it("★ 6. a vertical-dominant gesture performs nothing — the page keeps its scroll", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), VERTICAL);
    expect(calls).toEqual([]);
    expect(surfaceOf(only()).style.transform).toBe("translateX(0px)");
    expect(indicatorOf(only())).toBeNull();
  });

  it("a long vertical drag never decides, however far it travels", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), [[300, 100], [299, 200], [298, 400]]);
    expect(calls).toEqual([]);
  });

  it("axis is decided once — a swipe that starts horizontal is not stolen by later Y", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), [[300, 100], [270, 101], [200, 260]]);
    await waitFor(() => expect(calls).toEqual([{ id: "a", choice: "soon" }]));
  });

  it("★ 7. a cancelled touch decides nothing and strands nothing", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    press(only(), [[300, 100], [190, 100]]);
    expect(indicatorOf(only())).toBeTruthy(); // it was genuinely mid-gesture
    fireEvent.touchCancel(surfaceOf(only()));
    expect(calls).toEqual([]);
    expect(surfaceOf(only()).style.transform).toBe("translateX(0px)");
    expect(indicatorOf(only())).toBeNull();
  });

  it("a diagonal drift with more Y than X does not decide", async () => {
    const calls = await renderReady([item("a", CONV_A)]);
    drag(only(), [[300, 100], [280, 160], [240, 260]]);
    expect(calls).toEqual([]);
  });
});

describe("8-9. nothing is left behind, either way", () => {
  it("★ 8. a successful decision leaves no open tray and no action surface", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    drag(rows()[0], LEFT_COMMIT);
    await waitFor(() => expect(screen.getByTestId("saved-group-soon")).toBeTruthy());
    const decided = within(screen.getByTestId("saved-group-soon")).getByTestId("saved-item");
    // A decided row is not swipeable at all, so there is nothing left to leave open.
    expect(within(decided).queryByTestId("swipe-row")).toBeNull();
    expect(within(decided).queryByTestId("swipe-indicator")).toBeNull();
    // ...and the row that stayed behind is back at rest.
    const remaining = within(screen.getByTestId("saved-group-new")).getByTestId("swipe-row");
    expect(surfaceOf(remaining).style.transform).toBe("translateX(0px)");
  });

  it("★ 9. a FAILED decision leaves no stale translation", async () => {
    const calls = await renderReady([item("a", CONV_A)], { ok: false });
    drag(only(), LEFT_COMMIT);
    await waitFor(() => expect(screen.getByTestId("saved-triage-error")).toBeTruthy());
    expect(calls).toEqual([{ id: "a", choice: "soon" }]);
    const back = only();
    expect(surfaceOf(back).style.transform).toBe("translateX(0px)");
    expect(indicatorOf(back)).toBeNull();
    // The card is back in New with its buttons, which is the whole recovery.
    expect(within(back).getByTestId("saved-triage-soon")).toBeTruthy();
  });

  it("a failed decision can be retried straight away with the visible button", async () => {
    const calls = await renderReady([item("a", CONV_A)], { ok: false });
    drag(only(), LEFT_COMMIT);
    await waitFor(() => expect(screen.getByTestId("saved-triage-error")).toBeTruthy());
    fireEvent.click(screen.getByTestId("saved-triage-later"));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({ id: "a", choice: "later" });
  });
});

describe("10. one card's gesture is its own", () => {
  it("★ 10. dragging one card moves and marks ONLY that card", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const [first, second] = rows();
    press(first, [[300, 100], [200, 100]]);
    expect(indicatorOf(first)).toBeTruthy();
    expect(indicatorOf(second)).toBeNull();
    expect(surfaceOf(second).style.transform).toBe("translateX(0px)");
  });

  it("★ 10b. a decision on one card decides exactly one message", async () => {
    const calls = await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    drag(rows()[0], LEFT_COMMIT);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls).toEqual([{ id: "a", choice: "soon" }]);
    expect(within(screen.getByTestId("saved-group-new")).getAllByTestId("saved-item")).toHaveLength(1);
  });

  it("no gesture state survives from one card to the next", async () => {
    const calls = await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    press(rows()[0], [[300, 100], [200, 100]]);
    fireEvent.touchCancel(surfaceOf(rows()[0]));
    drag(rows()[1], RIGHT_COMMIT);
    await waitFor(() => expect(calls).toEqual([{ id: "b", choice: "later" }]));
  });
});

describe("11. the visible buttons are still the whole job", () => {
  it("★ 11. Soon and Later still work by tap, with no gesture at all", async () => {
    const calls = await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    fireEvent.click(screen.getAllByTestId("saved-triage-soon")[0]);
    await waitFor(() => expect(calls).toHaveLength(1));
    fireEvent.click(within(screen.getByTestId("saved-group-new")).getByTestId("saved-triage-later"));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toEqual([{ id: "a", choice: "soon" }, { id: "b", choice: "later" }]);
  });

  it("★ 11b. the gesture and the button send the IDENTICAL payload", async () => {
    const calls = await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    drag(rows()[0], LEFT_COMMIT);
    await waitFor(() => expect(calls).toHaveLength(1));
    fireEvent.click(within(screen.getByTestId("saved-group-new")).getByTestId("saved-triage-soon"));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].choice).toBe(calls[1].choice);
    expect(calls.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("the buttons keep their accessible names, and there is no second pair anywhere", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = only();
    const names = within(row).getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual(["Soon", "Later"]);
    // The old tray held a duplicate pair. Nothing renders one now.
    expect(within(row).queryByTestId("swipe-triage-soon")).toBeNull();
    expect(within(row).queryByTestId("swipe-triage-later")).toBeNull();
  });

  it("Open in Teams is still reachable and correct", async () => {
    await renderReady([item("a", CONV_A)]);
    const link = screen.getByTestId("saved-open") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://teams.microsoft.com/l/message/a");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});

describe("which rows may be swiped at all", () => {
  it("a decided row has no swipe surface", async () => {
    await renderReady([item("a", CONV_A, { triageChoice: "soon", triagedAt: "2026-09-01T00:00:00Z" })]);
    expect(screen.queryByTestId("swipe-surface")).toBeNull();
    expect(screen.queryByTestId("swipe-row")).toBeNull();
  });

  it("a collapsed conversation group is not swipeable — a gesture must never triage several", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    expect(screen.getByTestId("saved-conversation")).toBeTruthy();
    expect(screen.queryByTestId("swipe-surface")).toBeNull();
  });

  it("expanding that group makes each underlying message decidable on its own", async () => {
    const calls = await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    fireEvent.click(within(screen.getByTestId("saved-conversation")).getAllByRole("button")[0]);
    await waitFor(() => expect(screen.getByTestId("saved-conversation-messages")).toBeTruthy());
    const inner = within(screen.getByTestId("saved-conversation-messages")).getAllByTestId("swipe-row");
    expect(inner).toHaveLength(2);
    drag(inner[0], LEFT_COMMIT);
    await waitFor(() => expect(calls).toEqual([{ id: "a", choice: "soon" }]));
  });

  it("grouping recomputes after a swipe decision", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A), item("c", CONV_A)]);
    fireEvent.click(within(screen.getByTestId("saved-conversation")).getAllByRole("button")[0]);
    await waitFor(() => expect(screen.getByTestId("saved-conversation-messages")).toBeTruthy());
    drag(within(screen.getByTestId("saved-conversation-messages")).getAllByTestId("swipe-row")[0], LEFT_COMMIT);
    await waitFor(() => expect(screen.getByTestId("saved-group-soon")).toBeTruthy());
    // Three became two-in-a-group plus one decided.
    expect(within(screen.getByTestId("saved-group-soon")).getAllByTestId("saved-item")).toHaveLength(1);
  });
});
