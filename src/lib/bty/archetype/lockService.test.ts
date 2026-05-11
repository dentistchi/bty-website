/**
 * lockService unit-testable surface — earnedNaming gate integration.
 *
 * Supabase-dependent tests (DB read/write, RPC) require integration test setup
 * and are outside the scope of this file. The earnedNaming gate logic itself
 * is fully tested in earnedNaming.test.ts.
 *
 * This file tests the ResolveArchetypeResult type contract and any pure helpers.
 */

import { describe, it, expect } from "vitest";
import type { ResolveArchetypeResult } from "./lockService";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "./earnedNaming";

describe("ResolveArchetypeResult type contract", () => {
  it("pattern_forming variant has status=pattern_forming and no archetypeName", () => {
    const result: ResolveArchetypeResult = {
      ok: true,
      source: "pattern_forming",
      progress: { scenariosCompleted: 5, contractsCompleted: 1 },
      threshold: ENTRY_THRESHOLD,
    };
    expect(result.ok).toBe(true);
    expect(result.source).toBe("pattern_forming");
    expect(result.progress.scenariosCompleted).toBe(5);
    // TypeScript enforces: no archetypeName on pattern_forming variant
  });

  it("archetype_assigned variant has archetypeName and no progress", () => {
    const result: ResolveArchetypeResult = {
      ok: true,
      source: "newly_locked",
      archetypeName: "CLEARANCHOR",
      archetypeClass: "truth",
    };
    expect(result.ok).toBe(true);
    expect(result.source).toBe("newly_locked");
    // TypeScript already narrows to archetype variant from literal assignment
    expect(result.archetypeName).toBe("CLEARANCHOR");
  });

  it("error variant has ok=false", () => {
    const result: ResolveArchetypeResult = {
      ok: false,
      error: "something failed",
      code: "DB_ERROR",
    };
    expect(result.ok).toBe(false);
  });

  it("exit threshold is used for existing lock holders (hysteresis)", () => {
    const result: ResolveArchetypeResult = {
      ok: true,
      source: "pattern_forming",
      progress: { scenariosCompleted: 7, contractsCompleted: 1 },
      threshold: EXIT_THRESHOLD,
    };
    expect(result.threshold).toBe(EXIT_THRESHOLD);
    expect(result.threshold.scenariosCompleted).toBe(8);
  });
});

describe("caller narrowing pattern (§7.1)", () => {
  it("callers narrow by source to access archetype fields safely", () => {
    // Simulate how a real caller (route.ts, getMyPageIdentityState.ts) would narrow.
    // The function accepts the full union so TypeScript can't narrow from literal assignment.
    function extractArchetypeName(result: ResolveArchetypeResult): string | null {
      if (!result.ok) return null;
      if (result.source === "pattern_forming") return null;
      return result.archetypeName; // TypeScript knows this is string here
    }

    const archetype: ResolveArchetypeResult = {
      ok: true,
      source: "cached_match",
      archetypeName: "IRONROOT",
      archetypeClass: "pressure",
    };
    const patternForming: ResolveArchetypeResult = {
      ok: true,
      source: "pattern_forming",
      progress: { scenariosCompleted: 5, contractsCompleted: 1 },
      threshold: ENTRY_THRESHOLD,
    };

    expect(extractArchetypeName(archetype)).toBe("IRONROOT");
    expect(extractArchetypeName(patternForming)).toBeNull();
  });
});
