/** @vitest-environment jsdom */
/**
 * The resting card must expose no action surface — and now cannot (defect 2026-09-02, PASS/CLOSED).
 *
 * THE ORIGINAL DEFECT, from the Founder's iPhone Teams tab: a translucent strip carrying a second
 * "Soon" / "Later" pair ran down the centre-right of every undecided card, over the card's own
 * text, while nothing was being swiped. The cause was not a z-index, an overflow or a stranded
 * transform — a tray sat mounted behind every row, and the only thing hiding it was the card
 * painting on top. The card is `bg-white/[0.02]`. A two percent cover.
 *
 * That was first fixed by hiding the tray. The gesture has since become a direct action, and the
 * tray is gone entirely, so the guarantee is now STRUCTURAL: at rest there is nothing behind a row
 * to leak, hidden or otherwise. These tests hold that line — a future slice that reintroduces a
 * persistent layer behind a resting card fails here rather than on a Founder's phone.
 *
 * They also pin the half that keeps the new gesture legible: exactly ONE outcome may ever be on
 * screen, and it must be the one the finger is heading toward.
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
const CONV_C = { tenant_id: "T1", conversation_id: "19:chat-c@unq.gbl.spaces", sender_display: "Cy" };

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

function stub(items: SavedCapture[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/triage")) {
        const choice = JSON.parse(String(init?.body ?? "{}")).choice as string;
        const id = decodeURIComponent(u.split("/action-capture/")[1].split("/triage")[0]);
        const base = items.find((i) => i.id === id)!;
        return new Response(
          JSON.stringify({ ok: true, changed: true, capture: { ...base, triageChoice: choice } }),
          { status: 200 },
        );
      }
      if (u.includes("/api/bty/action-capture/mine")) {
        return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
}

async function renderReady(items: SavedCapture[]) {
  stub(items);
  render(<SavedForLater locale="en" />);
  await screen.findByTestId("saved-list");
}

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });
const surfaceOf = (row: HTMLElement) => within(row).getByTestId("swipe-surface");
const indicatorOf = (row: HTMLElement) => within(row).queryByTestId("swipe-indicator");
function press(row: HTMLElement, path: [number, number][]) {
  const s = surfaceOf(row);
  fireEvent.touchStart(s, touch(path[0][0], path[0][1]));
  for (const [x, y] of path.slice(1)) fireEvent.touchMove(s, touch(x, y));
}

describe("1. a resting card renders no action surface at all", () => {
  it("★ an untouched card has NO indicator in the DOM — not a hidden one", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    expect(indicatorOf(row)).toBeNull();
    expect(surfaceOf(row).style.transform).toBe("translateX(0px)");
  });

  it("★ the duplicate Soon/Later pair from the screenshot no longer exists anywhere", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    // The card's own controls, and only those, in the whole row. "Open in Teams" became a button
    // on 2026-09-04 (it was an anchor the Teams frame containment skipped); the assertion this test
    // exists for is unchanged — exactly ONE Soon and ONE Later, no duplicate pair from a tray.
    expect(within(row).getAllByRole("button", { hidden: true }).map((b) => b.textContent)).toEqual([
      "Open in Teams",
      "Soon",
      "Later",
    ]);
  });

  it("★ several undecided cards at rest expose nothing, which is the screenshot's exact shape", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B), item("c", CONV_C)]);
    const rows = screen.getAllByTestId("swipe-row");
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(indicatorOf(row)).toBeNull();
  });

  it("a movement too small to mean anything renders nothing", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [296, 100]]); // under the 8px intent lock
    expect(indicatorOf(row)).toBeNull();
  });

  it("a vertical scroll renders nothing", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [298, 170]]);
    expect(indicatorOf(row)).toBeNull();
  });
});

describe("2. exactly one outcome is ever on screen, and it is the one being headed toward", () => {
  it("★ dragging LEFT shows Soon and never Later", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [190, 100]]);
    const ind = indicatorOf(row)!;
    expect(ind).toBeTruthy();
    expect(ind.getAttribute("data-direction")).toBe("left");
    expect(ind.getAttribute("data-outcome")).toBe("Soon");
    expect(ind.textContent).toBe("Soon");
    expect(within(row).queryAllByText("Later")).toHaveLength(1); // the card's own button, only
  });

  it("★ dragging RIGHT shows Later and never Soon", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [410, 100]]);
    const ind = indicatorOf(row)!;
    expect(ind.getAttribute("data-direction")).toBe("right");
    expect(ind.getAttribute("data-outcome")).toBe("Later");
    expect(ind.textContent).toBe("Later");
    expect(within(row).queryAllByText("Soon")).toHaveLength(1); // the card's own button, only
  });

  it("reversing direction mid-gesture swaps the outcome rather than showing both", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [200, 100]]);
    expect(indicatorOf(row)!.getAttribute("data-outcome")).toBe("Soon");
    fireEvent.touchMove(surfaceOf(row), touch(400, 100));
    const ind = indicatorOf(row)!;
    expect(ind.getAttribute("data-outcome")).toBe("Later");
    expect(within(row).getAllByTestId("swipe-indicator")).toHaveLength(1);
  });

  it("the outcome only reads as certain once the commit distance is passed", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [270, 100]]); // 30px — moving, but not committing
    expect(indicatorOf(row)!.getAttribute("data-armed")).toBe("false");
    fireEvent.touchMove(surfaceOf(row), touch(190, 100)); // 110px — past 96
    expect(indicatorOf(row)!.getAttribute("data-armed")).toBe("true");
  });

  it("the indicator is decorative: aria-hidden and not clickable", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [190, 100]]);
    const ind = indicatorOf(row)!;
    expect(ind.getAttribute("aria-hidden")).toBe("true");
    expect(ind.className).toContain("pointer-events-none");
    expect(within(ind).queryAllByRole("button", { hidden: true })).toHaveLength(0);
  });
});

describe("3. the surface disappears again the moment the gesture ends", () => {
  it("★ releasing short of the threshold leaves nothing behind", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [270, 100]]);
    fireEvent.touchEnd(surfaceOf(row));
    expect(indicatorOf(row)).toBeNull();
    expect(surfaceOf(row).style.transform).toBe("translateX(0px)");
  });

  it("★ touchcancel mid-drag leaves nothing behind", async () => {
    await renderReady([item("a", CONV_A)]);
    const row = screen.getByTestId("swipe-row");
    press(row, [[300, 100], [190, 100]]);
    expect(indicatorOf(row)).toBeTruthy();
    fireEvent.touchCancel(surfaceOf(row));
    expect(indicatorOf(row)).toBeNull();
    expect(surfaceOf(row).style.transform).toBe("translateX(0px)");
  });

  it("★ a committed decision leaves no indicator on the row that remains", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const first = screen.getAllByTestId("swipe-row")[0];
    press(first, [[300, 100], [190, 100]]);
    fireEvent.touchEnd(surfaceOf(first));
    await waitFor(() => expect(screen.getByTestId("saved-group-soon")).toBeTruthy());
    for (const row of screen.getAllByTestId("swipe-row")) expect(indicatorOf(row)).toBeNull();
  });
});

describe("4. the 390px iPhone viewport the defect was photographed on", () => {
  it("★ a full resting list exposes no action surface at 390px", async () => {
    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    await renderReady([item("a", CONV_A), item("b", CONV_B), item("c", CONV_C)]);
    for (const row of screen.getAllByTestId("swipe-row")) expect(indicatorOf(row)).toBeNull();
  });

  it("★ and both directions still decide correctly at that width", async () => {
    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    await renderReady([item("a", CONV_A), item("b", CONV_B)]);
    const rows = screen.getAllByTestId("swipe-row");
    press(rows[0], [[300, 100], [190, 100]]);
    expect(indicatorOf(rows[0])!.getAttribute("data-outcome")).toBe("Soon");
    fireEvent.touchEnd(surfaceOf(rows[0]));
    await waitFor(() => expect(screen.getByTestId("saved-group-soon")).toBeTruthy());
    const remaining = within(screen.getByTestId("saved-group-new")).getByTestId("swipe-row");
    press(remaining, [[300, 100], [410, 100]]);
    expect(indicatorOf(remaining)!.getAttribute("data-outcome")).toBe("Later");
    fireEvent.touchEnd(surfaceOf(remaining));
    await waitFor(() => expect(screen.getByTestId("saved-group-later")).toBeTruthy());
  });
});
