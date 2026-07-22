/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

// PdfReader pulls in react-pdf/pdfjs (needs DOMMatrix, absent in jsdom); stub it.
vi.mock("./PdfReader", () => ({ PdfReader: () => null }));

import FoundryDocumentClient from "./FoundryDocumentClient";

/**
 * Slice 3.1B-3F.1 — the assigned PDF Room must show a visible "Back to Foundry" on every stage,
 * at parity with the YouTube Room (FoundryJoinClient). The control is pure navigation to the
 * sanitized same-origin `?return=/{locale}/app…` — it must NEVER complete the assignment, and it
 * must be ABSENT for an open-link scan (no/unsafe `?return`), exactly like the video player.
 */

function setUrl(search: string) {
  window.history.replaceState({}, "", "/f/tok" + search);
}

/** A mid-flow (read) snapshot: NOT a completed stage, so no auto-claim should fire. */
const readSnapshot = {
  content_type: "document",
  event: { title: "배가 고파", status: "open" },
  participant: { display_name: "Hanbit" },
  document: null,
  stage: "pre_join",
  xp_status: "none",
};

function mockFetch(onPost: (url: string) => void) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") onPost(String(url));
    return { ok: true, status: 200, json: async () => readSnapshot };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setUrl("");
});
beforeEach(() => setUrl(""));

describe("FoundryDocumentClient — Back to Foundry return control (Slice 3.1B-3F.1)", () => {
  it("renders the EN control to the sanitized app-shell target when ?return is present", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(() => {});
    setUrl("?return=" + encodeURIComponent("/en/app?tab=foundry"));
    render(<FoundryDocumentClient token="tok" />);
    const back = await screen.findByTestId("room-back-to-foundry");
    expect(back.getAttribute("href")).toBe("/en/app?tab=foundry");
    expect(back.textContent).toMatch(/Back to Foundry/i);
  });

  it("renders the KO label for a /ko/ return target", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(() => {});
    setUrl("?return=" + encodeURIComponent("/ko/app?tab=foundry"));
    render(<FoundryDocumentClient token="tok" />);
    const back = await screen.findByTestId("room-back-to-foundry");
    expect(back.getAttribute("href")).toBe("/ko/app?tab=foundry");
    expect(back.textContent).toContain("파운드리로 돌아가기");
  });

  it("does NOT render the control for an open-link scan (no ?return)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(() => {});
    setUrl("");
    render(<FoundryDocumentClient token="tok" />);
    await waitFor(() => expect(screen.getByText("배가 고파")).toBeTruthy());
    expect(screen.queryByTestId("room-back-to-foundry")).toBeNull();
  });

  it("rejects an unsafe/external ?return (no control)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(() => {});
    setUrl("?return=" + encodeURIComponent("https://evil.com/steal"));
    render(<FoundryDocumentClient token="tok" />);
    await waitFor(() => expect(screen.getByText("배가 고파")).toBeTruthy());
    expect(screen.queryByTestId("room-back-to-foundry")).toBeNull();
  });

  it("returning does not complete: the control is a plain href and no completion/claim POST fires", async () => {
    let posts: string[] = [];
    // @ts-expect-error test shim
    global.fetch = mockFetch((u) => { posts.push(u); });
    setUrl("?return=" + encodeURIComponent("/en/app?tab=foundry"));
    render(<FoundryDocumentClient token="tok" />);
    const back = await screen.findByTestId("room-back-to-foundry");
    // It is a navigation link, not a completion action.
    expect(back.tagName).toBe("A");
    expect(back.getAttribute("href")).toBe("/en/app?tab=foundry");
    // Rendering / presence of the control must not have triggered completion or XP claim.
    await new Promise((r) => setTimeout(r, 20));
    expect(posts.filter((u) => /\/complete|\/claim-xp/.test(u))).toHaveLength(0);
  });
});
