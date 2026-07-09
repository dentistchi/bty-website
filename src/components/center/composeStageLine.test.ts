import { describe, it, expect } from "vitest";
import { composeStageLine } from "./CenterMeCard";

/**
 * Guardrail test (Native Me Provenance Guardrails STEP 1).
 *
 * Locks the Me-card stage line to the identity form "<codeName> · Stage <ordinal>" ONLY.
 * These assertions are the contract that keeps CenterMeCard a Center/self mirror and prevents
 * it from ever surfacing an Arena stageName, a raw stage string, or any competition metric.
 */
describe("composeStageLine — Me-card identity guardrail", () => {
  it("composes '<codeName> · Stage <ordinal>' from codeName + Core-XP stage", () => {
    expect(composeStageLine("FORGE", "STAGE 1: FORGE")).toBe("FORGE · Stage 1");
    expect(composeStageLine("FORGE", "STAGE 3: FORGE")).toBe("FORGE · Stage 3");
  });

  it("renders ONLY the ordinal form — never the raw stage string", () => {
    // codeName present + parseable stage → the clean identity form (no "STAGE N: CODE" leak).
    const out = composeStageLine("ANVIL", "STAGE 2: ANVIL");
    expect(out).toBe("ANVIL · Stage 2");
    expect(out).not.toContain("STAGE 2: ANVIL");
    expect(out).toMatch(/^[A-Za-z]+ · Stage \d+$/);
  });

  it("returns null (mirror-only) when there is no stage", () => {
    expect(composeStageLine("FORGE", null)).toBeNull();
    expect(composeStageLine("FORGE", undefined)).toBeNull();
    expect(composeStageLine("FORGE", "")).toBeNull();
    expect(composeStageLine("FORGE", "   ")).toBeNull();
  });

  it("returns null when codeName is missing — no raw-string pass-through", () => {
    // Even with a real Core-XP stage, without an identity code we show the mirror ALONE,
    // rather than leaking "STAGE 1: FORGE".
    expect(composeStageLine(null, "STAGE 1: FORGE")).toBeNull();
    expect(composeStageLine(undefined, "STAGE 1: FORGE")).toBeNull();
    expect(composeStageLine("  ", "STAGE 1: FORGE")).toBeNull();
  });

  it("NEVER surfaces an Arena stageName (no 'STAGE N:' shape → null)", () => {
    // Arena stage NAMES (Spark/Ember/Flame/Inferno, etc.) are not Center-safe and must never
    // render here. Any value that is not the Core-XP "STAGE N: …" shape → mirror-only.
    for (const arena of ["Spark", "Ember", "Flame", "Inferno", "Rank 1", "Diamond"]) {
      expect(composeStageLine("FORGE", arena)).toBeNull();
    }
  });

  it("never emits XP / rank / raw-metric tokens", () => {
    const out = composeStageLine("FORGE", "STAGE 1: FORGE") ?? "";
    expect(out.toLowerCase()).not.toMatch(/xp|rank|air|streak|point|score|%/);
  });
});
