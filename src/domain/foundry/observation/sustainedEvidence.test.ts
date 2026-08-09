import { describe, it, expect } from "vitest";
import { addDaysToDayKey } from "@/domain/foundry/followup/followUpObligation";
import {
  dayKeySpanDays,
  deriveSustainedEvidence,
  type SustainedObservationFact,
} from "./sustainedEvidence";

/**
 * SLICE 3.2M-5 — the control matrix.
 *
 * Most of this file is about what must NOT become SUSTAINED, because that is where the claim
 * can go wrong: every false positive here would be the product telling a Host that someone's
 * behaviour lasted when the evidence only says somebody looked once.
 */
const EVENT = "ev-1";
const STANDARD = "The outgoing person states each open item aloud and the incoming person repeats it back.";
const SCOPE = { eventId: EVENT, observableStandard: STANDARD, followUpDays: 7 };

const f = (
  outcome: "OBSERVED" | "NOT_OBSERVED" | "UNABLE_TO_TELL",
  observedOn: string,
  observerUserId = "o1",
  over: Partial<SustainedObservationFact> = {},
): SustainedObservationFact => ({
  outcome,
  observerUserId,
  observedOn,
  submittedAt: `${observedOn}T09:00:00Z`,
  eventId: EVENT,
  observedStandardSnapshot: STANDARD,
  ...over,
});

describe("[3.2M-5] dayKeySpanDays", () => {
  it("counts whole calendar days, across months and years", () => {
    expect(dayKeySpanDays("2026-08-01", "2026-08-08")).toBe(7);
    expect(dayKeySpanDays("2026-07-28", "2026-08-04")).toBe(7);
    expect(dayKeySpanDays("2026-12-30", "2027-01-06")).toBe(7);
    expect(dayKeySpanDays("2026-08-01", "2026-08-31")).toBe(30);
    expect(dayKeySpanDays("2026-08-01", "2026-08-01")).toBe(0);
  });

  it("agrees with the existing follow-up day math — one calendar authority, not two", () => {
    for (const start of ["2026-03-05", "2026-10-28", "2026-12-30"]) {
      for (const n of [7, 30]) {
        expect(dayKeySpanDays(start, addDaysToDayKey(start, n))).toBe(n);
      }
    }
  });
});

describe("[3.2M-5] what establishes SUSTAINED", () => {
  it("two positives exactly one follow-up window apart", () => {
    const r = deriveSustainedEvidence([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-08")], SCOPE);
    expect(r.sustained).toBe(true);
    expect(r.firstObservedOn).toBe("2026-08-01");
    expect(r.lastObservedOn).toBe("2026-08-08");
    expect(r.spanDays).toBe(7);
    expect(r.distinctPositiveDates).toEqual(["2026-08-01", "2026-08-08"]);
  });

  it("a longer span than required also qualifies", () => {
    expect(deriveSustainedEvidence([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-09-30")], SCOPE).sustained).toBe(true);
  });

  it("facts in any order give the same answer — first and last come from the DATES", () => {
    const forward = deriveSustainedEvidence([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-08")], SCOPE);
    const reversed = deriveSustainedEvidence([f("OBSERVED", "2026-08-08"), f("OBSERVED", "2026-08-01")], SCOPE);
    expect(reversed).toEqual(forward);
  });

  it("a 30-day training requires a 30-day span", () => {
    const scope30 = { ...SCOPE, followUpDays: 30 };
    expect(deriveSustainedEvidence([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-29")], scope30).sustained).toBe(false);
    expect(deriveSustainedEvidence([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-31")], scope30).sustained).toBe(true);
  });
});

describe("[3.2M-5] SAME OBSERVER vs MANY OBSERVERS — corroboration is not persistence", () => {
  it("ONE observer on two qualifying dates establishes it", () => {
    const r = deriveSustainedEvidence([f("OBSERVED", "2026-08-01", "o1"), f("OBSERVED", "2026-08-08", "o1")], SCOPE);
    expect(r.sustained).toBe(true);
    expect(r.distinctPositiveObservers).toEqual(["o1"]);
  });

  it("TWO observers on the same two dates establish exactly the same rung", () => {
    const one = deriveSustainedEvidence([f("OBSERVED", "2026-08-01", "o1"), f("OBSERVED", "2026-08-08", "o1")], SCOPE);
    const two = deriveSustainedEvidence([f("OBSERVED", "2026-08-01", "o1"), f("OBSERVED", "2026-08-08", "o2")], SCOPE);
    // Stronger corroboration, reported as such. NOT a higher rung.
    expect(two.sustained).toBe(one.sustained);
    expect(two.distinctPositiveObservers).toHaveLength(2);
    expect(one.distinctPositiveObservers).toHaveLength(1);
  });

  it("THREE observers on ONE day is not sustained — no time has passed", () => {
    const r = deriveSustainedEvidence(
      [f("OBSERVED", "2026-08-01", "o1"), f("OBSERVED", "2026-08-01", "o2"), f("OBSERVED", "2026-08-01", "o3")],
      SCOPE,
    );
    expect(r.sustained).toBe(false);
    expect(r.distinctPositiveObservers).toHaveLength(3);
    expect(r.distinctPositiveDates).toEqual(["2026-08-01"]);
    expect(r.spanDays, "one date has no span").toBeNull();
  });
});

describe("[3.2M-5] what must NOT establish SUSTAINED", () => {
  it("one positive observation", () => {
    expect(deriveSustainedEvidence([f("OBSERVED", "2026-08-01")], SCOPE).sustained).toBe(false);
  });

  it("no observations at all", () => {
    const r = deriveSustainedEvidence([], SCOPE);
    expect(r.sustained).toBe(false);
    expect(r.firstObservedOn).toBeNull();
    expect(r.spanDays).toBeNull();
  });

  it("many positives on ONE date, however many rows", () => {
    const rows = Array.from({ length: 9 }, (_, i) => f("OBSERVED", "2026-08-01", `o${i}`));
    expect(deriveSustainedEvidence(rows, SCOPE).sustained, "row count is never the predicate").toBe(false);
  });

  it("two positives inside the window — one day short", () => {
    const r = deriveSustainedEvidence([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-07")], SCOPE);
    expect(r.sustained).toBe(false);
    expect(r.spanDays).toBe(6);
  });

  it("a positive plus a negative a window apart — a negative is not a sighting", () => {
    expect(deriveSustainedEvidence([f("OBSERVED", "2026-08-01"), f("NOT_OBSERVED", "2026-08-08")], SCOPE).sustained).toBe(false);
  });

  it("two 'could not tell' reports", () => {
    expect(deriveSustainedEvidence([f("UNABLE_TO_TELL", "2026-08-01"), f("UNABLE_TO_TELL", "2026-08-20")], SCOPE).sustained).toBe(false);
  });

  it("evidence from a DIFFERENT event — a new module version is a new behaviour", () => {
    const r = deriveSustainedEvidence(
      [f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-08", "o1", { eventId: "ev-2" })],
      SCOPE,
    );
    expect(r.sustained).toBe(false);
    expect(r.outOfScope).toBe(1);
  });

  it("evidence against a DIFFERENT standard — similar prose is not the same behaviour", () => {
    const nearlyIdentical = `${STANDARD} And the due date.`;
    const r = deriveSustainedEvidence(
      [f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-08", "o1", { observedStandardSnapshot: nearlyIdentical })],
      SCOPE,
    );
    expect(r.sustained, "a byte difference is a different standard").toBe(false);
    expect(r.outOfScope).toBe(1);
  });

  it("a training that authored NO follow-up window has no threshold and no claim", () => {
    const noWindow = { ...SCOPE, followUpDays: 0 };
    expect(deriveSustainedEvidence([f("OBSERVED", "2026-01-01"), f("OBSERVED", "2026-12-31")], noWindow).sustained).toBe(false);
  });

  it("a corrupt checkpoint is refused rather than guessed at", () => {
    for (const bad of [-7, 1.5, Number.NaN]) {
      const r = deriveSustainedEvidence([f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-09-01")], { ...SCOPE, followUpDays: bad });
      expect(r.sustained, String(bad)).toBe(false);
    }
  });

  it("malformed occurrence dates are not dates and establish nothing", () => {
    const r = deriveSustainedEvidence([f("OBSERVED", ""), f("OBSERVED", "not-a-date")], SCOPE);
    expect(r.sustained).toBe(false);
    expect(r.distinctPositiveDates).toEqual([]);
  });
});

describe("[3.2M-5] contradictory evidence is kept, and never nets off", () => {
  it("a later NOT_OBSERVED does not undo an established span", () => {
    // Day 1 and day 8 both positive, then someone did not see it on day 10. They may simply
    // not have been there — treating that as proof the behaviour stopped would punish the
    // learner for a colleague's schedule.
    const r = deriveSustainedEvidence(
      [f("OBSERVED", "2026-08-01"), f("OBSERVED", "2026-08-08"), f("NOT_OBSERVED", "2026-08-10", "o2")],
      SCOPE,
    );
    expect(r.sustained).toBe(true);
    expect(r.lastObservedOn, "the span ends at the last POSITIVE date").toBe("2026-08-08");
    expect(r.contradictions).toEqual([{ outcome: "NOT_OBSERVED", observerUserId: "o2", observedOn: "2026-08-10" }]);
  });

  it("two observers disagreeing on the same date are two facts, not a vote", () => {
    const r = deriveSustainedEvidence(
      [f("OBSERVED", "2026-08-01", "o1"), f("NOT_OBSERVED", "2026-08-01", "o2"), f("OBSERVED", "2026-08-08", "o1")],
      SCOPE,
    );
    expect(r.sustained).toBe(true);
    expect(r.contradictions).toHaveLength(1);
  });

  it("contradictions are reported even when nothing positive exists", () => {
    const r = deriveSustainedEvidence([f("NOT_OBSERVED", "2026-08-02"), f("UNABLE_TO_TELL", "2026-08-01")], SCOPE);
    expect(r.sustained).toBe(false);
    expect(r.contradictions.map((c) => c.observedOn), "ascending by occurrence").toEqual(["2026-08-01", "2026-08-02"]);
  });

  it("an out-of-scope contradiction is discarded too — it is about another behaviour", () => {
    const r = deriveSustainedEvidence([f("NOT_OBSERVED", "2026-08-01", "o1", { eventId: "ev-2" })], SCOPE);
    expect(r.contradictions).toEqual([]);
    expect(r.outOfScope).toBe(1);
  });
});

describe("[3.2M-5] purity", () => {
  it("the same input always gives the same output, and the input is never mutated", () => {
    const facts = [f("OBSERVED", "2026-08-08"), f("OBSERVED", "2026-08-01")];
    const snapshot = JSON.stringify(facts);
    const a = deriveSustainedEvidence(facts, SCOPE);
    const b = deriveSustainedEvidence(facts, SCOPE);
    expect(a).toEqual(b);
    expect(JSON.stringify(facts), "no in-place sort").toBe(snapshot);
  });

  it("nothing about the answer depends on when it is asked", () => {
    // Dates far in the past and far in the future both derive from the evidence alone; a
    // derivation that read a clock could not be proven by a test at all.
    expect(deriveSustainedEvidence([f("OBSERVED", "1999-01-01"), f("OBSERVED", "1999-01-08")], SCOPE).sustained).toBe(true);
    expect(deriveSustainedEvidence([f("OBSERVED", "2099-01-01"), f("OBSERVED", "2099-01-08")], SCOPE).sustained).toBe(true);
  });
});
