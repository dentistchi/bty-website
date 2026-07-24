/** @vitest-environment jsdom */
/**
 * FieldActionForm (Slice 3.1B-3N-5C.3) — Today-owned in-shell Field Action producer.
 * Learner authors Who/What/How/When; submit reuses submit-validation. Covers new-from-assignment,
 * validation, resubmit-prefill, no-optimistic-success, and 404-unavailable vs 500-retryable init.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FieldActionForm from "./FieldActionForm";

const DRAFT = {
  contractId: "c1", status: "pending", who: null, what: null, how: null, stepWhen: null,
  revisionNote: null, moduleTitle: "Leading under pressure",
};
const REJECTED = {
  contractId: "c9", status: "rejected", who: "Team", what: "Hold a 1:1", how: "In person", stepWhen: "Friday",
  revisionNote: "Name a specific person.", moduleTitle: "Feedback basics",
};

/**
 * `loadSequence` drives successive init responses (for retry): each entry is a status code;
 * 200 returns `loadContract`. `submitStatus` drives the submit-validation response.
 */
function mockFetch(opts: { loadSequence?: number[]; loadContract?: unknown; submitStatus?: number; onSubmit?: () => void }) {
  const seq = [...(opts.loadSequence ?? [200])];
  const contract = "loadContract" in opts ? opts.loadContract : DRAFT;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/submit-validation")) {
        opts.onSubmit?.();
        return Promise.resolve(new Response(JSON.stringify({ outcome: "ok" }), { status: opts.submitStatus ?? 200 }));
      }
      const status = seq.length > 1 ? seq.shift()! : seq[0];
      const body = status === 200 ? JSON.stringify({ ok: true, contract }) : JSON.stringify({ ok: false });
      return Promise.resolve(new Response(body, { status }));
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FieldActionForm", () => {
  it("new from a completed assignment → shows the authoring form + module context", async () => {
    mockFetch({});
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-form")).toBeTruthy();
    expect(screen.getByTestId("field-action-who")).toBeTruthy();
    expect(screen.getByText(/Leading under pressure/)).toBeTruthy();
  });

  it("blocks submit until Who/What/How/When are authored (no POST)", async () => {
    const onSubmit = vi.fn();
    mockFetch({ onSubmit });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={() => {}} />);
    fireEvent.click(await screen.findByTestId("field-action-submit"));
    expect(screen.getByTestId("field-action-validation")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits authored fields via submit-validation, then returns to Today", async () => {
    const onBack = vi.fn();
    const onSubmit = vi.fn();
    mockFetch({ onSubmit });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={onBack} />);
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
    mockFetch({ loadContract: REJECTED });
    render(<FieldActionForm locale="en" contractId="c9" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-revision-note")).toBeTruthy();
    expect((screen.getByTestId("field-action-what") as HTMLTextAreaElement).value).toBe("Hold a 1:1");
  });

  it("404 → safe unavailable state (no form, no retry)", async () => {
    mockFetch({ loadSequence: [404] });
    render(<FieldActionForm locale="en" contractId="c9" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-notfound")).toBeTruthy();
    expect(screen.queryByTestId("field-action-submit")).toBeNull();
    expect(screen.queryByTestId("field-action-retry")).toBeNull();
  });

  it("500 → retryable load error; retry re-initializes without a duplicate and reaches the form", async () => {
    mockFetch({ loadSequence: [500, 200] });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-loaderror")).toBeTruthy();
    expect(screen.getByText(/Couldn't load this action\. Try again\./)).toBeTruthy();
    fireEvent.click(screen.getByTestId("field-action-retry"));
    expect(await screen.findByTestId("field-action-form")).toBeTruthy();
    expect(screen.getByTestId("field-action-who")).toBeTruthy();
  });

  it("submit server failure does not declare success (no onBack)", async () => {
    const onBack = vi.fn();
    mockFetch({ submitStatus: 500 });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={onBack} />);
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
