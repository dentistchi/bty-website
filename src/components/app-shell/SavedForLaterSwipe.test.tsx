/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SavedForLater, { type SavedCapture } from "./SavedForLater";

/**
 * Swipe as a convenience (Slice T2.1b).
 *
 * The gesture tests assert the REFUSALS first — a vertical scroll, a diagonal drift and a cancelled
 * touch must all leave the row exactly where it was. A swipe that opens too eagerly is worse than
 * no swipe, because the visible buttons already do the whole job.
 */

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
          JSON.stringify({ ok: true, changed: true, capture: { ...base, triageChoice: choice, triagedAt: "2026-09-01T00:00:00Z" } }),
          { status: 200 },
        );
      }
      if (u.includes("/api/bty/action-capture/mine")) return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
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
/**
 * One finger: down, a path of moves, then up.
 *
 * Fired on the translating SURFACE, which is where the handlers live — a touch event dispatched on
 * the outer container would never reach a child's handler, so targeting the wrapper would silently
 * test nothing.
 */
function drag(row: HTMLElement, path: [number, number][]) {
  const s = within(row).getByTestId("swipe-surface");
  fireEvent.touchStart(s, touch(path[0][0], path[0][1]));
  for (const [x, y] of path.slice(1)) fireEvent.touchMove(s, touch(x, y));
  fireEvent.touchEnd(s);
}
const isOpen = (row: HTMLElement) => row.getAttribute("data-open") === "true";
const rowOf = (el: HTMLElement) => within(el).getByTestId("swipe-row");

describe("1-5. what the gesture does and, mostly, does not do", () => {
  it("1. a decisive leftward drag reveals the tray", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [250, 100], [180, 100]]);
    expect(isOpen(row)).toBe(true);
  });

  it("2. a small movement does nothing", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [296, 101]]); // under the intent threshold
    expect(isOpen(row)).toBe(false);
  });

  it("2b. a leftward drag that stops short of halfway settles back closed", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [280, 100], [270, 100]]); // ~30px of a 176px tray
    expect(isOpen(row)).toBe(false);
  });

  it("3. a vertical-dominant gesture never reveals — the page keeps its scroll", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [290, 160], [285, 260]]);
    expect(isOpen(row)).toBe(false);
  });

  it("4. a diagonal drift with more Y than X does not reveal", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    // 120px left but 200px down: the finger meant to scroll.
    drag(row, [[300, 100], [260, 170], [180, 300]]);
    expect(isOpen(row)).toBe(false);
  });

  it("4b. axis is decided once — a swipe that starts horizontal is not stolen by later Y", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    const s = within(row).getByTestId("swipe-surface");
    fireEvent.touchStart(s, touch(300, 100));
    fireEvent.touchMove(s, touch(270, 102)); // horizontal intent wins here
    fireEvent.touchMove(s, touch(180, 260)); // finger wanders down afterwards
    fireEvent.touchEnd(s);
    expect(isOpen(row)).toBe(true);
  });

  it("5. touchcancel restores the last stable position and strands nothing", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    const s = within(row).getByTestId("swipe-surface");
    fireEvent.touchStart(s, touch(300, 100));
    fireEvent.touchMove(s, touch(200, 100));
    fireEvent.touchCancel(s);
    expect(isOpen(row)).toBe(false);
    expect(row.querySelector('[style*="translateX(0px)"]')).toBeTruthy();
  });

  it("3b. beginning a vertical scroll closes a row that was already open", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [250, 100], [180, 100]]);
    expect(isOpen(row)).toBe(true);
    const s2 = within(row).getByTestId("swipe-surface");
    fireEvent.touchStart(s2, touch(300, 100));
    fireEvent.touchMove(s2, touch(298, 200));
    expect(isOpen(row)).toBe(false);
  });
});

describe("6-12. which rows may be swiped, and how many at once", () => {
  it("6+7. only one row stays open; opening another closes the first", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const [r1, r2] = screen.getAllByTestId("swipe-row");
    drag(r1, [[300, 100], [250, 100], [180, 100]]);
    expect(isOpen(r1)).toBe(true);
    drag(r2, [[300, 100], [250, 100], [180, 100]]);
    expect(isOpen(r2)).toBe(true);
    expect(isOpen(r1)).toBe(false);
  });

  it("8+9. a decided row has no swipe surface at all", async () => {
    await renderReady([
      item("s", CONV_A, { triageChoice: "soon", triagedAt: "2026-09-01T00:00:00Z" }),
      item("l", CONV_B, { triageChoice: "later", triagedAt: "2026-09-01T00:00:00Z" }),
    ]);
    expect(screen.queryByTestId("swipe-row")).toBeNull();
    expect(screen.queryByTestId("swipe-actions")).toBeNull();
  });

  it("10. a collapsed conversation group is not swipeable — a gesture must never triage several", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    expect(screen.getByTestId("saved-conversation")).toBeTruthy();
    expect(screen.queryByTestId("swipe-row")).toBeNull();
  });

  it("11. expanding that group makes each underlying message swipeable on its own", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    fireEvent.click(screen.getByTestId("saved-conversation-header"));
    const rows = screen.getAllByTestId("swipe-row");
    expect(rows).toHaveLength(2);
    drag(rows[0], [[300, 100], [250, 100], [180, 100]]);
    expect(isOpen(rows[0])).toBe(true);
    expect(isOpen(rows[1])).toBe(false);
  });

  it("12. a single New card is swipeable directly", async () => {
    await renderReady([item("solo", CONV_A)]);
    expect(screen.getByTestId("swipe-row")).toBeTruthy();
  });
});

describe("13-19. the tray uses the one existing triage authority", () => {
  it("13+14+15. Soon and Later from the tray move exactly one message", async () => {
    const calls = await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const rows = screen.getAllByTestId("swipe-row");
    drag(rows[0], [[300, 100], [250, 100], [180, 100]]);
    fireEvent.click(within(rows[0]).getByTestId("swipe-triage-later"));

    await waitFor(() => expect(screen.getByTestId("saved-group-later")).toBeTruthy());
    expect(calls).toEqual([{ id: "a", choice: "later" }]);
    expect(within(screen.getByTestId("saved-group-later")).getAllByTestId("saved-item")).toHaveLength(1);
    expect(within(screen.getByTestId("saved-group-new")).getAllByTestId("saved-item")).toHaveLength(1);
  });

  it("19. the tray and the visible button send the IDENTICAL payload", async () => {
    const calls = await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const rows = screen.getAllByTestId("swipe-row");
    drag(rows[0], [[300, 100], [250, 100], [180, 100]]);
    fireEvent.click(within(rows[0]).getByTestId("swipe-triage-soon"));
    await waitFor(() => expect(calls).toHaveLength(1));
    fireEvent.click(within(screen.getByTestId("saved-group-new")).getByTestId("saved-triage-soon"));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].choice).toBe(calls[1].choice);
    expect(calls.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("16. a failed tray decision rolls the message back and leaves no stranded swipe state", async () => {
    await renderReady([item("a", CONV_A)], { ok: false });
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [250, 100], [180, 100]]);
    fireEvent.click(within(row).getByTestId("swipe-triage-soon"));

    await screen.findByTestId("saved-triage-error");
    expect(screen.queryByTestId("saved-group-soon")).toBeNull();
    expect(within(screen.getByTestId("saved-group-new")).getByTestId("saved-item")).toBeTruthy();
    expect(isOpen(screen.getByTestId("swipe-row"))).toBe(false);
  });

  it("17+18. no bulk triage exists, and the visible buttons still work", async () => {
    const calls = await renderReady([item("a", CONV_A), item("b", CONV_A), item("c", CONV_A)]);
    fireEvent.click(screen.getByTestId("saved-conversation-header"));
    // 18: the in-card control, untouched by this slice.
    const rows = within(screen.getByTestId("saved-conversation-messages")).getAllByTestId("saved-item");
    fireEvent.click(within(rows[0]).getByTestId("saved-triage-soon"));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls).toEqual([{ id: "a", choice: "soon" }]); // 17: one message, never three
  });
});

describe("20-22. grouping still recomputes from message state", () => {
  it("20. triaging one of TWO grouped New messages leaves a single plain New card", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    fireEvent.click(screen.getByTestId("saved-conversation-header"));
    const rows = screen.getAllByTestId("swipe-row");
    drag(rows[0], [[300, 100], [250, 100], [180, 100]]);
    fireEvent.click(within(rows[0]).getByTestId("swipe-triage-later"));

    await waitFor(() => expect(screen.getByTestId("saved-group-later")).toBeTruthy());
    expect(within(screen.getByTestId("saved-group-new")).queryByTestId("saved-conversation")).toBeNull();
    expect(within(screen.getByTestId("saved-group-new")).getAllByTestId("saved-item")).toHaveLength(1);
  });

  it("21. triaging one of THREE leaves a two-message group", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A), item("c", CONV_A)]);
    fireEvent.click(screen.getByTestId("saved-conversation-header"));
    const rows = screen.getAllByTestId("swipe-row");
    drag(rows[0], [[300, 100], [250, 100], [180, 100]]);
    fireEvent.click(within(rows[0]).getByTestId("swipe-triage-soon"));

    await waitFor(() => expect(screen.getByTestId("saved-group-soon")).toBeTruthy());
    expect(within(screen.getByTestId("saved-group-new")).getByTestId("saved-conversation").getAttribute("data-count")).toBe("2");
  });

  it("22. grouping stays lane-local", async () => {
    await renderReady([
      item("n1", CONV_A),
      item("n2", CONV_A),
      item("s1", CONV_A, { triageChoice: "soon", triagedAt: "2026-09-01T00:00:00Z" }),
    ]);
    expect(within(screen.getByTestId("saved-group-new")).getByTestId("saved-conversation")).toBeTruthy();
    expect(within(screen.getByTestId("saved-group-soon")).queryByTestId("saved-conversation")).toBeNull();
  });
});

describe("23-27. reachable without the gesture, and still calm", () => {
  it("23+24. tray buttons are real buttons with names, and nothing needs a gesture to reach", async () => {
    await renderReady([item("a", CONV_A)]);
    const tray = screen.getByTestId("swipe-actions");
    const buttons = within(tray).getAllByRole("button", { hidden: true });
    expect(buttons.map((b) => b.textContent)).toEqual(["Soon", "Later"]);
    // 24: the same two actions are present in the card without any gesture at all.
    expect(screen.getByTestId("saved-triage-soon")).toBeTruthy();
    expect(screen.getByTestId("saved-triage-later")).toBeTruthy();
  });

  it("25. Open in Teams is still reachable and correct", async () => {
    await renderReady([item("a", CONV_A)]);
    expect(screen.getByTestId("saved-open").getAttribute("href")).toBe("https://teams.microsoft.com/l/message/a");
  });

  it("26+27. no badge, no count on a single card, and no gesture tutorial anywhere", async () => {
    await renderReady([item("a", CONV_A)]);
    const text = screen.getByTestId("saved-view").textContent ?? "";
    for (const forbidden of ["Swipe", "swipe", "Tip", "Drag", "How to", "Tutorial"]) {
      expect(text, `must not coach the user with "${forbidden}"`).not.toContain(forbidden);
    }
    expect(screen.queryByTestId("saved-conversation-count")).toBeNull();
  });
});
