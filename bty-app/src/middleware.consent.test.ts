import { describe, expect, it } from "vitest";
import { isConsentBypassed } from "./middleware";

describe("isConsentBypassed — allowlist paths (defensive, /api/* not in matcher)", () => {
  it("bypasses /api/auth/login", () => {
    expect(isConsentBypassed("/api/auth/login")).toBe(true);
  });
  it("bypasses /api/auth/register", () => {
    expect(isConsentBypassed("/api/auth/register")).toBe(true);
  });
  it("bypasses /api/auth/send-reset-email", () => {
    expect(isConsentBypassed("/api/auth/send-reset-email")).toBe(true);
  });
  it("bypasses /api/auth/callback", () => {
    expect(isConsentBypassed("/api/auth/callback")).toBe(true);
  });
  it("bypasses /api/legal/accept", () => {
    expect(isConsentBypassed("/api/legal/accept")).toBe(true);
  });
  it("bypasses /api/version", () => {
    expect(isConsentBypassed("/api/version")).toBe(true);
  });
});

describe("isConsentBypassed — locale legal pages", () => {
  it("bypasses /en/legal/accept", () => {
    expect(isConsentBypassed("/en/legal/accept")).toBe(true);
  });
  it("bypasses /ko/legal/accept", () => {
    expect(isConsentBypassed("/ko/legal/accept")).toBe(true);
  });
  it("bypasses /en/legal/anything-else", () => {
    expect(isConsentBypassed("/en/legal/privacy")).toBe(true);
  });
});

describe("isConsentBypassed — static assets and framework paths", () => {
  it("bypasses /_next/static/foo", () => {
    expect(isConsentBypassed("/_next/static/chunks/main.js")).toBe(true);
  });
  it("bypasses /favicon.ico", () => {
    expect(isConsentBypassed("/favicon.ico")).toBe(true);
  });
  it("bypasses image assets by extension", () => {
    expect(isConsentBypassed("/path/to/image.png")).toBe(true);
    expect(isConsentBypassed("/path/to/photo.jpg")).toBe(true);
    expect(isConsentBypassed("/path/to/icon.svg")).toBe(true);
  });
  it("bypasses font assets", () => {
    expect(isConsentBypassed("/_next/static/font.woff2")).toBe(true);
  });
});

describe("isConsentBypassed — non-bypassed paths (consent gate applies)", () => {
  it("does NOT bypass /en/bty", () => {
    expect(isConsentBypassed("/en/bty")).toBe(false);
  });
  it("does NOT bypass /ko/bty-arena", () => {
    expect(isConsentBypassed("/ko/bty-arena")).toBe(false);
  });
  it("does NOT bypass /en/bty/dashboard", () => {
    expect(isConsentBypassed("/en/bty/dashboard")).toBe(false);
  });
  it("does NOT bypass /en/legal (without trailing slash, no /legal/ child path)", () => {
    expect(isConsentBypassed("/en/legal")).toBe(false);
  });
});
