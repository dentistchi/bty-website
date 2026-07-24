/** @vitest-environment jsdom */
/**
 * FieldActionForm (Slice 3.1B-3N-5C.3) — Today-owned in-shell Field Action producer.
 * Learner authors Who/What/How/When; submit reuses submit-validation. Covers new-from-assignment,
 * validation, resubmit-prefill, 404-vs-500 init, and — critically — the submit-validation "revise"
 * (Layer-1) outcome: the form must STAY OPEN, show the server signal, and only close on a canonical
 * submitted landing (contract_state='awaiting_qr'), never on res.ok alone.
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
const SUBMITTED_OK = { outcome: "approve", contract_state: "awaiting_qr", verified_at: null };
const REVISE = { outcome: "revise", layer1_errors: [{ rule: "R1", signal: "Name one person. If the team matters, still pick who you will speak with first." }] };

function mockFetch(opts: {
  loadSequence?: number[];
  loadContract?: unknown;
  submitStatus?: number;
  submitBody?: unknown;
  submitSequence?: unknown[];
  onSubmit?: () => void;
}) {
  const seq = [...(opts.loadSequence ?? [200])];
  const contract = "loadContract" in opts ? opts.loadContract : DRAFT;
  const subSeq = opts.submitSequence ? [...opts.submitSequence] : null;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/submit-validation")) {
        opts.onSubmit?.();
        const body = subSeq ? (subSeq.length > 1 ? subSeq.shift()! : subSeq[0]) : (opts.submitBody ?? SUBMITTED_OK);
        return Promise.resolve(new Response(JSON.stringify(body), { status: opts.submitStatus ?? 200 }));
      }
      const status = seq.length > 1 ? seq.shift()! : seq[0];
      const b = status === 200 ? JSON.stringify({ ok: true, contract }) : JSON.stringify({ ok: false });
      return Promise.resolve(new Response(b, { status }));
    }),
  );
}

function authorAll() {
  fireEvent.change(screen.getByTestId("field-action-who"), { target: { value: "My team lead" } });
  fireEvent.change(screen.getByTestId("field-action-what"), { target: { value: "Review one handoff" } });
  fireEvent.change(screen.getByTestId("field-action-how"), { target: { value: "Agree one owner" } });
  fireEvent.change(screen.getByTestId("field-action-when"), { target: { value: "By 5pm" } });
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

  it("canonical submitted landing (contract_state=awaiting_qr) → onBack", async () => {
    const onBack = vi.fn();
    mockFetch({ onSubmit: () => {} });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={onBack} />);
    await screen.findByTestId("field-action-who");
    authorAll();
    fireEvent.click(screen.getByTestId("field-action-submit"));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it("HTTP 200 + outcome=revise → stays OPEN, shows the server signal, values preserved, no onBack", async () => {
    const onBack = vi.fn();
    mockFetch({ submitBody: REVISE });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={onBack} />);
    await screen.findByTestId("field-action-who");
    authorAll();
    fireEvent.click(screen.getByTestId("field-action-submit"));
    expect(await screen.findByTestId("field-action-revise")).toBeTruthy();
    expect(screen.getByTestId("field-action-revise-signal").textContent).toContain("Name one person");
    expect(onBack).not.toHaveBeenCalled();
    // values preserved after revise
    expect((screen.getByTestId("field-action-who") as HTMLTextAreaElement).value).toBe("My team lead");
    expect((screen.getByTestId("field-action-what") as HTMLTextAreaElement).value).toBe("Review one handoff");
  });

  it("HTTP 200 but canonical status still pending (no contract_state) → does NOT close (retryable)", async () => {
    const onBack = vi.fn();
    mockFetch({ submitBody: { outcome: "ok" } });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={onBack} />);
    await screen.findByTestId("field-action-who");
    authorAll();
    fireEvent.click(screen.getByTestId("field-action-submit"));
    expect(await screen.findByTestId("field-action-error")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("corrected resubmission reuses the SAME contract and closes on submitted", async () => {
    const onBack = vi.fn();
    const posts: string[] = [];
    // First submit → revise; edit Who; second submit → canonical submitted.
    mockFetch({ submitSequence: [REVISE, SUBMITTED_OK], onSubmit: () => {} });
    // capture the contractId sent to submit-validation
    const orig = globalThis.fetch as unknown as (u: string, i?: RequestInit) => Promise<Response>;
    vi.stubGlobal("fetch", vi.fn((u: string, i?: RequestInit) => {
      if (String(u).includes("/submit-validation") && i?.body) posts.push(String(i.body));
      return orig(u, i);
    }));
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={onBack} />);
    await screen.findByTestId("field-action-who");
    authorAll();
    fireEvent.click(screen.getByTestId("field-action-submit"));
    await screen.findByTestId("field-action-revise");
    fireEvent.change(screen.getByTestId("field-action-who"), { target: { value: "Dr. Chi" } });
    fireEvent.click(screen.getByTestId("field-action-submit"));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    const ids = posts.map((b) => JSON.parse(b).contractId);
    expect(ids[0]).toBe("c1");
    expect(ids[1]).toBe("c1"); // same contract on resubmission
  });

  it("resubmit-prefill: shows the Host revision note + prior values", async () => {
    mockFetch({ loadContract: REJECTED });
    render(<FieldActionForm locale="en" contractId="c9" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-revision-note")).toBeTruthy();
    expect((screen.getByTestId("field-action-what") as HTMLTextAreaElement).value).toBe("Hold a 1:1");
  });

  it("404 → safe unavailable; 500 → retryable load error (distinct)", async () => {
    mockFetch({ loadSequence: [404] });
    const { unmount } = render(<FieldActionForm locale="en" contractId="c9" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-notfound")).toBeTruthy();
    expect(screen.queryByTestId("field-action-retry")).toBeNull();
    unmount();
    mockFetch({ loadSequence: [500, 200] });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-loaderror")).toBeTruthy();
    fireEvent.click(screen.getByTestId("field-action-retry"));
    expect(await screen.findByTestId("field-action-form")).toBeTruthy();
  });

  it("submit 500 → retryable error, no success", async () => {
    const onBack = vi.fn();
    mockFetch({ submitStatus: 500 });
    render(<FieldActionForm locale="en" assignmentId="assign-1" onBack={onBack} />);
    await screen.findByTestId("field-action-who");
    authorAll();
    fireEvent.click(screen.getByTestId("field-action-submit"));
    expect(await screen.findByTestId("field-action-error")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });
});
