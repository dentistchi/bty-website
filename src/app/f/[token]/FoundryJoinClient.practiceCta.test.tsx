/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import FoundryJoinClient from "./FoundryJoinClient";

function mockRoom(opts: { stage?: string; xp?: string; practice?: { id: string; title: string } | null } = {}) {
  const snap = {
    ok: true,
    event: { title: "T", status: "open" },
    participant: { display_name: "Learner" },
    training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: "What will you do differently?", shared_question: null },
    stage: opts.stage ?? "completed_awarded",
    xp_status: opts.xp ?? "awarded",
    practice: opts.practice ?? null,
  };
  return vi.fn(async (url: string) => {
    if (String(url).includes("/api/auth/session")) return { ok: true, status: 200, json: async () => ({ ok: true, user: { email: "l@example.com" } }) };
    return { ok: true, status: 200, json: async () => snap };
  });
}

beforeEach(() => window.history.replaceState({}, "", "/f/tok"));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/**
 * SLICE 3.2M-2 — "Now try it". The training and its practice were already bound by
 * `source_event_id` and never connected in anyone's journey. The doorway is offered only
 * when a practice exists AND the completion belongs to an account, because a run nobody can
 * attribute is a step that leads nowhere.
 */
describe("[3.2M-2] Now try it", () => {
  const PRACTICE = { id: "pr-1", title: "Handing over under pressure" };

  it("offers the practice built from THIS training once it is finished and attributable", async () => {
    // @ts-expect-error test shim
    global.fetch = mockRoom({ stage: "completed_awarded", xp: "awarded", practice: PRACTICE });
    render(<FoundryJoinClient token="tok" />);
    const cta = await screen.findByTestId("now-try-it");
    expect(cta.textContent).toContain("Now try it");
    expect(cta.textContent).toMatch(/Practice this in a situation/);
    // The room polls, so assert against the live DOM rather than a captured node.
    expect(document.querySelectorAll('[data-testid="now-try-it-link"]').length).toBe(1);
    expect(document.querySelector('[data-testid="now-try-it-link"]')?.getAttribute("href"))
      .toBe("/en/bty-arena/practice/pr-1");
    // No internals reach the learner.
    expect(cta.textContent).not.toMatch(/PRACTICED|source_event_id|practice_id|Arena id/i);
  });

  it("offers nothing when the training has no practice — never a dead CTA", async () => {
    // @ts-expect-error test shim
    global.fetch = mockRoom({ stage: "completed_awarded", xp: "awarded", practice: null });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.queryByTestId("saved-to-bty")).toBeTruthy());
    expect(screen.queryByTestId("now-try-it")).toBeNull();
  });

  it("offers nothing to an unattributable completion — a run nobody can credit is not a step", async () => {
    // @ts-expect-error test shim
    global.fetch = mockRoom({ stage: "completed_claimable", xp: "claimable", practice: PRACTICE });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.queryByText(/Complete training/)).toBeNull());
    expect(screen.queryByTestId("now-try-it")).toBeNull();
  });
});
