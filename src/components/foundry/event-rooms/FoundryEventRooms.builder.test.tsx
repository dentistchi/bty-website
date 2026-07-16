/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import FoundryEventRooms from "./FoundryEventRooms";

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

type Summary = { id: string; status: string; current_step: number; module_version: number; updated_at: string; created_at: string };

function server(initialDrafts: Summary[]) {
  let drafts = [...initialDrafts];
  const calls: Array<{ url: string; method: string }> = [];
  const fn = vi.fn(async (url: string, opts?: { method?: string }) => {
    const method = opts?.method ?? "GET";
    calls.push({ url, method });
    if (url.includes("/api/bty/foundry/events")) return jsonRes({ events: [] });
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

const postCount = (calls: Array<{ url: string; method: string }>) =>
  calls.filter((c) => c.url.endsWith("/api/bty/foundry/modules") && c.method === "POST").length;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("FoundryEventRooms — Guided Module Builder entry", () => {
  it("shows Start new training for an active host", async () => {
    server([]);
    render(<FoundryEventRooms locale="en" />);
    expect(await screen.findByText("Start new training")).toBeTruthy();
  });

  it("starting a new draft creates EXACTLY one row even on a double-tap", async () => {
    const s = server([]);
    render(<FoundryEventRooms locale="en" />);
    const btn = await screen.findByText("Start new training");
    fireEvent.click(btn);
    fireEvent.click(btn); // repeated tap — must not create a second draft
    await waitFor(() => expect(postCount(s.calls)).toBe(1));
    // and we entered the builder (step 1 question)
    expect(await screen.findByText("What keeps going wrong?")).toBeTruthy();
  });

  it("shows the most recent draft as a Continue action", async () => {
    server([{ id: "d-1", status: "draft", current_step: 3, module_version: 1, updated_at: "2026-07-16T00:00:00Z", created_at: "t" }]);
    render(<FoundryEventRooms locale="en" />);
    expect(await screen.findByText("Continue draft")).toBeTruthy();
  });

  it("deleting a draft removes it and calls DELETE for that id", async () => {
    const s = server([{ id: "d-1", status: "draft", current_step: 2, module_version: 1, updated_at: "2026-07-16T00:00:00Z", created_at: "t" }]);
    render(<FoundryEventRooms locale="en" />);
    await screen.findByText("Continue draft");
    fireEvent.click(screen.getByLabelText("Delete draft"));
    await waitFor(() =>
      expect(s.calls.some((c) => c.url.includes("/api/bty/foundry/modules/d-1") && c.method === "DELETE")).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText("Continue draft")).toBeNull());
  });

  it("keeps the existing direct event-create CTA (regression)", async () => {
    server([]);
    render(<FoundryEventRooms locale="en" />);
    expect(await screen.findByText("Create an event")).toBeTruthy();
  });
});
