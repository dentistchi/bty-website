/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FoundryJoinClient from "./FoundryJoinClient";

/**
 * SLICE 3.2M-1 — what the learner sees, and what they are asked to do.
 *
 * Two things are proven here. The `follow_up` section carries a human label rather than the
 * internal identifier it used to leak. And "Your decision" is a question the learner answers,
 * not a sentence they read — BTY's proposal appears as context, the field starts empty, and
 * completing without an answer is refused.
 */
const DECISION_TEXT = "I will state each open item at my next handover.";

const journey = {
  displayTitle: "Handing over without gaps",
  elements: [
    { id: "el_why_it_matters", kind: "why_it_matters", content: "Handovers miss steps." },
    { id: "el_action_decision", kind: "action_decision", content: DECISION_TEXT },
    { id: "el_follow_up", kind: "follow_up", content: "In seven days you will be asked what you actually said." },
    { id: "el_completion_check", kind: "completion_check", content: "What will you say?" },
  ],
};

function mockRoom(opts: { withJourney?: boolean; stage?: string; xp?: string; practice?: { id: string; title: string } | null; onComplete?: (body: unknown) => unknown } = {}) {
  const snap = {
    ok: true,
    event: { title: "T", status: "open" },
    participant: { display_name: "Learner" },
    training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: "What will you do differently?", shared_question: null },
    stage: opts.stage ?? "response",
    xp_status: opts.xp ?? "none",
    practice: opts.practice ?? null,
    ...(opts.withJourney === false ? {} : { journey }),
  };
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/auth/session")) return { ok: true, status: 200, json: async () => ({ ok: false }) };
    if (u.includes("/progress/complete") && init?.method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const res = opts.onComplete?.(body);
      return (res as { ok: boolean; status: number; json: () => Promise<unknown> }) ?? {
        ok: true, status: 200, json: async () => ({ ...snap, stage: "completed_claimable" }),
      };
    }
    return { ok: true, status: 200, json: async () => snap };
  });
}

beforeEach(() => window.history.replaceState({}, "", "/f/tok"));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("[3.2M-1] the learner room", () => {
  it("follow_up carries a human label — never the internal identifier", async () => {
    // @ts-expect-error test shim
    // The journey is read AROUND the material, so the label lives in the watch frame.
    global.fetch = mockRoom({ stage: "watch" });
    render(<FoundryJoinClient token="tok" />);
    const section = await screen.findByTestId("journey-el-follow_up");
    expect(section.textContent).toContain("WHAT HAPPENS NEXT");
    expect(section.textContent, "the raw kind must never reach a learner").not.toContain("follow_up");
  });

  it("shows BTY's proposal as CONTEXT and leaves the answer empty", async () => {
    // @ts-expect-error test shim
    global.fetch = mockRoom();
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("decision-section")).toBeTruthy());
    expect(screen.getByTestId("decision-context").textContent).toBe(DECISION_TEXT);
    const input = screen.getByTestId("decision-input") as HTMLTextAreaElement;
    expect(input.value, "a prefilled decision would be BTY's, not theirs").toBe("");
    expect(screen.getByText("What will you do?")).toBeTruthy();
    expect(screen.getByTestId("decision-disclosure").textContent).toMatch(/shared with the training host/i);
  });

  it("refuses to complete with no decision, and says so in plain words", async () => {
    let posted = 0;
    // @ts-expect-error test shim
    global.fetch = mockRoom({ onComplete: () => { posted += 1; return undefined; } });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("decision-input")).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/carry forward|what will you do differently/i, { selector: "textarea" }), {
      target: { value: "My reflection." },
    });
    fireEvent.click(screen.getByText("Complete training"));
    await waitFor(() => expect(screen.getByTestId("decision-error")).toBeTruthy());
    expect(screen.getByTestId("decision-error").textContent).toBe("Please say what you will do to complete.");
    expect(posted, "nothing is submitted until they decide").toBe(0);
  });

  it("sends the learner's own words, and nothing else, as the decision", async () => {
    let body: Record<string, unknown> | null = null;
    // @ts-expect-error test shim
    global.fetch = mockRoom({ onComplete: (b) => { body = b as Record<string, unknown>; return undefined; } });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByTestId("decision-input")).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/carry forward|what will you do differently/i, { selector: "textarea" }), {
      target: { value: "My reflection." },
    });
    fireEvent.change(screen.getByTestId("decision-input"), { target: { value: "  I will say the two open items.  " } });
    fireEvent.click(screen.getByText("Complete training"));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.decision_response).toBe("I will say the two open items.");
    expect(body!.decision_response).not.toBe(DECISION_TEXT);
    expect(body!.response_text).toBe("My reflection.");
  });

  it("a training with no decision section asks for none, and completes as before", async () => {
    let body: Record<string, unknown> | null = null;
    // @ts-expect-error test shim
    global.fetch = mockRoom({ withJourney: false, onComplete: (b) => { body = b as Record<string, unknown>; return undefined; } });
    render(<FoundryJoinClient token="tok" />);
    await waitFor(() => expect(screen.getByText("Complete training")).toBeTruthy());
    expect(screen.queryByTestId("decision-section")).toBeNull();
    fireEvent.change(screen.getByLabelText(/carry forward|what will you do differently/i, { selector: "textarea" }), {
      target: { value: "My reflection." },
    });
    fireEvent.click(screen.getByText("Complete training"));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.decision_response).toBeUndefined();
  });
});
