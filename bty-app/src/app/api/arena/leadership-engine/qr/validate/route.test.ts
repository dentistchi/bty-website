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

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: adminFrom,
  })),
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
                  is: vi.fn().mockResolvedValue({ error: null }),
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

  it("finalizes submitted+validation_approved_at+verified_at=null contracts", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ error: null }),
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

  it("moves pending contract to submitted on commit token", async () => {
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
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; runtime_state: string };
    expect(data.status).toBe("submitted");
    expect(data.runtime_state).toBe("NEXT_SCENARIO_READY");
    expect((data as { gates?: { next_allowed?: boolean } }).gates?.next_allowed).toBe(true);
  });
});
