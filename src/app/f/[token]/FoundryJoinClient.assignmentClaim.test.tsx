/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FoundryJoinClient from "./FoundryJoinClient";

/**
 * Slice 3.1B-3D — the assignment-connection message is shown ONLY when the learner claimed
 * their OWN assignment ('claimed'/'already_claimed'). A no_matching_assignment (wrong
 * account / open-link) is SILENT: normal completion, no alarm, no disclosure. Exercises the
 * real installed-app claim path (the join client's claim-xp fetch → applyResult).
 */

// The initial GET returns a completed_claimable snapshot; the auto-claim POST then returns
// the awarded snapshot plus the assignmentClaim field under test.
function mockFetch(assignmentClaim: string | undefined) {
  const claimable = {
    event: { title: "T", status: "open" },
    participant: { display_name: "Hanbit Chi" },
    training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: null },
    stage: "completed_claimable",
    xp_status: "claimable",
  };
  const awarded = {
    ok: true,
    event: claimable.event,
    participant: claimable.participant,
    training: claimable.training,
    stage: "completed_awarded",
    xp_status: "awarded",
    assignmentClaim,
  };
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/progress/claim-xp") && init?.method === "POST") {
      return { ok: true, status: 200, json: async () => awarded };
    }
    // any other POST (video-complete etc.) or the initial GET
    return { ok: true, status: 200, json: async () => claimable };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryJoinClient — assignment connection message (3.1B-3D)", () => {
  it("shows the connection message when the learner claimed their OWN assignment", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch("claimed");
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("assignment-connected")).toBeTruthy());
    expect(screen.getByTestId("assignment-connected").textContent).toMatch(/assigned learning has been connected/i);
  });

  it("also shows it on an idempotent re-claim (already_claimed)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch("already_claimed");
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("assignment-connected")).toBeTruthy());
  });

  it("is SILENT for a wrong-account / open-link participant (no_matching_assignment)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch("no_matching_assignment");
    render(<FoundryJoinClient token="tok" />);
    // completion still renders (XP awarded), but NO assignment message and no disclosure
    await waitFor(() => expect(screen.getByText("+10 Core XP")).toBeTruthy());
    expect(screen.queryByTestId("assignment-connected")).toBeNull();
  });

  it("is SILENT when there is no assignmentClaim field at all (open-link event)", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(undefined);
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByText("+10 Core XP")).toBeTruthy());
    expect(screen.queryByTestId("assignment-connected")).toBeNull();
  });

  it("never reveals another assignee on a claim_conflict — treated as silent", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch("claim_conflict");
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByText("+10 Core XP")).toBeTruthy());
    expect(screen.queryByTestId("assignment-connected")).toBeNull();
  });
});
