/**
 * POST /api/arena/leadership-engine/qr/validate — token-only verification (witness-safe).
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { signArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

vi.mock("@/lib/bty/action-contract/actionContractLifecycle.server", () => ({
  completeArenaRunAfterContractVerification: vi
    .fn()
    .mockResolvedValue({ runUpdated: true, deferredQueued: false }),
}));

const mockApplyArenaRunRewardsOnVerifiedCompletion = vi
  .fn()
  .mockResolvedValue({ ok: true, applied: true, coreXp: 12, weeklyXp: 8, deltaApplied: 8 });
const mockReflectContractVerificationToAir = vi
  .fn()
  .mockResolvedValue({ ok: true });
vi.mock("@/lib/bty/arena/reflectionRewards.server", () => ({
  applyArenaRunRewardsOnVerifiedCompletion: (...args: unknown[]) =>
    mockApplyArenaRunRewardsOnVerifiedCompletion(...args),
  reflectContractVerificationToAir: (...args: unknown[]) =>
    mockReflectContractVerificationToAir(...args),
}));

const adminFrom = vi.fn();

const adminRpc = vi
  .fn()
  .mockResolvedValue({ data: [{ applied: true, band_changed: false }], error: null });

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: adminFrom,
    rpc: adminRpc,
  })),
}));

// MVE-D2 Phase 1: optional scanner identity. Default = guest witness (no session).
const mockRequireUser = vi.fn().mockResolvedValue({ user: null });
vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  requireConsentedUser: async (...args: unknown[]) => ({ ...(await mockRequireUser(...args)), consentDenied: null }),
}));

describe("POST /api/arena/leadership-engine/qr/validate", () => {
  const contractRow = {
    id: "c1",
    user_id: "owner",
    session_id: "run1",
    status: "submitted",
    validation_approved_at: new Date().toISOString(),
    verified_at: null as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret-validate");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    const arenaLevelRow = {
      consecutive_verified_completions: 0,
      current_band: "easy",
      cooldown_until: null as string | null,
      last_band_change_at: null as string | null,
    };
    const levelMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValue({ data: arenaLevelRow, error: null });

    adminFrom.mockImplementation((table: string) => {
      if (table === "arena_level_records") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: levelMaybeSingle,
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "arena_runs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { user_id: "owner" },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: contractRow,
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
              in: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({ data: [{ id: "c1" }], error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function req(body: unknown) {
    return new NextRequest("http://localhost/api/arena/leadership-engine/qr/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("401 when token invalid", async () => {
    const res = await POST(req({ arenaActionLoopToken: "nope" }));
    expect(res.status).toBe(401);
  });

  it("500 server_config_error when Supabase URL/key missing (contract update path)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const res = await POST(req({ arenaActionLoopToken: token }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("server_config_error");
  });

  it("422 when token payload is missing contractId", async () => {
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
    });
    const res = await POST(req({ arenaActionLoopToken: token }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("missing_contract_id");
  });

  it("409 run_actor_token_mismatch when token userId !== arena_runs.user_id", async () => {
    adminFrom.mockImplementation((table: string) => {
      if (table === "arena_level_records") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "arena_runs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { user_id: "real-owner" },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const res = await POST(req({ arenaActionLoopToken: token }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("run_actor_token_mismatch");
  });

  it("200 ok uses token userId for DB — does not require session user (no requireUser)", async () => {
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const res = await POST(req({ arenaActionLoopToken: token, clientScanAtIso: new Date().toISOString() }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; userId: string };
    expect(data.ok).toBe(true);
    expect(data.userId).toBe("owner");
  });

  it("409 self_witness_blocked when an authenticated scanner IS the actor", async () => {
    // Ruling 1: a logged-in session that matches the actor (token.userId) cannot self-witness.
    mockRequireUser.mockResolvedValueOnce({ user: { id: "owner" } });
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const res = await POST(req({ arenaActionLoopToken: token }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("self_witness_blocked");
  });

  it("allows a different authenticated witness (scanner !== actor) — guest-equivalent path", async () => {
    mockRequireUser.mockResolvedValueOnce({ user: { id: "some-other-member" } });
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const res = await POST(req({ arenaActionLoopToken: token }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("finalizes submitted+validation_approved_at+verified_at=null contracts", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [{ id: "c1" }], error: null }),
              }),
            }),
          }),
        }),
      }),
    });
    adminFrom.mockImplementation((table: string) => {
      if (table === "arena_level_records") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "arena_runs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: "owner" }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === "bty_action_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    ...contractRow,
                    status: "submitted",
                    validation_approved_at: new Date().toISOString(),
                    verified_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const res = await POST(req({ arenaActionLoopToken: token }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        verified_at: expect.any(String),
        completed_at: expect.any(String),
      }),
    );
    expect(mockApplyArenaRunRewardsOnVerifiedCompletion).toHaveBeenCalledTimes(1);
    expect(mockReflectContractVerificationToAir).toHaveBeenCalledTimes(1);
  });

  it("zero-row CAS (lost the race) → no completion effects, 409 already resolved (Refinement 5A)", async () => {
    // The read passes awaitingVerification, but the CAS updates ZERO rows because a
    // concurrent verifier (e.g. Host Approve) already flipped verified_at. Absence of an
    // update error is NOT proof a row changed — Level/XP/AIR must NOT run.
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    });
    adminFrom.mockImplementation((table: string) => {
      if (table === "arena_runs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: "owner" }, error: null }),
            }),
          }),
        };
      }
      if (table === "bty_action_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    ...contractRow,
                    status: "submitted",
                    validation_approved_at: new Date().toISOString(),
                    verified_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const res = await POST(req({ arenaActionLoopToken: token }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("contract_already_resolved");
    expect(mockApplyArenaRunRewardsOnVerifiedCompletion).not.toHaveBeenCalled();
    expect(mockReflectContractVerificationToAir).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("refuses a pending (unvalidated) contract — QR scan does not complete the action", async () => {
    adminFrom.mockImplementation((table: string) => {
      if (table === "arena_runs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: "owner" }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === "bty_action_contracts") {
        const update = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "c1",
                      status: "submitted",
                      submitted_at: new Date().toISOString(),
                      verified_at: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    ...contractRow,
                    status: "pending",
                    validation_approved_at: null,
                    verified_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });
    const token = signArenaActionLoopToken({
      sessionId: "run1",
      userId: "owner",
      actionId: "arena_action_loop:run1",
      issuedAt: Date.now(),
      contractId: "c1",
    });
    const res = await POST(req({ arenaActionLoopToken: token }));
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string; runtime_state: string };
    expect(data.error).toBe("action_validation_required");
    expect(data.runtime_state).toBe("ACTION_REQUIRED");
  });
});
