import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  evaluateDestructiveTarget,
  supabaseProjectRef,
} from "@/domain/safety/destructiveTarget";
import {
  assertDestructiveTargetAllowed,
  destructiveTargetDecision,
  isDestructiveTargetAllowed,
} from "@/lib/bty/safety/destructiveTargetGuard.server";

/**
 * The boundary that had to exist after P0 (Slice P0-R1).
 *
 * Production lost every `auth.users` row and, by cascade, its Action Contracts, Arena runs, Core XP
 * and both Leadership Engine logs. These tests pin the rule that keeps a dev/test path from being
 * able to reach the production project again, and they are written so that the DANGEROUS case is
 * the one asserted explicitly — a guard whose tests only prove the happy path is not a guard.
 */

const PROD_URL = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
const SAFE_URL = "https://disposabletestproject.supabase.co";

describe("supabaseProjectRef", () => {
  it("reads the ref off a Supabase URL", () => {
    expect(supabaseProjectRef(PROD_URL)).toBe(PRODUCTION_SUPABASE_PROJECT_REF);
    expect(supabaseProjectRef("https://Abc123.supabase.co/")).toBe("abc123");
  });

  it("returns null for anything whose project cannot be proven", () => {
    // Each of these is a target we cannot NAME, and an unnameable target is refused, not trusted.
    for (const v of [undefined, null, 42, "", "   ", "not a url", "http://localhost:54321", "https://evil.com"]) {
      expect(supabaseProjectRef(v)).toBeNull();
    }
  });
});

describe("evaluateDestructiveTarget — the production project is refused first", () => {
  it("refuses production EVEN WITH the opt-in enabled", () => {
    // The opt-in is not a key to production. This is the assertion the incident earned.
    const d = evaluateDestructiveTarget({ supabaseUrl: PROD_URL, optIn: "1" });
    expect(d.allowed).toBe(false);
    expect(d).toMatchObject({ reason: "production_project" });
  });

  it("refuses production without the opt-in, and names production as the reason", () => {
    const d = evaluateDestructiveTarget({ supabaseUrl: PROD_URL, optIn: undefined });
    expect(d.allowed).toBe(false);
    expect(d).toMatchObject({ reason: "production_project" });
  });

  it("fails closed when the project cannot be identified", () => {
    for (const url of [undefined, "", "http://localhost:54321"]) {
      const d = evaluateDestructiveTarget({ supabaseUrl: url, optIn: "1" });
      expect(d.allowed).toBe(false);
      expect(d).toMatchObject({ reason: "unresolvable_project" });
    }
  });

  it("refuses a non-production project that has no explicit opt-in", () => {
    const d = evaluateDestructiveTarget({ supabaseUrl: SAFE_URL, optIn: undefined });
    expect(d.allowed).toBe(false);
    expect(d).toMatchObject({ reason: "no_opt_in" });
  });

  it("allows ONLY a non-production project with an explicit opt-in", () => {
    expect(evaluateDestructiveTarget({ supabaseUrl: SAFE_URL, optIn: "1" })).toEqual({
      allowed: true,
      projectRef: "disposabletestproject",
    });
    // A truthy-but-wrong opt-in value is not an opt-in.
    for (const v of ["true", "yes", "0", " ", 1]) {
      expect(evaluateDestructiveTarget({ supabaseUrl: SAFE_URL, optIn: v }).allowed).toBe(false);
    }
  });
});

describe("destructiveTargetGuard (env-reading)", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("reads the SAME variables the destructive operation would connect with", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PROD_URL);
    vi.stubEnv("E2E_ALLOW_TEST_CLEANUP", "1");
    expect(isDestructiveTargetAllowed()).toBe(false);
    expect(destructiveTargetDecision()).toMatchObject({ reason: "production_project" });

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SAFE_URL);
    expect(isDestructiveTargetAllowed()).toBe(true);
  });

  it("throws against production, naming the project and never a credential", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PROD_URL);
    vi.stubEnv("E2E_ALLOW_TEST_CLEANUP", "1");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_THIS_MUST_NEVER_APPEAR");
    try {
      assertDestructiveTargetAllowed("some.helper");
      throw new Error("expected a refusal");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("some.helper");
      expect(msg).toContain(PRODUCTION_SUPABASE_PROJECT_REF);
      expect(msg).not.toContain("sb_secret_THIS_MUST_NEVER_APPEAR");
    }
  });

  it("does not throw for an opted-in non-production project", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SAFE_URL);
    vi.stubEnv("E2E_ALLOW_TEST_CLEANUP", "1");
    expect(() => assertDestructiveTargetAllowed("some.helper")).not.toThrow();
  });
});
