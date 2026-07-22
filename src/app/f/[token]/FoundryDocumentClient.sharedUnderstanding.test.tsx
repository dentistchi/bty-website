/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("./PdfReader", () => ({ PdfReader: () => null }));
import FoundryDocumentClient from "./FoundryDocumentClient";

/**
 * Slice 3.1B-3G CHECKPOINT 3 — the PDF learner's Shared Understanding section: it is a SEPARATE
 * section from the private Reflection, carries the explicit shared disclosure, blocks completion
 * when the configured shared question has no answer, and submits BOTH the private response_text
 * and the shared_response to the canonical /complete writer.
 */
function readSnapshot(sharedQuestion: string | null) {
  return {
    content_type: "document",
    event: { title: "배가 고파", status: "open" },
    participant: { display_name: "Hanbit" },
    document: {
      page_count: 2, min_read_seconds: 1, intro: null, last_page: 2,
      distinct_pages_viewed: 2, active_read_ms: 9999, reading_complete: true,
      completion_prompt: "What is your private reflection?",
      shared_question: sharedQuestion,
    },
    stage: "read",
    xp_status: "none",
  };
}

function mockFetch(sharedQuestion: string | null, onComplete: (body: unknown) => void) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/doc/complete") && init?.method === "POST") {
      onComplete(JSON.parse(String(init.body ?? "{}")));
      return { ok: true, status: 200, json: async () => ({ ...readSnapshot(sharedQuestion), ok: true, stage: "completed_awarded", xp_status: "awarded" }) };
    }
    return { ok: true, status: 200, json: async () => readSnapshot(sharedQuestion) };
  });
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("FoundryDocumentClient — Shared Understanding learner section", () => {
  it("renders a SEPARATE shared section with the disclosure, distinct from the private reflection", async () => {
    // @ts-expect-error test shim
    global.fetch = mockFetch("Explain the sterilization standard.", () => {});
    render(<FoundryDocumentClient token="tok" />);
    const shared = await screen.findByTestId("shared-understanding-section");
    expect(shared).toBeTruthy();
    expect(screen.getByTestId("shared-disclosure").textContent).toContain("shared with the training host");
    // The shared question text is shown; heading is the articulation framing (not "reflection").
    expect(shared.textContent).toContain("Explain the sterilization standard.");
    expect(shared.textContent).toContain("Show what you understood");
    // The private reflection input still exists and is a DIFFERENT element.
    expect(screen.getByTestId("shared-understanding-input")).toBeTruthy();
  });

  it("BLOCKS completion when the configured shared question has no answer (no /complete POST)", async () => {
    let posted: unknown = null;
    // @ts-expect-error test shim
    global.fetch = mockFetch("Explain the standard.", (b) => { posted = b; });
    render(<FoundryDocumentClient token="tok" />);
    await screen.findByTestId("shared-understanding-section");
    // Fill only the private reflection, leave shared blank.
    const areas = screen.getAllByRole("textbox");
    fireEvent.change(areas[0]!, { target: { value: "my private reflection" } });
    fireEvent.click(screen.getByText(/^(Complete|완료)/));
    await new Promise((r) => setTimeout(r, 20));
    expect(posted).toBeNull(); // completion blocked client-side
  });

  it("submits BOTH response_text (private) and shared_response when both are provided", async () => {
    let posted: Record<string, unknown> | null = null;
    // @ts-expect-error test shim
    global.fetch = mockFetch("Explain the standard.", (b) => { posted = b as Record<string, unknown>; });
    render(<FoundryDocumentClient token="tok" />);
    await screen.findByTestId("shared-understanding-section");
    fireEvent.change(screen.getByTestId("shared-understanding-input"), { target: { value: "Confirm PPE first." } });
    // the private reflection is the OTHER textbox
    const areas = screen.getAllByRole("textbox");
    const privateArea = areas.find((a) => a.getAttribute("data-testid") !== "shared-understanding-input")!;
    fireEvent.change(privateArea, { target: { value: "privately, I felt rushed" } });
    fireEvent.click(screen.getByText(/^(Complete|완료)/));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.response_text).toBe("privately, I felt rushed");
    expect(posted!.shared_response).toBe("Confirm PPE first.");
    // The private reflection is NOT sent as the shared answer.
    expect(posted!.shared_response).not.toBe(posted!.response_text);
  });

  it("no shared question → no shared section, completion sends only response_text", async () => {
    let posted: Record<string, unknown> | null = null;
    // @ts-expect-error test shim
    global.fetch = mockFetch(null, (b) => { posted = b as Record<string, unknown>; });
    render(<FoundryDocumentClient token="tok" />);
    await waitFor(() => expect(screen.getByText("배가 고파")).toBeTruthy());
    expect(screen.queryByTestId("shared-understanding-section")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "just my reflection" } });
    fireEvent.click(screen.getByText(/^(Complete|완료)/));
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted!.response_text).toBe("just my reflection");
    expect("shared_response" in posted!).toBe(false);
  });
});
