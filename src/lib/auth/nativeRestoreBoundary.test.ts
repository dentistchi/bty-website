import { describe, it, expect } from "vitest";
import { isEstablishingSessionPath } from "./nativeRestoreBoundary";

/**
 * R1G — the boundary that keeps native session restore off the OAuth callback.
 *
 * Pure, because the decision is pure: the provider only needs to know whether THIS path is in the
 * middle of establishing a session. Tested here rather than through the provider, whose boot effect
 * is gated by a module-level in-flight cache and several public-path short circuits.
 */
describe("isEstablishingSessionPath", () => {
  it.each(["/en/auth/callback", "/ko/auth/callback", "/en/auth/callback/", "/ko/auth/callback/x"])(
    "%s IS establishing a session — restore must be suppressed",
    (p) => expect(isEstablishingSessionPath(p)).toBe(true),
  );

  it.each([
    "/en/app",
    "/ko/app",
    "/start",
    "/en/bty/login",
    "/en/reset-password",
    "/en/auth/callbackx",      // near-miss must NOT match
    "/auth/callback",          // no locale segment
    "/en/authx/callback",
  ])("%s is an ordinary route — durable-session restore is preserved", (p) =>
    expect(isEstablishingSessionPath(p)).toBe(false),
  );

  it("an unknown path never suppresses restore — the guard only acts where it is provably needed", () => {
    expect(isEstablishingSessionPath(null)).toBe(false);
    expect(isEstablishingSessionPath(undefined)).toBe(false);
    expect(isEstablishingSessionPath("")).toBe(false);
  });
});
