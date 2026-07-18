/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import {
  ModuleDraftCopilot,
  type ModuleDraftGenerateOutcome,
  type ModuleDraftView,
  type ModuleDraftCurrent,
} from "./ModuleDraftCopilot";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";
import type { ClarificationAssessment } from "@/domain/foundry/module/clarification";

const t = MODULE_BUILDER_COPY.en.moduleDraft;

const BEHAVIOR_Q: ClarificationAssessment = {
  sufficient: false,
  missingDimensions: ["observable_behavior"],
  nextQuestion: { dimension: "observable_behavior", choiceKeys: [], allowCustom: true },
  askedCount: 0,
};
const EVIDENCE_Q: ClarificationAssessment = {
  sufficient: false,
  missingDimensions: ["success_evidence"],
  nextQuestion: {
    dimension: "success_evidence",
    choiceKeys: ["ev_seen", "ev_heard", "ev_recorded", "ev_confirmed"],
    allowCustom: true,
  },
  askedCount: 1,
};
const SUFFICIENT: ClarificationAssessment = { sufficient: true, missingDimensions: [], nextQuestion: null, askedCount: 0 };

const VIEW: ModuleDraftView = {
  learning_approach: ["practice", "shared_standard"],
  learning_approach_rationale: "Needs a repeatable standard practiced under pressure.",
  completion_question: "Before the next sign-off, what phrase will you use to confirm the read-back?",
  arena_recommended: true,
  arena_rationale: "The read-back must hold when the unit is busy.",
  follow_up_days: 7,
  follow_up_guidance: "Ask whether the read-back was used and what made it difficult.",
  material_guidance: { recommended_types: ["written", "live_discussion"], suggestion: "A short checklist may help; the host supplies it." },
};

const EMPTY_CURRENT: ModuleDraftCurrent = { learningNeeds: [], completionPrompt: "", arenaRecommended: undefined, followUpDays: undefined };

function setup(over: Partial<Parameters<typeof ModuleDraftCopilot>[0]> = {}) {
  const onGenerate = vi.fn<() => Promise<ModuleDraftGenerateOutcome>>().mockResolvedValue({ ok: true, draft: VIEW, assumptions: ["Staff can hear each other."], warnings: ["May also need a workflow change."] });
  const onApply = vi.fn();
  const props = { ready: true, contextFingerprint: "fp1", current: EMPTY_CURRENT, onGenerate, onApply, t, ...over };
  const utils = render(<ModuleDraftCopilot {...props} />);
  // onApply is never overridden by tests → return the typed mock for .mock.calls access.
  return { onGenerate: props.onGenerate, onApply, props, ...utils };
}

async function toReview(over: Partial<Parameters<typeof ModuleDraftCopilot>[0]> = {}) {
  const s = setup(over);
  fireEvent.click(screen.getByTestId("module-draft-trigger"));
  await waitFor(() => screen.getByTestId("module-draft-review"));
  return s;
}

afterEach(cleanup);

describe("ModuleDraftCopilot", () => {
  it("renders nothing until the canonical minimum context is valid", () => {
    setup({ ready: false });
    expect(screen.queryByTestId("module-draft-copilot")).toBeNull();
  });

  it("shows an optional assistive entry when ready, without auto-generating", () => {
    const { onGenerate } = setup();
    const block = screen.getByTestId("module-draft-copilot");
    expect(block.textContent).toContain("Ready to draft the rest?");
    expect(block.textContent).toContain("Draft the rest of this training");
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("tap → loading → exactly one structured draft (all sections)", async () => {
    setup();
    fireEvent.click(screen.getByTestId("module-draft-trigger"));
    expect(screen.getByTestId("module-draft-loading")).toBeTruthy();
    await waitFor(() => screen.getByTestId("module-draft-review"));
    for (const s of ["learning", "completion", "arena", "follow"]) {
      expect(screen.getByTestId(`module-draft-section-${s}`)).toBeTruthy();
    }
    expect(screen.getByTestId("module-draft-material")).toBeTruthy();
    // advisory assumptions + warnings shown
    expect(screen.getByTestId("module-draft-assumptions")).toBeTruthy();
    expect(screen.getByTestId("module-draft-warnings")).toBeTruthy();
  });

  it("empty canonical fields default to Use suggestion; no mutation before Apply", async () => {
    const { onApply } = await toReview();
    for (const s of ["learning", "completion", "arena", "follow"]) {
      expect(screen.getByTestId(`module-draft-${s}-use`).getAttribute("aria-pressed")).toBe("true");
    }
    expect(onApply).not.toHaveBeenCalled();
  });

  it("existing Host values default to Keep current and display beside the suggestion", async () => {
    const current: ModuleDraftCurrent = { learningNeeds: ["know"], completionPrompt: "My own existing question about the handoff?", arenaRecommended: false, followUpDays: 30 };
    await toReview({ current });
    expect(screen.getByTestId("module-draft-completion-keep").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("module-draft-arena-keep").getAttribute("aria-pressed")).toBe("true");
    // both current and suggested are visible
    const completion = screen.getByTestId("module-draft-section-completion");
    expect(completion.textContent).toContain("My own existing question about the handoff?");
    expect(completion.textContent).toContain("what phrase will you use to confirm the read-back?");
  });

  it("Apply on an empty draft applies all four canonical fields (suggestion values)", async () => {
    const { onApply } = await toReview();
    fireEvent.click(screen.getByTestId("module-draft-apply"));
    expect(onApply).toHaveBeenCalledWith({
      learningNeeds: ["practice", "shared_standard"],
      completionPrompt: VIEW.completion_question,
      arenaRecommended: true,
      followUpDays: 7,
    });
    expect(screen.getByTestId("module-draft-applied")).toBeTruthy();
  });

  it("Host can edit the completion suggestion before applying", async () => {
    const { onApply } = await toReview();
    fireEvent.change(screen.getByTestId("module-draft-completion-edit"), { target: { value: "Edited: what exact sentence will you say?" } });
    fireEvent.click(screen.getByTestId("module-draft-apply"));
    expect(onApply.mock.calls[0][0].completionPrompt).toBe("Edited: what exact sentence will you say?");
  });

  it("Host can skip an advisory field (it is not applied)", async () => {
    const { onApply } = await toReview();
    fireEvent.click(screen.getByTestId("module-draft-follow-skip"));
    fireEvent.click(screen.getByTestId("module-draft-apply"));
    expect(onApply.mock.calls[0][0]).not.toHaveProperty("followUpDays");
  });

  it("Keep current protects an existing value; explicit Use replaces it", async () => {
    const current: ModuleDraftCurrent = { ...EMPTY_CURRENT, completionPrompt: "old question about the call?" };
    const { onApply } = await toReview({ current });
    // default keep → not applied
    fireEvent.click(screen.getByTestId("module-draft-apply"));
    expect(onApply.mock.calls[0][0]).not.toHaveProperty("completionPrompt");
    // switch to use → replaced
    cleanup();
    const s2 = await toReview({ current });
    fireEvent.click(screen.getByTestId("module-draft-completion-use"));
    fireEvent.click(screen.getByTestId("module-draft-apply"));
    expect(s2.onApply.mock.calls[0][0].completionPrompt).toBe(VIEW.completion_question);
  });

  it("stale source context blocks Apply and offers Regenerate", async () => {
    const { rerender, props, onApply } = await toReview();
    rerender(<ModuleDraftCopilot {...props} contextFingerprint="fp2-changed" />);
    expect(screen.getByTestId("module-draft-stale")).toBeTruthy();
    expect((screen.getByTestId("module-draft-apply") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("module-draft-apply"));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("failure preserves the manual path: Try again regenerates, Continue manually dismisses", async () => {
    const onGenerate = vi
      .fn<() => Promise<ModuleDraftGenerateOutcome>>()
      .mockResolvedValueOnce({ ok: false, code: "generic" })
      .mockResolvedValueOnce({ ok: true, draft: VIEW, assumptions: [], warnings: [] });
    setup({ onGenerate });
    fireEvent.click(screen.getByTestId("module-draft-trigger"));
    await waitFor(() => screen.getByTestId("module-draft-error"));
    fireEvent.click(screen.getByTestId("module-draft-retry"));
    await waitFor(() => screen.getByTestId("module-draft-review"));
    expect(onGenerate).toHaveBeenCalledTimes(2);
  });

  it("renders the Korean surface", () => {
    setup({ t: MODULE_BUILDER_COPY.ko.moduleDraft });
    expect(screen.getByTestId("module-draft-copilot").textContent).toContain("나머지 교육 초안 만들기");
  });
});

// Adaptive Clarification (Slice 2.4C) — the smallest pre-draft question gate.
describe("ModuleDraftCopilot — adaptive clarification", () => {
  it("a sufficient verdict skips straight to generation (zero questions)", async () => {
    const { onGenerate } = setup({ clarificationAssessment: SUFFICIENT });
    fireEvent.click(screen.getByTestId("module-draft-trigger"));
    await waitFor(() => screen.getByTestId("module-draft-review"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("module-draft-clarify")).toBeNull();
  });

  it("an insufficient verdict asks the named question first, without generating", () => {
    const { onGenerate } = setup({ clarificationAssessment: BEHAVIOR_Q, onClarificationAnswer: vi.fn() });
    fireEvent.click(screen.getByTestId("module-draft-trigger"));
    expect(screen.getByTestId("module-draft-clarify")).toBeTruthy();
    expect(screen.getByTestId("module-draft-clarify-question").textContent).toBe(t.clarification.questions.observable_behavior);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("a suggested choice is captured as a clarification answer (no canonical write)", () => {
    const onClarificationAnswer = vi.fn();
    const { onApply } = setup({ clarificationAssessment: EVIDENCE_Q, onClarificationAnswer });
    fireEvent.click(screen.getByTestId("module-draft-trigger"));
    fireEvent.click(screen.getByTestId("module-draft-clarify-choice-ev_recorded"));
    expect(onClarificationAnswer).toHaveBeenCalledWith({
      dimension: "success_evidence",
      choiceKey: "ev_recorded",
      text: t.clarification.choices.ev_recorded,
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("a custom answer is captured verbatim (trimmed)", () => {
    const onClarificationAnswer = vi.fn();
    setup({ clarificationAssessment: BEHAVIOR_Q, onClarificationAnswer });
    fireEvent.click(screen.getByTestId("module-draft-trigger"));
    fireEvent.change(screen.getByTestId("module-draft-clarify-custom"), { target: { value: "  Reads the dosage back  " } });
    fireEvent.click(screen.getByTestId("module-draft-clarify-submit"));
    expect(onClarificationAnswer).toHaveBeenCalledWith({
      dimension: "observable_behavior",
      choiceKey: null,
      text: "Reads the dosage back",
    });
  });

  it("Draft anyway respects Host authority — generates immediately, skipping remaining questions", async () => {
    const { onGenerate } = setup({ clarificationAssessment: BEHAVIOR_Q, onClarificationAnswer: vi.fn() });
    fireEvent.click(screen.getByTestId("module-draft-trigger"));
    fireEvent.click(screen.getByTestId("module-draft-clarify-skip"));
    await waitFor(() => screen.getByTestId("module-draft-review"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("when the verdict flips to sufficient mid-clarification, it proceeds to generate", async () => {
    const onGenerate = vi.fn<() => Promise<ModuleDraftGenerateOutcome>>().mockResolvedValue({ ok: true, draft: VIEW, assumptions: [], warnings: [] });
    const props = { ready: true, contextFingerprint: "fp1", current: EMPTY_CURRENT, onGenerate, onApply: vi.fn(), t, clarificationAssessment: BEHAVIOR_Q, onClarificationAnswer: vi.fn() };
    const { rerender } = render(<ModuleDraftCopilot {...props} />);
    fireEvent.click(screen.getByTestId("module-draft-trigger"));
    expect(screen.getByTestId("module-draft-clarify")).toBeTruthy();
    // Parent persists the answer and recomputes a now-sufficient verdict.
    rerender(<ModuleDraftCopilot {...props} clarificationAssessment={SUFFICIENT} />);
    await waitFor(() => screen.getByTestId("module-draft-review"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
