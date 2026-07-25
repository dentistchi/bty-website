/** @vitest-environment jsdom */
/**
 * Practice → Field Actions focused surface. Reuses existing projections + the canonical state-aware
 * FieldActionForm / HostActionReviewDetail (both mocked here to assert wiring, not their internals).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/app-shell/FieldActionForm", () => ({
  default: ({ contractId, onBack }: { contractId?: string | null; onBack: () => void }) => (
    <div data-testid="field-action-form-mock" data-contract={contractId ?? ""}>
      <button data-testid="faf-back" onClick={onBack}>back</button>
    </div>
  ),
}));
vi.mock("@/components/app-shell/HostActionReviewDetail", () => ({
  default: ({ actionContractId, onBack }: { actionContractId: string; onBack: () => void }) => (
    <div data-testid="host-review-mock" data-contract={actionContractId}>
      <button data-testid="hrm-back" onClick={onBack}>back</button>
    </div>
  ),
}));

import FieldActionsFocus from "./FieldActionsFocus";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });

type StubOpts = {
  reminders?: unknown[];
  actionStatus?: unknown[];
  reviewed?: unknown[];
  queue?: unknown[];
  stageCounts?: unknown;
};
function stub(o: StubOpts = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: o.reminders ?? [], actionStatus: o.actionStatus ?? [] });
      if (u.includes("/api/bty/action-contract/reviewed-plans")) return json({ items: o.reviewed ?? [] });
      if (u.includes("/api/arena/action-review-queue")) return json({ items: o.queue ?? [], stageCounts: o.stageCounts ?? null });
      return json({});
    }),
  );
}

const rejected = { stableId: "action:r1", category: "ACTION_REVISION", title: "Call one teammate", state: "needs_revision", canonicalDeepLink: "/en/app?tab=practice&fieldAction=c-rejected", note: "Name one specific person." };
const pending = { stableId: "action:p1", category: "ACTION_DUE", title: "Give feedback", state: "due_today", canonicalDeepLink: "/en/app?tab=practice&fieldAction=c-pending" };
const submitted = { stableId: "actionstatus:s1", contractId: "c-submitted", actionType: "field_action", status: "verification_pending", title: "Run the 1:1", originalDeadline: null };
const nonFieldSubmitted = { stableId: "actionstatus:x1", contractId: "c-arena", actionType: "arena", status: "verification_pending", title: "arena action", originalDeadline: null };
const reviewedPlan = { contractId: "c-approved", who: "Sam", what: "listen", moduleTitle: "Empathy 101", reviewedAt: "2026-07-20T00:00:00Z" };

const BANNED = /\b(Applied|Observed|Completed in real life|Behavior changed)\b/i;

describe("FieldActionsFocus — focused Field Actions surface", () => {
  it("Tests 2/3/4 — learner approved/submitted/rejected states render with canonical copy", async () => {
    stub({ reminders: [rejected, pending], actionStatus: [submitted], reviewed: [reviewedPlan] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    await screen.findByTestId("field-actions-focus");
    // rejected → Needs revision + revision note
    const rev = await screen.findByTestId("fa-needs-revision-item");
    expect(rev.textContent).toContain("Needs revision");
    expect(rev.textContent).toContain("Name one specific person.");
    // submitted → Awaiting review
    expect((await screen.findByTestId("fa-awaiting-review-item")).textContent).toContain("Awaiting review");
    // pending → Upcoming
    expect(await screen.findByTestId("fa-upcoming-item")).toBeTruthy();
    // approved → Reviewed action plans, E3-safe copy
    const reviewed = await screen.findByTestId("fa-reviewed-item");
    expect(reviewed.textContent).toContain("Action plan reviewed & accepted");
  });

  it("Test 5 — approved is E3-safe (no Applied/Observed/Completed/Behavior changed anywhere)", async () => {
    stub({ reminders: [rejected], actionStatus: [submitted], reviewed: [reviewedPlan] });
    const { container } = render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    await screen.findByTestId("fa-reviewed-item");
    expect(container.textContent).not.toMatch(BANNED);
  });

  it("Test 3 — rejected opens the (editable) FieldActionForm with its contractId", async () => {
    stub({ reminders: [rejected] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    fireEvent.click(await screen.findByTestId("fa-needs-revision-item"));
    const form = await screen.findByTestId("field-action-form-mock");
    expect(form.getAttribute("data-contract")).toBe("c-rejected");
  });

  it("Test 4 — submitted opens FieldActionForm read-only path (by contractId)", async () => {
    stub({ actionStatus: [submitted] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    fireEvent.click(await screen.findByTestId("fa-awaiting-review-item"));
    expect((await screen.findByTestId("field-action-form-mock")).getAttribute("data-contract")).toBe("c-submitted");
  });

  it("scopes Awaiting review to field_action only (non-field submitted excluded)", async () => {
    stub({ actionStatus: [submitted, nonFieldSubmitted] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getAllByTestId("fa-awaiting-review-item").length).toBe(1));
    expect(screen.getByTestId("fa-awaiting-review-item").textContent).toContain("Run the 1:1");
  });

  it("Test 6/7 — Host stages + queue render only when authorized; queue opens HostActionReviewDetail", async () => {
    stub({
      stageCounts: { verificationPending: 2, needsRevision: 1, reviewedAccepted: 3, awaitingResolution: 0 },
      queue: [{ actionContractId: "q-1", learnerLabel: "Learner A", actionSummary: "did X", submittedAt: null, statusLabel: "Submitted" }],
    });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    expect(await screen.findByTestId("fa-host")).toBeTruthy();
    expect(screen.getByTestId("fa-host-count-verificationPending").getAttribute("data-count")).toBe("2");
    fireEvent.click(await screen.findByTestId("fa-host-queue-item"));
    expect((await screen.findByTestId("host-review-mock")).getAttribute("data-contract")).toBe("q-1");
  });

  it("Test 7 — non-reviewer sees NO Host section (authority-scoped empty)", async () => {
    stub({ reminders: [rejected], stageCounts: null, queue: [] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    await screen.findByTestId("fa-needs-revision-item");
    expect(screen.queryByTestId("fa-host")).toBeNull();
  });

  it("Test 8 — Back invokes onBack (returns to Practice landing)", async () => {
    const onBack = vi.fn();
    stub({ reminders: [rejected] });
    render(<FieldActionsFocus locale="en" onBack={onBack} />);
    fireEvent.click(await screen.findByTestId("field-actions-back"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("Test 9 — deep-link focus opens the specific action's form on mount", async () => {
    stub({});
    render(<FieldActionsFocus locale="en" onBack={() => {}} initialFieldActionId="c-deep" />);
    expect((await screen.findByTestId("field-action-form-mock")).getAttribute("data-contract")).toBe("c-deep");
  });

  it("Test 10 — no duplicate cards (one node per contract)", async () => {
    stub({ reminders: [rejected, pending], actionStatus: [submitted], reviewed: [reviewedPlan] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    await screen.findByTestId("field-actions-focus");
    expect((await screen.findAllByTestId("fa-needs-revision-item")).length).toBe(1);
    expect((await screen.findAllByTestId("fa-awaiting-review-item")).length).toBe(1);
    expect((await screen.findAllByTestId("fa-upcoming-item")).length).toBe(1);
    expect((await screen.findAllByTestId("fa-reviewed-item")).length).toBe(1);
  });

  it("Test 11 — EN/KO parity for section + status copy", async () => {
    stub({ reminders: [{ ...rejected, note: "명확히 해주세요." }], reviewed: [reviewedPlan] });
    render(<FieldActionsFocus locale="ko" onBack={() => {}} />);
    expect((await screen.findByTestId("fa-needs-revision-item")).textContent).toContain("수정 필요");
    expect((await screen.findByTestId("fa-reviewed-item")).textContent).toContain("행동 계획이 검토되고 승인되었습니다");
  });
});
