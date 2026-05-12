/**
 * Integration tests — resolveArchetypeForUser service boundary.
 * Spec: docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md §4, §7.1
 *
 * Supabase is mocked at the client boundary. Selector, fingerprint, earnedNaming,
 * and transition modules run with real implementations.
 *
 * IT-1: PATTERN_FORMING → earned transition
 * IT-2: Hysteresis — EXIT threshold for existing lock holders
 * IT-3: IT3-B — EXIT violation, no DB write (lock preserved)
 * IT-4: Determinism — 100 calls, same fingerprint → same archetype
 * IT-5: Race condition → cached_match convergence, no RPC write
 * IT-6: PATTERN_FORMING DB isolation — RPC never called
 * IT-7: Response contract §7.1 — forbidden fields absent
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { resolveArchetypeForUser } from "@/lib/bty/archetype/lockService";
import type { ArchetypeLockRow } from "@/lib/bty/archetype/lockService";
import type { FingerprintInput, AxisVector } from "@/lib/bty/archetype/fingerprint";
import { ENTRY_THRESHOLD, EXIT_THRESHOLD } from "@/lib/bty/archetype/earnedNaming";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

beforeEach(() => {
  vi.resetAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_AXIS: AxisVector = {
  ownership: 0.5,
  time: 0.5,
  authority: 0.5,
  truth: 0.5,
  repair: 0.5,
  conflict: 0.5,
  integrity: 0.5,
  visibility: 0.5,
  accountability: 0.5,
  courage: 0.5,
  control: 0.5,
  identity: 0.5,
};

/**
 * courage=0.70 → NIGHTFORGE uniquely matches (courage≥0.65).
 * STILLWATER excluded (conflict=0.5 > 0.40 max).
 * All other archetypes excluded by their axis conditions.
 */
const NIGHTFORGE_AXIS: AxisVector = { ...BASE_AXIS, courage: 0.70 };

/** Lock created 2 days ago — within 7-day hard floor; any transition attempt → "too_soon". */
const RECENT_NIGHTFORGE_LOCK: ArchetypeLockRow = {
  id: "lock-001",
  archetype_name: "NIGHTFORGE",
  archetype_class: "courage",
  input_hash: "existing-hash-abc123",
  locked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  scenarios_completed_at_lock: 15,
  contracts_completed_at_lock: 4,
};

/** Well above ENTRY_THRESHOLD (12/3). */
const EARNED_INPUT: FingerprintInput = {
  axisVector: NIGHTFORGE_AXIS,
  patternFamilies: ["pressure"],
  scenariosCompleted: 15,
  contractsCompleted: 4,
};

/** Above EXIT_THRESHOLD (8/2), below ENTRY_THRESHOLD (12/3). */
const HYSTERESIS_INPUT: FingerprintInput = {
  axisVector: NIGHTFORGE_AXIS,
  patternFamilies: ["pressure"],
  scenariosCompleted: 9,
  contractsCompleted: 2,
};

/** Below ENTRY_THRESHOLD — no existing lock. */
const INSUFFICIENT_INPUT: FingerprintInput = {
  axisVector: NIGHTFORGE_AXIS,
  patternFamilies: [],
  scenariosCompleted: 5,
  contractsCompleted: 1,
};

/** Below EXIT_THRESHOLD (8/2) — triggers IT3-B when existing lock is present. */
const EXIT_VIOLATION_INPUT: FingerprintInput = {
  axisVector: NIGHTFORGE_AXIS,
  patternFamilies: [],
  scenariosCompleted: 7,
  contractsCompleted: 1,
};

// ── Mock factory ──────────────────────────────────────────────────────────────

type MockConfig = {
  /** Returned when the chain has no eq("input_hash", …) call — findCurrentActiveLock. */
  currentActiveLock: ArchetypeLockRow | null;
  /** Returned when eq("input_hash", …) is present in the chain — findActiveLockByHash. */
  lockByHash: ArchetypeLockRow | null;
  /** RPC error to simulate (null = success). */
  rpcError?: { message: string; code?: string } | null;
};

/**
 * Builds a minimal SupabaseClient mock that handles the two query patterns used by
 * lockService: findCurrentActiveLock (no input_hash eq) and findActiveLockByHash
 * (input_hash eq present). Each from() call creates an independent builder chain.
 *
 * rpcSpy is placed on the admin client (getSupabaseAdmin mock) because lockService
 * calls getSupabaseAdmin().rpc(...) for bty_create_archetype_lock (§9 Forbidden,
 * public execute revoked — Option B PF-2).
 */
function makeMockSupabase(config: MockConfig) {
  const rpcSpy = vi.fn().mockResolvedValue({
    data: "mock-uuid-lock",
    error: config.rpcError ?? null,
  });

  // Admin client owns the rpc spy — lockService routes RPC through getSupabaseAdmin().
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    rpc: rpcSpy,
  } as unknown as SupabaseClient);

  const client = {
    from: (_table: string) => {
      let seenInputHash = false;
      const builder = {
        select: () => builder,
        eq: (col: string, _val: unknown) => {
          if (col === "input_hash") seenInputHash = true;
          return builder;
        },
        is: () => builder,
        // Support both spellings — production code shows maybySingle; provide both to be safe.
        maybySingle: async () => ({
          data: seenInputHash ? config.lockByHash : config.currentActiveLock,
          error: null,
        }),
        maybeSingle: async () => ({
          data: seenInputHash ? config.lockByHash : config.currentActiveLock,
          error: null,
        }),
      };
      return builder;
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    rpcSpy,
  };
}

// ── IT-1: PATTERN_FORMING → earned transition ─────────────────────────────────

describe("IT-1: PATTERN_FORMING → earned transition", () => {
  it("evidence below ENTRY threshold returns pattern_forming with ENTRY_THRESHOLD", async () => {
    const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    const result = await resolveArchetypeForUser(client, "user-it1", INSUFFICIENT_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.source).toBe("pattern_forming");
    if (result.source !== "pattern_forming") throw new Error("unreachable");
    expect(result.threshold).toBe(ENTRY_THRESHOLD);
    expect(result.progress.scenariosCompleted).toBe(5);
    expect(result.progress.contractsCompleted).toBe(1);
  });

  it("evidence above ENTRY threshold returns newly_locked with NIGHTFORGE", async () => {
    const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    const result = await resolveArchetypeForUser(client, "user-it1", EARNED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.source).toBe("newly_locked");
    if (result.source === "pattern_forming") throw new Error("unreachable");
    expect(result.archetypeName).toBe("NIGHTFORGE");
    expect(result.archetypeClass).toBe("courage");
  });
});

// ── IT-2: Hysteresis ──────────────────────────────────────────────────────────

describe("IT-2: Hysteresis — EXIT threshold for existing lock holder", () => {
  it("existing lock + evidence above EXIT threshold → transition_blocked (too_soon)", async () => {
    const { client } = makeMockSupabase({
      currentActiveLock: RECENT_NIGHTFORGE_LOCK,
      lockByHash: null,
    });

    const result = await resolveArchetypeForUser(client, "user-it2", HYSTERESIS_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // EXIT threshold applied (9≥8, 2≥2) → eligible; 7-day floor blocks the transition.
    expect(result.source).toBe("transition_blocked");
    if (result.source !== "transition_blocked") throw new Error("unreachable");
    expect(result.archetypeName).toBe("NIGHTFORGE");
    expect(result.blockReason).toBe("too_soon");
  });

  it("new user (no lock) with same hysteresis evidence → uses ENTRY threshold → pattern_forming", async () => {
    const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    const result = await resolveArchetypeForUser(client, "user-it2b", HYSTERESIS_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // ENTRY threshold (12/3) applied for new user — 9 < 12 → ineligible.
    expect(result.source).toBe("pattern_forming");
    if (result.source !== "pattern_forming") throw new Error("unreachable");
    expect(result.threshold).toBe(ENTRY_THRESHOLD);
  });
});

// ── IT-3: IT3-B — EXIT violation, no DB write ─────────────────────────────────

describe("IT-3: IT3-B — EXIT violation, no RPC write", () => {
  it("existing lock + evidence below EXIT threshold: RPC never called", async () => {
    const { client, rpcSpy } = makeMockSupabase({
      currentActiveLock: RECENT_NIGHTFORGE_LOCK,
      lockByHash: null,
    });

    await resolveArchetypeForUser(client, "user-it3", EXIT_VIOLATION_INPUT);

    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("returns pattern_forming with EXIT_THRESHOLD (lock row intact in DB)", async () => {
    const { client } = makeMockSupabase({
      currentActiveLock: RECENT_NIGHTFORGE_LOCK,
      lockByHash: null,
    });

    const result = await resolveArchetypeForUser(client, "user-it3", EXIT_VIOLATION_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.source).toBe("pattern_forming");
    if (result.source !== "pattern_forming") throw new Error("unreachable");
    expect(result.threshold).toBe(EXIT_THRESHOLD);
  });
});

// ── IT-4: Determinism — 100 calls ─────────────────────────────────────────────

describe("IT-4: Determinism — same fingerprint → same archetype across 100 calls", () => {
  it("all 100 calls return archetypeName=NIGHTFORGE", async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () => {
        const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });
        return resolveArchetypeForUser(client, "user-it4", EARNED_INPUT);
      }),
    );

    const names = results.map((r) => {
      if (!r.ok || r.source === "pattern_forming") {
        throw new Error(`unexpected result: ${JSON.stringify(r)}`);
      }
      return r.archetypeName;
    });

    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe("NIGHTFORGE");
  });

  it("source is always newly_locked (no spurious pattern_forming)", async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () => {
        const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });
        return resolveArchetypeForUser(client, "user-it4", EARNED_INPUT);
      }),
    );

    const sources = results.map((r) => (r.ok ? r.source : "error"));
    expect(new Set(sources).size).toBe(1);
    expect(sources[0]).toBe("newly_locked");
  });
});

// ── IT-5: Race condition → cached_match ───────────────────────────────────────

describe("IT-5: Race condition → cached_match convergence", () => {
  it("concurrent lock already exists for this hash → cached_match, RPC not called", async () => {
    const { client, rpcSpy } = makeMockSupabase({
      currentActiveLock: null,    // (A0): no existing lock → passes earned gate
      lockByHash: RECENT_NIGHTFORGE_LOCK, // (A): race winner already wrote the lock
    });

    const result = await resolveArchetypeForUser(client, "user-it5", EARNED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.source).toBe("cached_match");
    if (result.source !== "cached_match") throw new Error("unreachable");
    expect(result.archetypeName).toBe("NIGHTFORGE");
    expect(rpcSpy).not.toHaveBeenCalled();
  });
});

// ── IT-6: PATTERN_FORMING DB isolation ───────────────────────────────────────

describe("IT-6: PATTERN_FORMING DB isolation", () => {
  it("insufficient evidence → RPC never called (no DB write path reached)", async () => {
    const { client, rpcSpy } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    await resolveArchetypeForUser(client, "user-it6", INSUFFICIENT_INPUT);

    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("RPC is called only when evidence passes ENTRY threshold", async () => {
    const { client, rpcSpy } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    await resolveArchetypeForUser(client, "user-it6", EARNED_INPUT);

    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(rpcSpy).toHaveBeenCalledWith(
      "bty_create_archetype_lock",
      expect.objectContaining({
        p_user_id: "user-it6",
        p_archetype_name: "NIGHTFORGE",
      }),
    );
  });
});

// ── IT-7: Response contract §7.1 ─────────────────────────────────────────────

describe("IT-7: Response contract §7.1 — forbidden fields absent", () => {
  it("pattern_forming response has no archetypeName, archetypeClass, or blockReason", async () => {
    const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    const result = await resolveArchetypeForUser(client, "user-it7", INSUFFICIENT_INPUT);

    expect(result.ok).toBe(true);
    expect("archetypeName" in result).toBe(false);
    expect("archetypeClass" in result).toBe(false);
    expect("blockReason" in result).toBe(false);
  });

  it("pattern_forming response has progress and threshold", async () => {
    const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    const result = await resolveArchetypeForUser(client, "user-it7", INSUFFICIENT_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect("progress" in result).toBe(true);
    expect("threshold" in result).toBe(true);
  });

  it("archetype_assigned response has no progress or threshold", async () => {
    const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    const result = await resolveArchetypeForUser(client, "user-it7", EARNED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.source).not.toBe("pattern_forming");
    expect("progress" in result).toBe(false);
    expect("threshold" in result).toBe(false);
  });

  it("archetype_assigned response has archetypeName and archetypeClass", async () => {
    const { client } = makeMockSupabase({ currentActiveLock: null, lockByHash: null });

    const result = await resolveArchetypeForUser(client, "user-it7", EARNED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect("archetypeName" in result).toBe(true);
    expect("archetypeClass" in result).toBe(true);
  });
});
