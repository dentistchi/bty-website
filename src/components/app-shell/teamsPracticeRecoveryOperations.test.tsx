/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TeamsPracticeRecoveryOperations } from "./TeamsPracticeRecoveryOperations";

/**
 * Slice Teams-Native System-Block Recovery V1 — the OPERATOR surface.
 *
 * The rule these protect: the section is ABSENT unless the runtime is Teams, the caller is an
 * operator, and there is a specific failure to acknowledge. Every other path collapses to the same
 * absence, because a learner must never meet an admin placeholder.
 */

const ENDPOINT = "/api/admin/practice-generation/recover-system-block";
const ITEM = {
  draftId: "af921b9d-19b1-4673-a0ff-9753ecd581b1",
  blockedAttemptId: "29cfe46e-4b13-4c08-a4a2-9f639eb55195",
  outcome: "review_execution_failed",
  terminalReasonCode: "boundary_reviewer_terminal_failure",
  failedDeploySha: "d2a18a081c45b0a084c202308d43da6d224615b3",
  currentDeploySha: "c407d9c543c1d7f0c64ace763ec2a43fbf947cc8",
};
const SECOND = { ...ITEM, draftId: "bbbbbbbb-0000-4000-8000-000000000002", blockedAttemptId: "cccccccc-0000-4000-8000-000000000003" };

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];

/** `get` may be a list, a status, or a sequence of lists for the refresh case. */
function mockApi(get: { status?: number; lists?: unknown[][] }, postOk = true) {
  let n = 0;
  // @ts-expect-error test shim
  global.fetch = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? "GET";
    calls.push({ url: String(url), method, body: init?.body ? JSON.parse(init.body) : null });
    if (method === "POST") {
      return { ok: postOk, status: postOk ? 200 : 409, json: async () => ({ ok: postOk }) };
    }
    if (get.status && get.status !== 200) {
      return { ok: false, status: get.status, json: async () => ({ error: "x" }) };
    }
    const list = get.lists?.[Math.min(n++, (get.lists?.length ?? 1) - 1)] ?? [];
    return { ok: true, status: 200, json: async () => ({ recoverable: list }) };
  });
}

beforeEach(() => { calls = []; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("A/D/M — when the section exists at all", () => {
  it("A — operator with a recoverable block sees Admin operations", async () => {
    mockApi({ lists: [[ITEM]] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    await waitFor(() => expect(screen.getByTestId("teams-recovery-operations")).toBeTruthy());
    expect(screen.getByTestId("teams-recovery-operations").textContent).toContain("Admin operations");
    expect(screen.getByTestId("teams-recovery-start")).toBeTruthy();
  });

  it("D — nothing to recover renders nothing", async () => {
    mockApi({ lists: [[]] });
    const { container } = render(<TeamsPracticeRecoveryOperations locale="en" />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(screen.queryByTestId("teams-recovery-operations")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it.each([401, 403])("M — %i renders nothing, and reports no error", async (status) => {
    mockApi({ status });
    const { container } = render(<TeamsPracticeRecoveryOperations locale="en" />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(screen.queryByTestId("teams-recovery-operations")).toBeNull();
    expect(screen.queryByTestId("teams-recovery-note")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("a 5xx before the section was ever shown fails softly and silently", async () => {
    mockApi({ status: 500 });
    const { container } = render(<TeamsPracticeRecoveryOperations locale="en" />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(container.textContent).toBe("");
  });
});

describe("G/H/I/J — recovery requires confirmation and names only the failure", () => {
  it("G — the first tap confirms, and posts nothing", async () => {
    mockApi({ lists: [[ITEM]] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    fireEvent.click(await screen.findByTestId("teams-recovery-start"));
    await waitFor(() => expect(screen.getByTestId("teams-recovery-confirm")).toBeTruthy());
    expect(screen.getByTestId("teams-recovery-confirm").textContent).toContain("Allow this practice to try generation again?");
    expect(screen.getByTestId("teams-recovery-confirm").textContent).toContain("The failed attempt will remain in history.");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("cancelling posts nothing", async () => {
    mockApi({ lists: [[ITEM]] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    fireEvent.click(await screen.findByTestId("teams-recovery-start"));
    fireEvent.click(await screen.findByTestId("teams-recovery-cancel"));
    await waitFor(() => expect(screen.getByTestId("teams-recovery-start")).toBeTruthy());
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("H — one confirmation produces exactly one POST", async () => {
    mockApi({ lists: [[ITEM], []] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    fireEvent.click(await screen.findByTestId("teams-recovery-start"));
    fireEvent.click(await screen.findByTestId("teams-recovery-confirm-cta"));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
  });

  it("I/J — the body names the failure, the reason and the current build — and no granter", async () => {
    mockApi({ lists: [[ITEM], []] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    fireEvent.click(await screen.findByTestId("teams-recovery-start"));
    fireEvent.click(await screen.findByTestId("teams-recovery-confirm-cta"));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const body = calls.find((c) => c.method === "POST")!.body as Record<string, unknown>;
    expect(body).toEqual({
      draftId: ITEM.draftId,
      blockedAttemptId: ITEM.blockedAttemptId,
      recoveryReasonCode: "boundary_repair_group_expansion_fixed",
      fixedInDeploySha: ITEM.currentDeploySha,
    });
    for (const forbidden of ["grantedByUserId", "granted_by_user_id", "ownerId", "email", "token"]) {
      expect(Object.keys(body), forbidden).not.toContain(forbidden);
    }
  });
});

describe("K/L — success recovers, and does not generate", () => {
  it("L — refreshes once and the item disappears", async () => {
    mockApi({ lists: [[ITEM], []] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    fireEvent.click(await screen.findByTestId("teams-recovery-start"));
    fireEvent.click(await screen.findByTestId("teams-recovery-confirm-cta"));
    await waitFor(() => expect(screen.queryByTestId("teams-recovery-item")).toBeNull());
    expect(screen.getByTestId("teams-recovery-note").textContent).toContain("Recovery complete. Practice is ready.");
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(2);
  });

  it("K — no generation, admission or navigation is triggered", async () => {
    mockApi({ lists: [[ITEM], []] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    fireEvent.click(await screen.findByTestId("teams-recovery-start"));
    fireEvent.click(await screen.findByTestId("teams-recovery-confirm-cta"));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
    for (const c of calls) {
      expect(c.url).toContain("/api/admin/practice-generation/recover-system-block");
      expect(c.url).not.toMatch(/generate|governed|submission|attempt\//i);
    }
    const src = readFileSync(join(process.cwd(), "src/components/app-shell/TeamsPracticeRecoveryOperations.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of ["start_foundry_practice_generation", "submissionIntentId", "router", "navigate"]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
  });

  it("a refused POST changes nothing and says so once", async () => {
    mockApi({ lists: [[ITEM]] }, false);
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    fireEvent.click(await screen.findByTestId("teams-recovery-start"));
    fireEvent.click(await screen.findByTestId("teams-recovery-confirm-cta"));
    await waitFor(() => expect(screen.getByTestId("teams-recovery-note")).toBeTruthy());
    // No automatic retry.
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(screen.getByTestId("teams-recovery-item")).toBeTruthy();
  });
});

describe("multiple blocks are never collapsed", () => {
  it("renders one item per attempt, each bound to its own ids", async () => {
    mockApi({ lists: [[ITEM, SECOND]] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    await waitFor(() => expect(screen.getAllByTestId("teams-recovery-item")).toHaveLength(2));
    const ids = screen.getAllByTestId("teams-recovery-start").map((b) => b.getAttribute("data-attempt-id"));
    expect(ids).toEqual([ITEM.blockedAttemptId, SECOND.blockedAttemptId]);
  });

  it("recovering the SECOND posts the second's ids, never the first's", async () => {
    mockApi({ lists: [[ITEM, SECOND], [ITEM]] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    await waitFor(() => expect(screen.getAllByTestId("teams-recovery-start")).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId("teams-recovery-start")[1]);
    fireEvent.click(await screen.findByTestId("teams-recovery-confirm-cta"));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const body = calls.find((c) => c.method === "POST")!.body as Record<string, unknown>;
    expect(body.blockedAttemptId).toBe(SECOND.blockedAttemptId);
    expect(body.draftId).toBe(SECOND.draftId);
  });

  it("has no 'recover latest' form in the source", () => {
    const src = readFileSync(join(process.cwd(), "src/components/app-shell/TeamsPracticeRecoveryOperations.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/latest|\[0\]|most_recent/i);
  });
});

describe("details stay compact", () => {
  it("shows build identity only on request, and no diagnostic code", async () => {
    mockApi({ lists: [[ITEM]] });
    render(<TeamsPracticeRecoveryOperations locale="en" />);
    await waitFor(() => expect(screen.getByTestId("teams-recovery-operations")).toBeTruthy());
    expect(screen.queryByTestId("teams-recovery-details")).toBeNull();
    // The primary UI never shows the raw terminal reason code.
    expect(screen.getByTestId("teams-recovery-operations").textContent).not.toContain("boundary_reviewer_terminal_failure");
    fireEvent.click(screen.getByTestId("teams-recovery-details-toggle"));
    const d = (await screen.findByTestId("teams-recovery-details")).textContent ?? "";
    expect(d).toContain("29cfe46e…");
    expect(d).toContain("d2a18a08…");
    expect(d).toContain("c407d9c5…");
    expect(d).not.toContain("boundary_reviewer_terminal_failure");
  });
});
