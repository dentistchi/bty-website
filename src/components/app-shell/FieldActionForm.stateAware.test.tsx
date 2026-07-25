/** @vitest-environment jsdom */
/**
 * FieldActionForm — existing-state-aware UX (Slice 3.1B-3N-5D.1D).
 * An already approved/submitted Field Action must NOT reopen as an editable form: approved shows a
 * read-only "Action plan reviewed & accepted" (never "Applied"/"Observed"), submitted shows
 * "Awaiting review". A defensive 409 contract_not_submittable maps to a status-specific message, not
 * the generic error, with no auto-retry and no second write. pending/rejected stay editable.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FieldActionForm from "./FieldActionForm";

const BASE = {
  contractId: "c1", who: "Dr. Chi", what: "Review one unresolved", how: "Agree on one owner and one next step",
  stepWhen: "By tomorrow at 5 PM", revisionNote: null, moduleTitle: "Leadership Attention Device Test",
};
const APPROVED = { ...BASE, status: "approved", reviewedAt: "2026-07-24T18:55:00Z" };
const SUBMITTED = { ...BASE, status: "submitted" };
const PENDING = { ...BASE, status: "pending", who: null, what: null, how: null, stepWhen: null };
const REJECTED = { ...BASE, status: "rejected", revisionNote: "Name a specific person." };

function mockFetch(opts: { loadContract: unknown; submitStatus?: number; submitBody?: unknown; onSubmit?: () => void }) {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (String(url).includes("/submit-validation")) {
      opts.onSubmit?.();
      return Promise.resolve(new Response(JSON.stringify(opts.submitBody ?? {}), { status: opts.submitStatus ?? 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true, contract: opts.loadContract }), { status: 200 }));
  }));
}

function authorAll() {
  fireEvent.change(screen.getByTestId("field-action-who"), { target: { value: "My team lead" } });
  fireEvent.change(screen.getByTestId("field-action-what"), { target: { value: "Review one handoff" } });
  fireEvent.change(screen.getByTestId("field-action-how"), { target: { value: "Agree one owner" } });
  fireEvent.change(screen.getByTestId("field-action-when"), { target: { value: "By 5pm" } });
}

const PROHIBITED = /\b(applied|verified application|observed|sustained|behavior changed|capability mastered|completed in real life)\b/i;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("FieldActionForm — existing-state-aware UX", () => {
  it("(1,2,3) approved → read-only, no inputs, 'reviewed & accepted', no Applied/Observed language", async () => {
    mockFetch({ loadContract: APPROVED });
    render(<FieldActionForm locale="en" contractId="c1" onBack={() => {}} />);
    const view = await screen.findByTestId("field-action-approved");
    expect(screen.getByTestId("field-action-approved-state").textContent).toBe("Action plan reviewed & accepted");
    expect(screen.queryByTestId("field-action-who")).toBeNull();
    expect(screen.queryByTestId("field-action-submit")).toBeNull();
    expect(screen.getByTestId("field-action-ro-who").textContent).toBe("Dr. Chi");
    expect(screen.getByTestId("field-action-ro-what").textContent).toBe("Review one unresolved");
    expect(view.textContent && PROHIBITED.test(view.textContent)).toBeFalsy();
  });

  it("(12) approved → 'View in My Learning' links inside the app shell", async () => {
    mockFetch({ loadContract: APPROVED });
    render(<FieldActionForm locale="en" contractId="c1" onBack={() => {}} />);
    const link = await screen.findByTestId("field-action-view-my-learning");
    expect(link.getAttribute("href")).toBe("/en/app?tab=foundry&view=my-learning");
  });

  it("(4,5) submitted → read-only 'Awaiting review', no inputs, no resubmit", async () => {
    mockFetch({ loadContract: SUBMITTED });
    render(<FieldActionForm locale="en" contractId="c1" onBack={() => {}} />);
    await screen.findByTestId("field-action-submitted");
    expect(screen.getByTestId("field-action-submitted-state").textContent).toBe("Awaiting review");
    expect(screen.queryByTestId("field-action-who")).toBeNull();
    expect(screen.queryByTestId("field-action-submit")).toBeNull();
  });

  it("(6) rejected → stays editable with the revision note", async () => {
    mockFetch({ loadContract: REJECTED });
    render(<FieldActionForm locale="en" contractId="c1" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-revision-note")).toBeTruthy();
    expect(screen.getByTestId("field-action-who")).toBeTruthy();
    expect(screen.getByTestId("field-action-submit")).toBeTruthy();
  });

  it("(7) pending → editable authoring form", async () => {
    mockFetch({ loadContract: PENDING });
    render(<FieldActionForm locale="en" assignmentId="a1" onBack={() => {}} />);
    expect(await screen.findByTestId("field-action-form")).toBeTruthy();
    expect(screen.getByTestId("field-action-who")).toBeTruthy();
  });

  it("(8,10,11) 409+approved → approved message, not generic; submit called once; no new contract", async () => {
    const onSubmit = vi.fn();
    mockFetch({ loadContract: PENDING, submitStatus: 409, submitBody: { error: "contract_not_submittable", status: "approved" }, onSubmit });
    render(<FieldActionForm locale="en" assignmentId="a1" onBack={() => {}} />);
    await screen.findByTestId("field-action-who");
    authorAll();
    fireEvent.click(screen.getByTestId("field-action-submit"));
    await waitFor(() => expect(screen.getByTestId("field-action-error").textContent).toBe("This action plan has already been reviewed and accepted."));
    expect(onSubmit).toHaveBeenCalledTimes(1); // no auto-retry
  });

  it("(9) 409+submitted → submitted message, not generic", async () => {
    mockFetch({ loadContract: PENDING, submitStatus: 409, submitBody: { error: "contract_not_submittable", status: "submitted" } });
    render(<FieldActionForm locale="en" assignmentId="a1" onBack={() => {}} />);
    await screen.findByTestId("field-action-who");
    authorAll();
    fireEvent.click(screen.getByTestId("field-action-submit"));
    await waitFor(() => expect(screen.getByTestId("field-action-error").textContent).toBe("This action plan is already awaiting review."));
  });

  it("Korean approved copy matches the locked wording", async () => {
    mockFetch({ loadContract: APPROVED });
    render(<FieldActionForm locale="ko" contractId="c1" onBack={() => {}} />);
    await screen.findByTestId("field-action-approved");
    expect(screen.getByTestId("field-action-approved-state").textContent).toBe("행동 계획이 검토되고 승인되었습니다");
    expect(screen.getByTestId("field-action-view-my-learning").getAttribute("href")).toBe("/ko/app?tab=foundry&view=my-learning");
  });
});
