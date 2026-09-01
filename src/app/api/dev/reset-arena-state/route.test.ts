import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockRequireUser = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase/route-client", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  requireConsentedUser: async (...args: unknown[]) => ({ ...(await mockRequireUser(...args)), consentDenied: null }),
  copyCookiesAndDebug: vi.fn(),
  unauthenticated: vi.fn(() => new Response(JSON.stringify({ ok: false, error: "UNAUTHENTICATED" }), { status: 401 })),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

function makeReq(body?: Record<string, unknown>) {
  return new Request("http://localhost/api/dev/reset-arena-state", {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/dev/reset-arena-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      base: new Response(),
    });
    process.env.BTY_ENV = "staging";
    // P0-R1: the guard no longer trusts BTY_ENV. Existing behaviour stays reachable exactly as the
    // boundary intends — an explicitly opted-in, explicitly NON-production project.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://disposabletestproject.supabase.co");
    vi.stubEnv("E2E_ALLOW_TEST_CLEANUP", "1");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("full reset deletes all selector history tables so next session starts at core_01", async () => {
    function makeDeleteChain(rows: unknown[]) {
      return {
        delete: () => ({ eq: () => ({ select: async () => ({ data: rows, error: null }) }) }),
      };
    }
    mockGetSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === "arena_runs") return makeDeleteChain([{ run_id: "r1" }, { run_id: "r2" }]);
        if (table === "user_scenario_history") return makeDeleteChain([{ user_id: "user-1" }]);
        if (table === "user_scenario_choice_history") return makeDeleteChain([{ id: "ch-1" }, { id: "ch-2" }]);
        if (table === "arena_events") return makeDeleteChain([{ id: "ev-1" }]);
        if (table === "bty_action_contracts") return makeDeleteChain([{ id: "ac-1" }]);
        if (table === "arena_pending_outcomes") return makeDeleteChain([{ id: "po-1" }]);
        if (table === "arena_no_change_risks") return makeDeleteChain([{ id: "rk-1" }]);
        throw new Error(`unexpected table ${table}`);
      },
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.ok).toBe(true);
    expect(json.mode).toBe("full");
    const reset = json.reset as Record<string, unknown>;
    expect(reset.deleted_runs).toBe(2);
    expect(reset.deleted_scenario_history_rows).toBe(1);
    expect(reset.deleted_choice_history_rows).toBe(2);
    expect(reset.deleted_arena_events).toBe(1);
    expect(reset.deleted_contracts).toBe(1);
    expect(reset.deleted_pending_outcomes).toBe(1);
    expect(reset.deleted_no_change_risks).toBe(1);
    expect((json.client as Record<string, unknown>).next_entry).toBe("core_01_training_system_exposure");
  });

  it("P0-R1: refuses on the PRODUCTION project before any database access, even with BTY_ENV=staging", async () => {
    // The exact live configuration measured during the P0 audit: BTY_ENV="staging" shipped in
    // wrangler.toml on the production Worker, an authenticated user, and the production database.
    vi.stubEnv("BTY_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://mveycersmqfiuddslnrj.supabase.co");
    vi.stubEnv("E2E_ALLOW_TEST_CLEANUP", "1");

    const res = await POST(makeReq({ mode: "full" }));

    expect(res.status).toBe(404);
    // The refusal must precede the database entirely: no admin client is even requested, so no
    // credential is used and no delete can have been issued.
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("soft_current abandons older IN_PROGRESS runs and removes orphan no_change pending", async () => {
    const inProgressSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { run_id: "newest", started_at: "2026-04-02T00:00:00.000Z" },
                { run_id: "older", started_at: "2026-04-01T00:00:00.000Z" },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    const abandonUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [{ run_id: "older" }], error: null }),
        }),
      }),
    });
    const orphanDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [{ id: "po-x" }], error: null }),
            }),
          }),
        }),
      }),
    });
    mockGetSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === "arena_runs") {
          return {
            select: inProgressSelect,
            update: abandonUpdate,
          };
        }
        if (table === "arena_pending_outcomes") {
          return { delete: orphanDelete };
        }
        throw new Error(`unexpected table ${table}`);
      },
    });

    const res = await POST(makeReq({ mode: "soft_current" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.ok).toBe(true);
    expect(json.mode).toBe("soft_current");
    const reset = json.reset as Record<string, unknown>;
    expect(reset.kept_in_progress_run_id).toBe("newest");
    expect(reset.abandoned_in_progress_runs).toBe(1);
    expect(reset.removed_orphan_pending_no_change_reexposure).toBe(1);
  });
});
