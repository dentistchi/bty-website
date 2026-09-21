/** @vitest-environment jsdom */
/**
 * Quick Training authoring form — what the manager can actually see and do.
 *
 * Three claims, each of which was false before this slice:
 *   - Text is offered as a material, beside Video and PDF.
 *   - Choosing "Add quiz" REMOVES the completion question rather than adding a second check.
 *   - Manual, CSV and AI all land in the SAME editor, and none of them publishes on its own.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { CreateFoundryEventForm } from "./CreateFoundryEventForm";
import { EVENT_ROOMS_COPY } from "./copy";

const en = EVENT_ROOMS_COPY.en;

function renderForm() {
  const onCreated = vi.fn();
  render(<CreateFoundryEventForm locale="en" onCreated={onCreated} onCancel={vi.fn()} />);
  return { onCreated };
}

const CSV = [
  "question,option_a,option_b,option_c,option_d,correct_option,explanation",
  "When do you escalate?,Immediately,After the shift,,,a,Escalate at once.",
].join("\n");

/** A file whose `.text()` resolves — jsdom's File does not implement it in every version. */
function csvFile(text: string): File {
  const file = new File([text], "quiz.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  return file;
}

afterEach(() => cleanup());

describe("the three materials", () => {
  it("offers Video, PDF and Text", () => {
    renderForm();
    expect(screen.getByTestId("material-video")).toBeTruthy();
    expect(screen.getByTestId("material-pdf")).toBeTruthy();
    expect(screen.getByTestId("material-text")).toBeTruthy();
  });

  it("Text asks for the text itself and, with no quiz, a completion question", () => {
    renderForm();
    fireEvent.click(screen.getByTestId("material-text"));
    expect(screen.getByTestId("material-text-input")).toBeTruthy();
    expect(screen.getByLabelText(en.textPromptLabel)).toBeTruthy();
  });
});

describe("quiz optionality — the two states are named, and each says what it does", () => {
  it("defaults to No quiz, keeping the completion question", () => {
    renderForm();
    expect(screen.getByTestId("quiz-none").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText(en.promptLabel)).toBeTruthy();
    expect(screen.getByTestId("quiz-mode-note").textContent).toBe(en.quizNoneNote);
    expect(screen.queryByTestId("quiz-editor")).toBeNull();
  });

  it("Add quiz HIDES the completion question and opens the editor", () => {
    renderForm();
    fireEvent.click(screen.getByTestId("quiz-add"));
    expect(screen.queryByLabelText(en.promptLabel)).toBeNull();
    expect(screen.getByTestId("quiz-mode-note").textContent).toBe(en.quizAddNote);
    expect(screen.getByTestId("quiz-editor")).toBeTruthy();
  });

  it("hides the PDF and Text completion questions too", () => {
    renderForm();
    fireEvent.click(screen.getByTestId("quiz-add"));
    fireEvent.click(screen.getByTestId("material-pdf"));
    expect(screen.queryByLabelText(en.docPromptLabel)).toBeNull();
    fireEvent.click(screen.getByTestId("material-text"));
    expect(screen.queryByLabelText(en.textPromptLabel)).toBeNull();
  });
});

describe("all three methods land in the ONE editor", () => {
  it("Manual: an empty editor the manager fills in, with add/remove", () => {
    renderForm();
    fireEvent.click(screen.getByTestId("quiz-add"));
    fireEvent.click(screen.getByTestId("quiz-method-manual"));
    expect(screen.getAllByTestId("quiz-editor-question")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("quiz-editor-add-question"));
    expect(screen.getAllByTestId("quiz-editor-question")).toHaveLength(2);
    fireEvent.click(screen.getAllByText(en.quizRemoveQuestion)[0]!);
    expect(screen.getAllByTestId("quiz-editor-question")).toHaveLength(1);
  });

  it("CSV: an import POPULATES the editor and publishes nothing", async () => {
    renderForm();
    fireEvent.click(screen.getByTestId("quiz-add"));
    fireEvent.click(screen.getByTestId("quiz-method-csv"));
    fireEvent.change(screen.getByTestId("quiz-csv-input"), { target: { files: [csvFile(CSV)] } });

    await waitFor(() => expect(screen.getByTestId("quiz-message").textContent).toBe(en.quizCsvLoaded(1)));
    const question = screen.getAllByTestId("quiz-editor-question")[0]!;
    expect(within(question).getByDisplayValue("When do you escalate?")).toBeTruthy();
    expect(within(question).getByDisplayValue("Immediately")).toBeTruthy();
    expect(within(question).getByDisplayValue("Escalate at once.")).toBeTruthy();
  });

  it("AI: the box is SOURCE MATERIAL, and the generated draft lands in the editor", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        quiz: {
          schemaVersion: 1,
          questions: [
            {
              id: "q1",
              text: "What is the reporting window?",
              position: 1,
              choices: [
                { id: "a", label: "24 hours" },
                { id: "b", label: "7 days" },
              ],
              correctChoiceId: "a",
              sourceEvidence: "within 24 hours",
            },
          ],
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderForm();
    fireEvent.click(screen.getByTestId("quiz-add"));
    fireEvent.click(screen.getByTestId("quiz-method-generate"));

    // The label and the note say what the box is for: study content, not a question.
    expect(screen.getByText(en.quizSourceLabel)).toBeTruthy();
    expect(screen.getByTestId("quiz-source-note").textContent).toBe(en.quizSourceNote);

    fireEvent.change(screen.getByTestId("quiz-source-input"), {
      target: { value: "Incidents must be reported within 24 hours." },
    });
    fireEvent.click(screen.getByTestId("quiz-generate"));

    await waitFor(() =>
      expect(screen.getAllByTestId("quiz-editor-question")[0]!.querySelector("input")).toBeTruthy(),
    );
    await waitFor(() => expect(screen.getByDisplayValue("What is the reporting window?")).toBeTruthy());

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/bty/foundry/quiz/generate");
    expect(JSON.parse(String(init.body))).toMatchObject({
      sourceText: "Incidents must be reported within 24 hours.",
      questionCount: 5,
      locale: "en",
    });
    vi.unstubAllGlobals();
  });
});

describe("an unfinished quiz is refused in the browser, before any training is created", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("names the problem and sends nothing", () => {
    const { onCreated } = renderForm();
    fireEvent.change(screen.getByLabelText(en.nameLabel), { target: { value: "Incident reporting" } });
    fireEvent.change(screen.getByLabelText(en.youtubeLabel), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    fireEvent.click(screen.getByTestId("quiz-add"));
    fireEvent.click(screen.getByText(en.create));

    expect(screen.getByTestId("quiz-message").textContent).toBe(en.quizIncompleteError);
    expect(screen.getAllByTestId("quiz-editor-question-error").length).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
