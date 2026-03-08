/**
 * locale — getLocaleFromPathname 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { getLocaleFromPathname } from "./locale";

describe("locale", () => {
  describe("getLocaleFromPathname", () => {
    it("returns ko for /ko and /ko/ paths", () => {
      expect(getLocaleFromPathname("/ko")).toBe("ko");
      expect(getLocaleFromPathname("/ko/")).toBe("ko");
      expect(getLocaleFromPathname("/ko/bty")).toBe("ko");
      expect(getLocaleFromPathname("/ko/bty/dashboard")).toBe("ko");
    });
    it("returns en for /en and /en/ paths", () => {
      expect(getLocaleFromPathname("/en")).toBe("en");
      expect(getLocaleFromPathname("/en/train/day/1")).toBe("en");
    });
    it("returns en (default) when no locale prefix", () => {
      expect(getLocaleFromPathname("/")).toBe("en");
      expect(getLocaleFromPathname("/train/day/1")).toBe("en");
      expect(getLocaleFromPathname("/bty")).toBe("en");
    });
  });
});
