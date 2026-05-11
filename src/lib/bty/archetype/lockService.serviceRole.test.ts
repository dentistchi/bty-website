/**
 * Service role client isolation tests — Option B PF-2 enforcement.
 *
 * Verifies that bty_create_archetype_lock RPC goes through the service role
 * client (getSupabaseAdmin) and that SELECT queries remain on the user-scoped
 * client (RLS preserved). §9 Forbidden: users must not declare/override archetypes.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FingerprintInput } from "./fingerprint";

vi.mock("../../supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

// Import AFTER vi.mock so the mock is applied before the module resolves.
import { resolveArchetypeForUser } from "./lockService";
import { getSupabaseAdmin } from "../../supabase-admin";

// ── Fixtures ─────────────────────────────────────────────────────────────────

// NIGHTFORGE axis: courage=0.70 ≥ 0.65 → single condition match, specificity=100.
// conflict=0.5 > 0.40 → STILLWATER excluded. Deterministic selector output.
const NIGHTFORGE_AXIS = {
  ownership: 0.5, time: 0.5, authority: 0.5, truth: 0.5,
  repair: 0.3, conflict: 0.5, integrity: 0.5, visibility: 0.5,
  accountability: 0.5, courage: 0.70, control: 0.5, identity: 0.5,
};

const ELIGIBLE_INPUT: FingerprintInput = {
  axisVector: NIGHTFORGE_AXIS,
  patternFamilies: [],
  scenariosCompleted: 15, // > ENTRY_THRESHOLD (12)
  contractsCompleted: 4,  // > ENTRY_THRESHOLD (3)
};

// ── Mock helpers ──────────────────────────────────────────────────────────────

/**
 * User-scoped client — all DB reads return null (no cached / active lock).
 * Tracks `from()` calls and records whether `rpc()` is invoked.
 */
function makeUserClient() {
  const rpcSpy = vi.fn().mockResolvedValue({ data: "user-rpc-MUST-NOT-BE-CALLED", error: null });
  const fromSpy = vi.fn();
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.is = () => builder;
  builder.maybySingle = async () => ({ data: null, error: null });
  builder.maybeSingle = async () => ({ data: null, error: null });

  const client = {
    from: (table: string) => { fromSpy(table); return builder; },
    rpc: rpcSpy,
  };
  return { client: client as unknown as SupabaseClient, fromSpy, rpcSpy };
}

function makeAdminClient() {
  const rpcSpy = vi.fn().mockResolvedValue({ data: "admin-lock-uuid-00000000", error: null });
  const fromSpy = vi.fn();
  return {
    client: { from: fromSpy, rpc: rpcSpy } as unknown as SupabaseClient,
    rpcSpy,
    fromSpy,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("service role client isolation (Option B PF-2)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("T-1: RPC uses admin client, not user-scoped client", async () => {
    const { client: userClient, rpcSpy: userRpcSpy } = makeUserClient();
    const { client: adminClient, rpcSpy: adminRpcSpy } = makeAdminClient();
    vi.mocked(getSupabaseAdmin).mockReturnValue(adminClient);

    const result = await resolveArchetypeForUser(userClient, "user-t1-uuid", ELIGIBLE_INPUT);

    expect(result.ok).toBe(true);
    expect(adminRpcSpy).toHaveBeenCalledOnce();
    expect(adminRpcSpy).toHaveBeenCalledWith(
      "bty_create_archetype_lock",
      expect.objectContaining({ p_user_id: "user-t1-uuid" }),
    );
    expect(userRpcSpy).not.toHaveBeenCalled();
  });

  it("T-2: SELECT queries (findActiveLockByHash, findCurrentActiveLock) use user-scoped client only", async () => {
    const { client: userClient, fromSpy: userFromSpy } = makeUserClient();
    const { client: adminClient, fromSpy: adminFromSpy } = makeAdminClient();
    vi.mocked(getSupabaseAdmin).mockReturnValue(adminClient);

    await resolveArchetypeForUser(userClient, "user-t2-uuid", ELIGIBLE_INPUT);

    // All three SELECT calls (A0, loop-A, loop-B) must go through the user client.
    expect(userFromSpy).toHaveBeenCalled();
    expect(adminFromSpy).not.toHaveBeenCalled();
  });

  it("T-4: SelectorInvariantError (axis outside all thresholds) returns DB_ERROR — does not propagate throw", async () => {
    const BASELINE_AXIS = {
      ownership: 0.5, time: 0.5, authority: 0.5, truth: 0.5,
      repair: 0.5, conflict: 0.5, integrity: 0.5, visibility: 0.5,
      accountability: 0.5, courage: 0.5, control: 0.5, identity: 0.5,
    };
    const baselineInput: FingerprintInput = {
      axisVector: BASELINE_AXIS,
      patternFamilies: [],
      scenariosCompleted: 15,
      contractsCompleted: 4,
    };
    const { client: userClient } = makeUserClient();
    vi.mocked(getSupabaseAdmin).mockReturnValue(null); // step E must not be reached

    const result = await resolveArchetypeForUser(userClient, "user-t4-uuid", baselineInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DB_ERROR");
      expect(result.error).toMatch(/no rule matched axis vector/);
    }
    // Confirms SelectorInvariantError was caught before admin client was needed
    expect(vi.mocked(getSupabaseAdmin)).not.toHaveBeenCalled();
  });

  it("T-3: missing SUPABASE_SERVICE_ROLE_KEY returns DB_ERROR — no silent fallback to user client", async () => {
    const { client: userClient, rpcSpy: userRpcSpy } = makeUserClient();
    vi.mocked(getSupabaseAdmin).mockReturnValue(null);

    const result = await resolveArchetypeForUser(userClient, "user-t3-uuid", ELIGIBLE_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DB_ERROR");
      expect(result.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    }
    expect(userRpcSpy).not.toHaveBeenCalled();
  });
});
