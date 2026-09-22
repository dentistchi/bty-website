/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { FoundryQuizResults } from "./FoundryQuizResults";
import { EVENT_ROOMS_COPY } from "./copy";

/**
 * Slice Training Result → Human Teams Chat V1.
 *
 * A score is the way IN, not the destination: the row must be a control, the detail must name the
 * missed item and the answer the learner actually chose, and the CTA must open a chat the HOST
 * sends — never auto-send, and never appear for a learner who has no Teams coordinate.
 */

const openDirectChat = vi.hoisted(() => vi.fn(async () => ({ k: "opened" as const })));
vi.mock("@/lib/bty/teams/openDirectChat", () => ({ openDirectChat }));

const t = EVENT_ROOMS_COPY.en;
const participants = [{ id: "p1", display_name: "Ann" }];

const ROSTER = {
  submitted: 1,
  averageScore: 80,
  byParticipant: { p1: { correctCount: 4, totalCount: 5 } },
};

const DETAIL = {
  displayName: "Ann",
  correctCount: 4,
  totalCount: 5,
  scorePercent: 80,
  trainingTitle: "Morning Office Opening",
  canMessageInTeams: true,
  missed: [
    {
      questionId: "q2",
      text: "Who unlocks the back door?",
      selectedLabel: "The first person in",
      correctLabel: "The opening lead",
      explanation: "The opening lead carries the key.",
    },
  ],
};

function mockApi(overrides: { detail?: unknown; followUp?: unknown; followUpOk?: boolean } = {}) {
  return vi.fn(async (url: string, init?: { method?: string }) => {
    const u = String(url);
    if (init?.method === "POST" && u.includes("/follow-up")) {
      return {
        ok: overrides.followUpOk ?? true,
        status: overrides.followUpOk === false ? 409 : 200,
        json: async () => overrides.followUp ?? { ok: true, chatTarget: "ann@bty-dso.com" },
      };
    }
    if (u.includes("/quiz-results/p1")) {
      return { ok: true, status: 200, json: async () => overrides.detail ?? DETAIL };
    }
    return { ok: true, status: 200, json: async () => ROSTER };
  });
}

beforeEach(() => {
  openDirectChat.mockClear();
  openDirectChat.mockResolvedValue({ k: "opened" as const });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryQuizResults → learner result detail", () => {
  it("renders each scored learner as a TAPPABLE control, not a line of text", async () => {
    // @ts-expect-error test shim
    global.fetch = mockApi();
    render(<FoundryQuizResults eventId="e1" participantIds={participants} locale="en" t={t} />);
    const row = await screen.findByTestId("quiz-result-row-p1");
    expect(row.tagName).toBe("BUTTON");
    expect(row.textContent).toContain("4 / 5");
  });

  it("opens the detail in place and names the missed item and the chosen answer", async () => {
    // @ts-expect-error test shim
    global.fetch = mockApi();
    render(<FoundryQuizResults eventId="e1" participantIds={participants} locale="en" t={t} />);
    fireEvent.click(await screen.findByTestId("quiz-result-row-p1"));
    await waitFor(() => expect(screen.getByTestId("learner-result-missed")).toBeTruthy());
    const missed = screen.getByTestId("learner-result-missed").textContent ?? "";
    expect(missed).toContain("Who unlocks the back door?");
    expect(missed).toContain("The first person in");
    expect(missed).toContain("The opening lead");
    expect(missed).toContain("The opening lead carries the key.");
  });

  it("shows only what was missed — a correct question never appears", async () => {
    // @ts-expect-error test shim
    global.fetch = mockApi();
    render(<FoundryQuizResults eventId="e1" participantIds={participants} locale="en" t={t} />);
    fireEvent.click(await screen.findByTestId("quiz-result-row-p1"));
    await waitFor(() => expect(screen.getByTestId("learner-result-missed")).toBeTruthy());
    // The projection carries one entry; a roster of five questions yields exactly one row.
    expect(screen.getByTestId("learner-result-missed").querySelectorAll("li").length).toBe(1);
  });

  it("opens a DIRECT chat with a pre-filled draft, and never sends it", async () => {
    // @ts-expect-error test shim
    global.fetch = mockApi();
    render(<FoundryQuizResults eventId="e1" participantIds={participants} locale="en" t={t} />);
    fireEvent.click(await screen.findByTestId("quiz-result-row-p1"));
    fireEvent.click(await screen.findByTestId("message-in-teams"));
    await waitFor(() => expect(openDirectChat).toHaveBeenCalledTimes(1));
    const [target, message] = openDirectChat.mock.calls[0] as unknown as [string, string];
    expect(target).toBe("ann@bty-dso.com");
    expect(message).toContain("Morning Office Opening");
    // The draft proposes a conversation; it never quotes the score or the wrong answer.
    expect(message).not.toMatch(/4\s*\/\s*5|80%|first person in/i);
  });

  it("does not offer the CTA for a learner with no Teams coordinate", async () => {
    // @ts-expect-error test shim
    global.fetch = mockApi({ detail: { ...DETAIL, canMessageInTeams: false } });
    render(<FoundryQuizResults eventId="e1" participantIds={participants} locale="en" t={t} />);
    fireEvent.click(await screen.findByTestId("quiz-result-row-p1"));
    await waitFor(() => expect(screen.getByTestId("message-in-teams-absent")).toBeTruthy());
    expect(screen.queryByTestId("message-in-teams")).toBeNull();
    expect(openDirectChat).not.toHaveBeenCalled();
  });

  it("tells the Host when the chat cannot be opened, instead of opening nothing silently", async () => {
    // @ts-expect-error test shim
    global.fetch = mockApi({ followUpOk: false, followUp: { error: "no_teams_identity" } });
    render(<FoundryQuizResults eventId="e1" participantIds={participants} locale="en" t={t} />);
    fireEvent.click(await screen.findByTestId("quiz-result-row-p1"));
    fireEvent.click(await screen.findByTestId("message-in-teams"));
    await waitFor(() => expect(screen.getByTestId("message-in-teams-note")).toBeTruthy());
    expect(screen.getByTestId("message-in-teams-note").textContent).toBe(t.messageInTeamsNoIdentity);
    expect(openDirectChat).not.toHaveBeenCalled();
  });

  it("says so plainly when the learner answered everything correctly", async () => {
    // @ts-expect-error test shim
    global.fetch = mockApi({ detail: { ...DETAIL, correctCount: 5, scorePercent: 100, missed: [] } });
    render(<FoundryQuizResults eventId="e1" participantIds={participants} locale="en" t={t} />);
    fireEvent.click(await screen.findByTestId("quiz-result-row-p1"));
    await waitFor(() => expect(screen.getByTestId("learner-result-detail")).toBeTruthy());
    expect(screen.queryByTestId("learner-result-missed")).toBeNull();
    expect(screen.getByTestId("learner-result-detail").textContent).toContain(t.resultDetailAllCorrect);
  });

  it("goes back to the roster without leaving the control room", async () => {
    // @ts-expect-error test shim
    global.fetch = mockApi();
    render(<FoundryQuizResults eventId="e1" participantIds={participants} locale="en" t={t} />);
    fireEvent.click(await screen.findByTestId("quiz-result-row-p1"));
    fireEvent.click(await screen.findByTestId("learner-result-back"));
    await waitFor(() => expect(screen.getByTestId("quiz-result-row-p1")).toBeTruthy());
  });
});
