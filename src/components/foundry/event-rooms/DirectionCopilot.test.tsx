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
    expect(screen.queryByTestId("direction-copilot")).toBeNull();
  });

  it("shows the discoverable assistive block (EN heading + action + support) when ready, without auto-generating", () => {
    const { onGenerate } = setup();
    const block = screen.getByTestId("direction-copilot");
    expect(block.textContent).toContain("Not sure how to turn this into training?");
    expect(block.textContent).toContain("Show me three possible directions");
    expect(block.textContent).toContain("You can review and edit before anything is applied.");
    // A full-width, comfortably-large touch target action.
    expect(screen.getByTestId("direction-copilot-trigger").className).toContain("w-full");
    expect(onGenerate).not.toHaveBeenCalled(); // no auto-open, no auto-generate
  });

  it("renders the Korean heading, action, and supporting copy", () => {
    setup({ t: MODULE_BUILDER_COPY.ko.copilot });
    const block = screen.getByTestId("direction-copilot");
    expect(block.textContent).toContain("이 문제를 어떤 교육으로 만들지 막막하신가요?");
    expect(block.textContent).toContain("가능한 교육 방향 3개 보기");
    expect(block.textContent).toContain("검토하고 수정한 뒤에만 적용됩니다.");
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

  describe("card density — collapsible secondary details", () => {
    async function toResults() {
      setup();
      fireEvent.click(screen.getByTestId("direction-copilot-trigger"));
      await waitFor(() => screen.getByTestId("direction-copilot-results"));
    }

    it("collapses Why/Evidence/Assumption by default; essentials stay visible", async () => {
      await toResults();
      const card = screen.getAllByTestId("direction-card")[0];
      // Essentials visible.
      expect(card.textContent).toContain("Shift Handoff"); // Capability
      expect(card.textContent).toContain("behavior 1"); // Draft behavior
      expect(card.textContent).toContain(t.useThis);
      // Secondary details hidden until expanded.
      expect(card.querySelector('[data-testid="direction-card-details"]')).toBeNull();
      expect(card.textContent).not.toContain("why 1");
      const toggle = card.querySelector('[data-testid="direction-card-details-toggle"]') as HTMLButtonElement;
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.textContent).toBe(t.viewDetails);
    });

    it("expands and collapses details, exposing full content when open", async () => {
      await toResults();
      const card = screen.getAllByTestId("direction-card")[0];
      const toggle = card.querySelector('[data-testid="direction-card-details-toggle"]') as HTMLButtonElement;
      fireEvent.click(toggle);
      expect(card.querySelector('[data-testid="direction-card-details"]')).not.toBeNull();
      expect(card.textContent).toContain("why 1"); // rationale
      expect(card.textContent).toContain("evidence 1"); // success evidence
      expect(card.textContent).toContain("assumption 1"); // assumption
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(toggle.textContent).toBe(t.hideDetails);
      fireEvent.click(toggle);
      expect(card.querySelector('[data-testid="direction-card-details"]')).toBeNull();
    });

    it("selection works from both the collapsed and expanded states", async () => {
      await toResults();
      // Collapsed → Use.
      fireEvent.click(screen.getAllByTestId("direction-card-use")[0]);
      expect(screen.getByTestId("direction-copilot-review")).toBeTruthy();
      // Back, expand the second card, then Use from the expanded state.
      fireEvent.click(screen.getByText(t.backToDirections));
      const second = screen.getAllByTestId("direction-card")[1];
      fireEvent.click(second.querySelector('[data-testid="direction-card-details-toggle"]') as HTMLButtonElement);
      fireEvent.click(second.querySelector('[data-testid="direction-card-use"]') as HTMLButtonElement);
      expect(screen.getByTestId("direction-copilot-review")).toBeTruthy();
    });
  });
});
