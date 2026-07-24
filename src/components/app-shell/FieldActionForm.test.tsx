/** @vitest-environment jsdom */
/**
 * FieldActionForm (Slice 3.1B-3N-5C.3) — the Today-owned in-shell Field Action producer.
 * Learner authors Who/What/How/When; submit reuses submit-validation. Covers new-from-event,
 * validation, resubmit-prefill (with Host revision note), and no-optimistic-success.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FieldActionForm from "./FieldActionForm";

const DRAFT = {
  contractId: "c1", status: "draft", who: null, what: null, how: null, stepWhen: null,
  revisionNote: null, moduleTitle: "Leading under pressure",
};
const REJECTED = {
  contractId: "c9", status: "rejected", who: "Team", what: "Hold a 1:1", how: "In person", stepWhen: "Friday",
  revisionNote: "Name a specific person.", moduleTitle: "Feedback basics",
};

function mockFetch(handlers: { load?: unknown; submitStatus?: number; onSubmit?: () => void }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes("/submit-validation")) {
        handlers.onSubmit?.();
        return Promise.resolve(new Response(JSON.stringify({ outcome: "ok" }), { status: handlers.submitStatus ?? 200 }));
      }
      // producer route (POST create-by-event OR GET by contractId)
      void init;
      return Promise.resolve({ ok: "load" in handlers ? handlers.load != null : true, json: () => Promise.resolve({ contract: "load" in handlers ? handlers.load : DRAFT }) } as Response);
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FieldActionForm", () => {
  it("new from a completed event → shows the authoring form + module context", async () => {
    mockFetch({});
    render(<FieldActionForm locale="en" eventId="event-1" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-form")).toBeTruthy();
    expect(screen.getByTestId("field-action-who")).toBeTruthy();
    expect(screen.getByTestId("field-action-what")).toBeTruthy();
    expect(screen.getByText(/Leading under pressure/)).toBeTruthy();
  });

  it("blocks submit until Who/What/How/When are authored (no POST)", async () => {
    const onSubmit = vi.fn();
    mockFetch({ onSubmit });
    render(<FieldActionForm locale="en" eventId="event-1" onBack={() => {}} />);
    fireEvent.click(await screen.findByTestId("field-action-submit"));
    expect(screen.getByTestId("field-action-validation")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits authored fields via submit-validation, then returns to Today", async () => {
    const onBack = vi.fn();
    const onSubmit = vi.fn();
    mockFetch({ onSubmit });
    render(<FieldActionForm locale="en" eventId="event-1" onBack={onBack} />);
    await screen.findByTestId("field-action-who");
    fireEvent.change(screen.getByTestId("field-action-who"), { target: { value: "My team" } });
    fireEvent.change(screen.getByTestId("field-action-what"), { target: { value: "Run a retro" } });
    fireEvent.change(screen.getByTestId("field-action-how"), { target: { value: "45-min session" } });
    fireEvent.change(screen.getByTestId("field-action-when"), { target: { value: "Monday" } });
    fireEvent.click(screen.getByTestId("field-action-submit"));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("resubmit: prefills the rejected contract + shows the Host revision note", async () => {
    mockFetch({ load: REJECTED });
    render(<FieldActionForm locale="en" contractId="c9" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-revision-note")).toBeTruthy();
    expect(screen.getByText(/Name a specific person\./)).toBeTruthy();
    expect((screen.getByTestId("field-action-what") as HTMLTextAreaElement).value).toBe("Hold a 1:1");
  });

  it("unavailable target → notFound, no form", async () => {
    mockFetch({ load: null });
    render(<FieldActionForm locale="en" contractId="c9" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-notfound")).toBeTruthy();
    expect(screen.queryByTestId("field-action-submit")).toBeNull();
  });

  it("server failure does not declare success (no onBack)", async () => {
    const onBack = vi.fn();
    mockFetch({ submitStatus: 500 });
    render(<FieldActionForm locale="en" eventId="event-1" onBack={onBack} />);
    await screen.findByTestId("field-action-who");
    fireEvent.change(screen.getByTestId("field-action-who"), { target: { value: "a" } });
    fireEvent.change(screen.getByTestId("field-action-what"), { target: { value: "b" } });
    fireEvent.change(screen.getByTestId("field-action-how"), { target: { value: "c" } });
    fireEvent.change(screen.getByTestId("field-action-when"), { target: { value: "d" } });
    fireEvent.click(screen.getByTestId("field-action-submit"));
    expect(await screen.findByTestId("field-action-error")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });
});
