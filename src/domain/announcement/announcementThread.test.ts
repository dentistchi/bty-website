import { describe, it, expect } from "vitest";
import {
  CLIENT_MESSAGE_KEY_MAX,
  THREAD_MESSAGE_MAX,
  countUnreadFor,
  isThreadRole,
  normalizeClientMessageKey,
  normalizeThreadMessage,
  recipientNeedsHostAttention,
} from "@/domain/announcement/announcementThread";
import { QUESTION_TEXT_MAX, HOST_FRAMING_MAX } from "@/domain/announcement/trackedAnnouncement";

/**
 * Track conversation — the pure rules.
 *
 * Four things are asserted here because getting any of them wrong is silent: what a message may be,
 * who an author may be, what each side's unread means, and when a Host still owes somebody an
 * answer.
 */

const at = (s: string) => `2026-09-12T00:00:${s}Z`;

describe("normalizeThreadMessage — what counts as something said", () => {
  it("trims, and keeps the trimmed text", () => {
    expect(normalizeThreadMessage("  I'll try it Monday.  ")).toBe("I'll try it Monday.");
  });

  it("★ whitespace-only is NOT a message — a blank row in a conversation is noise nobody wrote", () => {
    expect(normalizeThreadMessage("   ")).toBeNull();
    expect(normalizeThreadMessage("\n\t ")).toBeNull();
    expect(normalizeThreadMessage("")).toBeNull();
  });

  it("refuses a non-string outright rather than coercing one", () => {
    for (const v of [null, undefined, 42, {}, [], true]) expect(normalizeThreadMessage(v)).toBeNull();
  });

  it("accepts exactly the maximum and refuses one character more", () => {
    expect(normalizeThreadMessage("x".repeat(THREAD_MESSAGE_MAX))).toHaveLength(THREAD_MESSAGE_MAX);
    expect(normalizeThreadMessage("x".repeat(THREAD_MESSAGE_MAX + 1))).toBeNull();
  });

  it("★ the bound is the product's EXISTING one, not a new number", () => {
    // host_framing and question_text are both `between 1 and 1000` in the schema. A reply is the
    // same act of writing, so it gets the same limit rather than a second one to remember.
    expect(THREAD_MESSAGE_MAX).toBe(QUESTION_TEXT_MAX);
    expect(THREAD_MESSAGE_MAX).toBe(HOST_FRAMING_MAX);
  });
});

describe("normalizeClientMessageKey — a nonce, and only a nonce", () => {
  it("keeps a bounded key and refuses an unbounded one", () => {
    expect(normalizeClientMessageKey("abc-123")).toBe("abc-123");
    expect(normalizeClientMessageKey("k".repeat(CLIENT_MESSAGE_KEY_MAX))).toHaveLength(CLIENT_MESSAGE_KEY_MAX);
    expect(normalizeClientMessageKey("k".repeat(CLIENT_MESSAGE_KEY_MAX + 1))).toBeNull();
  });

  it("absent is null, not an empty string that would then be stored and matched on", () => {
    expect(normalizeClientMessageKey(undefined)).toBeNull();
    expect(normalizeClientMessageKey("  ")).toBeNull();
    expect(normalizeClientMessageKey(7)).toBeNull();
  });
});

describe("isThreadRole — the whole author vocabulary", () => {
  it("is exactly HOST and RECIPIENT", () => {
    expect(isThreadRole("HOST")).toBe(true);
    expect(isThreadRole("RECIPIENT")).toBe(true);
    for (const v of ["host", "ADMIN", "SYSTEM", "BOT", "", null, 1]) expect(isThreadRole(v)).toBe(false);
  });
});

describe("countUnreadFor — and the rule that an author never makes unread for themselves", () => {
  const thread = [
    { authorRole: "RECIPIENT" as const, createdAt: at("01") },
    { authorRole: "HOST" as const, createdAt: at("02") },
    { authorRole: "RECIPIENT" as const, createdAt: at("03") },
    { authorRole: "RECIPIENT" as const, createdAt: at("04") },
  ];

  it("★ the HOST counts only RECIPIENT messages — never their own replies", () => {
    expect(countUnreadFor("HOST", thread, null)).toBe(3);
  });

  it("★ the RECIPIENT counts only HOST messages — never their own", () => {
    expect(countUnreadFor("RECIPIENT", thread, null)).toBe(1);
  });

  it("a null cursor means never opened, which is all of the other side's messages", () => {
    expect(countUnreadFor("HOST", thread, null)).toBe(3);
    expect(countUnreadFor("RECIPIENT", thread, null)).toBe(1);
  });

  it("counts strictly AFTER the cursor — what you just opened is not new", () => {
    expect(countUnreadFor("HOST", thread, at("03"))).toBe(1);
    expect(countUnreadFor("HOST", thread, at("04"))).toBe(0);
  });

  it("a cursor later than everything is zero, and never negative", () => {
    expect(countUnreadFor("HOST", thread, "2027-01-01T00:00:00Z")).toBe(0);
    expect(countUnreadFor("RECIPIENT", thread, "2027-01-01T00:00:00Z")).toBe(0);
  });

  it("an empty thread is zero for both sides", () => {
    expect(countUnreadFor("HOST", [], null)).toBe(0);
    expect(countUnreadFor("RECIPIENT", [], null)).toBe(0);
  });

  it("★ an UNPARSEABLE cursor is treated as never-read, not as everything-read", () => {
    // Showing a message twice is recoverable. Hiding one somebody is waiting on is not.
    expect(countUnreadFor("HOST", thread, "not-a-date")).toBe(3);
  });
});

describe("★ recipientNeedsHostAttention — the handled / reopen rule, stated once", () => {
  const base = { response: "QUESTION" as string | null, handledAt: null as string | null, unreadForHost: 0 };

  it("an unanswered open QUESTION needs attention (the existing rule, unchanged)", () => {
    expect(recipientNeedsHostAttention({ ...base })).toBe(true);
  });

  it("HELP_NEEDED behaves identically", () => {
    expect(recipientNeedsHostAttention({ ...base, response: "HELP_NEEDED" })).toBe(true);
  });

  it("once handled, it does not — with no conversation, this is exactly the old behaviour", () => {
    expect(recipientNeedsHostAttention({ ...base, handledAt: at("05") })).toBe(false);
  });

  it("★ A NEW RECIPIENT MESSAGE REOPENS ATTENTION even when the request was marked handled", () => {
    // The whole point of this slice: a stale flag the Host set BEFORE the person spoke must not
    // hide what they said afterwards.
    expect(recipientNeedsHostAttention({ ...base, handledAt: at("05"), unreadForHost: 1 })).toBe(true);
  });

  it("★ handled is NOT cleared to achieve that — the rule reads it, it does not write it", () => {
    const row = { response: "QUESTION", handledAt: at("05"), unreadForHost: 2 };
    const before = { ...row };
    recipientNeedsHostAttention(row);
    expect(row).toEqual(before);
  });

  it("ACKNOWLEDGED is already an ending and needs nothing — until they say something new", () => {
    expect(recipientNeedsHostAttention({ response: "ACKNOWLEDGED", handledAt: null, unreadForHost: 0 })).toBe(false);
    expect(recipientNeedsHostAttention({ response: "ACKNOWLEDGED", handledAt: null, unreadForHost: 1 })).toBe(true);
  });

  it("an unanswered person is not an open REQUEST, but a message from them still is", () => {
    expect(recipientNeedsHostAttention({ response: null, handledAt: null, unreadForHost: 0 })).toBe(false);
    expect(recipientNeedsHostAttention({ response: null, handledAt: null, unreadForHost: 3 })).toBe(true);
  });
});
