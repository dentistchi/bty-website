/**
 * Unit tests for auth cookie policy constants (BTY_RELEASE_GATE, bty-auth-deploy-safety).
 * Tests exported constants only; no business/XP logic.
 */
import { describe, it, expect } from "vitest";
import { AUTH_BASE, AUTH_COOKIE_NAMES } from "./authCookies";

describe("authCookies", () => {
  describe("AUTH_BASE", () => {
    it("is a non-empty string", () => {
      expect(typeof AUTH_BASE).toBe("string");
      expect(AUTH_BASE.length).toBeGreaterThan(0);
    });

    it("matches Supabase auth token prefix pattern", () => {
      expect(AUTH_BASE).toMatch(/^[a-z-]+$/);
    });
  });

  describe("AUTH_COOKIE_NAMES", () => {
    it("is an array containing AUTH_BASE", () => {
      expect(Array.isArray(AUTH_COOKIE_NAMES)).toBe(true);
      expect(AUTH_COOKIE_NAMES).toContain(AUTH_BASE);
    });

    it("has base plus numbered suffixes for chunked cookies", () => {
      expect(AUTH_COOKIE_NAMES.length).toBeGreaterThanOrEqual(1);
      expect(AUTH_COOKIE_NAMES.length).toBeLessThanOrEqual(10);
      for (const name of AUTH_COOKIE_NAMES) {
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
        expect(name.startsWith(AUTH_BASE) || name === AUTH_BASE).toBe(true);
      }
    });

    it("has no duplicate names", () => {
      const set = new Set(AUTH_COOKIE_NAMES);
      expect(set.size).toBe(AUTH_COOKIE_NAMES.length);
    });
  });
});
