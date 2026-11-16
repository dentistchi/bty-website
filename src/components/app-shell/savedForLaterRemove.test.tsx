/** @vitest-environment jsdom */
/**
 * Saved for later offers the same Remove action on every message, including
 * records with an older triage choice. A swipe reveals the action. Activating
 * the button removes the message from the saved list.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SavedForLater, { type SavedCapture } from "./SavedForLater";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const META = { provider: "teams", tenant_id: "T1" };
const item = (id: string, over: Partial<SavedCapture> = {}): SavedCapture => ({
  id,
  sourceType: "teams_message",
  previewText: `preview ${id}`,
  sourceUrl: `https://teams.microsoft.com/l/message/${id}`,
  sourceMetadata: { ...META, conversation_id: `19:chat-${id}@unq.gbl.spaces` },
  status: "captured",
  capturedAt: "2026-08-31T10:00:00Z",
  triageChoice: null,
  triagedAt: null,
  ...over,
});
const withLegacyChoice = (id: string, choice: "soon" | "later") =>
  item(id, { triageChoice: choice, triagedAt: "2026-09-01T00:00:00Z" });

function stub(items: SavedCapture[], remove: { ok: boolean } = { ok: true }) {
  const removes: string[] = [];
  const mutations: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method && init.method !== "GET") mutations.push(u);
    if (u.includes("/remove")) {
      removes.push(decodeURIComponent(u.split("/action-capture/")[1].split("/remove")[0]));
      expect(init?.method).toBe("POST");
      expect(init?.credentials).toBe("include");
      expect(init?.body).toBeUndefined();
      return remove.ok
        ? new Response(JSON.stringify({ ok: true, changed: true }), { status: 200 })
        : new Response(JSON.stringify({ ok: false }), { status: 500 });
    }
    if (u.includes("/api/bty/action-capture/mine")) {
      return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${u}`);
  }));
  return { removes, mutations };
}

const rows = () => screen.getAllByTestId("saved-item");
const rowFor = (id: string) => rows().find((row) => within(row).queryByText(`preview ${id}`))!;
const surface = (row: HTMLElement) => within(row).getByTestId("saved-swipe-surface");
const drag = (el: HTMLElement, dx = -120, dy = 0) => {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchMove(el, { touches: [{ clientX: 200 + dx, clientY: 100 + dy }] });
  fireEvent.touchEnd(el, {});
};

describe("Saved list and Remove", () => {
  it("renders legacy choices and untriaged messages in one list with no triage controls", async () => {
    stub([item("a"), withLegacyChoice("b", "soon"), withLegacyChoice("c", "later")]);
    render(<SavedForLater locale="en" />);
    const list = await screen.findByTestId("saved-list");

    expect(screen.getAllByTestId("saved-list")).toHaveLength(1);
    expect(within(list).getAllByTestId("saved-item")).toHaveLength(3);
    expect(within(list).getAllByTestId("saved-remove")).toHaveLength(3);
    expect(within(list).queryByTestId(/^saved-group-(new|soon|later)$/)).toBeNull();
    expect(within(list).queryByTestId(/^saved-triage-/)).toBeNull();
    expect(within(list).queryByText(/^(New|Soon|Later)$/i)).toBeNull();
  });

  it.each([
    ["untriaged", item("a")],
    ["legacy Soon", withLegacyChoice("a", "soon")],
    ["legacy Later", withLegacyChoice("a", "later")],
  ])("%s: releasing a swipe reveals Remove without making a request", async (_label, capture) => {
    const { removes, mutations } = stub([capture]);
    render(<SavedForLater locale="en" />);
    await screen.findByText("preview a");
    const row = rowFor("a");

    drag(surface(row));
    const action = within(row).getByTestId("saved-swipe-action");
    expect(action.textContent).toBe("Remove");
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual(["/api/bty/action-capture/mine"]);
    expect(mutations).toEqual([]);
    expect(row.isConnected).toBe(true);

    fireEvent.click(action);
    await waitFor(() => expect(removes).toEqual(["a"]));
    expect(mutations).toEqual(["/api/bty/action-capture/a/remove"]);
    expect(screen.queryByText("preview a")).toBeNull();
  });

  it("uses the same Korean Remove label as Today", async () => {
    stub([item("a")]);
    render(<SavedForLater locale="ko" />);
    const row = await waitFor(() => rowFor("a"));
    drag(surface(row));
    expect(within(row).getByTestId("saved-swipe-action").textContent).toBe("치우기");
  });
});

describe("Remove input and focus", () => {
  it.each([
    ["short left drag", -20, 0],
    ["right swipe", 160, 0],
    ["vertical scroll", -5, 120],
  ])("keeps the tray closed after a %s", async (_name, dx, dy) => {
    const { mutations } = stub([item("a")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    drag(surface(row), dx, dy);
    expect(within(row).queryByTestId("saved-swipe-action")).toBeNull();
    expect(mutations).toEqual([]);
  });

  it("keeps one row open at a time", async () => {
    const { mutations } = stub([item("a"), withLegacyChoice("b", "later")]);
    render(<SavedForLater locale="en" />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    drag(surface(rowFor("a")));
    expect(within(rowFor("a")).queryByTestId("saved-swipe-action")).toBeTruthy();
    drag(surface(rowFor("b")));
    expect(within(rowFor("b")).queryByTestId("saved-swipe-action")).toBeTruthy();
    expect(within(rowFor("a")).queryByTestId("saved-swipe-action")).toBeNull();
    expect(mutations).toEqual([]);
  });

  it("supports tabbing to Remove and activating it with the keyboard", async () => {
    const user = userEvent.setup();
    const { removes, mutations } = stub([item("a")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    const btn = within(row).getByTestId("saved-remove");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toContain("sr-only");
    expect(btn.className).toContain("focus:not-sr-only");
    await user.tab();
    expect(document.activeElement).toBe(within(row).getByRole("button", { name: "Open in Teams" }));
    await user.tab();
    expect(document.activeElement).toBe(btn);
    expect(mutations).toEqual([]);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(removes).toEqual(["a"]));
  });

  it("keeps the Remove tray hidden at rest", async () => {
    stub([item("a")]);
    render(<SavedForLater locale="en" />);
    await waitFor(() => rowFor("a"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getAllByText("Remove")).toHaveLength(1);
    expect(screen.getByTestId("saved-remove").className).toContain("sr-only");
  });
});

describe("Remove result", () => {
  it("replaces the list with the empty state after removing the last message", async () => {
    const { removes } = stub([item("a")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    drag(surface(row));
    fireEvent.click(within(row).getByTestId("saved-swipe-action"));
    await waitFor(() => expect(removes).toEqual(["a"]));
    expect(screen.queryByTestId("saved-list")).toBeNull();
    expect(screen.getByText("Nothing saved for later.")).toBeTruthy();
  });

  it("restores the message and shows the Remove error after a failed request", async () => {
    const { removes } = stub([item("a")], { ok: false });
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    drag(surface(row));
    fireEvent.click(within(row).getByTestId("saved-swipe-action"));
    await waitFor(() => expect(removes).toEqual(["a"]));
    expect((await screen.findByTestId("saved-remove-error")).textContent).toBe("Couldn't remove that.");
    expect(screen.getByText("preview a")).toBeTruthy();
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
      return new Response(JSON.stringify({ ok: true, items: [item("a"), withLegacyChoice("b", "later")] }), { status: 200 });
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

describe("Remove request and source link", () => {
  it("preserves the source permalink for Open in Teams", async () => {
    stub([item("a")]);
    render(<SavedForLater locale="en" />);
    const row = await waitFor(() => rowFor("a"));
    const open = within(row).getByRole("button", { name: "Open in Teams" });
    expect(open.getAttribute("data-source-url")).toBe(item("a").sourceUrl);
  });

  it("sends only the item ID in an authenticated POST to Remove", async () => {
    const { removes } = stub([withLegacyChoice("a", "soon")]);
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
