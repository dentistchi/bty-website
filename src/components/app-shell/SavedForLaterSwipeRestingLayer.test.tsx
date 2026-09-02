/** @vitest-environment jsdom */
/**
 * The resting card must not leak its swipe tray (device defect, 2026-09-02).
 *
 * FOUNDER SCREENSHOT, iPhone Teams tab: a translucent vertical strip carrying a second "Soon" /
 * "Later" pair ran down the centre-right of every undecided Saved card, over the card's own text,
 * while nothing was being swiped. The real bottom buttons were present too, so the same two words
 * appeared twice on one card.
 *
 * WHY IT HAPPENED, and why the obvious suspects were all innocent. The tray is positioned
 * `absolute inset-y-0 right-0` INSIDE the swipe wrapper. It is never translated off-screen, and
 * the wrapper's `overflow-hidden` never clips it, because it already sits inside the box. The one
 * and only thing concealing it was the row painting over it — and a Saved card's background is
 * `bg-white/[0.02]`. Two percent. The tray read straight through it.
 *
 * So: not double-rendered, not an inverted z-index, not a missing `overflow-hidden`, not a
 * stranded transform. The cover was transparent.
 *
 * These tests pin the mechanism that replaced it: the tray is `invisible` and inert until the row
 * has ACTUALLY moved. They are deliberately about the resting state, which the existing 27 gesture
 * tests never asserted — every one of them measured what happens DURING and AFTER a drag.
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
const trayOf = (row: HTMLElement) => within(row).getByTestId("swipe-actions");

/** The contract: a tray is only revealed while the row is displaced. */
const revealed = (row: HTMLElement) => trayOf(row).getAttribute("data-revealed") === "true";
/** The CSS that actually does the hiding — asserted so the attribute cannot drift from reality. */
const inert = (row: HTMLElement) => {
  const cls = trayOf(row).className;
  return cls.includes("invisible") && cls.includes("pointer-events-none");
};

function press(row: HTMLElement, path: [number, number][]) {
  const s = surfaceOf(row);
  fireEvent.touchStart(s, touch(path[0][0], path[0][1]));
  for (const [x, y] of path.slice(1)) fireEvent.touchMove(s, touch(x, y));
}
function drag(row: HTMLElement, path: [number, number][]) {
  press(row, path);
  fireEvent.touchEnd(surfaceOf(row));
}

describe("1. a resting card exposes no swipe action layer", () => {
  it("★ the tray is invisible and inert on an untouched card", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    expect(row.getAttribute("data-open")).toBe("false");
    expect(revealed(row)).toBe(false);
    expect(inert(row)).toBe(true);
  });

  it("★ the duplicate Soon/Later pair from the screenshot is present but hidden, not painted", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    // The tray's buttons still EXIST (they are the same two actions) — they are simply not shown.
    const trayButtons = within(trayOf(row)).getAllByRole("button", { hidden: true });
    expect(trayButtons.map((b) => b.textContent)).toEqual(["Soon", "Later"]);
    expect(inert(row)).toBe(true);
    // ...while the card's own visible controls are untouched and still on screen.
    expect(within(row).getByTestId("saved-triage-soon")).toBeTruthy();
    expect(within(row).getByTestId("saved-triage-later")).toBeTruthy();
  });

  it("the resting row carries no translation, so nothing is displaced to begin with", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    expect(surfaceOf(row).style.transform).toBe("translateX(0px)");
  });

  it("a movement too small to mean anything still reveals nothing", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [296, 100]]); // under the 8px intent threshold
    expect(revealed(row)).toBe(false);
    expect(inert(row)).toBe(true);
  });
});

describe("2. the tray appears only while the row is actually displaced", () => {
  it("★ mid-drag the tray is revealed", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [250, 100]]);
    expect(revealed(row)).toBe(true);
    expect(inert(row)).toBe(false);
    expect(surfaceOf(row).style.transform).not.toBe("translateX(0px)");
  });

  it("an open row keeps the tray revealed after the finger lifts", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [250, 100], [180, 100]]);
    expect(row.getAttribute("data-open")).toBe("true");
    expect(revealed(row)).toBe(true);
  });

  it("a vertical scroll never reveals the tray", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [298, 160]]);
    expect(revealed(row)).toBe(false);
    expect(inert(row)).toBe(true);
  });
});

describe("3. cancel and settle-back return a clean resting card", () => {
  it("★ a drag that stops short of halfway leaves no visible tray", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [285, 100]]);
    expect(row.getAttribute("data-open")).toBe("false");
    expect(revealed(row)).toBe(false);
    expect(inert(row)).toBe(true);
    expect(surfaceOf(row).style.transform).toBe("translateX(0px)");
  });

  it("★ touchcancel mid-drag strands no visible strip", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [240, 100]]);
    expect(revealed(row)).toBe(true);
    fireEvent.touchCancel(surfaceOf(row));
    expect(revealed(row)).toBe(false);
    expect(inert(row)).toBe(true);
    expect(surfaceOf(row).style.transform).toBe("translateX(0px)");
  });

  it("tapping an open row puts it away and hides the tray again", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    drag(row, [[300, 100], [250, 100], [180, 100]]);
    expect(revealed(row)).toBe(true);
    fireEvent.click(surfaceOf(row));
    expect(row.getAttribute("data-open")).toBe("false");
    expect(revealed(row)).toBe(false);
  });
});

describe("4. a completed decision leaves no stale overlay", () => {
  it("★ choosing from the tray leaves the resulting card with no swipe layer at all", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const row = screen.getAllByTestId("swipe-row")[0];
    drag(row, [[300, 100], [250, 100], [180, 100]]);
    fireEvent.click(within(row).getByTestId("swipe-triage-later"));

    await waitFor(() => expect(screen.getByTestId("saved-group-later")).toBeTruthy());
    const decided = within(screen.getByTestId("saved-group-later")).getByTestId("saved-item");
    // A decided row is not swipeable, so it renders no tray whatsoever — nothing left to leak.
    expect(within(decided).queryByTestId("swipe-actions")).toBeNull();
    expect(within(decided).queryByTestId("swipe-row")).toBeNull();
  });

  it("a failed decision rolls back to a clean resting card, not an open one", async () => {
    await renderReady([item("a", CONV_A)], { ok: false });
    const row = screen.getAllByTestId("swipe-row")[0];
    drag(row, [[300, 100], [250, 100], [180, 100]]);
    fireEvent.click(within(row).getByTestId("swipe-triage-soon"));
    await waitFor(() => expect(screen.getByTestId("saved-triage-error")).toBeTruthy());
    const back = screen.getAllByTestId("swipe-row")[0];
    expect(back.getAttribute("data-open")).toBe("false");
    expect(revealed(back)).toBe(false);
  });
});

describe("5. cards do not share swipe state", () => {
  it("★ swiping one card reveals ONLY that card's tray", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const rows = screen.getAllByTestId("swipe-row");
    press(rows[0], [[300, 100], [240, 100]]);
    expect(revealed(rows[0])).toBe(true);
    expect(revealed(rows[1])).toBe(false);
    expect(inert(rows[1])).toBe(true);
  });

  it("opening a second card hides the first card's tray again", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const rows = screen.getAllByTestId("swipe-row");
    drag(rows[0], [[300, 100], [250, 100], [180, 100]]);
    expect(revealed(rows[0])).toBe(true);
    drag(rows[1], [[300, 100], [250, 100], [180, 100]]);
    const after = screen.getAllByTestId("swipe-row");
    expect(revealed(after[0])).toBe(false);
    expect(inert(after[0])).toBe(true);
    expect(revealed(after[1])).toBe(true);
  });

  it("★ with several undecided cards, a fully resting list shows no revealed tray anywhere", async () => {
    // The screenshot's actual shape: multiple cards, all leaking at once.
    await renderReady([
      item("a", CONV_A),
      item("b", CONV_B),
      item("c", { tenant_id: "T1", conversation_id: "19:chat-c@unq.gbl.spaces", sender_display: "Cy" }),
    ]);
    const rows = screen.getAllByTestId("swipe-row");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      expect(revealed(row)).toBe(false);
      expect(inert(row)).toBe(true);
    }
  });
});

describe("6. the iPhone viewport the defect was photographed on", () => {
  it("★ at 390px the resting list still exposes no tray", async () => {
    // iPhone 14/15 CSS width, which is what the Teams tab renders at on the Founder's device.
    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    for (const row of screen.getAllByTestId("swipe-row")) {
      expect(revealed(row)).toBe(false);
      expect(inert(row)).toBe(true);
    }
  });

  it("the hiding is real CSS, not only an attribute a snapshot could satisfy", async () => {
    await renderReady([item("a", CONV_A)]);
    const tray = trayOf(screen.getByTestId("swipe-row"));
    // visibility:hidden, NOT display:none — the reveal width is measured from offsetWidth, and a
    // display:none tray measures zero, which would collapse the open position to nothing.
    expect(tray.className).toContain("invisible");
    expect(tray.className).not.toContain("hidden ");
    expect(tray.className).not.toMatch(/\bdisplay-none\b/);
    expect(tray.className).toContain("pointer-events-none");
  });
});
