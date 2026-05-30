/** @vitest-environment jsdom */
/**
 * AssessmentClient — locks the 50/31 fix:
 *  - B: option auto-advance race guard (rapid double-click does NOT skip a question)
 *  - A: submit gated on all-answered (canSubmit), incomplete shows hint + disabled
 *  - C: 4xx surfaces submitError + blocks result push; 5xx keeps offline fallback push
 * Uses a 4-question fixture (total = questions.length, no 50 hardcode).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/en/assessment",
  useSearchParams: () => new URLSearchParams(),
}));

// HubTopNav is unrelated chrome whose subtree (LangSwitch, arena-entry/forced-reset
// hooks) fires its own navigation hooks + fetches; stub it so the test isolates the
// assessment flow and fetchMock only sees /api/assessment/submit.
vi.mock("@/components/bty/HubTopNav", () => ({ default: () => null }));

import AssessmentClient from "./AssessmentClient";

type Q = { id: number; dimension: "core" | "compassion" | "stability" | "growth" | "social"; text: string; reverse: boolean };
const QS: Q[] = [
  { id: 1, dimension: "core", text: "Q1", reverse: false },
  { id: 2, dimension: "compassion", text: "Q2", reverse: false },
  { id: 3, dimension: "stability", text: "Q3", reverse: false },
  { id: 4, dimension: "social", text: "Q4", reverse: false },
];

let fetchMock: ReturnType<typeof vi.fn>;
const store: Record<string, string> = {};

beforeEach(() => {
  pushMock.mockClear();
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal("sessionStorage", {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: vi.fn((k: string) => { delete store[k]; }),
    clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
  });
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, scores: {}, pattern: "x" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Click the "Agree" option for the currently shown question, then let auto-advance (280ms) run. */
async function answerAndAdvance() {
  fireEvent.click(screen.getByRole("button", { name: "Agree" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}

describe("AssessmentClient", () => {
  it("submits all answers and routes to result on full completion", async () => {
    render(<AssessmentClient questions={QS} locale="en" />);

    await answerAndAdvance(); // Q1 -> Q2
    await answerAndAdvance(); // Q2 -> Q3
    await answerAndAdvance(); // Q3 -> Q4
    fireEvent.click(screen.getByRole("button", { name: "Agree" })); // Q4 (last, no auto-advance)

    const submit = screen.getByRole("button", { name: "See result" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/assessment/submit",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body.answers).length).toBe(QS.length);
    expect(pushMock).toHaveBeenCalledWith("/en/assessment/result");
  });

  it("rapid double-click does not skip a question (auto-advance race guard)", async () => {
    render(<AssessmentClient questions={QS} locale="en" />);

    // Two clicks within the 280ms window — guard must collapse to a single +1.
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.getByText("Q2")).toBeTruthy();   // advanced exactly one
    expect(screen.queryByText("Q3")).toBeNull();   // NOT skipped to Q3
  });

  it("disables submit and shows a hint until every question is answered", async () => {
    render(<AssessmentClient questions={QS} locale="en" />);

    await answerAndAdvance(); // Q1 -> Q2
    await answerAndAdvance(); // Q2 -> Q3
    await answerAndAdvance(); // Q3 -> Q4 (Q4 left unanswered)

    expect(screen.getByText("Q4")).toBeTruthy();
    const submit = screen.getByRole("button", { name: "See result" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText(/3\/4 answered/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a 4xx validation error and does NOT route to result", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "answers_count_mismatch: expected 50, got 4" }),
    });
    render(<AssessmentClient questions={QS} locale="en" />);

    await answerAndAdvance();
    await answerAndAdvance();
    await answerAndAdvance();
    fireEvent.click(screen.getByRole("button", { name: "Agree" })); // Q4

    fireEvent.click(screen.getByRole("button", { name: "See result" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("keeps the offline fallback push on a 5xx (no error surfaced)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<AssessmentClient questions={QS} locale="en" />);

    await answerAndAdvance();
    await answerAndAdvance();
    await answerAndAdvance();
    fireEvent.click(screen.getByRole("button", { name: "Agree" })); // Q4

    fireEvent.click(screen.getByRole("button", { name: "See result" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/en/assessment/result"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
