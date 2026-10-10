/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { ArenaPracticePlayer } from "./ArenaPracticePlayer";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/**
 * PRACTICE DEBRIEF V1 — the learner is told WHY, after deciding.
 *
 * MEASURED ON THE SHIPPED PLAYER. The completion screen was a title, "You worked through the full
 * decision. Nothing here counts against you — it's practice.", and a Done button. Every generated
 * choice already carried a reviewed value and cost; none of it reached the learner. TRY without
 * FEEDBACK.
 *
 * Still NO CORRECT ANSWER: each decision is set beside the option not taken, in the same shape, and
 * the screen closes on both being defensible. Nothing during the choice changes — the value is only
 * named once the decision can no longer be cued by it.
 */

const SCENARIO: ArenaScenarioDraft = {
  title: "Opening with a missing kit",
  opening: "The emergency kit is missing its oxygen mask and the first patient is in the chair.",
  primary: { choices: [{ id: "p1", label: "Tell the manager now" }, { id: "p2", label: "Check the back room first" }] },
  tradeoff: { escalationText: "Flat escalation.", choices: [{ id: "ft1", label: "flat one" }, { id: "ft2", label: "flat two" }] },
  actionDecision: { prompt: "Flat prompt", choices: [{ id: "fa1", label: "flat act", isActionCommitment: true }, { id: "fa2", label: "flat wait", isActionCommitment: false }] },
  branches: {
    p1: {
      resultingWorldState: "The manager is on the way.",
      escalationText: "A parent asks why they are waiting.",
      tradeoffChoices: [{ id: "b1t1", label: "Explain the delay plainly" }, { id: "b1t2", label: "Offer to reschedule" }],
      actionDecision: { prompt: "What now?", choices: [{ id: "b1a1", label: "Log the gap now", isActionCommitment: true }, { id: "b1a2", label: "Wait for the call", isActionCommitment: false }] },
    },
    p2: {
      escalationText: "No spare mask in the back room.",
      tradeoffChoices: [{ id: "b2t1", label: "Stop the schedule" }, { id: "b2t2", label: "Borrow from next door" }],
      actionDecision: { prompt: "What now?", choices: [{ id: "b2a1", label: "Call the manager", isActionCommitment: true }, { id: "b2a2", label: "Send a runner", isActionCommitment: false }] },
    },
  },
};

const entry = (label: string, protects: string, costs: string) => ({ forLabel: label, protects, costs });
const WITH_DEBRIEF: ArenaScenarioDraft = {
  ...SCENARIO,
  debrief: {
    p1: entry("Tell the manager now", "patient safety", "the first patient waits"),
    p2: entry("Check the back room first", "a calm start", "minutes without a known-good kit"),
    b1t1: entry("Explain the delay plainly", "the parent's trust", "an awkward conversation now"),
    b1t2: entry("Offer to reschedule", "the parent's time", "a lost appointment"),
    b1a1: entry("Log the gap now", "a record that sticks", "time before the first patient"),
    b1a2: entry("Wait for the call", "the manager's decision", "the room sits idle"),
    b2t1: entry("Stop the schedule", "safety", "every patient is late"),
    b2t2: entry("Borrow from next door", "the schedule", "the other office is short"),
    b2a1: entry("Call the manager", "a clear decision", "interrupting the manager"),
    b2a2: entry("Send a runner", "momentum", "one fewer person in the room"),
  },
};

function walk(scenario: ArenaScenarioDraft, labels: [string, string, string], locale: "en" | "ko" = "en") {
  render(<ArenaPracticePlayer scenario={scenario} locale={locale} mode="play" onExit={() => {}} onComplete={() => {}} onPath={() => {}} />);
  fireEvent.click(screen.getByText(locale === "ko" ? "시작" : "Begin"));
  for (const l of labels) fireEvent.click(screen.getByText(l));
}

afterEach(cleanup);

describe("[Debrief · D1-D4] the completion screen explains the path the learner walked", () => {
  it("D1 each decision shows the learner's choice and the option not taken, with what each protected and cost", () => {
    walk(WITH_DEBRIEF, ["Tell the manager now", "Offer to reschedule", "Log the gap now"]);
    const section = screen.getByTestId("practice-debrief");
    expect(within(section).getByText("What each choice protected")).toBeTruthy();

    const tradeoff = screen.getByTestId("practice-debrief-tradeoff");
    expect(tradeoff.textContent).toContain("Offer to reschedule");
    expect(tradeoff.textContent).toContain("the parent's time");
    expect(tradeoff.textContent).toContain("a lost appointment");
    expect(tradeoff.textContent).toContain("Explain the delay plainly");
    expect(tradeoff.textContent).toContain("the parent's trust");
    // The learner's own choice comes first.
    expect(tradeoff.textContent!.indexOf("Offer to reschedule")).toBeLessThan(tradeoff.textContent!.indexOf("Explain the delay plainly"));

    expect(screen.getByTestId("practice-debrief-primary").textContent).toContain("patient safety");
    expect(screen.getByTestId("practice-debrief-action").textContent).toContain("Wait for the call");
  });

  it("D2 the other branch never appears", () => {
    walk(WITH_DEBRIEF, ["Tell the manager now", "Offer to reschedule", "Log the gap now"]);
    const text = screen.getByTestId("practice-debrief").textContent ?? "";
    for (const otherBranch of ["Stop the schedule", "Borrow from next door", "Call the manager", "Send a runner"]) {
      expect(text, otherBranch).not.toContain(otherBranch);
    }
  });

  it("D3 nothing scores or ranks a choice — the screen closes on both being defensible", () => {
    walk(WITH_DEBRIEF, ["Check the back room first", "Stop the schedule", "Send a runner"]);
    const body = document.body.textContent ?? "";
    for (const banned of ["Correct", "Incorrect", "Best choice", "Good choice", "Wrong", "Recommended", "You should have", "You chose", "points"]) {
      expect(body, banned).not.toContain(banned);
    }
    expect(body).toContain("Both options were defensible.");
    expect(document.body.innerHTML).not.toContain("isActionCommitment");
  });

  it("D4 the value is NOT shown before the last decision — naming it during the choice would cue it", () => {
    render(<ArenaPracticePlayer scenario={WITH_DEBRIEF} locale="en" mode="play" onExit={() => {}} onComplete={() => {}} onPath={() => {}} />);
    fireEvent.click(screen.getByText("Begin"));
    expect(document.body.textContent).not.toContain("patient safety");
    fireEvent.click(screen.getByText("Tell the manager now"));
    expect(document.body.textContent).not.toContain("the parent's trust");
    fireEvent.click(screen.getByText("Explain the delay plainly"));
    expect(document.body.textContent).not.toContain("a record that sticks");
    expect(screen.queryByTestId("practice-debrief")).toBeNull();
  });
});

describe("[Debrief · D5-D8] old Practices, reloads, Korean, and writes", () => {
  it("D5 a Practice without a debrief ends exactly as before", () => {
    walk(SCENARIO, ["Tell the manager now", "Offer to reschedule", "Log the gap now"]);
    expect(screen.queryByTestId("practice-debrief")).toBeNull();
    expect(screen.getByText("Practice complete")).toBeTruthy();
    expect(screen.getByText("You worked through the full decision. Nothing here counts against you — it's practice.")).toBeTruthy();
  });

  it("D6 a learner who reloads a finished run still gets their debrief", () => {
    render(
      <ArenaPracticePlayer
        scenario={WITH_DEBRIEF}
        locale="en"
        mode="play"
        onExit={() => {}}
        initialPath={{ v: 1, primaryChoiceId: "p2", tradeoffChoiceId: "b2t2", actionChoiceId: "b2a1" }}
      />,
    );
    expect(screen.getByTestId("practice-debrief-action").textContent).toContain("interrupting the manager");
    expect(screen.getByTestId("practice-debrief-tradeoff").textContent).toContain("the other office is short");
  });

  it("D7 Korean copy", () => {
    const ko: ArenaScenarioDraft = {
      ...WITH_DEBRIEF,
      debrief: Object.fromEntries(Object.entries(WITH_DEBRIEF.debrief!).map(([id, e]) => [id, { ...e, protects: `지킨 ${id}`, costs: `대가 ${id}` }])),
    };
    walk(ko, ["Tell the manager now", "Offer to reschedule", "Log the gap now"], "ko");
    const text = screen.getByTestId("practice-debrief").textContent ?? "";
    expect(text).toContain("각 선택이 지킨 것");
    expect(text).toContain("다른 선택지");
    expect(text).toContain("두 선택 모두 타당했습니다.");
  });

  it("D8 the debrief causes no extra path write and no second completion", () => {
    const onPath = vi.fn();
    const onComplete = vi.fn();
    render(<ArenaPracticePlayer scenario={WITH_DEBRIEF} locale="en" mode="play" onExit={() => {}} onPath={onPath} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Begin"));
    fireEvent.click(screen.getByText("Tell the manager now"));
    fireEvent.click(screen.getByText("Offer to reschedule"));
    fireEvent.click(screen.getByText("Log the gap now"));
    expect(onPath).toHaveBeenCalledTimes(3);
    expect(onPath).toHaveBeenLastCalledWith({ primaryChoiceId: "p1", tradeoffChoiceId: "b1t2", actionChoiceId: "b1a1" });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
