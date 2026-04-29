import { describe, it, expect } from "vitest";
import { canAccessEliteOnlyContent } from "./eliteUnlock";

describe("eliteUnlock domain", () => {
  describe("canAccessEliteOnlyContent", () => {
    it("allows access when content is not elite_only", () => {
      expect(canAccessEliteOnlyContent(false, false)).toBe(true);
      expect(canAccessEliteOnlyContent(true, false)).toBe(true);
    });
    it("allows access when content is elite_only and user is elite", () => {
      expect(canAccessEliteOnlyContent(true, true)).toBe(true);
    });
    it("denies access when content is elite_only and user is not elite", () => {
      expect(canAccessEliteOnlyContent(false, true)).toBe(false);
    });
  });
});
