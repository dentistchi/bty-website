/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { useState } from "react";
import { FoundryTrainingOutcome, TrainingOutcomeBody } from "./FoundryTrainingOutcome";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerOutcome } from "./types";

/**
 * R4-R3A — the Host surface that answers "did anything change?".
 *
 * The component counts nothing: every number arrives pre-decided by the domain. These tests are
 * about what a Host is SHOWN — specifically the three things the product must never imply:
 * that completion is application, that a learner's own report is confirmation, or that a training
 * which was never set up to continue has learners who failed to follow up.
 */

const t = EVENT_ROOMS_COPY.en;

/** The presentation half, rendered from an already-decided aggregate. */
function Body({ outcome, t: copy }: { outcome: ManagerOutcome; t: typeof t }) {
  const [open, setOpen] = useState(false);
  return <TrainingOutcomeBody outcome={outcome} t={copy} openDecisions={open} setOpenDecisions={setOpen} />;
}

/** The configured-but-empty follow-up shape every fixture starts from. */
const BASE_FOLLOWUP = {
  configured: true as const,
  days: 7 as const,
  applied: 0, partlyApplied: 0, notYet: 0, blocked: 0, waiting: 0, overdue: 0, total: 0, answered: 0,
};

function outcome(over: Partial<ManagerOutcome> = {}): ManagerOutcome {
  return {
    participation: { joined: 18, completed: 12, followUpReachable: 12, followUpNotConnected: 0 },
    followUp: { ...BASE_FOLLOWUP },
    observation: { confirmed: 0, notEstablished: 0, couldntTell: 0, total: 0 },
    applicationJourney: "action_decision",
    decisionCount: 0,
    reading: "nothing_yet",
    decisions: [],
    ...over,
  };
}

afterEach(cleanup);

describe("R4-R3A · A · the first viewport answers the question in ordinary language", () => {
  it("leads with the question and the completion count", () => {
    render(<Body outcome={outcome()} t={t} />);
    expect(screen.getByText("Did anything change?")).toBeTruthy();
    expect(screen.getByTestId("outcome-completed").textContent).toBe("12 of 18");
  });

  it("keeps the three evidence levels visibly separate and never sums them", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { configured: true, days: 7, applied: 1, partlyApplied: 0, notYet: 1, blocked: 0, waiting: 5, overdue: 2, total: 9, answered: 2 },
          observation: { confirmed: 0, notEstablished: 0, couldntTell: 1, total: 1 },
          reading: "unknown_yet",
        })}
        t={t}
      />,
    );
    expect(screen.getByTestId("outcome-after")).toBeTruthy();
    expect(screen.getByTestId("outcome-observed")).toBeTruthy();
    // Three separate blocks, and nothing that reads as a combined score.
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/success rate|%|score/i);
  });

  it("no Evidence Ladder vocabulary reaches the Host", () => {
    render(<Body outcome={outcome({ reading: "reported_only" })} t={t} />);
    const body = (document.body.textContent ?? "").toLowerCase();
    for (const term of ["evidence ladder", "exposed", "reflected", "decided", "practiced", "sustained", "rung"]) {
      expect(body).not.toContain(term);
    }
  });
});

describe("R4-R3A · 4 · APPLIED is presented as the learner's report, not as observation", () => {
  it("APPLIED sits under 'After the training', never under 'Observed by someone else'", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { configured: true, days: 7, applied: 3, partlyApplied: 0, notYet: 0, blocked: 0, waiting: 0, overdue: 0, total: 3, answered: 3 },
          reading: "reported_only",
        })}
        t={t}
      />,
    );
    expect(screen.getByTestId("outcome-after").textContent).toContain("Applied");
    expect(screen.getByTestId("outcome-observed").textContent).not.toContain("Applied");
    // And the reading says plainly that nobody else has confirmed it.
    expect(screen.getByTestId("outcome-reading").textContent).toBe(
      "People told us what happened. No one else has confirmed it yet.",
    );
  });
});

describe("R4-R3A · 5/8/9 · observation language never blames and never over-claims", () => {
  it("UNABLE_TO_TELL shows as 'Couldn’t tell' and the reading is not a confirmation", () => {
    render(
      <Body
        outcome={outcome({
          observation: { confirmed: 0, notEstablished: 0, couldntTell: 1, total: 1 },
          followUp: { configured: true, days: 7, applied: 0, partlyApplied: 0, notYet: 0, blocked: 0, waiting: 1, overdue: 0, total: 1, answered: 0 },
          reading: "unknown_yet",
        })}
        t={t}
      />,
    );
    const observed = screen.getByTestId("outcome-observed").textContent ?? "";
    expect(observed).toContain("Couldn’t tell");
    expect(screen.getByTestId("outcome-reading").textContent).toBe("We don’t know yet — 1 person hasn’t answered.");
  });

  it("NOT_OBSERVED is shown neutrally — no failure or contradiction wording", () => {
    render(
      <Body
        outcome={outcome({
          // An observation FKs to a follow-up, so two observed targets means two obligations.
          followUp: { ...BASE_FOLLOWUP, waiting: 2, total: 2 },
          observation: { confirmed: 0, notEstablished: 2, couldntTell: 0, total: 2 },
          reading: "nothing_yet",
        })}
        t={t}
      />,
    );
    const observed = screen.getByTestId("outcome-observed").textContent ?? "";
    expect(observed).toContain("Not established");
    const body = (document.body.textContent ?? "").toLowerCase();
    for (const bad of ["failed", "did not happen", "didn't happen", "no evidence that"]) {
      expect(body).not.toContain(bad);
    }
  });

  it("a confirmed observation is the only thing that says it happened at work", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { ...BASE_FOLLOWUP, applied: 1, total: 1, answered: 1 },
          observation: { confirmed: 1, notEstablished: 0, couldntTell: 0, total: 1 },
          reading: "confirmed",
        })}
        t={t}
      />,
    );
    expect(screen.getByTestId("outcome-reading").textContent).toBe("Someone else confirmed this happened at work.");
  });
});

describe("R4-R3A · 6 · overdue is surfaced distinctly from waiting", () => {
  it("both are shown, and the reading names the overdue count", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { configured: true, days: 7, applied: 1, partlyApplied: 0, notYet: 1, blocked: 0, waiting: 5, overdue: 2, total: 9, answered: 2 },
          reading: "unknown_yet",
        })}
        t={t}
      />,
    );
    const after = screen.getByTestId("outcome-after").textContent ?? "";
    expect(after).toContain("Waiting");
    expect(after).toContain("Overdue");
    expect(screen.getByTestId("outcome-reading").textContent).toBe(
      "We don’t know yet — 7 people haven’t answered, and 2 are overdue.",
    );
  });
});

/* R4-R3B2 — same intent, corrected fact: the count is reported, the cause is not asserted. */
describe("R4-R3B2 · 10 · unreached completions are reported, not hidden", () => {
  it("states how many are not connected yet, without blaming anyone", () => {
    render(
      <Body
        outcome={outcome({ participation: { joined: 40, completed: 39, followUpReachable: 12, followUpNotConnected: 27 } })}
        t={t}
      />,
    );
    expect(screen.getByTestId("outcome-not-connected").textContent).toBe(
      "27 completions aren’t connected to a follow-up yet.",
    );
  });

  it("is absent when every completion is claimed", () => {
    render(<Body outcome={outcome()} t={t} />);
    expect(screen.queryByTestId("outcome-not-connected")).toBeNull();
  });
});

/* R4-R3A-R1 — the sentence is unchanged; what may TRIGGER it is now the checkpoint, not the Journey. */
describe("R4-R3A-R1 · 11 · only an unconfigured training says it ends at completion", () => {
  for (const applicationJourney of ["none", "journey_no_decision"] as const) {
    it(`no checkpoint (applicationJourney=${applicationJourney}): ends at completion, NO follow-up table`, () => {
      render(
        <Body
          outcome={outcome({
            applicationJourney,
            followUp: { ...BASE_FOLLOWUP, configured: false, days: null },
            reading: "ends_at_completion",
          })}
          t={t}
        />,
      );
      expect(screen.getByTestId("outcome-ends-at-completion").textContent).toBe(
        "This training ends at completion. No follow-up was set up for it.",
      );
      /*
        The follow-up and observation blocks are ABSENT, not zeroed. A table of zeros here would
        read as "nobody followed up" — which blames learners for something the Host never asked for.
      */
      expect(screen.queryByTestId("outcome-after")).toBeNull();
      expect(screen.queryByTestId("outcome-observed")).toBeNull();
      // Completion is still reported truthfully.
      expect(screen.getByTestId("outcome-completed")).toBeTruthy();
    });
  }
});

describe("R4-R3A · 12 · decisions are secondary, collapsed and unattributed", () => {
  const withDecisions = outcome({
    decisionCount: 2,
    decisions: ["At my next huddle I will name one owner and one deadline.", "I will ask the receiver to say it back."],
    reading: "nothing_yet",
  });

  it("is collapsed by default — no learner words in the first viewport", () => {
    render(<Body outcome={withDecisions} t={t} />);
    const toggle = screen.getByTestId("outcome-decisions-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("outcome-decisions")).toBeNull();
    expect(document.body.textContent).not.toContain("At my next huddle");
  });

  it("opens on request and shows the decisions with no names attached", async () => {
    render(<Body outcome={withDecisions} t={t} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("outcome-decisions-toggle"));
    });
    const list = screen.getByTestId("outcome-decisions");
    expect(list.textContent).toContain("At my next huddle");
    expect(list.querySelectorAll("li")).toHaveLength(2);
  });

  it("is absent entirely when nobody recorded a decision", () => {
    render(<Body outcome={outcome()} t={t} />);
    expect(screen.queryByTestId("outcome-decisions-toggle")).toBeNull();
  });
});

describe("R4-R3A · 16 · honest empty state", () => {
  it("a training with nothing yet says so rather than showing a hopeful zero", () => {
    render(<Body outcome={outcome({ participation: { joined: 3, completed: 0, followUpReachable: 0, followUpNotConnected: 0 } })} t={t} />);
    expect(screen.getByTestId("outcome-completed").textContent).toBe("0 of 3");
    expect(screen.getByTestId("outcome-reading").textContent).toBe("Nothing to report yet.");
  });
});

describe("R4-R3A · KO parity", () => {
  it("renders in Korean without falling back to English", () => {
    render(<Body outcome={outcome({ reading: "nothing_yet" })} t={EVENT_ROOMS_COPY.ko} />);
    expect(screen.getByText("무엇이 달라졌나요?")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Did anything change?");
  });
});


describe("R4-R3A · 3 · singular and plural are grammatical", () => {
  const reading = (waiting: number, overdue: number) =>
    EVENT_ROOMS_COPY.en.outcomeReadingUnknown(waiting, overdue);

  it("1 waiting reads as one person, not '1 haven’t answered'", () => {
    expect(reading(1, 0)).toBe("We don’t know yet — 1 person hasn’t answered.");
  });

  it("2 waiting reads as people", () => {
    expect(reading(2, 0)).toBe("We don’t know yet — 2 people haven’t answered.");
  });

  it("waiting + overdue stays concise, and 1 overdue is singular", () => {
    expect(reading(0, 1)).toBe("We don’t know yet — 1 person hasn’t answered, and 1 is overdue.");
    expect(reading(5, 2)).toBe("We don’t know yet — 7 people haven’t answered, and 2 are overdue.");
  });

  it("KO parity — the counter form is correct for every n", () => {
    const ko = EVENT_ROOMS_COPY.ko.outcomeReadingUnknown;
    expect(ko(1, 0)).toBe("아직 알 수 없습니다 — 1명이 답하지 않았습니다.");
    expect(ko(5, 2)).toBe("아직 알 수 없습니다 — 7명이 답하지 않았고, 2명은 기한이 지났습니다.");
  });

  it("the shortfall note is also grammatical at 1", () => {
    expect(EVENT_ROOMS_COPY.en.outcomeNotConnectedNote(1)).toBe(
      "1 completion isn’t connected to a follow-up yet.",
    );
    expect(EVENT_ROOMS_COPY.en.outcomeNotConnectedNote(27)).toBe(
      "27 completions aren’t connected to a follow-up yet.",
    );
  });
});


describe("R4-R3A · the panel fetches its own data and never blocks the room", () => {
  const aggregate: ManagerOutcome = {
    participation: { joined: 2, completed: 1, followUpReachable: 1, followUpNotConnected: 0 },
    followUp: { configured: true, days: 7, applied: 0, partlyApplied: 0, notYet: 0, blocked: 0, waiting: 1, overdue: 0, total: 1, answered: 0 },
    observation: { confirmed: 0, notEstablished: 0, couldntTell: 1, total: 1 },
    applicationJourney: "action_decision",
    decisionCount: 1,
    reading: "unknown_yet",
    decisions: ["At my next huddle I will name one owner and one deadline."],
  };

  it("C — sends the Host's real IANA timezone as ?tz= on the sibling outcome route", async () => {
    const urls: string[] = [];
    // @ts-expect-error test shim
    global.fetch = vi.fn((url: string) => {
      urls.push(String(url));
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, outcome: aggregate }) });
    });
    render(<FoundryTrainingOutcome eventId="E1" t={t} />);
    await waitFor(() => expect(screen.getByTestId("training-outcome")).toBeTruthy());

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/api/bty/foundry/events/E1/outcome?tz=");
    const sent = decodeURIComponent(urls[0].split("?tz=")[1] ?? "");
    // A real IANA zone, not "UTC" guessed by the server.
    expect(sent).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(sent).toMatch(/^[A-Za-z]+\/[A-Za-z_+\-0-9]+$|^UTC$/);
  });

  it("renders nothing at all when the outcome cannot be fetched — the room is never blocked", async () => {
    // @ts-expect-error test shim
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) }));
    render(<FoundryTrainingOutcome eventId="E1" t={t} />);
    await waitFor(() => expect(screen.queryByTestId("training-outcome")).toBeNull());
  });
});
