/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("./PdfReader", () => ({ PdfReader: () => null }));
import FoundryDocumentClient from "./FoundryDocumentClient";

/**
 * SLICE 3.2R-R2.5 — a document training whose journey asks for a decision could not be completed.
 *
 * MEASURED on the live event `4d1b2375`, the Founder's first published decide-program. The
 * learner's reading gate was satisfied (`document_read_completed_at` set, 368s read, page 1/1) and
 * completion was still impossible: 3.2M-1 added YOUR DECISION to the YouTube learner and to the
 * document SERVICE, and never to this client. So the server computed
 * `resolveDecisionResponse(actionDecision, undefined)` → `decision_required`, and the client had
 * no field to answer it with and no branch to report it — the refusal fell through to
 * `await load()`, the snapshot silently reloaded, and nothing on screen changed.
 *
 * That is exactly what "Complete training cannot be pressed" looks like from the outside.
 */

const DECISION_CONTEXT =
  "The next time this happens, I will name one owner and one deadline for each open action item before the huddle ends.";

/** The live event's shape: grounded action_decision, no shared question, no reflection element. */
function snap(withDecision: boolean, over: Record<string, unknown> = {}) {
  return {
    content_type: "document",
    event: { title: "Establishing Action Ownership in Huddles", status: "open" },
    participant: { display_name: "테스터223" },
    document: {
      page_count: 1, min_read_seconds: 15, intro: null, last_page: 1,
      distinct_pages_viewed: 1, active_read_ms: 368000, reading_complete: true,
      completion_prompt: "What two things should be clear before a huddle ends?",
      shared_question: null,
    },
    journey: withDecision
      ? { displayTitle: "Establishing Action Ownership in Huddles", elements: [
          { id: "el_observable_standard", kind: "observable_standard", content: "…" },
          { id: "el_action_decision", kind: "action_decision", content: DECISION_CONTEXT },
          { id: "el_completion_check", kind: "completion_check", content: "What two things should be clear before a huddle ends?" },
        ] }
      : null,
    reflection_required: false,
    stage: "read",
    xp_status: "none",
    ...over,
  };
}

function mockFetch(withDecision: boolean, onComplete: (b: unknown) => void, completeResponse?: { ok: boolean; body: unknown }) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/doc/complete") && init?.method === "POST") {
      onComplete(JSON.parse(String(init.body ?? "{}")));
      if (completeResponse) return { ok: completeResponse.ok, status: completeResponse.ok ? 200 : 400, json: async () => completeResponse.body };
      return { ok: true, status: 200, json: async () => ({ ...snap(withDecision), ok: true, stage: "completed_awarded", xp_status: "awarded" }) };
    }
    return { ok: true, status: 200, json: async () => snap(withDecision) };
  });
}

const fillCompletionCheck = (v: string) => {
  const areas = screen.getAllByRole("textbox");
  fireEvent.change(areas[0]!, { target: { value: v } });
};
const clickComplete = () => fireEvent.click(screen.getByText(/^(Complete|완료)/));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("the document learner can answer YOUR DECISION", () => {
  it("renders the decision section with BTY's sentence as context, never prefilled", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(true, () => {});
    render(<FoundryDocumentClient token="tok" />);
    const section = await screen.findByTestId("decision-section");
    expect(screen.getByTestId("decision-context").textContent).toBe(DECISION_CONTEXT);
    expect(section.textContent).toContain("Your decision");
    expect(section.textContent).toContain("What will you do?");
    expect(screen.getByTestId("decision-disclosure").textContent).toContain("shared with the training host");
    // The learner's own answer starts EMPTY — a decision they read is not one they made.
    expect((screen.getByTestId("decision-input") as HTMLTextAreaElement).value).toBe("");
  });

  it("completion SENDS decision_response alongside the completion check", async () => {
    let posted: Record<string, unknown> | null = null;
    // @ts-expect-error test shim
    global.fetch = mockFetch(true, (b) => { posted = b as Record<string, unknown>; });
    render(<FoundryDocumentClient token="tok" />);
    await screen.findByTestId("decision-section");
    fillCompletionCheck("An owner and a deadline.");
    fireEvent.change(screen.getByTestId("decision-input"), { target: { value: "I will name the owner out loud." } });
    clickComplete();
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.response_text).toBe("An owner and a deadline.");
    expect(posted!.decision_response).toBe("I will name the owner out loud.");
  });

  it("BLOCKS completion with a visible reason when the decision is empty — no POST", async () => {
    /*
      The gate is legitimate and must stay; what was missing is that the learner can see it.
    */
    let posted: unknown = null;
    // @ts-expect-error test shim
    global.fetch = mockFetch(true, (b) => { posted = b; });
    render(<FoundryDocumentClient token="tok" />);
    await screen.findByTestId("decision-section");
    fillCompletionCheck("An owner and a deadline.");
    clickComplete();
    await new Promise((r) => setTimeout(r, 20));
    expect(posted).toBeNull();
    expect((await screen.findByTestId("decision-error")).textContent).toContain("what you will do");
  });

  it("a server decision_required is SHOWN, not swallowed into a silent reload", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch(true, () => {}, { ok: false, body: { error: "decision_required" } });
    render(<FoundryDocumentClient token="tok" />);
    await screen.findByTestId("decision-section");
    fillCompletionCheck("An owner and a deadline.");
    fireEvent.change(screen.getByTestId("decision-input"), { target: { value: "x" } });
    clickComplete();
    expect(await screen.findByTestId("decision-error")).toBeTruthy();
  });

  it("the completion check still blocks on its own, independently", async () => {
    let posted: unknown = null;
    // @ts-expect-error test shim
    global.fetch = mockFetch(true, (b) => { posted = b; });
    render(<FoundryDocumentClient token="tok" />);
    await screen.findByTestId("decision-section");
    fireEvent.change(screen.getByTestId("decision-input"), { target: { value: "I will name the owner." } });
    clickComplete();
    await new Promise((r) => setTimeout(r, 20));
    expect(posted).toBeNull();
  });
});

describe("a training that asks for NO decision is untouched", () => {
  it("renders no decision section and completes without one", async () => {
    let posted: Record<string, unknown> | null = null;
    // @ts-expect-error test shim
    global.fetch = mockFetch(false, (b) => { posted = b as Record<string, unknown>; });
    render(<FoundryDocumentClient token="tok" />);
    await screen.findByText("What two things should be clear before a huddle ends?");
    expect(screen.queryByTestId("decision-section")).toBeNull();
    fillCompletionCheck("An owner and a deadline.");
    clickComplete();
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.decision_response).toBeUndefined();
  });
});
