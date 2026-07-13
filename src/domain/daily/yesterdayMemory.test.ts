/**
 * Yesterday → Today Memory Bridge V1 — pure resolver.
 *
 * Asserts the resolver reflects ONLY the relationship the user actually committed to yesterday,
 * never fabricates, never uses judgment/completion language, and returns null on absent/degraded
 * evidence (so Today's arrival stays unchanged for no-evidence users).
 */
import { describe, expect, it } from "vitest";
import { resolveYesterdayMemory, type YesterdayMemoryEvidence } from "./yesterdayMemory";

const ev = (p: Partial<YesterdayMemoryEvidence>): YesterdayMemoryEvidence => ({
  existed: true,
  relationship: null,
  ...p,
});

describe("resolveYesterdayMemory", () => {
  it("reflects a Self relationship as a returned-to-self memory", () => {
    const m = resolveYesterdayMemory(ev({ relationship: "self" }));
    expect(m).toEqual({ line: "Yesterday, you chose to return to yourself.", source: "relationship" });
  });

  it("reflects an Others relationship as a showed-up-for-someone memory", () => {
    expect(resolveYesterdayMemory(ev({ relationship: "others" }))?.line).toBe(
      "Yesterday, you chose to show up for someone.",
    );
  });

  it("reflects a World relationship as a met-the-world memory", () => {
    expect(resolveYesterdayMemory(ev({ relationship: "world" }))?.line).toBe(
      "Yesterday, you chose to meet the world.",
    );
  });

  it("returns null when there was no yesterday commitment", () => {
    expect(resolveYesterdayMemory(ev({ existed: false, relationship: "self" }))).toBeNull();
  });

  it("returns null (never fabricates) when the relationship is absent or degraded", () => {
    expect(resolveYesterdayMemory(ev({ relationship: null }))).toBeNull();
    // Unusable stored value → null, not a guessed relationship.
    expect(resolveYesterdayMemory(ev({ relationship: "friend" as never }))).toBeNull();
  });

  it("never uses completion / judgment / achievement language", () => {
    const banned = /\b(completed?|complete|success|succeeded|failed?|missed|great job|congratulations|streak|score|progress|goal|better|diagnos)/i;
    for (const relationship of ["self", "others", "world"] as const) {
      const line = resolveYesterdayMemory(ev({ relationship }))!.line;
      expect(line).not.toMatch(banned);
      // A choice, never an action-done claim.
      expect(line).toMatch(/^Yesterday, you chose to/);
      expect(line).not.toMatch(/\d|%/);
    }
  });

  it("is deterministic — same evidence always yields the same line", () => {
    const a = resolveYesterdayMemory(ev({ relationship: "others" }));
    const b = resolveYesterdayMemory(ev({ relationship: "others" }));
    expect(a).toEqual(b);
  });
});
