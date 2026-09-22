/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { FoundryTrainingDetail } from "./FoundryTrainingDetail";

/**
 * Slice My Learning — Canonical Training History V1: PROGRESSIVE DISCLOSURE.
 *
 * A learner with a hundred completed trainings must open a calm screen. These assert that each
 * level shows only what that level is for, and that nothing about a quiz appears before it is
 * explicitly asked for.
 */

const MISSED = {
  ok: true,
  title: "Morning Office Opening",
  completedAt: "2026-09-22T10:00:00Z",
  content: { materialText: "Open the back door first." },
  hasReflection: true,
  quiz: {
    correctCount: 4,
    totalCount: 5,
    scorePercent: 80,
    questions: [
      { id: "q1", text: "Who opens?", choices: [{ id: "a", label: "The lead" }], selectedChoiceId: "a", correctChoiceId: "a", explanation: null },
      { id: "q2", text: "Who unlocks the back door?", choices: [{ id: "a", label: "First person in" }, { id: "b", label: "The opening lead" }], selectedChoiceId: "a", correctChoiceId: "b", explanation: "The opening lead carries the key." },
    ],
  },
};
const PERFECT = {
  ...MISSED,
  quiz: { ...MISSED.quiz, correctCount: 5, scorePercent: 100, questions: [MISSED.quiz.questions[0]] },
};

function mock(payload: unknown) {
  // @ts-expect-error test shim
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }));
}
const render2 = () =>
  render(<FoundryTrainingDetail entryId="e1" locale="en" onBack={() => {}} reflectionHref="/en/app?tab=center&entry=e1" />);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LEVEL 2 — detail shows sections, never quiz content", () => {
  it("shows title and date, and no question text at all", async () => {
    mock(MISSED);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-title")).toBeTruthy());
    const body = screen.getByTestId("training-detail").textContent ?? "";
    expect(body).not.toContain("Who unlocks the back door?");
    expect(body).not.toContain("First person in");
    expect(body).not.toContain("The opening lead carries the key.");
  });

  it("prints the score ONCE, under the row it labels", async () => {
    mock(MISSED);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-quiz")).toBeTruthy());
    expect(screen.getByTestId("training-detail-quiz").textContent).toContain("4 / 5 · 80%");
    // No second copy at the top of the screen.
    expect(screen.queryByTestId("training-detail-score")).toBeNull();
  });

  it("does NOT expand the training text until it is asked for", async () => {
    mock(MISSED);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-material")).toBeTruthy());
    expect(screen.queryByTestId("training-material-text")).toBeNull();
    fireEvent.click(screen.getByTestId("training-detail-material"));
    expect((await screen.findByTestId("training-material-text")).textContent)
      .toBe("Open the back door first.");
  });

  it("says how many items are worth reviewing, without naming them", async () => {
    mock(MISSED);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-quiz")).toBeTruthy());
    expect(screen.getByTestId("training-detail-quiz").textContent).toContain("1 item to review");
  });

  it("offers the reflection as a real in-shell anchor, and never its text", async () => {
    mock(MISSED);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-reflection")).toBeTruthy());
    const row = screen.getByTestId("training-detail-reflection");
    expect(row.tagName).toBe("A");
    expect(row.getAttribute("href")).toBe("/en/app?tab=center&entry=e1");
  });
});

describe("LEVEL 3 — the question list is ticks and flags", () => {
  it("opens only when asked, and shows no answers", async () => {
    mock(MISSED);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-quiz")).toBeTruthy());
    expect(screen.queryByTestId("training-quiz-review")).toBeNull();

    fireEvent.click(screen.getByTestId("training-detail-quiz"));
    await waitFor(() => expect(screen.getByTestId("training-quiz-review")).toBeTruthy());
    const body = screen.getByTestId("training-quiz-review").textContent ?? "";
    expect(body).toContain("Question 1");
    expect(body).toContain("Question 2");
    expect(body).not.toContain("Who unlocks the back door?");
    expect(body).not.toContain("The opening lead carries the key.");
    expect(screen.getAllByTestId("quiz-review-flag")).toHaveLength(1);
  });
});

describe("LEVEL 4 — one question, the only place answers appear", () => {
  it("shows the question, their answer, the correct answer and the explanation", async () => {
    mock(MISSED);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-quiz")).toBeTruthy());
    fireEvent.click(screen.getByTestId("training-detail-quiz"));
    fireEvent.click(await screen.findByTestId("quiz-review-row-q2"));
    const body = (await screen.findByTestId("training-question-detail")).textContent ?? "";
    expect(body).toContain("Who unlocks the back door?");
    expect(body).toContain("First person in");
    expect(body).toContain("The opening lead");
    expect(screen.getByTestId("question-detail-explanation").textContent).toBe("The opening lead carries the key.");
  });

  it("goes back up one level at a time", async () => {
    mock(MISSED);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-quiz")).toBeTruthy());
    fireEvent.click(screen.getByTestId("training-detail-quiz"));
    fireEvent.click(await screen.findByTestId("quiz-review-row-q2"));
    fireEvent.click(await screen.findByTestId("question-detail-back"));
    await waitFor(() => expect(screen.getByTestId("training-quiz-review")).toBeTruthy());
    fireEvent.click(screen.getByTestId("quiz-review-back"));
    await waitFor(() => expect(screen.getByTestId("training-detail")).toBeTruthy());
  });
});

describe("the follow-up loop survives the list simplification", () => {
  /*
    `canCheckInAgain` is about a SETTLED obligation and the domain says it belongs to My Learning —
    Today shows only PENDING ones. When the list stopped rendering it, this became the learner's
    only door back to a NOT_YET they have since acted on.
  */
  it("offers Check in again, and opens THAT follow-up", async () => {
    const onOpenFollowUp = vi.fn();
    mock({ ...MISSED, checkInAgain: [{ followupId: "f7", followUpDays: 7, outcome: "NOT_YET" }] });
    render(
      <FoundryTrainingDetail entryId="e1" locale="en" onBack={() => {}} reflectionHref="/en/app?tab=center&entry=e1" onOpenFollowUp={onOpenFollowUp} />,
    );
    const row = await screen.findByTestId("training-detail-check-in-again");
    expect(row.textContent).toContain("Check in again");
    fireEvent.click(row);
    expect(onOpenFollowUp).toHaveBeenCalledWith("f7");
  });

  it("offers an unanswered follow-up whose checkpoint has arrived", async () => {
    const onOpenFollowUp = vi.fn();
    mock({ ...MISSED, openFollowUp: [{ followupId: "f30", followUpDays: 30 }] });
    render(
      <FoundryTrainingDetail entryId="e1" locale="en" onBack={() => {}} reflectionHref="/x" onOpenFollowUp={onOpenFollowUp} />,
    );
    fireEvent.click(await screen.findByTestId("training-detail-open-follow-up"));
    expect(onOpenFollowUp).toHaveBeenCalledWith("f30");
  });

  it("shows no follow-up row when there is none open", async () => {
    mock(MISSED);
    render(
      <FoundryTrainingDetail entryId="e1" locale="en" onBack={() => {}} reflectionHref="/x" onOpenFollowUp={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId("training-detail")).toBeTruthy());
    expect(screen.queryByTestId("training-detail-check-in-again")).toBeNull();
    expect(screen.queryByTestId("training-detail-open-follow-up")).toBeNull();
  });
});

describe("the honest states", () => {
  it("5/5 shows the score and invents no review", async () => {
    mock(PERFECT);
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail-quiz")).toBeTruthy());
    const sub = screen.getByTestId("training-detail-quiz").textContent ?? "";
    expect(sub).toContain("5 / 5 · 100%");
    expect(sub).not.toContain("to review");
    fireEvent.click(screen.getByTestId("training-detail-quiz"));
    await waitFor(() => expect(screen.getByTestId("training-quiz-review")).toBeTruthy());
    expect(screen.queryByTestId("quiz-review-flag")).toBeNull();
  });

  it("a training with no quiz shows no quiz section rather than an empty 0 / 0", async () => {
    mock({ ...MISSED, quiz: null });
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail")).toBeTruthy());
    expect(screen.queryByTestId("training-detail-quiz")).toBeNull();
    expect(screen.queryByTestId("training-detail-score")).toBeNull();
  });

  it("shows NO reflection section when the training never produced one", async () => {
    /*
      The device finding this pins: a quiz-backed training has no reflection step, so a row
      reading "you didn't write a reflection" reported a gap that never existed.
    */
    mock({ ...MISSED, hasReflection: false });
    render2();
    await waitFor(() => expect(screen.getByTestId("training-detail")).toBeTruthy());
    expect(screen.queryByTestId("training-detail-reflection")).toBeNull();
    expect(screen.getByTestId("training-detail").textContent ?? "").not.toContain("reflection");
  });
});
