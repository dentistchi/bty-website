import { describe, expect, it } from "vitest";
import {
  funnelIsComplete,
  isAnnouncementResponse,
  normalizeHostFraming,
  normalizeQuestionText,
  parsePickedRecipients,
  projectForRecipient,
  safeSourceUrl,
  summariseAnnouncement,
} from "@/domain/announcement/trackedAnnouncement";

/**
 * Tracked Announcement domain (Slice A1).
 *
 * Three things are asserted here because getting any of them wrong is silent: the audience set,
 * the five buckets, and what a recipient may see.
 */

describe("parsePickedRecipients — the People Picker's submitted value", () => {
  const A = "33333333-3333-3333-3333-333333333333";
  const B = "44444444-4444-4444-4444-444444444444";

  it("reads the documented multi-select shape (comma-separated Entra IDs)", () => {
    expect(parsePickedRecipients(`${A},${B}`)).toEqual([A, B]);
  });

  it("reads a single-select bare id", () => {
    expect(parsePickedRecipients(A)).toEqual([A]);
  });

  it("DE-DUPLICATES — a repeat would inflate a denominator the table cannot hold twice", () => {
    expect(parsePickedRecipients(`${A},${A},${B},${A}`)).toEqual([A, B]);
  });

  it("lowercases, so casing cannot defeat uniqueness", () => {
    expect(parsePickedRecipients(`${A.toUpperCase()},${A}`)).toEqual([A]);
  });

  it("drops anything that is not an identity", () => {
    expect(parsePickedRecipients(`${A},not-a-guid,,   ,12345`)).toEqual([A]);
  });

  it("returns EMPTY for unusable input rather than guessing", () => {
    for (const v of [null, undefined, "", "   ", 42, {}, ["not-a-guid"]]) {
      expect(parsePickedRecipients(v), `input ${JSON.stringify(v)}`).toEqual([]);
    }
  });
});

describe("host framing and question text are bounded", () => {
  it("trims and requires real content", () => {
    expect(normalizeHostFraming("  Please read this  ")).toBe("Please read this");
    for (const v of ["", "   ", null, undefined, 7, "x".repeat(1001)]) {
      expect(normalizeHostFraming(v), `input ${JSON.stringify(v)}`).toBeNull();
    }
  });

  it("keeps question text ONLY for QUESTION", () => {
    expect(normalizeQuestionText("which office?", "QUESTION")).toBe("which office?");
    expect(normalizeQuestionText("sneaky", "ACKNOWLEDGED")).toBeNull();
    expect(normalizeQuestionText("sneaky", "HELP_NEEDED")).toBeNull();
    expect(normalizeQuestionText("x".repeat(1001), "QUESTION")).toBeNull();
  });

  it("admits exactly three responses and nothing that means 'seen'", () => {
    for (const v of ["ACKNOWLEDGED", "QUESTION", "HELP_NEEDED"]) expect(isAnnouncementResponse(v)).toBe(true);
    for (const v of ["READ", "SEEN", "DELIVERED", "VIEWED", "OK", "", null, 1]) {
      expect(isAnnouncementResponse(v), `value ${JSON.stringify(v)}`).toBe(false);
    }
  });
});

describe("the five buckets", () => {
  const bound = (r: "ACKNOWLEDGED" | "QUESTION" | "HELP_NEEDED" | null) => ({ boundUserId: "u", response: r });
  const unbound = { boundUserId: null, response: null };

  it("counts each recipient exactly once and sums to N", () => {
    const f = summariseAnnouncement(5, [
      bound("ACKNOWLEDGED"),
      bound("QUESTION"),
      bound("HELP_NEEDED"),
      bound(null),
      unbound,
    ]);
    expect(f).toEqual({
      announcedTo: 5,
      gotIt: 1,
      question: 1,
      needHelp: 1,
      noResponse: 1,
      notYetActivated: 1,
    });
    expect(funnelIsComplete(f)).toBe(true);
  });

  it("★ NEVER folds an unactivated person into No response", () => {
    /*
      This is the product. A Host may legitimately choose someone who has never opened BTY; that
      person has not declined to answer. Counting them as silence would report platform onboarding
      as a human choice, in the exact place a Host decides who to follow up with.
    */
    const f = summariseAnnouncement(3, [unbound, unbound, unbound]);
    expect(f.notYetActivated).toBe(3);
    expect(f.noResponse).toBe(0);
  });

  it("an unbound person who somehow HAS a response is counted by their answer", () => {
    // Binding can be revoked (user deleted → user_id SET NULL) without erasing what they said.
    const f = summariseAnnouncement(1, [{ boundUserId: null, response: "ACKNOWLEDGED" }]);
    expect(f.gotIt).toBe(1);
    expect(f.notYetActivated).toBe(0);
  });

  it("reports an INCOMPLETE funnel rather than quietly losing a person", () => {
    expect(funnelIsComplete(summariseAnnouncement(4, [bound("ACKNOWLEDGED")]))).toBe(false);
  });

  it("exposes no combined score, percentage or total", () => {
    const f = summariseAnnouncement(2, [bound("ACKNOWLEDGED"), unbound]);
    const keys = Object.keys(f).sort();
    expect(keys).toEqual(["announcedTo", "gotIt", "needHelp", "noResponse", "notYetActivated", "question"]);
    for (const k of keys) expect(k).not.toMatch(/score|percent|rate|engagement|compliance/i);
  });
});

describe("what a recipient may see — the privacy whitelist", () => {
  it("carries the Host's framing and NOTHING from the captured message", () => {
    const p = projectForRecipient({
      announcementId: "a1",
      recipientId: "r1",
      hostFraming: "Please confirm you've read the new intake steps.",
      hostDisplay: "Dr. Chi",
      sourceUrl: "https://teams.microsoft.com/l/message/19:x/1",
      response: "QUESTION",
      respondedAt: "2026-09-01T00:00:00Z",
      unreadCount: 2,
      messageCount: 3,
    });
    /*
      THE WHITELIST GREW BY THREE, AND ONLY BY THREE (Track conversation V1).

      `recipientId` is the caller's OWN row and the address of their OWN conversation — this list is
      scoped by `user_id` = the session user, so it is the only one they can receive here, it
      identifies nobody, and possessing it grants nothing because authority is re-derived in the
      database on every read and write.

      `unreadCount` and `messageCount` are COUNTS. A number cannot carry a body, a name or an
      identifier, and neither can say anything about another recipient of the same announcement.
    */
    expect(Object.keys(p).sort()).toEqual([
      "announcementId",
      "hostDisplay",
      "hostFraming",
      "messageCount",
      "recipientId",
      "respondedAt",
      "response",
      "sourceUrl",
      "unreadCount",
    ]);
    const dump = JSON.stringify(p);
    // The shapes that must never reach a recipient — the source may be a private channel.
    for (const forbidden of ["preview", "external_key", "tenant", "conversation_id", "channel_id", "chat_id", "source_metadata"]) {
      expect(dump).not.toContain(forbidden);
    }
  });

  it("only https / msteams links become tappable", () => {
    expect(safeSourceUrl("https://teams.microsoft.com/l/message/x/1")).toBe("https://teams.microsoft.com/l/message/x/1");
    expect(safeSourceUrl("msteams:/l/message/x/1")).toBe("msteams:/l/message/x/1");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "http://insecure.test", "", null, 5]) {
      expect(safeSourceUrl(bad), `url ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  it("an unrecognised response never leaks through as a claim", () => {
    expect(projectForRecipient({ announcementId: "a", hostFraming: "f", response: "READ" }).response).toBeNull();
  });

  it("counts are floored at zero and never carry a negative or a fraction from a bad read", () => {
    const p = projectForRecipient({
      announcementId: "a",
      hostFraming: "f",
      unreadCount: -3,
      messageCount: 2.7,
    });
    expect(p.unreadCount).toBe(0);
    expect(p.messageCount).toBe(2);
  });

  it("a missing recipient id is an empty string, not `undefined` leaking into a URL", () => {
    expect(projectForRecipient({ announcementId: "a", hostFraming: "f" }).recipientId).toBe("");
  });
});
