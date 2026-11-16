/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SavedForLater, { type SavedCapture } from "./SavedForLater";

/**
 * Saved for later — conversation grouping (Slice T2.1).
 *
 * The fixtures mirror the SEVEN captures measured on production: one 1:1 conversation holding
 * three messages, a private-channel post from the SAME sender, and single messages elsewhere. The
 * sender-collision case is the one that matters most — it is the mistake that looks correct.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const CONV_A = { tenant_id: "T1", conversation_id: "19:chat-a@unq.gbl.spaces", sender_display: "Dr. Su-Young Choi (sc)" };
/** Same sender as CONV_A, different conversation — the live private-channel post. */
const CHANNEL = { tenant_id: "T1", conversation_id: "19:chan-z@thread.tacv2", sender_display: "Dr. Su-Young Choi (sc)" };
const CONV_B = { tenant_id: "T1", conversation_id: "19:chat-b@unq.gbl.spaces", sender_display: "Art Ando (SAA)" };

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

function stub(items: SavedCapture[], remove: { ok: boolean } = { ok: true }) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/bty/action-capture/mine")) return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
      if (init?.method === "POST") {
        calls.push(u);
        return new Response(
          JSON.stringify({ ok: remove.ok }),
          { status: remove.ok ? 200 : 500 },
        );
      }
      throw new Error(`Unexpected Saved request: ${u}`);
    }),
  );
  return calls;
}

async function renderReady(items: SavedCapture[], remove?: { ok: boolean }) {
  const calls = stub(items, remove);
  render(<SavedForLater locale="en" />);
  await screen.findByTestId("saved-list");
  return calls;
}

const messages = () => within(screen.getByTestId("saved-conversation-messages"));

describe("9+10+11. one message passes through; two or more collapse", () => {
  it("9. a conversation with ONE saved message renders the plain card, with no group chrome", async () => {
    await renderReady([item("solo", CONV_A)]);
    expect(screen.getByTestId("saved-item")).toBeTruthy();
    expect(screen.queryByTestId("saved-conversation")).toBeNull();
    expect(screen.queryByTestId("saved-conversation-count")).toBeNull();
  });

  it("10+11. two messages from one conversation collapse into a group that says how many", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    const conv = screen.getByTestId("saved-conversation");
    expect(conv.getAttribute("data-count")).toBe("2");
    expect(screen.getByTestId("saved-conversation-count").textContent).toBe("2 saved messages");
    // Collapsed: the individual cards are not rendered at all.
    expect(screen.queryByTestId("saved-item")).toBeNull();
  });

  it("12. a three-message group previews the LATEST message and names its sender", async () => {
    await renderReady([
      item("newest", CONV_A, { capturedAt: "2026-08-31T14:47:00Z" }),
      item("middle", CONV_A, { capturedAt: "2026-08-31T14:43:00Z" }),
      item("oldest", CONV_A, { capturedAt: "2026-08-31T14:27:00Z" }),
    ]);
    const header = screen.getByTestId("saved-conversation-header");
    expect(header.textContent).toContain("preview newest");
    expect(header.textContent).toContain("Teams · Dr. Su-Young Choi (sc)");
    expect(screen.getByTestId("saved-conversation-count").textContent).toBe("3 saved messages");
  });

  it("a collapsed group has no bulk removal control", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    expect(screen.queryByTestId("saved-remove")).toBeNull();
  });
});

describe("14+15+16. expanding reaches the individual messages", () => {
  it("reveals every message, each with its own controls and its own source link", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A), item("c", CONV_A)]);
    fireEvent.click(screen.getByTestId("saved-conversation-header"));

    const rows = messages().getAllByTestId("saved-item");
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(within(row).getByTestId("saved-remove")).toBeTruthy();
    }
    // 16. message-specific links, never one ambiguous group link.
    // The open control is a button now (see SavedForLater.test.tsx), so the destination is read
    // from `data-source-url` instead of `href`. The assertion is unchanged in substance: three
    // message-specific destinations, never one ambiguous group link.
    const hrefs = messages()
      .getAllByTestId("saved-open")
      .map((a) => a.getAttribute("data-source-url"));
    expect(new Set(hrefs).size).toBe(3);
    expect(hrefs).toContain("https://teams.microsoft.com/l/message/a");
  });

  it("collapses again, and expansion is not persisted anywhere", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    const header = screen.getByTestId("saved-conversation-header");
    expect(header.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(header);
    expect(screen.queryByTestId("saved-conversation-messages")).toBeNull();
  });
});

describe("17+18. what must never be merged", () => {
  it("18. the private-channel post from the SAME sender stays out of the 1:1 group", async () => {
    // The live shape. Grouping by sender would merge these; grouping by conversation does not.
    await renderReady([item("a", CONV_A), item("b", CONV_A), item("channel", CHANNEL)]);

    const convs = screen.getAllByTestId("saved-conversation");
    expect(convs).toHaveLength(1); // only the 1:1 pair grouped
    expect(convs[0].getAttribute("data-count")).toBe("2");
    // The channel post is its own plain card, still visible and still individually actionable.
    const solo = within(screen.getByTestId("saved-list")).getAllByTestId("saved-item");
    expect(solo).toHaveLength(1);
    expect(within(solo[0]).getByTestId("saved-open").getAttribute("data-source-url")).toContain("/channel");
  });

  it("two different conversations stay in separate groups", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A), item("c", CONV_B), item("d", CONV_B)]);
    const convs = screen.getAllByTestId("saved-conversation");
    expect(convs).toHaveLength(2);
    expect(convs.map((c) => c.getAttribute("data-count"))).toEqual(["2", "2"]);
  });
});

describe("removing individual messages from the combined group", () => {
  const mixed = [
    item("a", CONV_A),
    item("b", CONV_A, { triageChoice: "soon", triagedAt: "2026-09-01T00:00:00Z" }),
    item("c", CONV_A, { triageChoice: "later", triagedAt: "2026-09-01T00:00:00Z" }),
  ];

  it("keeps all legacy choices in one group and removes only the chosen message", async () => {
    const calls = await renderReady(mixed);
    expect(screen.getByTestId("saved-conversation").getAttribute("data-count")).toBe("3");
    fireEvent.click(screen.getByTestId("saved-conversation-header"));
    expect(messages().getAllByTestId("saved-item")).toHaveLength(3);
    expect(screen.queryByTestId("saved-triage-controls")).toBeNull();
    for (const key of ["new", "soon", "later"]) {
      expect(screen.queryByTestId(`saved-group-${key}`)).toBeNull();
    }

    const target = messages().getAllByTestId("saved-item").find((row) => within(row).queryByText("preview b"))!;
    fireEvent.click(within(target).getByTestId("saved-remove"));
    await waitFor(() => expect(calls).toEqual(["/api/bty/action-capture/b/remove"]));
    expect(screen.getByTestId("saved-conversation").getAttribute("data-count")).toBe("2");
    expect(messages().getByText("preview a")).toBeTruthy();
    expect(messages().queryByText("preview b")).toBeNull();
    expect(messages().getByText("preview c")).toBeTruthy();
  });

  it("restores the group if the removal fails", async () => {
    const calls = await renderReady(mixed, { ok: false });
    fireEvent.click(screen.getByTestId("saved-conversation-header"));
    const target = messages().getAllByTestId("saved-item").find((row) => within(row).queryByText("preview a"))!;
    fireEvent.click(within(target).getByTestId("saved-remove"));

    await screen.findByTestId("saved-remove-error");
    expect(calls).toEqual(["/api/bty/action-capture/a/remove"]);
    expect(screen.getByTestId("saved-conversation").getAttribute("data-count")).toBe("3");
    expect(messages().getAllByTestId("saved-item")).toHaveLength(3);
  });
});

describe("25. still not a task manager, and still no leaked ids", () => {
  it("shows no badge, deadline, checkbox or completion control on a group", async () => {
    await renderReady([item("a", CONV_A), item("b", CONV_A)]);
    const view = screen.getByTestId("saved-view");
    expect(view.querySelector('input[type="checkbox"]')).toBeNull();
    for (const forbidden of ["Done", "Complete", "Clear", "Dismiss", "Delete", "Overdue", "Due", "Deadline", "XP", "Undo", "Priority"]) {
      expect(view.textContent ?? "", `must not say "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("never renders a tenant, conversation, channel or chat id", async () => {
    await renderReady([
      item("a", { ...CONV_A, chat_id: "19:chat-a@unq.gbl.spaces" }),
      item("b", { ...CONV_A, channel_id: "19:chan-secret" }),
    ]);
    const html = screen.getByTestId("saved-view").outerHTML;
    for (const secret of ["T1", "19:chat-a", "19:chan-secret", "unq.gbl.spaces", "thread.tacv2"]) {
      expect(html, `must not leak "${secret}"`).not.toContain(secret);
    }
  });
});
