import { describe, it, expect, beforeAll } from "vitest";
import {
  signFoundryRoomToken,
  verifyFoundryRoomToken,
  FOUNDRY_ROOM_TOKEN_PREFIX,
} from "./foundry-room-token";

beforeAll(() => {
  // Deterministic secret for the crypto path (no real secret needed in unit tests).
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-foundry-room-secret-0123456789";
});

function mint(overrides: Partial<Parameters<typeof signFoundryRoomToken>[0]> = {}) {
  return signFoundryRoomToken({
    type: "foundry_room",
    eventId: "11111111-1111-1111-1111-111111111111",
    joinVersion: 1,
    iat: 1_700_000_000_000,
    ...overrides,
  });
}

describe("signFoundryRoomToken / verifyFoundryRoomToken", () => {
  it("round-trips a valid token", () => {
    const token = mint();
    expect(token.startsWith(`${FOUNDRY_ROOM_TOKEN_PREFIX}.`)).toBe(true);
    const r = verifyFoundryRoomToken(token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.eventId).toBe("11111111-1111-1111-1111-111111111111");
      expect(r.payload.joinVersion).toBe(1);
      expect(r.payload.type).toBe("foundry_room");
    }
  });

  it("preserves joinVersion through rotation mints", () => {
    const r = verifyFoundryRoomToken(mint({ joinVersion: 7 }));
    expect(r.ok && r.payload.joinVersion).toBe(7);
  });

  it("rejects an empty / malformed token", () => {
    expect(verifyFoundryRoomToken("")).toEqual({ ok: false, reason: "invalid_token" });
    expect(verifyFoundryRoomToken("garbage")).toEqual({ ok: false, reason: "invalid_token" });
    expect(verifyFoundryRoomToken("a.b")).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects the wrong prefix (another QR family)", () => {
    const token = mint();
    const swapped = token.replace(FOUNDRY_ROOM_TOKEN_PREFIX, "btyev1");
    expect(verifyFoundryRoomToken(swapped)).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects a tampered payload (signature mismatch)", () => {
    const token = mint();
    const [prefix, , sig] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        type: "foundry_room",
        eventId: "22222222-2222-2222-2222-222222222222",
        joinVersion: 1,
        iat: 1,
      }),
      "utf8",
    ).toString("base64url");
    const forged = `${prefix}.${forgedPayload}.${sig}`;
    expect(verifyFoundryRoomToken(forged)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token signed with a different secret", () => {
    const token = mint();
    const original = process.env.FOUNDRY_ROOM_QR_SECRET;
    process.env.FOUNDRY_ROOM_QR_SECRET = "a-completely-different-secret-value";
    const r = verifyFoundryRoomToken(token);
    process.env.FOUNDRY_ROOM_QR_SECRET = original;
    expect(r).toEqual({ ok: false, reason: "bad_signature" });
  });
});
