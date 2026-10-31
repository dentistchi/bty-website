/** @vitest-environment jsdom */
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/lib/supabase", () => ({ supabase: null }));
import TrackingSent from "@/components/app-shell/TrackingSent";
import SavedForLater, { type SavedCapture } from "@/components/app-shell/SavedForLater";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const person = { recipientId: "recipient-1", display: "Synthetic colleague", questionText: null,
  respondedAt: "2026-10-01T00:00:00Z", handledAt: null, unreadCount: 0, messageCount: 0, needsAttention: false };
const run = { id: "announcement-1", hostFraming: "Synthetic QA announcement", previewText: null, sourceUrl: null,
  createdAt: "2026-10-01T00:00:00Z", status: "active",
  funnel: { announcedTo: 1, gotIt: 1, question: 0, needHelp: 0, noResponse: 0, notYetActivated: 0 },
  responders: { acknowledged: [person], question: [], needHelp: [], noResponse: [] } };
const saved: SavedCapture = { id: "capture-1", sourceType: "teams_message", previewText: "Synthetic saved message", sourceUrl: null,
  sourceMetadata: {}, status: "captured", capturedAt: "2026-10-01T00:00:00Z", triageChoice: "soon", triagedAt: "2026-10-01T00:01:00Z" };

describe("superseded Saved and Tracking reads", () => {
  it.each(["success", "HTTP failure", "malformed body", "body success"] as const)("a late Tracking %s cannot replace the confirmed removal", async late => {
    let resolveOld!: (response: Response) => void;
    let reads = 0, removed = false;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "POST") { removed = true; return json({ ok: true }); }
      if (++reads === 2) {
        if (late === "body success") return { ok: true, status: 200, json: () => new Promise(resolve => { resolveOld = response => { void response.json().then(resolve); }; }) } as Response;
        return new Promise<Response>(resolve => { resolveOld = resolve; });
      }
      return json({ ok: true, items: removed ? [] : [run] });
    });
    vi.stubGlobal("fetch", fetcher);
    const view = render(<TrackingSent locale="en" refreshKey={0} />);
    await screen.findByTestId("tracking-item");
    view.rerender(<TrackingSent locale="en" refreshKey={1} />);
    await waitFor(() => expect(reads).toBe(2));
    fireEvent.click(screen.getByTestId("tracking-remove"));
    await waitFor(() => expect(reads).toBe(3));
    await waitFor(() => expect(screen.queryByTestId("tracking-item")).toBeNull());
    await act(async () => { resolveOld((late === "success" || late === "body success") ? json({ ok: true, items: [run] }) : late === "HTTP failure" ? json({ ok: false }, 500) : json({ ok: true, items: "invalid" })); });
    expect(removed).toBe(true);
    expect(screen.queryByTestId("tracking-item")).toBeNull();
    expect(screen.queryByTestId("tracking-sent-error")).toBeNull();
  });

  it.each(["triage", "remove"] as const)("an earlier Saved mount read cannot undo a confirmed %s", async operation => {
    let resolveOld!: (response: Response) => void;
    let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "POST") return json(operation === "remove" ? { ok: true } : { ok: true, capture: { ...saved, triageChoice: "later" } });
      if (++reads === 1) return new Promise<Response>(resolve => { resolveOld = resolve; });
      return json({ ok: true, items: [{ ...saved, triageChoice: operation === "triage" ? null : "soon" }] });
    }));
    render(<StrictMode><SavedForLater locale="en" /></StrictMode>);
    await screen.findByTestId("saved-item");
    fireEvent.click(screen.getByTestId(operation === "remove" ? "saved-remove" : "saved-triage-later"));
    if (operation === "remove") await screen.findByTestId("saved-empty");
    else await waitFor(() => expect(screen.getByTestId("saved-item").getAttribute("data-triage")).toBe("later"));
    await act(async () => { resolveOld(json({ ok: true, items: [{ ...saved, triageChoice: operation === "triage" ? null : "soon" }] })); });
    expect(reads).toBe(2);
    if (operation === "remove") expect(screen.queryByTestId("saved-item")).toBeNull();
    else expect(screen.getByTestId("saved-item").getAttribute("data-triage")).toBe("later");
  });
});
