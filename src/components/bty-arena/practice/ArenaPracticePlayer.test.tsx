/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { ArenaPracticePlayer } from "./ArenaPracticePlayer";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/**
 * Arena Practice choice-card visual state (Slice 2.4A.4).
 *
 * The learner-facing choice cards must be structurally identical and carry no
 * badge/pill/capsule before selection — in particular the internal
 * `isActionCommitment` classification must NOT be surfaced (it leaked which option is
 * the "real action" and made that card look preselected).
 */

// First ACTION-DECISION choice is the commitment — the exact condition that used to
// render a lone "action" pill on the first card only.
function scenario(): ArenaScenarioDraft {
  return {
    title: "Handoff under pressure",
    opening: "A shift change happens during a busy period.",
    primary: {
      choices: [
        { id: "p1", label: "Pause and confirm the critical details" },
        { id: "p2", label: "Proceed to keep things moving" },
      ],
    },
    tradeoff: {
      escalationText: "Now a second urgent task lands.",
      choices: [
        { id: "t1", label: "Escalate to the lead" },
        { id: "t2", label: "Handle it yourself" },
      ],
    },
    actionDecision: {
      prompt: "What will you do right now?",
      choices: [
        { id: "a1", label: "Record the owner and next check time", isActionCommitment: true },
        { id: "a2", label: "Wait until the rush is over", isActionCommitment: false },
        { id: "a3", label: "Ask a colleague to watch it", isActionCommitment: false },
      ],
    },
  };
}

const ACTION_LABELS = [
  "Record the owner and next check time",
  "Wait until the rush is over",
  "Ask a colleague to watch it",
];

function renderPlayer(opts: { mode?: "test" | "play"; onComplete?: () => void; onExit?: () => void } = {}) {
  return render(
    <ArenaPracticePlayer
      scenario={scenario()}
      locale="en"
      mode={opts.mode ?? "play"}
      onExit={opts.onExit ?? (() => {})}
      onComplete={opts.onComplete}
    />,
  );
}

/** Advance opening → primary → tradeoff → action (the three-choice DECIDE screen). */
function toActionPhase() {
  fireEvent.click(screen.getByText("Begin"));
  fireEvent.click(screen.getByText("Pause and confirm the critical details"));
  fireEvent.click(screen.getByText("Escalate to the lead"));
}

const actionButtons = () => ACTION_LABELS.map((l) => screen.getByText(l).closest("button") as HTMLButtonElement);

afterEach(cleanup);

describe("ArenaPracticePlayer — choice-card visual state", () => {
  it("REPRODUCTION: no choice on the DECIDE screen renders an 'action' pill / capsule", () => {
    renderPlayer();
    toActionPhase();
    // The internal commitment classification is never surfaced.
    expect(screen.queryByText("action")).toBeNull();
    // Each choice button contains exactly ONE span (its label) — no extra pill span.
    for (const btn of actionButtons()) {
      expect(btn.querySelectorAll("span").length).toBe(1);
    }
  });

  it("all three unselected cards have equivalent structure and none looks preselected", () => {
    renderPlayer();
    toActionPhase();
    const [a, b, c] = actionButtons();
    // identical class treatment (no index-0 special-casing / selected styling)
    expect(a.className).toBe(b.className);
    expect(b.className).toBe(c.className);
    // no aria-pressed / aria-selected / checked state on any card
    for (const btn of [a, b, c]) {
      expect(btn.getAttribute("aria-pressed")).toBeNull();
      expect(btn.getAttribute("aria-selected")).toBeNull();
      expect(btn.getAttribute("data-selected")).toBeNull();
    }
  });

  it("primary and tradeoff choices are likewise pill-free (uniform across phases)", () => {
    renderPlayer();
    fireEvent.click(screen.getByText("Begin"));
    for (const label of ["Pause and confirm the critical details", "Proceed to keep things moving"]) {
      expect((screen.getByText(label).closest("button") as HTMLElement).querySelectorAll("span").length).toBe(1);
    }
  });

  it("does NOT expose any hidden score / correctness / XP / pattern / commitment signal", () => {
    renderPlayer();
    toActionPhase();
    const region = screen.getByText("What will you do right now?").closest("div") as HTMLElement;
    const text = region.parentElement?.textContent ?? "";
    for (const leak of ["action", "commit", "correct", "XP", "score", "points", "preferred"]) {
      expect(text.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it("choices remain accessible buttons with their label as the accessible name", () => {
    renderPlayer();
    toActionPhase();
    for (const label of ACTION_LABELS) {
      const btn = screen.getByRole("button", { name: label });
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("cards are full-width tap targets (mobile Arena layout)", () => {
    renderPlayer();
    toActionPhase();
    for (const btn of actionButtons()) expect(btn.className).toContain("w-full");
  });

  it("selecting the FIRST choice advances (selection = progression, no lingering pill), firing completion once", () => {
    const onComplete = vi.fn();
    renderPlayer({ mode: "play", onComplete });
    toActionPhase();
    fireEvent.click(screen.getByText(ACTION_LABELS[0]));
    expect(screen.getByText("Practice complete")).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("selecting the SECOND choice behaves identically (no special first-card behavior)", () => {
    const onComplete = vi.fn();
    renderPlayer({ mode: "play", onComplete });
    toActionPhase();
    fireEvent.click(screen.getByText(ACTION_LABELS[1]));
    expect(screen.getByText("Practice complete")).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("full phase progression is unchanged and completion fires exactly once", () => {
    const onComplete = vi.fn();
    renderPlayer({ mode: "play", onComplete });
    // opening → primary
    fireEvent.click(screen.getByText("Begin"));
    expect(screen.getByText("Your choice")).toBeTruthy();
    fireEvent.click(screen.getByText("Proceed to keep things moving"));
    // tradeoff
    expect(screen.getByText("It gets harder")).toBeTruthy();
    fireEvent.click(screen.getByText("Handle it yourself"));
    // action
    expect(screen.getByText("Decide")).toBeTruthy();
    fireEvent.click(screen.getByText(ACTION_LABELS[2]));
    // complete
    expect(screen.getByText("Practice complete")).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("test mode earns nothing and never records completion", () => {
    const onComplete = vi.fn();
    renderPlayer({ mode: "test", onComplete });
    expect(screen.getByText(/Preview — nothing is saved/)).toBeTruthy();
    toActionPhase();
    fireEvent.click(screen.getByText(ACTION_LABELS[0]));
    expect(screen.getByText("Practice complete")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled(); // test mode: no completion callback
  });

  it("renders the Korean surface without a commitment pill", () => {
    render(
      <ArenaPracticePlayer scenario={scenario()} locale="ko" mode="play" onExit={() => {}} />,
    );
    fireEvent.click(screen.getByText("시작"));
    fireEvent.click(screen.getByText("Pause and confirm the critical details"));
    fireEvent.click(screen.getByText("Escalate to the lead"));
    expect(screen.queryByText("행동")).toBeNull();
    for (const btn of actionButtons()) expect(within(btn).queryByText("행동")).toBeNull();
  });
});
