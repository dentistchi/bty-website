/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useState } from "react";
import { TrainingOutcomeBody } from "./FoundryTrainingOutcome";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerOutcome } from "./types";

/**
 * R4-R3B2 — WHAT THE HOST IS TOLD WHEN A FOLLOW-UP HAS NOT REACHED SOMEONE.
 *
 * The old sentence named a cause: "finished without signing in, so we can't follow up with them."
 * It was wrong twice over. It asserted an ACCOUNT state the product cannot observe, and for three
 * measured production completions it was simply false — a reachable follow-up existed for them.
 *
 * The replacement states the fact and stops. No sign-in inference, no "unclaimed", and never a
 * claim that follow-up is impossible where an obligation exists.
 */

const en = EVENT_ROOMS_COPY.en;
const ko = EVENT_ROOMS_COPY.ko;

function Body({ outcome, t }: { outcome: ManagerOutcome; t: typeof en }) {
  const [open, setOpen] = useState(false);
  return <TrainingOutcomeBody outcome={outcome} t={t} openDecisions={open} setOpenDecisions={setOpen} />;
}

const FU = {
  configured: true as boolean, days: 7 as 7 | 30 | null,
  applied: 0, partlyApplied: 0, notYet: 0, blocked: 0, waiting: 0, overdue: 0, total: 0, answered: 0,
};

function outcome(over: Partial<ManagerOutcome> = {}): ManagerOutcome {
  return {
    participation: { joined: 4, completed: 3, followUpReachable: 0, followUpNotConnected: 3 },
    followUp: { ...FU },
    observation: { confirmed: 0, notEstablished: 0, couldntTell: 0, total: 0 },
    applicationJourney: "none",
    decisionCount: 0,
    reading: "awaiting_connection",
    decisions: [],
    ...over,
  };
}

afterEach(cleanup);

/** Wording this surface must never use again, in either locale. */
const BANNED_EN = [
  "without signing in",
  "not signed in",
  "unclaimed",
  "can’t follow up",
  "can't follow up",
];
const BANNED_KO = ["로그인하지 않고", "후속 확인을 할 수 없습니다"];

describe("R4-R3B2 · 10 · EN states the fact and asserts no cause", () => {
  it("names the configured checkpoint, then the shortfall", () => {
    render(<Body outcome={outcome()} t={en} />);
    expect(screen.getByTestId("outcome-reading").textContent).toBe(
      "Follow-up was set for 7 days. 3 completions aren’t connected to a follow-up yet.",
    );
  });

  it("singular reads as English", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { ...FU, days: 30 },
          participation: { joined: 2, completed: 1, followUpReachable: 0, followUpNotConnected: 1 },
        })}
        t={en}
      />,
    );
    expect(screen.getByTestId("outcome-reading").textContent).toBe(
      "Follow-up was set for 30 days. 1 completion isn’t connected to a follow-up yet.",
    );
  });

  it("no sign-in inference appears anywhere on the surface", () => {
    render(<Body outcome={outcome()} t={en} />);
    const body = (document.body.textContent ?? "").toLowerCase();
    for (const bad of BANNED_EN) expect(body).not.toContain(bad.toLowerCase());
  });

  it("the mixed case shows real evidence AND the shortfall, without a cause", () => {
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
    expect(screen.getByTestId("outcome-after")).toBeTruthy();
    expect(screen.getByTestId("outcome-not-connected").textContent).toBe(
      "2 completions aren’t connected to a follow-up yet.",
    );
    const body = (document.body.textContent ?? "").toLowerCase();
    for (const bad of BANNED_EN) expect(body).not.toContain(bad.toLowerCase());
  });

  it("nothing is said when every completion is reachable", () => {
    render(
      <Body
        outcome={outcome({
          followUp: { ...FU, waiting: 2, total: 2 },
          participation: { joined: 2, completed: 2, followUpReachable: 2, followUpNotConnected: 0 },
          reading: "unknown_yet",
        })}
        t={en}
      />,
    );
    expect(screen.queryByTestId("outcome-not-connected")).toBeNull();
  });

  it("the shortfall sentence is said once, never twice", () => {
    render(<Body outcome={outcome()} t={en} />);
    expect(screen.queryByTestId("outcome-not-connected")).toBeNull();
    expect(screen.getByTestId("outcome-reading")).toBeTruthy();
  });
});

describe("R4-R3B2 · 11 · KO parity, and no sign-in inference either", () => {
  it("every outcome key exists in both locales", () => {
    for (const k of Object.keys(en).filter((x) => x.startsWith("outcome"))) {
      expect(ko, `ko is missing ${k}`).toHaveProperty(k);
      expect(typeof (ko as Record<string, unknown>)[k]).toBe(typeof (en as Record<string, unknown>)[k]);
    }
    expect(ko.outcomeAwaitingConnection(7, 3)).not.toBe(en.outcomeAwaitingConnection(7, 3));
  });

  it("KO names the days and the count and asserts no cause", () => {
    const s = ko.outcomeAwaitingConnection(7, 3);
    expect(s).toContain("7");
    expect(s).toContain("3");
    for (const bad of BANNED_KO) expect(s).not.toContain(bad);
  });

  it("KO renders through the component with no banned wording", () => {
    render(<Body outcome={outcome()} t={ko as unknown as typeof en} />);
    expect(screen.getByTestId("outcome-reading").textContent).toBe(ko.outcomeAwaitingConnection(7, 3));
    const body = document.body.textContent ?? "";
    for (const bad of BANNED_KO) expect(body).not.toContain(bad);
  });

  it("the KO shortfall note also asserts no cause", () => {
    const s = ko.outcomeNotConnectedNote(2);
    for (const bad of BANNED_KO) expect(s).not.toContain(bad);
    expect(s).toContain("2");
  });
});

describe("R4-R3B2 · the banned wording is gone from the copy module itself", () => {
  it("no outcome string in either locale carries a sign-in inference", () => {
    for (const [loc, dict] of [["en", en], ["ko", ko]] as const) {
      for (const [key, val] of Object.entries(dict)) {
        if (!key.startsWith("outcome")) continue;
        const rendered = typeof val === "function" ? (val as (a: number, b: number) => string)(7, 2) : String(val);
        for (const bad of loc === "en" ? BANNED_EN : BANNED_KO) {
          expect(rendered.toLowerCase(), `${loc}.${key}`).not.toContain(bad.toLowerCase());
        }
      }
    }
  });
});
