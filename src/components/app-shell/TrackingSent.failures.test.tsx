/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/lib/supabase", () => ({ supabase: null }));
import TrackingSent from "@/components/app-shell/TrackingSent";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const person = { recipientId: "recipient-1", display: "Synthetic colleague", questionText: "Can you clarify?",
  respondedAt: "2026-10-01T00:00:00Z", handledAt: null, unreadCount: 0, messageCount: 0, needsAttention: true };
const run = (operation: "remove" | "handle") => ({
  id: "announcement-1", hostFraming: "Synthetic QA announcement", previewText: null, sourceUrl: null,
  createdAt: "2026-10-01T00:00:00Z", status: "active",
  funnel: { announcedTo: 1, gotIt: operation === "remove" ? 1 : 0, question: operation === "handle" ? 1 : 0,
    needHelp: 0, noResponse: 0, notYetActivated: 0 },
  responders: { acknowledged: operation === "remove" ? [{ ...person, questionText: null, needsAttention: false }] : [],
    question: operation === "handle" ? [person] : [], needHelp: [], noResponse: [] },
});

describe("Track mutations preserve the item and explain failure", () => {
  it.each(["remove", "handle"] as const)("%s: a non-2xx response is visible and never shown as success", async operation => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") { posts.push(url); return new Response('{"ok":false}', { status: 500 }); }
      return new Response(JSON.stringify({ ok: true, items: [run(operation)] }));
    }));
    render(<TrackingSent locale="en" />);
    await screen.findByTestId("tracking-item");
    if (operation === "handle") {
      fireEvent.click(screen.getByTestId("tracking-toggle"));
      fireEvent.click(await screen.findByRole("button", { name: "Mark handled" }));
    } else fireEvent.click(screen.getByTestId("tracking-remove"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("tracking-item")).toBeTruthy();
    expect(screen.queryByText("Handled")).toBeNull();
  });
  it.each(["remove", "handle"] as const)("%s: a connection failure is visible and preserves the item", async operation => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") { posts.push(url); throw new TypeError("Synthetic offline"); }
      return new Response(JSON.stringify({ ok: true, items: [run(operation)] }));
    }));
    render(<TrackingSent locale="en" />);
    await screen.findByTestId("tracking-item");
    if (operation === "handle") {
      fireEvent.click(screen.getByTestId("tracking-toggle"));
      fireEvent.click(await screen.findByRole("button", { name: "Mark handled" }));
    } else fireEvent.click(screen.getByTestId("tracking-remove"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("tracking-item")).toBeTruthy();
  });
});
