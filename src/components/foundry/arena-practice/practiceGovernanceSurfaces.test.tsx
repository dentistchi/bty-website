/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { PracticeGovernancePanel } from "./PracticeGovernancePanel";
import { RetryConfirmation } from "./RetryConfirmation";
import { ReviewSetupPanel } from "./ReviewSetupPanel";
import { resolveHardestWhenOptions, showsCustomText } from "./guidedQuestionOptions";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";
import { HARDEST_WHEN_OPTIONS } from "@/domain/foundry/arena-draft/types";
import type { Governance } from "./practiceGovernance";

/**
 * THE RENDERED HOST SURFACES (Slice 3.2I-R5B2-R5C-4B-R1).
 *
 * The previous session proved the CONTRACTS and shipped no screen, so a Host still saw nothing.
 * These tests render the real component tree and hold what a Host can actually see and press.
 */

const copyFor = (l: "en" | "ko") => ARENA_PRACTICE_COPY[l];
const en = copyFor("en");
const g = (over: Partial<Governance>): Governance => ({
  generationInputRevision: 1,
  generationLocale: "en",
  refusalCount: 0,
  state: "ready",
  canStartGeneration: true,
  requiresExplicitConfirmation: false,
  reviewSetupRecommended: false,
  ...over,
});

const panel = (governance: Governance | null, over: Partial<Parameters<typeof PracticeGovernancePanel>[0]> = {}) =>
  render(
    <PracticeGovernancePanel
      governance={governance}
      copy={en.governance}
      onReviewSetup={vi.fn()}
      onTryOnceMore={vi.fn()}
      {...over}
    />,
  );

afterEach(cleanup);

describe("[R5C-4B-R1] the panel renders the SERVER's state", () => {
  it("READY shows no panel at all — no warning about a refusal that never happened", () => {
    panel(g({}));
    expect(screen.queryByTestId("practice-governance-panel")).toBeNull();
  });

  it("CONFIRM_SECOND_ATTEMPT offers Review setup AND Try once more", () => {
    panel(g({ state: "confirm_second_attempt", refusalCount: 1, canStartGeneration: false, requiresExplicitConfirmation: true }));
    const p = screen.getByTestId("practice-governance-panel");
    expect(p.dataset.governanceState).toBe("confirm_second_attempt");
    expect(screen.getByTestId("governance-review-setup")).toBeTruthy();
    expect(screen.getByTestId("governance-try-once-more")).toBeTruthy();
  });

  it("REVISION_REQUIRED has NO retry control anywhere in the tree", () => {
    panel(g({ state: "revision_required", refusalCount: 2, canStartGeneration: false }));
    // Absent, not disabled: a disabled control still reads as "there is a way through here".
    expect(screen.queryByTestId("governance-try-once-more")).toBeNull();
    expect(screen.getByTestId("governance-review-setup")).toBeTruthy();
    expect(screen.getByText(en.governance.revisionRequiredTitle)).toBeTruthy();
  });

  it("IN_PROGRESS offers nothing to press and does not claim leaving cancels it", () => {
    panel(g({ state: "in_progress", canStartGeneration: false }));
    expect(screen.queryByTestId("governance-try-once-more")).toBeNull();
    expect(screen.queryByTestId("governance-review-setup")).toBeNull();
    expect(screen.getByText(en.governance.inProgressBody)).toBeTruthy();
  });

  it("MISSING governance fails closed rather than reading as ready", () => {
    panel(null);
    const p = screen.getByTestId("practice-governance-panel");
    expect(p).toBeTruthy();
    expect(screen.queryByTestId("governance-try-once-more")).toBeNull();
  });

  it("never exposes an identifier, a code or a provider detail", () => {
    panel(g({ state: "revision_required", refusalCount: 2, canStartGeneration: false }));
    const text = screen.getByTestId("practice-governance-panel").textContent ?? "";
    for (const forbidden of ["generation_input_revision", "refusalCount", "boundary_review_rejected", "attempt", "provider", "uuid", "$"]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("does not communicate state by colour alone", () => {
    panel(g({ state: "revision_required", refusalCount: 2, canStartGeneration: false }));
    // A heading and a non-colour glyph both carry the meaning.
    expect(screen.getByRole("heading", { level: 3 })).toBeTruthy();
    expect(screen.getByTestId("practice-governance-panel").textContent).toContain(en.governance.revisionRequiredTitle);
  });

  it("announces politely so it cannot interrupt typing", () => {
    panel(g({ state: "in_progress", canStartGeneration: false }));
    expect(screen.getByTestId("practice-governance-panel").getAttribute("aria-live")).toBe("polite");
  });
});

describe("[R5C-4B-R1] the retry confirmation never submits by opening", () => {
  const confirm = (over: Partial<Parameters<typeof RetryConfirmation>[0]> = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onReviewSetup = vi.fn();
    render(
      <RetryConfirmation open copy={en.retryConfirm} submitting={false} onConfirm={onConfirm} onCancel={onCancel} onReviewSetup={onReviewSetup} {...over} />,
    );
    return { onConfirm, onCancel, onReviewSetup };
  };

  it("is closed when not open", () => {
    render(<RetryConfirmation open={false} copy={en.retryConfirm} submitting={false} onConfirm={vi.fn()} onCancel={vi.fn()} onReviewSetup={vi.fn()} />);
    expect(screen.queryByTestId("retry-confirmation")).toBeNull();
  });

  it("opening sends nothing — only the explicit action can spend", () => {
    const { onConfirm } = confirm();
    expect(screen.getByTestId("retry-confirmation")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("states plainly that the result may still be refused", () => {
    confirm();
    expect(screen.getByText(en.retryConfirm.mayStillFailLine)).toBeTruthy();
    expect(screen.getByText(en.retryConfirm.unchangedLine)).toBeTruthy();
  });

  it("Review setup is offered inside the confirmation", () => {
    const { onReviewSetup, onConfirm } = confirm();
    fireEvent.click(screen.getByTestId("retry-confirm-review"));
    expect(onReviewSetup).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Cancel and Escape close WITHOUT submitting", () => {
    const { onCancel, onConfirm } = confirm();
    fireEvent.click(screen.getByTestId("retry-confirm-cancel"));
    fireEvent.keyDown(screen.getByTestId("retry-confirmation").parentElement!, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("the explicit action confirms exactly once, and is blocked while submitting", () => {
    const { onConfirm } = confirm();
    fireEvent.click(screen.getByTestId("retry-confirm-submit"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    cleanup();
    const second = confirm({ submitting: true });
    fireEvent.click(screen.getByTestId("retry-confirm-submit"));
    expect(second.onConfirm).not.toHaveBeenCalled();
  });

  it("is a labelled modal dialog and takes focus", () => {
    confirm();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("retry-confirm-title");
    expect(document.activeElement?.id).toBe("retry-confirm-title");
  });
});

describe("[R5C-4B-R1] Review setup edits the real answers", () => {
  const CURRENT = { hardestWhen: { choice: "authority_unclear" as const }, avoidancePressure: { text: "nobody owns the call" } };
  const setup = (over: Partial<Parameters<typeof ReviewSetupPanel>[0]> = {}) => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <ReviewSetupPanel
        copy={{ ...en.reviewSetup, otherPlaceholder: en.otherPlaceholder, hardestWhen: en.hardestWhen }}
        current={CURRENT}
        sourceOptions={HARDEST_WHEN_OPTIONS}
        saving={false}
        errorText={null}
        onSave={onSave}
        onCancel={onCancel}
        boundarySection={<div data-testid="boundary-editor-slot" />}
        {...over}
      />,
    );
    return { onSave, onCancel };
  };

  it("shows the CURRENT choice as selected, in product language", () => {
    setup();
    const chosen = screen.getByTestId("review-setup-choice-authority_unclear");
    expect(chosen.getAttribute("aria-checked")).toBe("true");
    // The label, never the raw domain code.
    expect(chosen.textContent).toBe(en.hardestWhen.authority_unclear);
  });

  it("renders the existing boundary editor rather than a second boundary model", () => {
    setup();
    expect(screen.getByTestId("review-setup-boundary")).toBeTruthy();
    expect(within(screen.getByTestId("review-setup-boundary")).getByTestId("boundary-editor-slot")).toBeTruthy();
  });

  it("Save is DISABLED with no semantic change", () => {
    setup();
    expect((screen.getByTestId("review-setup-save") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("review-setup-unsaved")).toBeNull();
  });

  it("a real change enables Save and marks the edit unsaved", () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByTestId("review-setup-choice-time_limited"));
    expect(screen.getByTestId("review-setup-unsaved")).toBeTruthy();
    const save = screen.getByTestId("review-setup-save") as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({ hardestWhen: { choice: "time_limited" }, avoidancePressure: CURRENT.avoidancePressure });
  });

  it("a whitespace-only edit leaves Save disabled — the server would write nothing", () => {
    setup();
    const areas = screen.getAllByRole("textbox");
    fireEvent.change(areas[areas.length - 1], { target: { value: "  nobody   owns the call  " } });
    expect((screen.getByTestId("review-setup-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("the free-text field appears ONLY under the choice generation reads it for", () => {
    setup();
    const before = screen.getAllByRole("textbox").length;
    fireEvent.click(screen.getByTestId("review-setup-choice-other"));
    expect(screen.getAllByRole("textbox").length).toBe(before + 1);
    expect(showsCustomText("other")).toBe(true);
    expect(showsCustomText("time_limited")).toBe(false);
  });

  it("`other` with no text cannot be saved", () => {
    setup();
    fireEvent.click(screen.getByTestId("review-setup-choice-other"));
    expect((screen.getByTestId("review-setup-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Cancel reports the discard without saving", () => {
    const { onCancel, onSave } = setup();
    fireEvent.click(screen.getByTestId("review-setup-choice-time_limited"));
    fireEvent.click(screen.getByTestId("review-setup-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("says plainly that saving does not create a situation", () => {
    setup();
    expect(screen.getByText(en.reviewSetup.noGenerationNote)).toBeTruthy();
  });

  it("groups the choices and labels every control", () => {
    setup();
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(en.reviewSetup.heading);
    for (const box of screen.getAllByRole("textbox")) expect(box.getAttribute("placeholder")).toBeTruthy();
  });
});

describe("[R5C-4B-R1] one vocabulary, shared with creation", () => {
  it("Review setup offers exactly the domain options, never a second list", () => {
    expect(resolveHardestWhenOptions(HARDEST_WHEN_OPTIONS)).toEqual([...HARDEST_WHEN_OPTIONS]);
  });

  it("an unknown source option is dropped rather than rendered", () => {
    // Storing it would fail server validation on save, after the Host had already chosen it.
    expect(resolveHardestWhenOptions(["time_limited", "not_a_real_option"])).toEqual(["time_limited"]);
  });

  it("an empty source falls back to the full vocabulary rather than rendering nothing", () => {
    expect(resolveHardestWhenOptions([])).toEqual([...HARDEST_WHEN_OPTIONS]);
    expect(resolveHardestWhenOptions(null)).toEqual([...HARDEST_WHEN_OPTIONS]);
  });

  it.each(["en", "ko"] as const)("%s copy covers every option and every governance state", (loc) => {
    const c = copyFor(loc);
    for (const opt of HARDEST_WHEN_OPTIONS) expect(c.hardestWhen[opt]?.length ?? 0).toBeGreaterThan(0);
    for (const k of ["confirmTitle", "revisionRequiredTitle", "inProgressTitle", "unavailableTitle", "reviewSetupCta", "tryOnceMoreCta"] as const) {
      expect(c.governance[k].length, `${loc}.${k}`).toBeGreaterThan(0);
    }
  });

  it("no Host-facing string leaks implementation vocabulary", () => {
    for (const loc of ["en", "ko"] as const) {
      const blob = JSON.stringify(copyFor(loc).governance) + JSON.stringify(copyFor(loc).retryConfirm) + JSON.stringify(copyFor(loc).reviewSetup);
      for (const forbidden of ["generation_input_revision", "refusalCount", "atomic", "terminal", "provider", "revision_required"]) {
        expect(blob.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });
});
