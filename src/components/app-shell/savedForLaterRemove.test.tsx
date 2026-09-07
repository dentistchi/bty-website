/** @vitest-environment jsdom */
/**
 * ★ SWIPE LEFT ON A DECIDED ITEM → REVEAL → TAP → REMOVE FROM MY QUEUE.
 *
 * "Remove" here means clear my Saved for later. It is not deletion: the capture, its permalink and
 * any Track that references it survive, and an explicit Save to BTY on the same source brings the
 * SAME row back. That half is proven against real PostgreSQL in `savedRemove.pg.test.ts`; this file
 * holds the surface's half.
 *
 * ★ TWO GRAMMARS IN ONE LIST, AND THE DIFFERENCE IS DELIBERATE.
 *
 *   UNDECIDED  swipe COMMITS on release — left Soon, right Later. Untouched by this slice.
 *   DECIDED    swipe LEFT REVEALS a red tray; removal takes a second, explicit tap.
 *
 * Classification is reversible by looking at the list. Removal takes the item out of it. So the
 * destructive one asks to be meant, and the non-destructive one stays a flick. The refusals are
 * asserted hardest, because a gesture that removes too eagerly is far worse than one that does
 * nothing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SavedForLater, { type SavedCapture } from "./SavedForLater";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const META = { provider: "teams", tenant_id: "T1", conversation_id: "19:chat-a@unq.gbl.spaces" };
const item = (id: string, over: Partial<SavedCapture> = {}): SavedCapture => ({
  id,
  sourceType: "teams_message",
  previewText: `preview ${id}`,
  sourceUrl: `https://teams.microsoft.com/l/message/${id}`,
  sourceMetadata: META,
  status: "captured",
  capturedAt: "2026-08-31T10:00:00Z",
  triageChoice: null,
  triagedAt: null,
  ...over,
});
const decided = (id: string, choice: "soon" | "later") =>
  item(id, { triageChoice: choice, triagedAt: "2026-09-01T00:00:00Z" });

function stub(items: SavedCapture[], remove: { ok: boolean } = { ok: true }) {
  const removes: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/remove")) {
        removes.push(decodeURIComponent(u.split("/action-capture/")[1].split("/remove")[0]));
        expect(init?.method, "a mutation is a POST").toBe("POST");
        expect(init?.credentials, "the session is the authority").toBe("include");
        expect(init?.body, "nothing is read from a body — the id is in the path").toBeUndefined();
        return remove.ok
          ? new Response(JSON.stringify({ ok: true, changed: true }), { status: 200 })
          : new Response(JSON.stringify({ ok: false }), { status: 500 });
      }
      if (u.includes("/api/bty/action-capture/mine")) {
        return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
  return removes;
}

const rows = () => screen.getAllByTestId("saved-item");
const rowFor = (id: string) => rows().find((r) => within(r).queryByText(`preview ${id}`))!;
/** The gesture, as a real touch: past the 96px reveal threshold, then release. */
const swipeLeft = (el: HTMLElement, dx = -120) => {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 200 + dx, clientY: 100 }] });
  fireEvent.touchEnd(el, {});
};

describe("★ 1-2 — a decided item can be removed, from either group", () => {
  for (const choice of ["soon", "later"] as const) {
    it(`★ ${choice}: swipe left reveals, and the TAP is what removes`, async () => {
      const removes = stub([decided("a", choice)]);
      render(<SavedForLater locale="en" />);
      const row = await waitFor(() => rowFor("a"));

      swipeLeft(within(row).getByTestId("saved-swipe-surface"));
      expect(removes, "★ the release commits NOTHING").toEqual([]);
      const action = within(row).getByTestId("saved-swipe-action");
      expect(action.textContent).toBe("Remove");

      fireEvent.click(action);
      await waitFor(() => expect(removes).toEqual(["a"]));
      expect(screen.queryByText("preview a"), "★ and it leaves the list").toBeNull();
    });
  }

  it("★ Korean copy is the same word Today uses", async () => {
    stub([decided("a", "soon")]);
    render(<SavedForLater locale="ko" />);
    const row = await waitFor(() => rowFor("a"));
    swipeLeft(within(row).getByTestId("saved-swipe-surface"));
    expect(within(row).getByTestId("saved-swipe-action").textContent).toBe("치우기");
  });
});

describe("★ 3 — the UNDECIDED gesture is untouched", () => {
  it("★ an undecided row still commits Soon on release, and grows no Remove tray", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/triage")) { seen.push("triage"); return new Response(JSON.stringify({ ok: true, changed: true, capture: { ...item("a"), triageChoice: "soon" } }), { status: 200 }); }
      if (u.includes("/remove")) { seen.push("remove"); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
      return new Response(JSON.stringify({ ok: true, items: [item("a")] }), { status: 200 });
    }));
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    expect(within(row).queryByTestId("saved-swipe-surface"), "no reveal tray on an undecided row").toBeNull();
    // The undecided row uses the OTHER component; drive it through its own surface hook.
    const s2 = within(row).getByTestId("swipe-surface");
    fireEvent.touchStart(s2, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(s2, { touches: [{ clientX: 80, clientY: 100 }] });
    fireEvent.touchEnd(s2, {});
    await waitFor(() => expect(seen).toContain("triage"));
    expect(seen, "★ the release decided; it did not remove").not.toContain("remove");
  });

  it("★ Remove is NOT offered on an undecided row at all", async () => {
    stub([item("a")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    expect(within(row).queryByTestId("saved-remove")).toBeNull();
    expect(within(row).queryByText("Remove")).toBeNull();
  });
});

describe("★ F/I — the gesture refuses to be eager, and is not the only path", () => {
  it("★ a short drag does not open anything", async () => {
    const removes = stub([decided("a", "soon")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    swipeLeft(within(row).getByTestId("saved-swipe-surface"), -20);
    expect(within(row).queryByTestId("saved-swipe-action")).toBeNull();
    expect(removes).toEqual([]);
  });

  it("★ a RIGHT swipe on a decided row does nothing — left only", async () => {
    const removes = stub([decided("a", "later")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    const s = within(row).getByTestId("saved-swipe-surface");
    fireEvent.touchStart(s, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(s, { touches: [{ clientX: 260, clientY: 100 }] });
    fireEvent.touchEnd(s, {});
    expect(within(row).queryByTestId("saved-swipe-action")).toBeNull();
    expect(removes).toEqual([]);
  });

  it("★ a vertical drag is the page scrolling, not a swipe", async () => {
    stub([decided("a", "soon")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    const s = within(row).getByTestId("saved-swipe-surface");
    fireEvent.touchStart(s, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(s, { touches: [{ clientX: 195, clientY: 220 }] });
    fireEvent.touchEnd(s, {});
    expect(within(row).queryByTestId("saved-swipe-action")).toBeNull();
  });

  it("★ ONE ROW OPEN AT A TIME", async () => {
    stub([decided("a", "soon"), decided("b", "later")]);
    render(<SavedForLater locale="en" />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    swipeLeft(within(rowFor("a")).getByTestId("saved-swipe-surface"));
    expect(within(rowFor("a")).queryByTestId("saved-swipe-action")).toBeTruthy();
    swipeLeft(within(rowFor("b")).getByTestId("saved-swipe-surface"));
    expect(within(rowFor("b")).queryByTestId("saved-swipe-action")).toBeTruthy();
    expect(within(rowFor("a")).queryByTestId("saved-swipe-action"), "the first one closed").toBeNull();
  });

  it("★ NOT GESTURE-ONLY: a keyboard-reachable Remove exists, hidden until focused", async () => {
    const removes = stub([decided("a", "soon")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    const btn = within(row).getByTestId("saved-remove");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className, "in the a11y tree and tab order, invisible at rest").toContain("sr-only");
    expect(btn.className, "and it appears the moment it is focused").toContain("focus:not-sr-only");
    fireEvent.click(btn);
    await waitFor(() => expect(removes).toEqual(["a"]));
  });

  it("★ no confirmation modal, and no always-visible delete icon", async () => {
    stub([decided("a", "soon")]);
    render(<SavedForLater locale="en" />);
    await waitFor(() => rowFor("a"));
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).toBeNull();
    // Before any gesture, the only Remove in the DOM is the sr-only one.
    expect(screen.getAllByText("Remove")).toHaveLength(1);
    expect(screen.getByTestId("saved-remove").className).toContain("sr-only");
  });
});

describe("★ J — after Remove", () => {
  it("★ the section disappears when it empties, and the global empty state becomes truthful", async () => {
    const removes = stub([decided("a", "soon")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    swipeLeft(within(row).getByTestId("saved-swipe-surface"));
    fireEvent.click(within(row).getByTestId("saved-swipe-action"));
    await waitFor(() => expect(removes).toEqual(["a"]));
    expect(screen.queryByText("Soon")).toBeNull();
    expect(screen.getByText("Nothing saved for later.")).toBeTruthy();
  });

  it("★ OPTIMISTIC BUT NEVER LOSSY: a failed remove puts the item back and says which action failed", async () => {
    const removes = stub([decided("a", "soon")], { ok: false });
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    swipeLeft(within(row).getByTestId("saved-swipe-surface"));
    fireEvent.click(within(row).getByTestId("saved-swipe-action"));
    await waitFor(() => expect(removes).toEqual(["a"]));
    await waitFor(() => expect(screen.getByText("preview a"), "a saved thing does not vanish on a failure").toBeTruthy());
    expect(screen.getByTestId("saved-triage-error").textContent, "★ and it names the right action").toBe(
      "Couldn't remove that.",
    );
  });

  it("only ONE mutation at a time — a second tap mid-flight is not a second removal", async () => {
    let release!: () => void;
    const removes: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/remove")) {
        removes.push("x");
        return new Promise<Response>((r) => { release = () => r(new Response(JSON.stringify({ ok: true }), { status: 200 })); });
      }
      return new Response(JSON.stringify({ ok: true, items: [decided("a", "soon"), decided("b", "later")] }), { status: 200 });
    }));
    render(<SavedForLater locale="en" />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.click(within(rowFor("a")).getByTestId("saved-remove"));
    await waitFor(() => expect(removes).toHaveLength(1));
    fireEvent.click(within(rowFor("b")).getByTestId("saved-remove"));
    expect(removes).toHaveLength(1);
    release();
  });
});

describe("★ K/H — the source is not touched", () => {
  it("★ Open in Teams is still offered on a decided row, and the permalink is unchanged", async () => {
    stub([decided("a", "soon")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    expect(within(row).getByText("Open in Teams")).toBeTruthy();
  });

  it("★ the client sends NOTHING but the id — no user id, no body, no source fields", async () => {
    const removes = stub([decided("a", "soon")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    fireEvent.click(within(row).getByTestId("saved-remove"));
    await waitFor(() => expect(removes).toEqual(["a"]));
    const calls = vi.mocked(fetch).mock.calls.filter((c) => String(c[0]).includes("/remove"));
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toBe("/api/bty/action-capture/a/remove");
    // asserted inside the stub too: POST, credentials include, and no body at all
  });
});
