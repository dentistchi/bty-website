/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { sanitizeRoomReturn } from "./roomReturn";

/** Slice 3.1B-3E.1 contract C — only the app shell is a valid Room return; reject the rest. */
describe("sanitizeRoomReturn", () => {
  it("accepts the canonical app-shell return targets", () => {
    expect(sanitizeRoomReturn("/en/app?tab=foundry")).toBe("/en/app?tab=foundry");
    expect(sanitizeRoomReturn("/ko/app?tab=foundry")).toBe("/ko/app?tab=foundry");
    expect(sanitizeRoomReturn("/en/app")).toBe("/en/app");
    expect(sanitizeRoomReturn(encodeURIComponent("/en/app?tab=foundry"))).toBe("/en/app?tab=foundry");
  });

  it("rejects external / protocol-relative / malformed URLs", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "http://arena.btydaily.com/en/app",
      "/en/app\\@evil.com",
      "javascript:alert(1)",
      "/en/bty", // not the app shell
      "/en/appearance", // not an /app path boundary
      "/fr/app",
      "",
      null,
      undefined,
    ]) {
      expect(sanitizeRoomReturn(bad as string)).toBeNull();
    }
  });
});
