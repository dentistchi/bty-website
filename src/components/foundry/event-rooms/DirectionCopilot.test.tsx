/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { DirectionCopilot, type DirectionGenerateOutcome, type DirectionSuggestionView } from "./DirectionCopilot";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";

const t = MODULE_BUILDER_COPY.en.copilot;

const SUGGESTIONS: DirectionSuggestionView[] = [
  { id: "direction_1", title: "Accurate handoff", capability_candidate: "Shift Handoff", rationale: "why 1", observable_behavior: "behavior 1", success_evidence_hint: "evidence 1", important_assumption: "assumption 1" },
  { id: "direction_2", title: "Order read-back", capability_candidate: "Order Verification", rationale: "why 2", observable_behavior: "behavior 2", success_evidence_hint: "evidence 2", important_assumption: null },
  { id: "direction_3", title: "Escalate early", capability_candidate: "Escalation", rationale: "why 3", observable_behavior: "behavior 3", success_evidence_hint: "evidence 3", important_assumption: null },
];

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(over: Partial<Parameters<typeof DirectionCopilot>[0]> = {}) {
  const onGenerate = vi.fn<() => Promise<DirectionGenerateOutcome>>().mockResolvedValue({ ok: true, suggestions: SUGGESTIONS });
  const onApply = vi.fn();
  const props = { problemStatement: "Handoffs miss the check step.", ready: true, onGenerate, onApply, t, ...over };
  const utils = render(<DirectionCopilot {...props} />);
  return { onGenerate: props.onGenerate, onApply: props.onApply, props, ...utils };
}

afterEach(cleanup);

describe("DirectionCopilot", () => {
  it("renders nothing until the problem meets minimum validity", () => {
    setup({ ready: false });
    expect(screen.queryByTestId("direction-copilot-trigger")).toBeNull();
  });

  it("shows the trigger when ready and generates on tap (loading first, no auto-select)", async () => {
    const d = deferred<DirectionGenerateOutcome>();
    const { onGenerate } = setup({ onGenerate: vi.fn().mockReturnValue(d.promise) });
    fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
    expect(screen.getByTestId("direction-copilot-loading")).toBeTruthy();
    expect(onGenerate).toHaveBeenCalledTimes(1);
    d.resolve({ ok: true, suggestions: SUGGESTIONS });
    await waitFor(() => expect(screen.getByTestId("direction-copilot-results")).toBeTruthy());
    // exactly three cards, none pre-selected into review
    expect(screen.getAllByTestId("direction-card")).toHaveLength(3);
    expect(screen.queryByTestId("direction-copilot-review")).toBeNull();
  });

  it("does not mutate canonical fields on generation or on merely selecting a card", async () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
    await waitFor(() => screen.getByTestId("direction-copilot-results"));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByTestId("direction-card-use")[0]);
    expect(screen.getByTestId("direction-copilot-review")).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled(); // selection alone never applies
  });

  it("review is editable; Apply sends only capability/behavior/evidence with edits", async () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
    await waitFor(() => screen.getByTestId("direction-copilot-results"));
    fireEvent.click(screen.getAllByTestId("direction-card-use")[0]);
    fireEvent.change(screen.getByTestId("review-capability"), { target: { value: "Edited Capability" } });
    fireEvent.change(screen.getByTestId("review-behavior"), { target: { value: "Edited behavior" } });
    fireEvent.click(screen.getByTestId("direction-copilot-apply"));
    expect(onApply).toHaveBeenCalledWith({
      capabilityCandidate: "Edited Capability",
      observableBehavior: "Edited behavior",
      successEvidence: "evidence 1",
    });
    expect(screen.getByTestId("direction-copilot-applied")).toBeTruthy();
  });

  it("Back returns to the three directions", async () => {
    setup();
    fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
    await waitFor(() => screen.getByTestId("direction-copilot-results"));
    fireEvent.click(screen.getAllByTestId("direction-card-use")[0]);
    fireEvent.click(screen.getByText(t.backToDirections));
    expect(screen.getByTestId("direction-copilot-results")).toBeTruthy();
  });

  it("Describe another direction opens a blank editable review", async () => {
    setup();
    fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
    await waitFor(() => screen.getByTestId("direction-copilot-results"));
    fireEvent.click(screen.getByTestId("direction-copilot-describe-another"));
    expect(screen.getByTestId("direction-copilot-review")).toBeTruthy();
    expect((screen.getByTestId("review-capability") as HTMLInputElement).value).toBe("");
  });

  it("failure preserves nothing lost: retry re-generates, continue collapses", async () => {
    const onGenerate = vi
      .fn<() => Promise<DirectionGenerateOutcome>>()
      .mockResolvedValueOnce({ ok: false, code: "generic" })
      .mockResolvedValueOnce({ ok: true, suggestions: SUGGESTIONS });
    setup({ onGenerate });
    fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
    await waitFor(() => screen.getByTestId("direction-copilot-error"));
    fireEvent.click(screen.getByTestId("direction-copilot-retry"));
    await waitFor(() => screen.getByTestId("direction-copilot-results"));
    expect(onGenerate).toHaveBeenCalledTimes(2);
  });

  it("continue without suggestions returns to the trigger", async () => {
    setup({ onGenerate: vi.fn().mockResolvedValue({ ok: false, code: "generic" }) });
    fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
    await waitFor(() => screen.getByTestId("direction-copilot-error"));
    fireEvent.click(screen.getByText(t.continueWithout));
    expect(screen.getByTestId("direction-copilot-trigger")).toBeTruthy();
  });

  it("marks results stale and blocks Apply when the problem changes after generation", async () => {
    const { rerender, props, onApply } = setup();
    fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
    await waitFor(() => screen.getByTestId("direction-copilot-results"));
    fireEvent.click(screen.getAllByTestId("direction-card-use")[0]);
    // Host edits the problem while a direction is under review.
    rerender(<DirectionCopilot {...props} problemStatement="A different problem now." />);
    expect(screen.getByTestId("direction-copilot-stale")).toBeTruthy();
    fireEvent.click(screen.getByTestId("direction-copilot-apply"));
    expect(onApply).not.toHaveBeenCalled();
  });
});
