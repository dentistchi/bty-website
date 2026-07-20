/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AdminArenaMembershipPage from "./page";

/**
 * Slice 3.1A-2: the approval page surfaces the canonical write-through result
 * non-blockingly. reconciliation_pending must NOT imply the approval failed.
 */

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));
vi.mock("@/components/bty-arena", () => ({
  EmptyState: () => <div data-testid="empty" />,
  LoadingFallback: () => <div data-testid="loading" />,
  CardSkeleton: () => <div data-testid="skeleton" />,
}));

const PENDING_ROW = {
  id: 5, user_id: "u5", fullName: "Test Member", job_function: "staff",
  joined_at: "2026-01-01", leader_started_at: null, status: "pending",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

function mockFetch(approveBody: unknown) {
  let listCall = 0;
  global.fetch = vi.fn().mockImplementation((url: string, opts?: { method?: string }) => {
    if (typeof url === "string" && url.includes("/approve")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => approveBody });
    }
    // list endpoint: first load returns the pending row; reload after approval returns none
    listCall += 1;
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ requests: listCall === 1 ? [PENDING_ROW] : [] }) });
    void opts;
  }) as unknown as typeof fetch;
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

async function approve() {
  render(<AdminArenaMembershipPage />);
  await waitFor(() => screen.getByText("Test Member"));
  const approveBtn = screen.getAllByRole("button").find((b) => b.textContent && /approve|승인/i.test(b.textContent));
  fireEvent.click(approveBtn!);
}

describe("approval page canonical observability", () => {
  it("canonicalMembership=ok → success confirmation, no error", async () => {
    mockFetch({ ok: true, requestId: 5, userId: "u5", canonicalMembership: "ok" });
    await approve();
    await waitFor(() => screen.getByTestId("canonical-notice-ok"));
    expect(screen.queryByTestId("canonical-notice-pending")).toBeNull();
  });

  it("reconciliation_pending → non-blocking warning that links to the identity page", async () => {
    mockFetch({ ok: true, requestId: 5, userId: "u5", canonicalMembership: "reconciliation_pending" });
    await approve();
    await waitFor(() => screen.getByTestId("canonical-notice-pending"));
    const link = screen.getByTestId("canonical-notice-link");
    expect(link.getAttribute("href")).toBe("/en/admin/arena-identity");
    // approval still succeeded — the pending list reloaded to empty, no error surfaced
    expect(screen.queryByText(/failed/i)).toBeNull();
  });
});
