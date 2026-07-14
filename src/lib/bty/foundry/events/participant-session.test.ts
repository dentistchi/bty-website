import { describe, it, expect } from "vitest";
import {
  generateParticipantSessionToken,
  hashParticipantSessionToken,
  participantCookieName,
} from "./participant-session";

describe("generateParticipantSessionToken", () => {
  it("produces a high-entropy url-safe token (>=192-bit, base64url of 32 bytes)", () => {
    const t = generateParticipantSessionToken();
    // 32 bytes base64url -> 43 chars, no padding, url-safe alphabet only.
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(42);
  });

  it("is unique across mints (no sequential/guessable pattern)", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateParticipantSessionToken()));
    expect(set.size).toBe(200);
  });
});

describe("hashParticipantSessionToken", () => {
  it("is deterministic for the same token", () => {
    const t = generateParticipantSessionToken();
    expect(hashParticipantSessionToken(t)).toBe(hashParticipantSessionToken(t));
  });

  it("differs for different tokens and never equals the raw token", () => {
    const a = generateParticipantSessionToken();
    const b = generateParticipantSessionToken();
    expect(hashParticipantSessionToken(a)).not.toBe(hashParticipantSessionToken(b));
    expect(hashParticipantSessionToken(a)).not.toBe(a);
    expect(hashParticipantSessionToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("participantCookieName", () => {
  it("is event-scoped and hyphen-free", () => {
    const name = participantCookieName("11111111-1111-1111-1111-111111111111");
    expect(name).toBe("bty_fr_ps_11111111111111111111111111111111");
    expect(name).not.toContain("-");
  });

  it("differs per event", () => {
    const a = participantCookieName("aaaaaaaa-0000-0000-0000-000000000000");
    const b = participantCookieName("bbbbbbbb-0000-0000-0000-000000000000");
    expect(a).not.toBe(b);
  });
});
