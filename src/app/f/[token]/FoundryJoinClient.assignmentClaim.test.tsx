/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FoundryJoinClient from "./FoundryJoinClient";

/**
 * Slice 3.1B-3D + fix — the external Foundry claim flow must make the authenticated ACCOUNT
 * observable before claiming (the room can run in an external browser whose Supabase session
 * differs from the app), and the assignment message must come only from the authoritative
 * committed claim result. Wrong-account / open-link never reveal an assignee.
 */

function mockFetch(opts: {
  account?: { email: string | null } | null; // /api/auth/session user
  assignmentClaim?: string; // claim-xp POST result
  captureClaim?: () => void;
}) {
  const claimable = {
    event: { title: "T", status: "open" },
    participant: { display_name: "Hojin Kim" },
    training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: null },
    stage: "completed_claimable",
    xp_status: "claimable",
  };
  const awarded = {
    ok: true,
    ...claimable,
    stage: "completed_awarded",
    xp_status: "awarded",
    assignmentClaim: opts.assignmentClaim,
  };
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/auth/session")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, user: opts.account ?? null }) };
    }
    if (u.includes("/progress/claim-xp") && init?.method === "POST") {
      opts.captureClaim?.();
      return { ok: true, status: 200, json: async () => awarded };
    }
    return { ok: true, status: 200, json: async () => claimable };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryJoinClient — account observability + assignment claim (3.1B-3D)", () => {
  it("shows the CURRENT authenticated account and does NOT auto-claim", async () => {
    const captureClaim = vi.fn();
    // @ts-expect-error test shim
    global.fetch = mockFetch({ account: { email: "hojin@example.com" }, assignmentClaim: "not_applicable", captureClaim });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("claim-account")).toBeTruthy());
    expect(screen.getByTestId("claim-account-email").textContent).toBe("hojin@example.com");
    // account is shown but NOTHING is claimed until the learner chooses
    expect(captureClaim).not.toHaveBeenCalled();
    expect(screen.getByTestId("claim-continue")).toBeTruthy();
    expect(screen.getByTestId("claim-switch-account")).toBeTruthy();
  });

  it("MATCHING account: Continue → shows the connection message from the committed result", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ account: { email: "hanbit@example.com" }, assignmentClaim: "claimed" });
    render(<FoundryJoinClient token="tok" />);
    fireEvent.click(await screen.findByTestId("claim-continue"));
    await waitFor(() => expect(screen.getByTestId("assignment-connected")).toBeTruthy());
    expect(screen.getByTestId("assignment-connected").textContent).toMatch(/assigned learning has been connected/i);
  });

  it("WRONG account on an assigned event: neutral no-match message, NO assignee disclosure", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ account: { email: "someoneelse@example.com" }, assignmentClaim: "no_matching_assignment" });
    render(<FoundryJoinClient token="tok" />);
    fireEvent.click(await screen.findByTestId("claim-continue"));
    const msg = await screen.findByTestId("assignment-no-match");
    expect(msg.textContent).toMatch(/No matching assignment was connected/i);
    // XP still succeeded; no assignee identity anywhere
    expect(screen.getByText("+10 Core XP")).toBeTruthy();
    expect(screen.queryByTestId("assignment-connected")).toBeNull();
  });

  it("OPEN-LINK room (not_applicable): SILENT — no assignment message at all", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ account: { email: "anyone@example.com" }, assignmentClaim: "not_applicable" });
    render(<FoundryJoinClient token="tok" />);
    fireEvent.click(await screen.findByTestId("claim-continue"));
    await waitFor(() => expect(screen.getByText("+10 Core XP")).toBeTruthy());
    expect(screen.queryByTestId("assignment-connected")).toBeNull();
    expect(screen.queryByTestId("assignment-no-match")).toBeNull();
  });

  it("a claim_conflict is treated as neutral no-match (never reveals the other participant)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ account: { email: "hanbit@example.com" }, assignmentClaim: "claim_conflict" });
    render(<FoundryJoinClient token="tok" />);
    fireEvent.click(await screen.findByTestId("claim-continue"));
    await waitFor(() => expect(screen.getByTestId("assignment-no-match")).toBeTruthy());
    expect(screen.queryByTestId("assignment-connected")).toBeNull();
  });

  it("UNAUTHENTICATED: shows a sign-in prompt, not a silent auto-claim", async () => {
    const captureClaim = vi.fn();
    // @ts-expect-error test shim
    global.fetch = mockFetch({ account: null, captureClaim });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("claim-signin")).toBeTruthy());
    expect(captureClaim).not.toHaveBeenCalled();
    expect(screen.queryByTestId("claim-continue")).toBeNull();
  });

  it("account switch control is present so the learner can change accounts (external browser)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch({ account: { email: "wrong@example.com" }, assignmentClaim: "no_matching_assignment" });
    render(<FoundryJoinClient token="tok" />);
    const sw = await screen.findByTestId("claim-switch-account");
    expect(sw.textContent).toMatch(/another account/i);
  });
  it("RECONCILE: arriving already-awarded (XP done earlier) silently re-claims and connects", async () => {
    // The snapshot loads directly as completed_awarded (XP already awarded by a prior/stale
    // claim). The client should fire ONE silent claim-xp to reconcile the assignment.
    const claimable = {
      event: { title: "T", status: "open" },
      participant: { display_name: "Hanbit" },
      training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: null },
      stage: "completed_awarded",
      xp_status: "awarded",
    };
    let claimCalls = 0;
    // @ts-expect-error test shim
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/auth/session")) return { ok: true, status: 200, json: async () => ({ ok: true, user: { email: "hanbit@example.com" } }) };
      if (u.includes("/progress/claim-xp") && init?.method === "POST") {
        claimCalls += 1;
        return { ok: true, status: 200, json: async () => ({ ...claimable, ok: true, assignmentClaim: "claimed" }) };
      }
      return { ok: true, status: 200, json: async () => claimable };
    });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("assignment-connected")).toBeTruthy());
    expect(claimCalls).toBe(1);
  });
});
