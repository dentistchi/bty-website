import { describe, expect, it } from "vitest";
import {
  inferLocaleFromNextParam,
  normalizeNextPathCandidate,
  sanitizeNextForRedirect,
} from "./sanitize-next-for-redirect";

describe("sanitizeNextForRedirect", () => {
  it("falls back for //evil.com", () => {
    expect(sanitizeNextForRedirect("//evil.com", { locale: "en" })).toBe("/en/bty");
    expect(sanitizeNextForRedirect("/%2F%2Fevil.com", { locale: "en" })).toBe("/en/bty");
  });

  it("falls back for https://evil.com", () => {
    expect(sanitizeNextForRedirect("https://evil.com", { locale: "en" })).toBe("/en/bty");
  });

  it("falls back for backslash host trick", () => {
    expect(sanitizeNextForRedirect("\\evil.com", { locale: "en" })).toBe("/en/bty");
    expect(sanitizeNextForRedirect("/foo\\bar", { locale: "en" })).toBe("/en/bty");
  });

  it("allows /ko/bty/home", () => {
    expect(sanitizeNextForRedirect("/ko/bty/home", { locale: "ko" })).toBe("/ko/bty/home");
  });

  it("allows /en/bty/arena", () => {
    expect(sanitizeNextForRedirect("/en/bty/arena", { locale: "en" })).toBe("/en/bty/arena");
  });

  it("blocks login loop paths", () => {
    expect(sanitizeNextForRedirect("/en/bty/login", { locale: "en" })).toBe("/en/bty");
    expect(sanitizeNextForRedirect("/ko/bty/login?x=1", { locale: "ko" })).toBe("/ko/bty");
    expect(sanitizeNextForRedirect("/bty/login", { locale: "en" })).toBe("/en/bty");
  });

  it("inferLocaleFromNextParam reads /ko/ prefix", () => {
    expect(inferLocaleFromNextParam("/ko/bty/arena")).toBe("ko");
    expect(inferLocaleFromNextParam("/en/bty/arena")).toBe("en");
  });

  it("normalizeNextPathCandidate rejects empty", () => {
    expect(normalizeNextPathCandidate("")).toBeNull();
    expect(normalizeNextPathCandidate("   ")).toBeNull();
  });
});
