/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useState } from "react";
import { TrainingOutcomeBody } from "./FoundryTrainingOutcome";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerOutcome } from "./types";

/**
 * R4-R3A-R1 — WHAT THE HOST IS TOLD ABOUT WHY THE EVIDENCE STOPS.
 *
 * The panel used to print "This training ends at completion. No follow-up was set up for it."
 * whenever the Journey was missing. Measured against production, that named the wrong cause on 17
 * of the 31 events that have completions: each of them HAD a 7- or 30-day checkpoint, and the
 * reason no obligation existed was that the people who finished never signed in. A Host reading
 * it was told they had forgotten to configure something they had configured, and the identity
 * gap — the thing they could actually act on — was invisible.
 *
 * Three sentences, three distinct causes, and none of them blames a learner.
 */

const en = EVENT_ROOMS_COPY.en;
const ko = EVENT_ROOMS_COPY.ko;

function Body({ outcome, t }: { outcome: ManagerOutcome; t: typeof en }) {
  const [open, setOpen] = useState(false);
  return <TrainingOutcomeBody outcome={outcome} t={t} openDecisions={open} setOpenDecisions={setOpen} />;
}

const FU = {
  configured: true as boolean,
  days: 7 as 7 | 30 | null,
  applied: 0, partlyApplied: 0, notYet: 0, blocked: 0, waiting: 0, overdue: 0, total: 0, answered: 0,
};

function outcome(over: Partial<ManagerOutcome> = {}): ManagerOutcome {
  return {
    participation: { joined: 3, completed: 2, followUpReachable: 2, followUpNotConnected: 0 },
    followUp: { ...FU },
    observation: { confirmed: 0, notEstablished: 0, couldntTell: 0, total: 0 },
    applicationJourney: "action_decision",
    decisionCount: 0,
    reading: "nothing_yet",
    decisions: [],
    ...over,
  };
}

afterEach(cleanup);

describe("R4-R3A-R1 · 1 · only an unconfigured training says it ends at completion", () => {
  it("not configured → the end-at-completion sentence, and no follow-up table", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { ...FU, configured: false, days: null },
          applicationJourney: "none",
          reading: "ends_at_completion",
        })}
        t={en}
      />,
    );
    expect(screen.getByTestId("outcome-ends-at-completion").textContent).toBe(
      "This training ends at completion. No follow-up was set up for it.",
    );
    // Absent, not zeroed: a table of zeros reads as learner failure, and nobody failed.
    expect(screen.queryByTestId("outcome-after")).toBeNull();
    expect(screen.queryByTestId("outcome-observed")).toBeNull();
    expect(screen.getByTestId("outcome-completed")).toBeTruthy();
  });
});

describe("R4-R3A-R1 · 2/3/7/8 · a configured checkpoint never shows that sentence", () => {
  for (const days of [7, 30] as const) {
    for (const applicationJourney of ["none", "journey_no_decision", "action_decision"] as const) {
      it(`followUpDays ${days} + applicationJourney ${applicationJourney}: never "no follow-up was set up"`, () => {
        render(
          <Body
            outcome={outcome({
              followUp: { ...FU, days, waiting: 1, total: 1 },
              applicationJourney,
              participation: { joined: 2, completed: 1, followUpReachable: 1, followUpNotConnected: 0 },
              reading: "unknown_yet",
            })}
            t={en}
          />,
        );
        expect(screen.queryByTestId("outcome-ends-at-completion")).toBeNull();
        expect(document.body.textContent).not.toContain("No follow-up was set up");
      });
    }
  }
});

/*
  R4-R3B2 CORRECTED THIS BLOCK. It pinned "finished without signing in, so we can't follow up with
  them" — a cause the product cannot observe, and one production disproved for three completions
  that had a reachable follow-up. The shape of the check is kept: the configuration is named first,
  the count second, and nobody is blamed. Only the false cause is gone.
*/
describe("R4-R3B2 · 4 · configured with nothing connected states the fact, not a cause", () => {
  const anon = outcome({
    followUp: { ...FU, days: 7 },
    applicationJourney: "none",
    participation: { joined: 3, completed: 2, followUpReachable: 0, followUpNotConnected: 2 },
    reading: "awaiting_connection",
  });

  it("says the checkpoint EXISTS, then why it produced nothing", () => {
    render(<Body outcome={anon} t={en} />);
    expect(screen.getByTestId("outcome-reading").textContent).toBe(
      "Follow-up was set for 7 days. 2 completions aren’t connected to a follow-up yet.",
    );
  });

  it("blames nobody — not the Host for forgetting, not the learner for failing", () => {
    render(<Body outcome={anon} t={en} />);
    const body = (document.body.textContent ?? "").toLowerCase();
    for (const bad of [
      "No follow-up was set up", "failed", "did not follow", "forgot", "missing journey",
      // R4-R3B2 — the cause this surface may no longer assert.
      "without signing in", "can’t follow up", "unclaimed",
    ]) {
      expect(body).not.toContain(bad.toLowerCase());
    }
  });

  it("singular reads as English, not as a template", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { ...FU, days: 30 },
          participation: { joined: 2, completed: 1, followUpReachable: 0, followUpNotConnected: 1 },
          reading: "awaiting_connection",
        })}
        t={en}
      />,
    );
    expect(screen.getByTestId("outcome-reading").textContent).toBe(
      "Follow-up was set for 30 days. 1 completion isn’t connected to a follow-up yet.",
    );
  });

  it("the generic shortfall note is not repeated beneath it", () => {
    render(<Body outcome={anon} t={en} />);
    expect(screen.queryByTestId("outcome-not-connected")).toBeNull();
  });
});

describe("R4-R3A-R1 · 5/6 · real follow-up rows are never hidden", () => {
  it("5 — configured + linked pending: the Waiting / Overdue table renders", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { ...FU, waiting: 1, overdue: 2, total: 3 },
          participation: { joined: 3, completed: 3, followUpReachable: 3, followUpNotConnected: 0 },
          reading: "unknown_yet",
        })}
        t={en}
      />,
    );
    const after = screen.getByTestId("outcome-after").textContent ?? "";
    expect(after).toContain("Waiting");
    expect(after).toContain("Overdue");
    expect(screen.getByTestId("outcome-observed")).toBeTruthy();
  });

  it("6 — mixed: the evidence table AND the shortfall note both render", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { ...FU, waiting: 1, total: 1 },
          participation: { joined: 4, completed: 3, followUpReachable: 1, followUpNotConnected: 2 },
          reading: "unknown_yet",
        })}
        t={en}
      />,
    );
    // Not suppressed merely because some completions were anonymous.
    expect(screen.getByTestId("outcome-after")).toBeTruthy();
    expect(screen.getByTestId("outcome-not-connected").textContent).toBe(
      "2 completions aren’t connected to a follow-up yet.",
    );
    expect(screen.getByTestId("outcome-reading").textContent).toBe("We don’t know yet — 1 person hasn’t answered.");
  });

  it("configured with nobody finished yet stays neutral", () => {
    render(
      <Body
        outcome={outcome({
          participation: { joined: 5, completed: 0, followUpReachable: 0, followUpNotConnected: 0 },
          reading: "nothing_yet",
        })}
        t={en}
      />,
    );
    expect(screen.getByTestId("outcome-reading").textContent).toBe("Nothing to report yet.");
    expect(screen.queryByTestId("outcome-ends-at-completion")).toBeNull();
  });
});

describe("R4-R3A-R1 · 12 · EN / KO parity", () => {
  it("every outcome key exists in both locales, and the new ones are really translated", () => {
    for (const k of Object.keys(en).filter((x) => x.startsWith("outcome"))) {
      expect(ko, `ko is missing ${k}`).toHaveProperty(k);
      expect(typeof (ko as Record<string, unknown>)[k]).toBe(typeof (en as Record<string, unknown>)[k]);
    }
    expect(ko.outcomeAwaitingConnection(7, 2)).not.toBe(en.outcomeAwaitingConnection(7, 2));
    expect(ko.outcomeEndsAtCompletion).not.toBe(en.outcomeEndsAtCompletion);
  });

  it("the Korean sentence names the configured days AND the count, and asserts no cause", () => {
    const s = ko.outcomeAwaitingConnection(7, 2);
    expect(s).toContain("7");
    expect(s).toContain("2");
    // R4-R3B2 — it must no longer reach for an account explanation.
    expect(s).not.toContain("로그인");
  });

  it("KO renders the same three causes through the component", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { ...FU, days: 7 },
          participation: { joined: 3, completed: 2, followUpReachable: 0, followUpNotConnected: 2 },
          reading: "awaiting_connection",
        })}
        t={ko as unknown as typeof en}
      />,
    );
    expect(screen.getByTestId("outcome-reading").textContent).toBe(ko.outcomeAwaitingConnection(7, 2));

    cleanup();
    render(
      <Body
        outcome={outcome({ followUp: { ...FU, configured: false, days: null }, reading: "ends_at_completion" })}
        t={ko as unknown as typeof en}
      />,
    );
    expect(screen.getByTestId("outcome-ends-at-completion").textContent).toBe(ko.outcomeEndsAtCompletion);
  });
});
