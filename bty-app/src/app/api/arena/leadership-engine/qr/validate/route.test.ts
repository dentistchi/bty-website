/**
 * POST /api/arena/leadership-engine/qr/validate — token-only verification (witness-safe).
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { signArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

const adminFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: adminFrom,
  })),
}));

describe("POST /api/arena/leadership-engine/qr/validate", () => {
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
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "c1",
                    user_id: "owner",
                    session_id: "run1",
                    status: "pending",
                    validation_approved_at: null,
                    verified_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
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
});
