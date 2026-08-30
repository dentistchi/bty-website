/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { startPkceAttempt, tracePkce, readPkceTrace, formatPkceTrace } from "./pkceTrace";

/**
 * R1H — the diagnostic must be USEFUL and must LEAK NOTHING.
 *
 * Useful: two observations of the same verifier must share a fingerprint, and two different
 * verifiers must not. That is the entire question the device retest has to answer.
 *
 * Leaks nothing: the verifier value, its cookie name, the authorization code and any token must be
 * absent from everything this module stores or renders.
 */
const VERIFIER = "SUPER-SECRET-VERIFIER-VALUE-abcdef0123456789";

function setVerifierCookie(value: string, chunks = 1) {
  document.cookie.split(";").forEach((c) => {
    const n = c.split("=")[0].trim();
    if (n) document.cookie = `${n}=; max-age=0; path=/`;
  });
  if (!value) return;
  if (chunks === 1) {
    document.cookie = `sb-proj-auth-token-code-verifier=${value}; path=/`;
  } else {
    const size = Math.ceil(value.length / chunks);
    for (let i = 0; i < chunks; i++) {
      document.cookie = `sb-proj-auth-token-code-verifier.${i}=${value.slice(i * size, (i + 1) * size)}; path=/`;
    }
  }
}

beforeEach(() => {
  window.sessionStorage.clear();
  setVerifierCookie("");
});

describe("pkceTrace — useful", () => {
  it("the SAME verifier fingerprints identically at two observation points", async () => {
    const a = startPkceAttempt();
    setVerifierCookie(VERIFIER);
    await tracePkce("P2_after_signIn", a);
    await tracePkce("P5_before_exchange", a);
    const [p2, p5] = readPkceTrace();
    expect(p2.fp).toBe(p5.fp);
    expect(p2.exists && p5.exists).toBe(true);
    expect(p2.len).toBe(VERIFIER.length);
  });

  it("a REPLACED verifier fingerprints differently — the overwrite case is detectable", async () => {
    const a = startPkceAttempt();
    setVerifierCookie(VERIFIER);
    await tracePkce("P2_after_signIn", a);
    setVerifierCookie("A-COMPLETELY-DIFFERENT-VERIFIER-9876543210");
    await tracePkce("P5_before_exchange", a);
    const [p2, p5] = readPkceTrace();
    expect(p5.fp).not.toBe(p2.fp);
  });

  it("a REMOVED verifier is detectable as absent — the missing case", async () => {
    const a = startPkceAttempt();
    setVerifierCookie(VERIFIER);
    await tracePkce("P2_after_signIn", a);
    setVerifierCookie("");
    await tracePkce("P5_before_exchange", a);
    const [, p5] = readPkceTrace();
    expect(p5.exists).toBe(false);
    expect(p5.len).toBe(0);
    expect(p5.fp).toBe("-");
  });

  it("chunked storage is combined in index order and counted", async () => {
    setVerifierCookie(VERIFIER, 3);
    await tracePkce("P5_before_exchange", startPkceAttempt());
    const [e] = readPkceTrace();
    expect(e.chunks).toBe(3);
    expect(e.len).toBe(VERIFIER.length);
  });

  it("one attempt id correlates the whole lifecycle", async () => {
    const a = startPkceAttempt();
    setVerifierCookie(VERIFIER);
    await tracePkce("P1_before_signIn", a);
    await tracePkce("P5_before_exchange", a);
    expect(new Set(readPkceTrace().map((e) => e.attempt)).size).toBe(1);
  });
});

describe("pkceTrace — leaks nothing", () => {
  it("neither storage nor the rendered lines contain the verifier or its cookie name", async () => {
    setVerifierCookie(VERIFIER);
    await tracePkce("P5_before_exchange", startPkceAttempt());
    const stored = window.sessionStorage.getItem("bty.pkce.trace") ?? "";
    const rendered = formatPkceTrace(readPkceTrace()).join("\n");
    for (const blob of [stored, rendered]) {
      expect(blob).not.toContain(VERIFIER);
      expect(blob).not.toContain("SUPER-SECRET");
      expect(blob).not.toContain("code-verifier");
      expect(blob).not.toMatch(/eyJ|access_token|refresh_token|@/);
    }
  });

  it("the fingerprint is a short one-way prefix, not the value", async () => {
    setVerifierCookie(VERIFIER);
    await tracePkce("P5_before_exchange", startPkceAttempt());
    const [e] = readPkceTrace();
    expect(e.fp).toMatch(/^[0-9a-f]{8}$/);
    expect(VERIFIER).not.toContain(e.fp);
  });

  it("never throws when storage or crypto is unavailable", async () => {
    setVerifierCookie(VERIFIER);
    const orig = window.sessionStorage.setItem;
    window.sessionStorage.setItem = () => {
      throw new Error("quota");
    };
    await expect(tracePkce("P5_before_exchange", "x")).resolves.toBeUndefined();
    window.sessionStorage.setItem = orig;
  });
});
