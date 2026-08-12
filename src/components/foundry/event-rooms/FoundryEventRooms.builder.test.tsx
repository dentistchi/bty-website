/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import FoundryEventRooms from "./FoundryEventRooms";

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

type Summary = {
  id: string;
  status: string;
  current_step: number;
  module_version: number;
  title: string | null;
  updated_at: string;
  created_at: string;
};
type Ev = { id: string; title: string; status: string; joined_count: number; created_at: string; closed_at: string | null };

function server(initialDrafts: Summary[], events: Ev[] = []) {
  let drafts = [...initialDrafts];
  const calls: Array<{ url: string; method: string }> = [];
  const fn = vi.fn(async (url: string, opts?: { method?: string }) => {
    const method = opts?.method ?? "GET";
    calls.push({ url, method });
    // Read-only History archive list (must be checked before the generic events match).
    if (url.includes("/api/bty/foundry/event-history")) return jsonRes({ events: [] });
    if (url.includes("/api/bty/foundry/events")) return jsonRes({ events });
    if (url.endsWith("/api/bty/foundry/modules") && method === "GET") return jsonRes({ drafts });
    if (url.endsWith("/api/bty/foundry/modules") && method === "POST")
      return jsonRes(
        { draft: { id: "new-1", status: "draft", current_step: 1, answers: {}, module_version: 1, parent_module_id: null, document_asset_ref_present: false, created_at: "t", updated_at: "t" } },
        201,
      );
    if (url.includes("/api/bty/foundry/modules/") && method === "DELETE") {
      const id = url.split("/").pop() as string;
      drafts = drafts.filter((d) => d.id !== id);
      return jsonRes({ deleted: true });
    }
    if (url.includes("/api/bty/foundry/modules/") && method === "GET")
      return jsonRes({ draft: { id: "new-1", status: "draft", current_step: 1, answers: {}, module_version: 1, parent_module_id: null, document_asset_ref_present: false, created_at: "t", updated_at: "t" } });
    return jsonRes({});
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { calls, fn };
}

const draft = (over: Partial<Summary>): Summary => ({
  id: "d-1",
  status: "draft",
  current_step: 5,
  module_version: 1,
  title: null,
  updated_at: new Date().toISOString(),
  created_at: "t",
  ...over,
});

const postCount = (calls: Array<{ url: string; method: string }>) =>
  calls.filter((c) => c.url.endsWith("/api/bty/foundry/modules") && c.method === "POST").length;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("FoundryEventRooms — Guided Module Builder entry (2.1)", () => {
  it("shows the host-oriented Create training entry", async () => {
    server([]);
    render(<FoundryEventRooms locale="en" />);
    expect(await screen.findByText("Create training")).toBeTruthy();
    expect(screen.getByText("Turn a real workplace issue into clear training for your team.")).toBeTruthy();
  });

  it("keeps the legacy path but demotes it to a discoverable quick-event path", async () => {
    server([]);
    render(<FoundryEventRooms locale="en" />);
    // primary first, then the quick-event lead + button directly beneath it.
    expect(await screen.findByText("Create training")).toBeTruthy();
    expect(screen.getByText("Need to launch something quickly?")).toBeTruthy();
    expect(screen.getByText("Create quick event")).toBeTruthy();
    expect(screen.getByText("Skip guided setup.")).toBeTruthy();
  });

  it("starting a new draft creates EXACTLY one row even on a double-tap", async () => {
    const s = server([]);
    render(<FoundryEventRooms locale="en" />);
    const btn = await screen.findByText("Create training");
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(postCount(s.calls)).toBe(1));
    expect(await screen.findByText("What keeps going wrong?")).toBeTruthy();
  });

  it("draft card shows a problem-derived title + step progress", async () => {
    server([draft({ title: "Patient plans are ending before completion", current_step: 5 })]);
    render(<FoundryEventRooms locale="en" />);
    expect(await screen.findByText("Patient plans are ending before completion")).toBeTruthy();
    expect(screen.getByText(/Step 5 of 8/)).toBeTruthy();
  });

  it("draft card falls back to Untitled training when there is no problem yet", async () => {
    server([draft({ title: null })]);
    render(<FoundryEventRooms locale="en" />);
    expect(await screen.findByText("Untitled training")).toBeTruthy();
  });

  it("left-swipe reveals a red Delete; only one row stays open", async () => {
    server([draft({ id: "d-1", title: "First" }), draft({ id: "d-2", title: "Second" })]);
    render(<FoundryEventRooms locale="en" />);
    const first = (await screen.findByText("First")).closest("div") as HTMLElement;
    fireEvent.touchStart(first, { touches: [{ clientX: 220 }] });
    fireEvent.touchMove(first, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(first, {});
    expect(await screen.findByLabelText("Delete")).toBeTruthy();

    // open the second row — the first must close (single open row).
    const second = (screen.getByText("Second")).closest("div") as HTMLElement;
    fireEvent.touchStart(second, { touches: [{ clientX: 220 }] });
    fireEvent.touchMove(second, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(second, {});
    await waitFor(() => expect(screen.getAllByLabelText("Delete").length).toBe(1));
  });

  it("the accessible (non-swipe) delete removes the draft via DELETE", async () => {
    const s = server([draft({ id: "d-1", title: "Removable" })]);
    render(<FoundryEventRooms locale="en" />);
    await screen.findByText("Removable");
    fireEvent.click(screen.getByLabelText("Delete draft"));
    await waitFor(() =>
      expect(s.calls.some((c) => c.url.includes("/api/bty/foundry/modules/d-1") && c.method === "DELETE")).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText("Removable")).toBeNull());
  });

  it("past section previews only three, with a door into the read-only History archive", async () => {
    const past: Ev[] = Array.from({ length: 5 }, (_, i) => ({
      id: `e-${i}`,
      title: `Closed event ${i}`,
      status: "closed",
      joined_count: 0,
      created_at: "t",
      closed_at: "t",
    }));
    server([], past);
    render(<FoundryEventRooms locale="en" />);
    await screen.findByText("Create training");
    // only 3 of 5 shown as an inline preview on the home surface
    expect(screen.getByText("Closed event 0")).toBeTruthy();
    expect(screen.getByText("Closed event 2")).toBeTruthy();
    expect(screen.queryByText("Closed event 4")).toBeNull();
    // the "view all" affordance now opens the dedicated read-only History archive
    fireEvent.click(screen.getByText(/View all past events/));
    expect(await screen.findByText("History")).toBeTruthy();
    expect(await screen.findByText("No past training yet")).toBeTruthy();
  });
});
