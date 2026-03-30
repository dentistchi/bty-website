/**
 * POST /api/arena/leadership-engine/qr/validate — token-only verification (witness-safe).
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { signArenaActionLoopToken } from "@/lib/bty/leadership-engine/qr/arena-action-loop-token";

const adminFrom = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () =>
    ({
      from: adminFrom,
    }) as unknown as ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>,
}));

describe("POST /api/arena/leadership-engine/qr/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret-validate");
    adminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "c1", user_id: "owner", session_id: "run1", status: "pending" },
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
