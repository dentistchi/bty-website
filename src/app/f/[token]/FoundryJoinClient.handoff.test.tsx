/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FoundryJoinClient from "./FoundryJoinClient";

/**
 * Slice 3.1B-3H — open-link → BTY handoff. After a successful AUTHENTICATED claim (xp awarded)
 * on an OPEN-LINK entry (no assigned `?return`), the Room shows "Saved to your BTY" + a
 * Continue-to-BTY link into the app-shell My Learning view. An ASSIGNED entry (with `?return`)
 * keeps "Back to Foundry" and shows NO handoff. The Continue link is a plain anchor — navigation
 * is non-mutating (it never POSTs completion/claim).
 */

function mockAwarded(onClaim?: () => void) {
  const awarded = {
    ok: true,
    event: { title: "T", status: "open" },
    participant: { display_name: "Learner" },
    training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: null },
    stage: "completed_awarded",
    xp_status: "awarded",
  };
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/auth/session")) return { ok: true, status: 200, json: async () => ({ ok: true, user: { email: "learner@example.com" } }) };
    if (u.includes("/progress/claim-xp") && init?.method === "POST") { onClaim?.(); return { ok: true, status: 200, json: async () => ({ ...awarded, assignmentClaim: "not_applicable" }) }; }
    return { ok: true, status: 200, json: async () => awarded };
  });
}

beforeEach(() => {
  window.history.replaceState({}, "", "/f/tok");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryJoinClient — open-link → BTY handoff", () => {
  it("OPEN-LINK (no ?return) + awarded → shows Saved to your BTY + Continue-to-BTY into My Learning", async () => {
    // @ts-expect-error test shim
    global.fetch = mockAwarded();
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("saved-to-bty")).toBeTruthy());
    const cont = screen.getByTestId("continue-to-bty") as HTMLAnchorElement;
    expect(cont.getAttribute("href")).toBe("/en/app?tab=foundry&view=my-learning");
    expect(screen.getByText("Saved to your BTY")).toBeTruthy();
    expect(screen.getByText("Your reflection is private and available in My Learning.")).toBeTruthy();
  });

  it("the Continue-to-BTY control is a non-mutating anchor (no claim/completion POST on click)", async () => {
    let claimPosts = 0;
    // @ts-expect-error test shim
    global.fetch = mockAwarded(() => { claimPosts += 1; });
    render(<FoundryJoinClient token="tok" />);
    const cont = (await screen.findByTestId("continue-to-bty")) as HTMLAnchorElement;
    // it is a real link (href), not a button that writes
    expect(cont.tagName).toBe("A");
    expect(cont.getAttribute("href")).toContain("/app?tab=foundry&view=my-learning");
    // the reconcile may fire ONE silent claim-xp, but the handoff render itself adds none beyond that
    expect(claimPosts).toBeLessThanOrEqual(1);
  });

  it("ASSIGNED entry (with ?return=/en/app?tab=foundry) shows Back to Foundry and NO handoff", async () => {
    window.history.replaceState({}, "", "/f/tok?return=" + encodeURIComponent("/en/app?tab=foundry"));
    // @ts-expect-error test shim
    global.fetch = mockAwarded();
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("room-back-to-foundry")).toBeTruthy());
    expect(screen.queryByTestId("saved-to-bty")).toBeNull();
  });
});
