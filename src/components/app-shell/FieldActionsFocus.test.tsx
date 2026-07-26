/** @vitest-environment jsdom */
/**
 * Practice → Field Actions focused surface — canonical learner inventory + explicit load states.
 * Learner groups are driven by /api/bty/action-contract/mine (a canonical inventory), NOT the Today
 * brief — so a submitted contract absent from Today still appears. Reuses the canonical state-aware
 * FieldActionForm / HostActionReviewDetail (mocked here to assert wiring, not internals).
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

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

type StubOpts = {
  items?: unknown[];
  mineStatus?: number;
  mineOk?: boolean;
  queue?: unknown[];
  stageCounts?: unknown;
  onMineCall?: () => void;
};
function stub(o: StubOpts = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bty/action-contract/mine")) {
        o.onMineCall?.();
        if (o.mineStatus && o.mineStatus >= 400) return json({ ok: false, error: "SERVER_ERROR" }, o.mineStatus);
        return json({ ok: o.mineOk ?? true, items: o.items ?? [] });
      }
      if (u.includes("/api/arena/action-review-queue")) return json({ items: o.queue ?? [], stageCounts: o.stageCounts ?? null });
      return json({});
    }),
  );
}

const fa = (over: Record<string, unknown> = {}) => ({
  contractId: "c1", status: "submitted", who: "Sam", what: "Run the 1:1",
  contractDescription: "배가 고파", revisionNote: null, reviewedAt: null, ...over,
});
const BANNED = /\b(Applied|Observed|Completed in real life|Behavior changed|Capability mastered|Sustained)\b/i;

describe("FieldActionsFocus — canonical inventory + load states", () => {
  it("Test 8/11 — loading state renders before data, with Back available", () => {
    stub({ items: [] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    expect(screen.getByTestId("fa-loading")).toBeTruthy();
    expect(screen.getByTestId("field-actions-back")).toBeTruthy();
  });

  it("Tests 1/2/3 — a submitted contract (absent from Today brief) appears once under Awaiting review", async () => {
    stub({ items: [fa({ contractId: "bf5081c6", status: "submitted", contractDescription: "배가 고파" })], stageCounts: null });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    const group = await screen.findByTestId("fa-group-awaiting_review");
    expect(group.textContent).toContain("배가 고파");
    expect(group.textContent).toContain("Awaiting review");
    expect(screen.getAllByTestId("fa-item").length).toBe(1); // exactly once
  });

  it("Test 4 — rejected under Needs revision, editable (opens FieldActionForm) with note", async () => {
    stub({ items: [fa({ contractId: "c-rej", status: "rejected", revisionNote: "Name one person." })] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("fa-item");
    expect(item.getAttribute("data-group")).toBe("needs_revision");
    expect(item.textContent).toContain("Name one person.");
    fireEvent.click(item);
    expect((await screen.findByTestId("field-action-form-mock")).getAttribute("data-contract")).toBe("c-rej");
  });

  it("Test 5 — approved under Reviewed action plans, E3-safe copy", async () => {
    stub({ items: [fa({ contractId: "c-app", status: "approved", reviewedAt: "2026-07-20T00:00:00Z" })] });
    const { container } = render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("fa-item");
    expect(item.getAttribute("data-group")).toBe("reviewed");
    expect(item.textContent).toContain("Action plan reviewed & accepted");
    expect(container.textContent).not.toMatch(BANNED);
  });

  it("Test 6 — pending under Upcoming actions", async () => {
    stub({ items: [fa({ contractId: "c-pend", status: "pending" })] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    expect((await screen.findByTestId("fa-item")).getAttribute("data-group")).toBe("upcoming");
  });

  it("Test 7 — contract-id dedup across overlapping fixtures (rendered once)", async () => {
    stub({ items: [fa({ contractId: "dup", status: "submitted" }), fa({ contractId: "dup", status: "submitted" })] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    await screen.findByTestId("fa-group-awaiting_review");
    expect(screen.getAllByTestId("fa-item").length).toBe(1);
  });

  it("Test 9/11 — loaded-empty is explicit (not blank), Back available", async () => {
    stub({ items: [], stageCounts: null });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    expect(await screen.findByTestId("fa-empty")).toBeTruthy();
    expect(screen.getByTestId("field-actions-back")).toBeTruthy();
    expect(screen.queryByTestId("fa-item")).toBeNull();
  });

  it("Test 10/11 — error state + retry is explicit and READ-ONLY (no create/mutate); Back available", async () => {
    let call = 0;
    stub({ mineStatus: 500, onMineCall: () => { call += 1; } });
    // First response errors; flip to success for the retry.
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/bty/action-contract/mine")) {
        call += 1;
        return call === 1 ? json({ ok: false }, 500) : json({ ok: true, items: [fa({ contractId: "c-ok", status: "pending" })] });
      }
      if (u.includes("/api/arena/action-review-queue")) return json({ items: [], stageCounts: null });
      return json({});
    });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    expect(await screen.findByTestId("fa-error")).toBeTruthy();
    expect(screen.getByTestId("field-actions-back")).toBeTruthy();
    // Only GET calls to mine so far — no POST/PUT/PATCH/DELETE (read-only).
    const methods = fetchMock.mock.calls.map((c) => (c[1] as RequestInit | undefined)?.method ?? "GET");
    expect(methods.every((m) => m === "GET")).toBe(true);
    fireEvent.click(screen.getByTestId("fa-retry"));
    expect((await screen.findByTestId("fa-item")).getAttribute("data-group")).toBe("upcoming");
  });

  it("Test 12 — Host authorized counts + queue render; queue opens HostActionReviewDetail", async () => {
    stub({
      items: [],
      stageCounts: { verificationPending: 2, needsRevision: 1, reviewedAccepted: 3, awaitingResolution: 0 },
      queue: [{ actionContractId: "q-1", learnerLabel: "Learner A", actionSummary: "did X", submittedAt: null, statusLabel: "Submitted" }],
    });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    expect(await screen.findByTestId("fa-host")).toBeTruthy();
    expect(screen.getByTestId("fa-host-count-verificationPending").getAttribute("data-count")).toBe("2");
    fireEvent.click(await screen.findByTestId("fa-host-queue-item"));
    expect((await screen.findByTestId("host-review-mock")).getAttribute("data-contract")).toBe("q-1");
  });

  it("Test 13 — non-reviewer sees NO Host section (authority-scoped empty), a Host loading state shows first", async () => {
    stub({ items: [fa({ status: "pending" })], stageCounts: null, queue: [] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    // Host loading is visible before the queue resolves (async ≠ empty authorized scope).
    expect(screen.getByTestId("fa-host-loading")).toBeTruthy();
    await screen.findByTestId("fa-item");
    await waitFor(() => expect(screen.queryByTestId("fa-host-loading")).toBeNull());
    expect(screen.queryByTestId("fa-host")).toBeNull();
  });

  it("Test 14 — no cross-mount reuse: a remount fetches fresh inventory (no stale account data)", async () => {
    stub({ items: [fa({ contractId: "acct-A", status: "submitted", contractDescription: "A only" })] });
    const { unmount } = render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    expect((await screen.findByTestId("fa-item")).getAttribute("data-contract")).toBe("acct-A");
    unmount();
    stub({ items: [fa({ contractId: "acct-B", status: "submitted", contractDescription: "B only" })] });
    render(<FieldActionsFocus locale="en" onBack={() => {}} />);
    const item = await screen.findByTestId("fa-item");
    expect(item.getAttribute("data-contract")).toBe("acct-B");
    expect(screen.queryByText("A only")).toBeNull();
  });

  it("Test 15 — deep link focuses the correct contract's form on mount", async () => {
    stub({});
    render(<FieldActionsFocus locale="en" onBack={() => {}} initialFieldActionId="c-deep" />);
    expect((await screen.findByTestId("field-action-form-mock")).getAttribute("data-contract")).toBe("c-deep");
  });

  it("Test 16 — EN/KO parity for group + status copy", async () => {
    stub({ items: [fa({ contractId: "c-app", status: "approved" }), fa({ contractId: "c-rej", status: "rejected", revisionNote: "명확히" })] });
    render(<FieldActionsFocus locale="ko" onBack={() => {}} />);
    expect((await screen.findByTestId("fa-group-needs_revision")).textContent).toContain("수정이 필요합니다");
    expect((await screen.findByTestId("fa-group-reviewed")).textContent).toContain("검토·승인된 행동 계획");
  });
});
