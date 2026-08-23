/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { copyLikeLearnerQuestions } from "@/domain/foundry/module/learnerQuestionRole";
import { BUILDER_QUESTION_STEP, BUILDER_STEP_MAX } from "@/domain/foundry/module/module-builder";
import { MODULE_BUILDER_COPY } from "./moduleBuilderCopy";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

/**
 * SLICE R4-R5C12A — T16/T17: the advisory has to reach the field, and must never block Publish.
 *
 * Two kinds of assertion, deliberately. The harness proves the OBSERVABLE transition — a tap
 * moves the Host to the step the question lives on and the field is on screen. The source
 * assertions prove the shipped shell is wired that way, because a harness that reproduces the
 * intended wiring proves the intention and not the product (the exact trap R4-R7A-R2 fell into,
 * where the shipped control was a styled span).
 */

const SHELL = join(process.cwd(), "src/components/foundry/event-rooms/ModuleBuilderShell.tsx");
const shellSrc = readFileSync(SHELL, "utf8");
/** Comments say what a file MEANS; these assertions are about what it DOES. */
const shellCode = shellSrc
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const STANDARD = "Employees make a confirmation call and follow a checklist of required questions and information to convey.";
const COPY_LIKE = "Describe how you will use the checklist to ensure your confirmation calls include all required questions and information.";
const A = (o: Partial<BuilderAnswers>) => o as BuilderAnswers;

/** The shipped wiring: Review shows the advisory; its action is `jumpTo(BUILDER_QUESTION_STEP)`. */
function ReviewHarness({ answers }: { answers: BuilderAnswers }) {
  const t = MODULE_BUILDER_COPY.en;
  const [step, setStep] = useState(BUILDER_STEP_MAX);
  const flagged = copyLikeLearnerQuestions(answers);
  if (step === BUILDER_QUESTION_STEP) {
    return (
      <textarea
        data-testid="builder-completion-field"
        aria-label={t.s6CompletionQ}
        defaultValue={answers.completionPrompt ?? ""}
      />
    );
  }
  return (
    <div>
      {flagged.length > 0 ? (
        <div data-testid="question-copy-advisory">
          <p>{t.questionCopyLike}</p>
          <button type="button" data-testid="question-copy-advisory-edit" onClick={() => setStep(BUILDER_QUESTION_STEP)}>
            {t.questionCopyLikeCta} →
          </button>
        </div>
      ) : null}
      <button type="button" data-testid="publish-cta" disabled={false}>
        {t.publishCta}
      </button>
    </div>
  );
}

afterEach(cleanup);

describe("[R4-R5C12A · T16] the advisory action reaches the existing field", () => {
  it("shows the advisory for a copy-like completion question", () => {
    render(<ReviewHarness answers={A({ observableBehavior: STANDARD, completionPrompt: COPY_LIKE })} />);
    const advisory = screen.getByTestId("question-copy-advisory");
    expect(advisory.textContent).toContain("repeating the training above");
  });

  it("T16 tapping Edit question lands on the step the question is authored on", () => {
    render(<ReviewHarness answers={A({ observableBehavior: STANDARD, completionPrompt: COPY_LIKE })} />);
    fireEvent.click(screen.getByTestId("question-copy-advisory-edit"));
    const field = screen.getByTestId("builder-completion-field") as HTMLTextAreaElement;
    expect(field).toBeTruthy();
    // The Host's own words, unchanged — the action opens the field, it does not replace anything.
    expect(field.value).toBe(COPY_LIKE);
  });

  it("stays silent for a healthy question", () => {
    render(
      <ReviewHarness
        answers={A({ observableBehavior: STANDARD, completionPrompt: "What will you do differently the next time this happens?" })}
      />,
    );
    expect(screen.queryByTestId("question-copy-advisory")).toBeNull();
  });
});

describe("[R4-R5C12A · T17] Publish is not blocked by the advisory", () => {
  it("the CTA stays enabled while the advisory is showing", () => {
    render(<ReviewHarness answers={A({ observableBehavior: STANDARD, completionPrompt: COPY_LIKE })} />);
    expect(screen.getByTestId("question-copy-advisory")).toBeTruthy();
    expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(false);
  });

  it("T17 the shipped readiness gate does not read the advisory", () => {
    const notReady = shellCode.match(/const notReady = [^;]+;/)?.[0];
    expect(notReady, "PublishAction still computes a readiness gate").toBeTruthy();
    expect(notReady).not.toMatch(/copyLike/i);
    // And it is not smuggled in through the missing-sections list either.
    const missingSections = shellCode.match(/function reviewMissingSections[\s\S]*?\n}/)?.[0] ?? "";
    expect(missingSections).not.toMatch(/copyLike/i);
  });
});

describe("[R4-R5C12A] the shipped shell renders the advisory, not just the harness", () => {
  it("PublishAction renders the advisory block with a real button", () => {
    expect(shellCode).toContain('data-testid="question-copy-advisory"');
    expect(shellCode).toMatch(/<button[\s\S]{0,400}data-testid="question-copy-advisory-edit"/);
    expect(shellCode).toMatch(/onClick=\{\(\) => onEdit\(BUILDER_QUESTION_STEP\)\}/);
  });

  it("the advisory is computed from the domain selector, not re-derived in the UI", () => {
    expect(shellCode).toContain("copyLikeLearnerQuestions(answers)");
    // No thresholds, stems or overlap arithmetic in the render layer.
    expect(shellCode).not.toMatch(/overlapRatio/);
  });

  it("both languages carry the advisory copy", () => {
    for (const loc of ["en", "ko"] as const) {
      expect(MODULE_BUILDER_COPY[loc].questionCopyLike.length, loc).toBeGreaterThan(20);
      expect(MODULE_BUILDER_COPY[loc].questionCopyLikeCta.length, loc).toBeGreaterThan(1);
    }
  });
});
