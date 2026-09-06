import { describe, it, expect } from "vitest";
import {
  hostActivityVersion,
  hostTodayAction,
  isHiddenFromToday,
  isTodayItemKind,
  recipientActivityVersion,
  recipientTodayAction,
} from "@/domain/daily/todayDismissal";

/**
 * "Remove from my Today" — the pure rules.
 *
 * Two things are asserted here because getting either wrong is silent and harmful in opposite
 * directions: removing a card somebody is waiting on, and burying a message that arrived after a
 * tidy-up.
 */

describe("★ recipient — ONE canonical answer, with the reason attached", () => {
  it("★ unanswered → needs_response, never removable", () => {
    expect(recipientTodayAction({ response: null, unreadCount: 0 }))
      .toEqual({ removable: false, blocker: "needs_response" });
  });

  it("★ answered with an UNREAD reply → unread, never removable", () => {
    expect(recipientTodayAction({ response: "QUESTION", unreadCount: 1 }))
      .toEqual({ removable: false, blocker: "unread" });
    expect(recipientTodayAction({ response: "HELP_NEEDED", unreadCount: 2 }))
      .toEqual({ removable: false, blocker: "unread" });
  });

  it("answered and nothing waiting → removable, for all three responses", () => {
    for (const r of ["ACKNOWLEDGED", "QUESTION", "HELP_NEEDED"]) {
      expect(recipientTodayAction({ response: r, unreadCount: 0 }), r)
        .toEqual({ removable: true, blocker: null });
    }
  });

  it("★ needs_response OUTRANKS unread — answering is the first thing they owe", () => {
    expect(recipientTodayAction({ response: null, unreadCount: 3 }).blocker).toBe("needs_response");
  });

  it("★ HANDLED is not consulted — it is the HOST's state and not in this projection", () => {
    // Passing it changes nothing; the function has no such parameter to read.
    const a = recipientTodayAction({ response: "QUESTION", unreadCount: 0 } as never);
    const b = recipientTodayAction({ response: "QUESTION", unreadCount: 0, handledAt: null } as never);
    expect(a).toEqual(b);
    expect(a.removable).toBe(true);
  });

  it("blocker is null EXACTLY when removable is true", () => {
    for (const c of [
      { response: null, unreadCount: 0 },
      { response: "QUESTION", unreadCount: 1 },
      { response: "QUESTION", unreadCount: 0 },
    ]) {
      const r = recipientTodayAction(c);
      expect(r.removable === (r.blocker === null), JSON.stringify(c)).toBe(true);
    }
  });
});

describe("★ host — ONE canonical answer, with the reason attached", () => {
  const p = (over: Record<string, unknown> = {}) => ({ needsAttention: false, unreadCount: 0, ...over });

  it("nobody waiting → removable", () => {
    expect(hostTodayAction({ responders: [p(), p()] })).toEqual({ removable: true, blocker: null });
  });

  it("an empty run is removable — nobody is waiting on the Host", () => {
    expect(hostTodayAction({ responders: [] })).toEqual({ removable: true, blocker: null });
  });

  it("★ an unread recipient message → unread", () => {
    expect(hostTodayAction({ responders: [p(), p({ needsAttention: true, unreadCount: 1 })] }))
      .toEqual({ removable: false, blocker: "unread" });
  });

  it("★ attention with nothing unread → needs_handling", () => {
    expect(hostTodayAction({ responders: [p({ needsAttention: true })] }))
      .toEqual({ removable: false, blocker: "needs_handling" });
  });

  it("★ unread is reported FIRST — reading what somebody said comes before settling it", () => {
    expect(hostTodayAction({
      responders: [p({ needsAttention: true }), p({ needsAttention: true, unreadCount: 1 })],
    }).blocker).toBe("unread");
  });

  it("★ eligibility is NOT widened — it is still exactly !some(needsAttention)", () => {
    for (const rs of [[p()], [p(), p()], [], [p({ needsAttention: true })], [p({ needsAttention: true, unreadCount: 4 })]]) {
      expect(hostTodayAction({ responders: rs }).removable).toBe(!rs.some((x) => x.needsAttention));
    }
  });
});

describe("★ THE RESURFACE RULE — a monotonic COUNT, never a clock", () => {
  it("no dismissal means visible", () => {
    expect(isHiddenFromToday({ dismissedActivityVersion: null, currentActivityVersion: 3 })).toBe(false);
  });

  it("dismissed with nothing since is hidden", () => {
    expect(isHiddenFromToday({ dismissedActivityVersion: 2, currentActivityVersion: 2 })).toBe(true);
  });

  it("★ activity AFTER the dismissal resurfaces the card", () => {
    expect(isHiddenFromToday({ dismissedActivityVersion: 2, currentActivityVersion: 3 })).toBe(false);
  });

  it("★ THE MVCC CASE — a version recorded BEFORE a concurrent commit always resurfaces", () => {
    /*
      A dismissing transaction can only count rows in its own snapshot, so an uncommitted message
      is necessarily NOT in the recorded version. When it lands the count is strictly greater.
      Under the old timestamp rule that same message was stamped BEFORE the dismissal and was
      therefore hidden forever.
    */
    const recordedBeforeCommit = 1; // the writer's message had not committed yet
    const afterCommit = 2;
    expect(isHiddenFromToday({ dismissedActivityVersion: recordedBeforeCommit, currentActivityVersion: afterCommit })).toBe(false);
  });

  it("★ an unreadable version FAILS TOWARD VISIBLE — showing twice is recoverable, losing one is not", () => {
    expect(isHiddenFromToday({ dismissedActivityVersion: Number.NaN, currentActivityVersion: 0 })).toBe(false);
  });

  it("★ a re-dismissal at the NEW version hides it again — the second removal is their decision", () => {
    expect(isHiddenFromToday({ dismissedActivityVersion: 3, currentActivityVersion: 3 })).toBe(true);
  });
});

describe("★ activity version — recipient", () => {
  it("counts HOST messages only; their own replies are not activity they need resurfacing for", () => {
    const msgs = [{ authorRole: "HOST" }, { authorRole: "RECIPIENT" }, { authorRole: "HOST" }];
    expect(recipientActivityVersion(msgs)).toBe(2);
  });
  it("an empty thread is version 0", () => expect(recipientActivityVersion([])).toBe(0));
  it("is monotonic — appending a HOST message strictly increases it", () => {
    const before = recipientActivityVersion([{ authorRole: "HOST" }]);
    const after = recipientActivityVersion([{ authorRole: "HOST" }, { authorRole: "HOST" }]);
    expect(after).toBeGreaterThan(before);
  });
});

describe("★ activity version — host", () => {
  it("counts RECIPIENT messages plus QUESTION/HELP_NEEDED first responses", () => {
    expect(hostActivityVersion([{ authorRole: "RECIPIENT" }, { authorRole: "HOST" }], ["QUESTION"])).toBe(2);
  });

  it("★ HELP_NEEDED moves the version even though it fabricates NO message", () => {
    // This is why the response term exists: without it the activity that most needs a Host would
    // leave the version unmoved and the card buried.
    expect(hostActivityVersion([], ["HELP_NEEDED"])).toBe(1);
    expect(hostActivityVersion([], [null])).toBe(0);
  });

  it("ACKNOWLEDGED asks nothing of the Host and does not move it", () => {
    expect(hostActivityVersion([], ["ACKNOWLEDGED"])).toBe(0);
  });

  it("sums across every recipient of the run", () => {
    expect(hostActivityVersion(
      [{ authorRole: "RECIPIENT" }, { authorRole: "RECIPIENT" }],
      ["QUESTION", "ACKNOWLEDGED", "HELP_NEEDED"],
    )).toBe(4);
  });
});

describe("the item-kind vocabulary is closed", () => {
  it("is exactly the two Track card kinds", () => {
    expect(isTodayItemKind("track_recipient")).toBe(true);
    expect(isTodayItemKind("track_host")).toBe(true);
    for (const v of ["saved", "brief_item", "required_learning", "", null, 1]) {
      expect(isTodayItemKind(v), String(v)).toBe(false);
    }
  });
});
