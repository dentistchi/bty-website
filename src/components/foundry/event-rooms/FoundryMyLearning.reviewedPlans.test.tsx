/** @vitest-environment jsdom */
/**
 * FoundryMyLearning — Reviewed Action Plans section (Slice 3.1B-3N-5D.1, Phase 2/10).
 * An approved Field Action renders exactly one "Action plan reviewed & accepted" card with
 * who/what/how/when + module title + immutable version + review date. It coexists with the
 * completion list (a different evidence stage), dedupes by contract id, and never shows reviewer
 * identity, private reflection, or any prohibited evidence wording (Applied/Observed/Sustained…).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import FoundryMyLearning from "./FoundryMyLearning";

function plan(over: Record<string, unknown> = {}) {
  return {
    contractId: "c1",
    who: "My team lead",
    what: "Review one handoff",
    how: "Agree one owner",
    stepWhen: "By Friday",
    moduleTitle: "Leading under pressure",
    moduleVersion: 2,
    reviewedAt: "2026-07-24T03:00:00Z",
    ...over,
  };
}

function stub(opts: { history?: unknown[]; plans?: unknown[] }) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            String(url).includes("/api/bty/action-contract/reviewed-plans")
              ? { items: opts.plans ?? [] }
              : { history: opts.history ?? [], thread: null, threadStatus: "none" },
          ),
      } as Response),
    ),
  );
}

const PROHIBITED = /\b(applied|verified application|observed|sustained|behavior changed|capability mastered)\b/i;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => vi.restoreAllMocks());

describe("FoundryMyLearning — Reviewed Action Plans", () => {
  it("renders one reviewed-plan card with the exact E3 label + who/what/how/when + module context", async () => {
    stub({ history: [], plans: [plan()] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const card = await screen.findByTestId("reviewed-plan-item");
    expect(within(card).getByTestId("reviewed-plan-status").textContent).toBe("Action plan reviewed & accepted");
    expect(within(card).getByText("My team lead")).toBeTruthy();
    expect(within(card).getByText("Review one handoff")).toBeTruthy();
    expect(within(card).getByText("Agree one owner")).toBeTruthy();
    expect(within(card).getByText("By Friday")).toBeTruthy();
    expect(within(card).getByText("Leading under pressure")).toBeTruthy();
    expect(within(card).getByText("Module v2")).toBeTruthy();
  });

  it("dedupes duplicate contract ids into a single card", async () => {
    stub({ history: [], plans: [plan(), plan()] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await screen.findByTestId("reviewed-plan-item");
    expect(screen.getAllByTestId("reviewed-plan-item")).toHaveLength(1);
  });

  it("omits the section when there are no reviewed plans", async () => {
    stub({ history: [], plans: [] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("my-learning-empty")).toBeTruthy());
    expect(screen.queryByTestId("reviewed-plans")).toBeNull();
  });

  it("hides the module version when lineage is missing (no guess)", async () => {
    stub({ history: [], plans: [plan({ moduleVersion: null })] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const card = await screen.findByTestId("reviewed-plan-item");
    expect(within(card).queryByText(/Module v/)).toBeNull();
    expect(within(card).getByText("Leading under pressure")).toBeTruthy();
  });

  it("shows no reviewer identity, no reflection, and no prohibited evidence wording", async () => {
    stub({ history: [], plans: [plan()] });
    render(<FoundryMyLearning locale="en" onBack={() => {}} />);
    const card = await screen.findByTestId("reviewed-plan-item");
    expect(card.textContent && PROHIBITED.test(card.textContent)).toBeFalsy();
    expect(card.textContent).not.toMatch(/reviewer|reviewed by|verified by/i);
  });

  it("Korean locale uses the locked KO status copy", async () => {
    stub({ history: [], plans: [plan()] });
    render(<FoundryMyLearning locale="ko" onBack={() => {}} />);
    const card = await screen.findByTestId("reviewed-plan-item");
    expect(within(card).getByTestId("reviewed-plan-status").textContent).toBe("행동 계획이 검토되고 승인되었습니다");
  });
});
