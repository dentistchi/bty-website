/**
 * ★ TODAY ∩ PAST = ∅, AND TODAY ∪ PAST LOSES NOTHING.
 *
 * This is the invariant the whole retrieval slice rests on. If a Track can be in both surfaces a
 * person sees it twice and cannot tell which is real; if it can be in neither, history the database
 * is deliberately preserving becomes unreachable — which is the exact defect Past Tracks exists to
 * close.
 *
 * The guarantee is structural rather than tested case-by-case: `past` is the boolean NEGATION of
 * `today` over the same inputs, in one function. These tests hold that property over the whole
 * input space, and then name the individual product cases so a reader can see them.
 */
import { describe, it, expect } from "vitest";
import {
  isTrackOnToday,
  isTrackInScope,
  isHiddenFromToday,
  hostActivityVersion,
  recipientActivityVersion,
} from "@/domain/daily/todayDismissal";

/** Every meaningfully different card, enumerated rather than sampled. */
const CARDS = (() => {
  const out: { historical: boolean; dismissedActivityVersion: number | null; currentActivityVersion: number }[] = [];
  for (const historical of [false, true]) {
    for (const dismissedActivityVersion of [null, 0, 1, 2, 5]) {
      for (const currentActivityVersion of [0, 1, 2, 3, 5, 9]) {
        out.push({ historical, dismissedActivityVersion, currentActivityVersion });
      }
    }
  }
  return out;
})();

describe("★ THE PARTITION, over the whole input space", () => {
  it(`★ every card (${CARDS.length} of them) is in EXACTLY ONE scope — never both, never neither`, () => {
    for (const c of CARDS) {
      const inToday = isTrackInScope("today", c);
      const inPast = isTrackInScope("past", c);
      expect(inToday && inPast, `BOTH: ${JSON.stringify(c)}`).toBe(false);
      expect(inToday || inPast, `NEITHER: ${JSON.stringify(c)}`).toBe(true);
    }
  });

  it("★ 'today' is exactly isTrackOnToday, and 'past' is exactly its negation", () => {
    for (const c of CARDS) {
      expect(isTrackInScope("today", c)).toBe(isTrackOnToday(c));
      expect(isTrackInScope("past", c)).toBe(!isTrackOnToday(c));
    }
  });

  it("★ the Today half is UNCHANGED — it still agrees with the dismissal rule that shipped", () => {
    for (const c of CARDS.filter((c) => !c.historical)) {
      expect(isTrackOnToday(c)).toBe(!isHiddenFromToday(c));
    }
  });
});

describe("★ M — the named product cases, recipient side", () => {
  /** A recipient card: `historical` is "the run is closed", which their Today treats as no longer theirs to act on. */
  const rec = (closed: boolean, dismissedAt: number | null, current: number) =>
    ({ historical: closed, dismissedActivityVersion: dismissedAt, currentActivityVersion: current });
  const where = (c: Parameters<typeof isTrackOnToday>[0]) => (isTrackOnToday(c) ? "today" : "past");

  it("1. unanswered active, never dismissed → Today only", () => {
    expect(where(rec(false, null, 0))).toBe("today");
  });
  it("2. unread Host reply, never dismissed → Today only", () => {
    expect(where(rec(false, null, 3))).toBe("today");
  });
  it("3. settled but still rendered in Today → Today only, NOT Past", () => {
    // Removable is a property of the CARD, not of the partition: until it is actually removed it
    // is still on Today, and Past must not show it in parallel.
    expect(where(rec(false, null, 2))).toBe("today");
  });
  it("4. dismissed and still hidden → Past only", () => {
    expect(where(rec(false, 2, 2))).toBe("past");
  });
  it("5. ownerless but still on Today (not yet removed) → Today only", () => {
    // Ownerless is not itself historical: the card is still on Today until the person removes it.
    expect(where(rec(false, null, 1))).toBe("today");
  });
  it("★ 6. ownerless AND dismissed → Past only — and this one can never come back on its own", () => {
    // No Host means no new HOST message, so the version is frozen and Today can never re-surface it.
    // Past is its ONLY door. This is the case the whole slice exists for.
    expect(where(rec(false, 4, 4))).toBe("past");
  });
  it("7. closed → Past only, whatever the dismissal state", () => {
    for (const d of [null, 0, 3]) expect(where(rec(true, d, 3)), `dismissed=${d}`).toBe("past");
  });
  it("★ 8. new activity after dismissal moves it Past → Today, with no write anywhere", () => {
    const before = rec(false, 2, 2);
    expect(where(before)).toBe("past");
    const afterHostReplies = { ...before, currentActivityVersion: 3 };
    expect(where(afterHostReplies)).toBe("today");
  });
});

describe("★ M — the named product cases, Host side", () => {
  /** A Host run: `historical` is always false — a Host's own closed run stays on their Today, badged. */
  const host = (dismissedAt: number | null, current: number) =>
    ({ historical: false, dismissedActivityVersion: dismissedAt, currentActivityVersion: current });
  const where = (c: Parameters<typeof isTrackOnToday>[0]) => (isTrackOnToday(c) ? "today" : "past");

  it("9. needs attention → Today only", () => expect(where(host(null, 1))).toBe("today"));
  it("10. unread recipient reply → Today only", () => expect(where(host(null, 2))).toBe("today"));
  it("11. settled but still rendered → Today only", () => expect(where(host(null, 0))).toBe("today"));
  it("12. dismissed and still hidden → Past only", () => expect(where(host(1, 1))).toBe("past"));
  it("★ 13. new recipient activity moves it Past → Today", () => {
    expect(where(host(1, 1))).toBe("past");
    expect(where(host(1, 2))).toBe("today");
  });
  it("★ a Host's CLOSED run stays on their Today — the two sides disagree, deliberately", () => {
    // The recipient side passes `historical: status !== "active"`; the Host side passes false.
    // Closing is something the Host DID, and the outcome is theirs to read back.
    expect(where(host(null, 0))).toBe("today");
  });
});

describe("★ an unreadable dismissal never hides anything", () => {
  it("NaN / Infinity fall to Today rather than swallowing a card into Past", () => {
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isTrackOnToday({ historical: false, dismissedActivityVersion: v, currentActivityVersion: 0 })).toBe(true);
      expect(isTrackInScope("past", { historical: false, dismissedActivityVersion: v, currentActivityVersion: 0 })).toBe(false);
    }
  });
});

/**
 * ★ C/5/6/7 — WRITING FROM PAST MOVES THE *OTHER* PERSON, NOT YOU.
 *
 * The activity versions are side-specific, and that asymmetry is what makes continuing a
 * conversation from Past behave correctly without any "restore" concept:
 *
 *   recipientActivityVersion counts HOST-authored messages
 *   hostActivityVersion      counts RECIPIENT-authored messages + QUESTION/HELP_NEEDED
 *
 * So a person returns to Today when there is something new for THEM to process — never merely
 * because they chose to speak. Nothing is written to move a card; the same predicate is simply
 * re-evaluated on the next read.
 */
describe("★ C — continuation from Past, and who moves", () => {
  const hostSide = (msgs: { authorRole: string }[], responses: (string | null)[]) =>
    hostActivityVersion(msgs, responses);
  const recipientSide = (msgs: { authorRole: string }[]) => recipientActivityVersion(msgs);
  const where = (dismissedAt: number | null, current: number) =>
    isTrackOnToday({ historical: false, dismissedActivityVersion: dismissedAt, currentActivityVersion: current })
      ? "today"
      : "past";

  it("★ 5. a recipient writing from Past raises the HOST's version and leaves their own alone", () => {
    // Both sides had tidied this away: the recipient at 1 Host message, the Host at 1 recipient message.
    const before = [{ authorRole: "HOST" }, { authorRole: "RECIPIENT" }];
    const recipientDismissedAt = recipientSide(before);   // 1
    const hostDismissedAt = hostSide(before, [null]);     // 1
    expect(where(recipientDismissedAt, recipientSide(before))).toBe("past");
    expect(where(hostDismissedAt, hostSide(before, [null]))).toBe("past");

    // The recipient opens it in Past and sends one more message.
    const after = [...before, { authorRole: "RECIPIENT" }];

    expect(where(hostDismissedAt, hostSide(after, [null])), "★ the HOST is pulled back to Today").toBe("today");
    expect(
      where(recipientDismissedAt, recipientSide(after)),
      "★ and the sender stays in Past — they have nothing new to process",
    ).toBe("past");
  });

  it("★ 6. when the Host replies, the recipient moves Past → Today", () => {
    const before = [{ authorRole: "HOST" }, { authorRole: "RECIPIENT" }, { authorRole: "RECIPIENT" }];
    const recipientDismissedAt = recipientSide(before); // 1
    expect(where(recipientDismissedAt, recipientSide(before))).toBe("past");
    const after = [...before, { authorRole: "HOST" }];
    expect(where(recipientDismissedAt, recipientSide(after))).toBe("today");
  });

  it("★ 7. the mirror: a Host writing from Past raises the RECIPIENT's version, not their own", () => {
    const before = [{ authorRole: "RECIPIENT" }];
    const hostDismissedAt = hostSide(before, [null]);       // 1
    const recipientDismissedAt = recipientSide(before);     // 0
    expect(where(hostDismissedAt, hostSide(before, [null]))).toBe("past");
    expect(where(recipientDismissedAt, recipientSide(before))).toBe("past");

    const after = [...before, { authorRole: "HOST" }];
    expect(where(recipientDismissedAt, recipientSide(after)), "★ the RECIPIENT is pulled back").toBe("today");
    expect(where(hostDismissedAt, hostSide(after, [null])), "★ the Host who spoke stays put").toBe("past");
  });

  it("★ 8. the partition holds throughout — never both, never neither, at every step", () => {
    const steps = [
      [{ authorRole: "HOST" }],
      [{ authorRole: "HOST" }, { authorRole: "RECIPIENT" }],
      [{ authorRole: "HOST" }, { authorRole: "RECIPIENT" }, { authorRole: "HOST" }],
    ];
    for (const msgs of steps) {
      for (const dismissedAt of [null, 0, 1, 2]) {
        for (const version of [recipientSide(msgs), hostSide(msgs, [null, "QUESTION"])]) {
          const card = { historical: false, dismissedActivityVersion: dismissedAt, currentActivityVersion: version };
          expect(isTrackInScope("today", card) && isTrackInScope("past", card)).toBe(false);
          expect(isTrackInScope("today", card) || isTrackInScope("past", card)).toBe(true);
        }
      }
    }
  });

  it("★ a HOST-authored message never raises the Host's own version, and vice versa", () => {
    // This is the property the whole behaviour rests on; if it ever changed, sending would drag
    // the sender's own card back to Today and Past would feel like it was fighting the person.
    const base = [{ authorRole: "HOST" }, { authorRole: "RECIPIENT" }];
    expect(hostSide([...base, { authorRole: "HOST" }], [null])).toBe(hostSide(base, [null]));
    expect(recipientSide([...base, { authorRole: "RECIPIENT" }])).toBe(recipientSide(base));
  });
});
